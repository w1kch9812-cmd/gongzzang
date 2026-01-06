// lib/utils/dataHelpers.ts - 데이터 처리 유틸리티 (중앙 집중)

import type { Coordinate, ParcelMarkerData } from '@/types/data';
import type { DataTypeFilter } from '@/lib/stores/types';
import { logger } from './logger';

// ===== 타입 가드 =====

/** 배열 타입 체크 */
function isArrayLike(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

/** 객체 타입 체크 */
function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ===== 좌표 변환 헬퍼 (Single Source of Truth) =====

/** 다양한 좌표 형식을 [lng, lat] 배열로 통일 */
export function normalizeCoordinate(data: unknown): Coordinate {
    if (!isObject(data)) {
        logger.warn('좌표 데이터가 객체가 아님:', data);
        return [0, 0];
    }

    // 배열 형식: [lng, lat]
    if (isArrayLike(data.coordinates) && data.coordinates.length >= 2) {
        return data.coordinates as Coordinate;
    }
    if (isArrayLike(data.coord) && data.coord.length >= 2) {
        return data.coord as Coordinate;
    }

    // 객체 형식: { lng, lat }
    if (isObject(data.centroid)) {
        const { lng, lat } = data.centroid;
        if (typeof lng === 'number' && typeof lat === 'number') {
            return [lng, lat];
        }
    }
    if (isObject(data.center)) {
        const { lng, lat } = data.center;
        if (typeof lng === 'number' && typeof lat === 'number') {
            return [lng, lat];
        }
    }

    // 개별 필드
    const { lng, lat, longitude, latitude } = data;
    if (typeof lng === 'number' && typeof lat === 'number') {
        return [lng, lat];
    }
    if (typeof longitude === 'number' && typeof latitude === 'number') {
        return [longitude, latitude];
    }

    logger.warn('좌표 형식을 인식할 수 없음:', data);
    return [0, 0];
}

// ===== fetch 래퍼 (에러 처리 중앙화) =====

interface FetchOptions<T> {
    url: string;
    errorMessage: string;
    transform?: (data: unknown) => T;
    fallback: T;
    noCache?: boolean;  // 캐시 무시 옵션
}

/** 데이터 fetch + 에러 처리 통합 */
export async function fetchData<T>({
    url,
    errorMessage,
    transform,
    fallback,
    noCache = false,
}: FetchOptions<T>): Promise<T> {
    try {
        // 캐시 무시 시 타임스탬프 추가
        const fetchUrl = noCache ? `${url}?_t=${Date.now()}` : url;
        const response = await fetch(fetchUrl, noCache ? { cache: 'no-store' } : undefined);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data: unknown = await response.json();
        return transform ? transform(data) : (data as T);
    } catch (error) {
        logger.error(`${errorMessage}:`, error);
        return fallback;
    }
}

// ===== 타입 플래그 계산 =====

/** 필지 타입 플래그 계산 (1=실거래, 2=매물, 4=경매) */
export function calculateParcelType(parcel: {
    transactionPrice?: number;
    listingPrice?: number;
    auctionPrice?: number;
}): number {
    let type = 0;
    if (parcel.transactionPrice) type |= 1;
    if (parcel.listingPrice) type |= 2;
    if (parcel.auctionPrice) type |= 4;
    return type;
}

/** 필지 타입 플래그 체크 */
export function hasTransactionPrice(type: number): boolean {
    return (type & 1) !== 0;
}

export function hasListingPrice(type: number): boolean {
    return (type & 2) !== 0;
}

export function hasAuctionPrice(type: number): boolean {
    return (type & 4) !== 0;
}

// ===== 필터링 헬퍼 (Single Source of Truth) =====

/** 데이터 유형별 필지 필터링 */
export function filterParcelsByDataType(
    parcels: ParcelMarkerData[],
    dataType: DataTypeFilter
): ParcelMarkerData[] {
    if (dataType === 'all') return parcels;

    return parcels.filter((parcel) => {
        switch (dataType) {
            case 'transaction':
                return hasTransactionPrice(parcel.type);
            case 'listing':
                return hasListingPrice(parcel.type);
            case 'auction':
                return hasAuctionPrice(parcel.type);
            default:
                return true;
        }
    });
}

/** 필지에서 가격 배열 추출 */
export function extractPrices(
    parcel: ParcelMarkerData,
    types: ('transaction' | 'listing' | 'auction')[] = ['transaction', 'listing', 'auction']
): number[] {
    const prices: number[] = [];

    if (types.includes('transaction') && parcel.transactionPrice && parcel.transactionPrice > 0) {
        prices.push(parcel.transactionPrice);
    }
    if (types.includes('listing') && parcel.listingPrice && parcel.listingPrice > 0) {
        prices.push(parcel.listingPrice);
    }
    if (types.includes('auction') && parcel.auctionPrice && parcel.auctionPrice > 0) {
        prices.push(parcel.auctionPrice);
    }

    return prices;
}

/** 가격 범위 내 여부 확인 */
export function isInPriceRange(
    parcel: ParcelMarkerData,
    minPrice: number | null,
    maxPrice: number | null,
    types?: ('transaction' | 'listing' | 'auction')[]
): boolean {
    const prices = extractPrices(parcel, types);
    if (prices.length === 0) return true;

    const maxVal = Math.max(...prices);
    const minVal = Math.min(...prices);

    if (minPrice !== null && maxVal < minPrice) return false;
    if (maxPrice !== null && minVal > maxPrice) return false;

    return true;
}

/** 매물 필지 필터 */
export function getListings(parcels: ParcelMarkerData[]): ParcelMarkerData[] {
    return parcels.filter((p) => hasListingPrice(p.type));
}

/** 경매 필지 필터 */
export function getAuctions(parcels: ParcelMarkerData[]): ParcelMarkerData[] {
    return parcels.filter((p) => hasAuctionPrice(p.type));
}

/** 실거래 필지 필터 */
export function getTransactions(parcels: ParcelMarkerData[]): ParcelMarkerData[] {
    return parcels.filter((p) => hasTransactionPrice(p.type));
}

// ===== 산업단지 타입 변환 =====

/** 산업단지 타입 코드 → 이름 매핑 */
export const COMPLEX_TYPE_MAP: Record<string, string> = {
    '1': '국가',
    '2': '일반',
    '3': '농공',
    '4': '도시첨단',
};

/** 산업단지 타입 이름 → 코드 매핑 (역변환) */
export const COMPLEX_TYPE_REVERSE_MAP: Record<string, string> = {
    '국가': '1',
    '일반': '2',
    '농공': '3',
    '도시첨단': '4',
};

/** 산업단지 타입 코드를 이름으로 변환 */
export function getComplexTypeName(typeCode: string | undefined): string {
    if (!typeCode) return '기타';
    return COMPLEX_TYPE_MAP[typeCode] || typeCode;
}

/** 산업단지 타입 이름을 코드로 변환 */
export function getComplexTypeCode(typeName: string | undefined): string {
    if (!typeName) return '';
    return COMPLEX_TYPE_REVERSE_MAP[typeName] || typeName;
}

/** 산업단지 타입별 색상 */
export const COMPLEX_TYPE_COLORS: Record<string, string> = {
    '1': '#ef4444', // 국가 - 빨강
    '2': '#3b82f6', // 일반 - 파랑
    '3': '#22c55e', // 농공 - 초록
    '4': '#a855f7', // 도시첨단 - 보라
};

/** 산업단지 타입 코드로 색상 가져오기 */
export function getComplexTypeColor(typeCode: string | undefined): string {
    if (!typeCode) return '#6b7280'; // 기본 회색
    return COMPLEX_TYPE_COLORS[typeCode] || '#6b7280';
}

// ===== 로깅 헬퍼 =====

/** 데이터 로딩 시작 로그 */
export function logLoadStart(name: string): number {
    logger.log(`📦 ${name} 로딩 시작...`);
    return performance.now();
}

/** 데이터 로딩 완료 로그 */
export function logLoadComplete(name: string, count: number, startTime: number): void {
    const elapsed = performance.now() - startTime;
    logger.log(`✅ ${name} 로딩 완료: ${count}개 (${elapsed.toFixed(0)}ms)`);
}
