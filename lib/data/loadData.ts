// lib/data/loadData.ts
// 데이터 로딩 유틸리티 - Single Source of Truth
//
// 데이터 구조:
// - /data/geometry/*.pmtiles  : 폴리곤 geometry (불변)
// - /data/entities/*.json     : 비즈니스 데이터

import { getDataUrl } from './dataUrl';
import type {
    ParcelMarkerData,
    ParcelDetail,
    District,
    IndustrialComplex,
    IndustrialComplexDetail,
    KnowledgeCenterIndex,
    KnowledgeIndustryCenter,
    FactoryIndex,
    Factory,
} from '@/types/data';
import { useDataStore } from '@/lib/stores/data-store';
import { logger } from '@/lib/utils/logger';
import { dataCache } from './DataCache';

/**
 * 개별 fetch 래퍼 (에러 처리 포함)
 */
async function safeFetch<T>(url: string, fallback: T): Promise<T> {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (error) {
        logger.error(`[loadData] ${url} 로드 실패:`, error);
        return fallback;
    }
}

/**
 * 모든 초기 데이터 로드 (Promise.allSettled로 부분 실패 허용)
 */
export async function loadAllData(): Promise<{
    parcels: ParcelMarkerData[];
    districts: District[];
    industrialComplexes: IndustrialComplex[];
    knowledgeCenters: KnowledgeCenterIndex[];
    factories: FactoryIndex[];
}> {
    // Promise.allSettled로 부분 실패 허용
    // 새 경로: /data/entities/*.json (Single Source of Truth)
    const results = await Promise.allSettled([
        safeFetch<ParcelMarkerData[]>(getDataUrl('/data/entities/parcels.json'), []),
        safeFetch<District[]>(getDataUrl('/data/entities/districts-emd.json'), []),
        safeFetch<District[]>(getDataUrl('/data/entities/districts-sig.json'), []),
        safeFetch<District[]>(getDataUrl('/data/entities/districts-sido.json'), []),
        safeFetch<IndustrialComplex[]>(getDataUrl('/data/entities/complexes.json'), []),
        safeFetch<KnowledgeCenterIndex[]>(getDataUrl('/data/entities/knowledge-centers-index.json'), []),
        safeFetch<FactoryIndex[]>(getDataUrl('/data/entities/factories-index.json'), []),
    ]);

    // 결과 추출 (실패 시 빈 배열)
    const getValue = <T>(result: PromiseSettledResult<T>, fallback: T): T => {
        return result.status === 'fulfilled' ? result.value : fallback;
    };

    const parcels = getValue(results[0], []);
    const districtsEmd = getValue(results[1], []);
    const districtsSig = getValue(results[2], []);
    const districtsSido = getValue(results[3], []);
    const complexes = getValue(results[4], []);
    const knowledgeCenters = getValue(results[5], []);
    const factories = getValue(results[6], []);

    // 실패한 요청 로깅
    const failedCount = results.filter(r => r.status === 'rejected').length;
    if (failedCount > 0) {
        logger.warn(`[loadData] ${failedCount}개 데이터 로드 실패`);
    }

    // level 속성 추가
    const districtsWithLevel: District[] = [
        ...districtsSido.map(d => ({ ...d, level: 'sido' as const })),
        ...districtsSig.map(d => ({ ...d, level: 'sig' as const })),
        ...districtsEmd.map(d => ({ ...d, level: 'emd' as const })),
    ];

    return {
        parcels,
        districts: districtsWithLevel,
        industrialComplexes: complexes,
        knowledgeCenters,
        factories,
    };
}

/**
 * 필지 상세 정보 로드 (스토어에서 조회 - 중복 fetch 방지)
 */
export async function loadParcelDetail(pnu: string): Promise<ParcelDetail | null> {
    try {
        // 스토어에서 먼저 조회 (이미 로드된 데이터 활용)
        const parcel = useDataStore.getState().getParcelById(pnu);

        if (!parcel) {
            logger.warn(`[loadParcelDetail] PNU ${pnu} 찾을 수 없음`);
            return null;
        }

        // ParcelMarkerData를 ParcelDetail로 확장
        const detail: ParcelDetail = {
            ...parcel,
            pnu: parcel.pnu,  // 새 필드명 사용
            jibun: parcel.jibun || '',
            address: parcel.jibun || '',
            transactions: parcel.transactions?.map(t => ({
                date: t.date,
                price: t.price,
            })) || [],
            listings: [],
            auctions: [],
        };

        return detail;
    } catch (error) {
        logger.error(`[loadParcelDetail] ${pnu} 로드 실패:`, error);
        return null;
    }
}

/**
 * 공장 상세 정보 로드 (DataCache 위임)
 */
export async function loadFactoryDetail(id: string): Promise<Factory | null> {
    return dataCache.getFactoryDetail(id);
}

/**
 * 지식산업센터 상세 정보 로드 (DataCache 위임)
 */
export async function loadKnowledgeCenterDetail(id: string): Promise<KnowledgeIndustryCenter | null> {
    return dataCache.getKnowledgeCenterDetail(id);
}

/**
 * 공장 목록 로드 (인덱스)
 */
export async function loadFactories(): Promise<FactoryIndex[]> {
    return safeFetch<FactoryIndex[]>(getDataUrl('/data/entities/factories-index.json'), []);
}

/**
 * 지식산업센터 목록 로드 (인덱스)
 */
export async function loadKnowledgeCenters(): Promise<KnowledgeCenterIndex[]> {
    return safeFetch<KnowledgeCenterIndex[]>(getDataUrl('/data/entities/knowledge-centers-index.json'), []);
}

/**
 * 산업단지 상세 정보 로드 (DataCache 위임, 포커스 모드용)
 */
export async function loadIndustrialComplexDetail(id: string): Promise<IndustrialComplexDetail | null> {
    return dataCache.getIndustrialComplexDetail(id);
}

/**
 * 모든 캐시 초기화 (메모리 정리용)
 */
export function clearAllCache(): void {
    dataCache.clear();
}
