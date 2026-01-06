// lib/data/DataCache.ts - 통합 데이터 캐시 관리
// LRU 캐시와 전체 데이터 캐시를 단일 클래스로 통합

import { LRUCache } from '@/lib/utils/cache';
import { logger } from '@/lib/utils/logger';
import { getDataUrl } from './dataUrl';
import type {
    Factory,
    KnowledgeIndustryCenter,
    IndustrialComplex,
    IndustrialComplexDetail,
    IndustrialLot,
    IndustryType,
} from '@/types/data';

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (error) {
        logger.error(`[DataCache] ${url} 로드 실패:`, error);
        return fallback;
    }
}

/**
 * 통합 데이터 캐시 (Singleton)
 * - 전체 데이터 캐시: 초기 로드 후 메모리에 유지
 * - LRU 캐시: 상세 정보 캐싱 (메모리 제한)
 */
class DataCache {
    private static instance: DataCache;

    // === 전체 데이터 캐시 (lazy load) ===
    private factories: Factory[] | null = null;
    private knowledgeCenters: KnowledgeIndustryCenter[] | null = null;
    private complexes: IndustrialComplex[] | null = null;
    private lots: IndustrialLot[] | null = null;
    private industries: IndustryType[] | null = null;

    // === LRU 캐시 (상세 정보) ===
    private factoryDetailCache = new LRUCache<Factory>(100);
    private knowledgeCenterDetailCache = new LRUCache<KnowledgeIndustryCenter>(50);
    private complexDetailCache = new LRUCache<IndustrialComplexDetail>(20);

    // === 로딩 상태 (중복 요청 방지) ===
    private loadingPromises: Map<string, Promise<unknown>> = new Map();

    private constructor() {}

    static getInstance(): DataCache {
        if (!DataCache.instance) {
            DataCache.instance = new DataCache();
        }
        return DataCache.instance;
    }

    /**
     * 전체 데이터 로드 (중복 요청 방지)
     */
    private async loadFullData<T>(
        key: string,
        url: string,
        fallback: T
    ): Promise<T> {
        // 이미 로딩 중이면 기존 Promise 반환
        const existing = this.loadingPromises.get(key);
        if (existing) {
            return existing as Promise<T>;
        }

        const promise = safeFetch<T>(getDataUrl(url), fallback);
        this.loadingPromises.set(key, promise);

        try {
            const result = await promise;
            return result;
        } finally {
            this.loadingPromises.delete(key);
        }
    }

    // === 공장 ===

    async getFactoryDetail(id: string): Promise<Factory | null> {
        // LRU 캐시 확인
        const cached = this.factoryDetailCache.get(id);
        if (cached) return cached;

        // 전체 데이터 로드 (새 경로: /data/entities/)
        if (!this.factories) {
            this.factories = await this.loadFullData<Factory[]>(
                'factories',
                '/data/entities/factories.json',
                []
            );
        }

        const factory = this.factories.find(f => f.id === id);
        if (factory) {
            this.factoryDetailCache.set(id, factory);
        }
        return factory || null;
    }

    // === 지식산업센터 ===

    async getKnowledgeCenterDetail(id: string): Promise<KnowledgeIndustryCenter | null> {
        // LRU 캐시 확인
        const cached = this.knowledgeCenterDetailCache.get(id);
        if (cached) return cached;

        // 전체 데이터 로드 (새 경로: /data/entities/)
        if (!this.knowledgeCenters) {
            this.knowledgeCenters = await this.loadFullData<KnowledgeIndustryCenter[]>(
                'knowledge-centers',
                '/data/entities/knowledge-centers.json',
                []
            );
        }

        const kc = this.knowledgeCenters.find(k => k.id === id);
        if (kc) {
            this.knowledgeCenterDetailCache.set(id, kc);
        }
        return kc || null;
    }

    // === 산업단지 ===

    async getIndustrialComplexDetail(id: string): Promise<IndustrialComplexDetail | null> {
        // LRU 캐시 확인
        const cached = this.complexDetailCache.get(id);
        if (cached) return cached;

        // 전체 데이터 병렬 로드 (새 경로: /data/entities/)
        const [complexData, lotsData, industriesData] = await Promise.all([
            this.complexes
                ? Promise.resolve(this.complexes)
                : this.loadFullData<IndustrialComplex[]>('complexes', '/data/entities/complexes.json', []),
            this.lots
                ? Promise.resolve(this.lots)
                : this.loadFullData<IndustrialLot[]>('lots', '/data/entities/lots.json', []),
            this.industries
                ? Promise.resolve(this.industries)
                : this.loadFullData<IndustryType[]>('industries', '/data/entities/industries.json', []),
        ]);

        // 캐시 업데이트
        if (!this.complexes) this.complexes = complexData;
        if (!this.lots) this.lots = lotsData;
        if (!this.industries) this.industries = industriesData;

        const complex = this.complexes.find(c => c.id === id);
        if (!complex) {
            logger.warn(`[DataCache] 산업단지 ${id} 찾을 수 없음`);
            return null;
        }

        const detail: IndustrialComplexDetail = {
            ...complex,
            lots: this.lots.filter(l => l.complexId === id),
            industries: this.industries.filter(i => i.complexId === id),
        };

        this.complexDetailCache.set(id, detail);
        return detail;
    }

    // === 캐시 관리 ===

    /**
     * 모든 캐시 초기화
     */
    clear(): void {
        this.factories = null;
        this.knowledgeCenters = null;
        this.complexes = null;
        this.lots = null;
        this.industries = null;

        this.factoryDetailCache.clear();
        this.knowledgeCenterDetailCache.clear();
        this.complexDetailCache.clear();

        this.loadingPromises.clear();

        logger.log('[DataCache] 모든 캐시 초기화됨');
    }

    /**
     * 캐시 상태 로깅
     */
    logStats(): void {
        logger.log(`[DataCache] 전체 데이터:`, {
            factories: this.factories?.length ?? 'not loaded',
            knowledgeCenters: this.knowledgeCenters?.length ?? 'not loaded',
            complexes: this.complexes?.length ?? 'not loaded',
            lots: this.lots?.length ?? 'not loaded',
            industries: this.industries?.length ?? 'not loaded',
        });
        logger.log(`[DataCache] LRU 캐시:`, {
            factoryDetails: this.factoryDetailCache.size,
            kcDetails: this.knowledgeCenterDetailCache.size,
            complexDetails: this.complexDetailCache.size,
        });
    }
}

// 싱글톤 인스턴스 export
export const dataCache = DataCache.getInstance();

// 편의 함수 export
export const getFactoryDetail = (id: string) => dataCache.getFactoryDetail(id);
export const getKnowledgeCenterDetail = (id: string) => dataCache.getKnowledgeCenterDetail(id);
export const getIndustrialComplexDetail = (id: string) => dataCache.getIndustrialComplexDetail(id);
export const clearDataCache = () => dataCache.clear();
