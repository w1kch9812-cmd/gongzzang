// lib/utils/statsHelpers.ts - 통계 계산 유틸리티 함수

import type { ParcelMarkerData, District, IndustrialComplex, FactoryIndex } from '@/types/data';

// ===== 타입 정의 =====

/** 가격 추이 데이터 (시계열) */
export interface PriceTrend {
    /** 날짜 (YYYY-MM) */
    date: string;
    /** 평균 실거래가 (만원) */
    avgPrice: number;
    /** 거래 건수 */
    count: number;
    /** 최저가 (만원) */
    minPrice: number;
    /** 최고가 (만원) */
    maxPrice: number;
}

/** 행정구역별 통계 */
export interface RegionStats {
    /** 행정구역 코드 */
    code: string;
    /** 행정구역 이름 */
    name: string;
    /** 평균 실거래가 (만원) */
    avgPrice: number;
    /** 거래 건수 */
    count: number;
    /** 매물 수 */
    listingCount: number;
    /** 경매 수 */
    auctionCount: number;
}

/** 산업 분포 데이터 */
export interface IndustryDistribution {
    /** 업종명 */
    industry: string;
    /** 개수 */
    count: number;
    /** 비율 (%) */
    percentage: number;
}

/** 매물 현황 데이터 */
export interface MarketStatus {
    /** 총 매물 수 */
    totalListings: number;
    /** 총 경매 수 */
    totalAuctions: number;
    /** 평균 매물가 (만원) */
    avgListingPrice: number;
    /** 평균 경매가 (만원) */
    avgAuctionPrice: number;
    /** 거래 유형별 분포 */
    dealTypeDistribution: { type: string; count: number }[];
}

/** 가격 분포 데이터 */
export interface PriceDistribution {
    /** 가격 범위 (예: "0-1억") */
    range: string;
    /** 개수 */
    count: number;
}

// ===== 가격 분석 =====

/**
 * 가격 추이 계산 (Mock 데이터 기반, 실제 데이터 연동 시 수정 필요)
 * @param parcels 필지 데이터
 * @param months 최근 N개월
 */
export function calculatePriceTrend(
    parcels: ParcelMarkerData[],
    months: number = 12
): PriceTrend[] {
    // 현재는 Mock 데이터이므로 더미 데이터 생성
    const trends: PriceTrend[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        // 실제로는 transactionDate 필드로 필터링해야 함
        const transactionParcels = parcels.filter(p => p.transactionPrice);
        const count = Math.floor(transactionParcels.length / months * (0.8 + Math.random() * 0.4));

        if (transactionParcels.length > 0) {
            const prices = transactionParcels.map(p => p.transactionPrice!).filter(Boolean);
            const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);

            trends.push({
                date: dateStr,
                avgPrice: Math.round(avgPrice),
                count,
                minPrice,
                maxPrice,
            });
        }
    }

    return trends;
}

/**
 * 행정구역별 통계 계산
 * @param parcels 필지 데이터
 * @param districts 행정구역 데이터
 * @param level 행정구역 레벨 ('sig' | 'emd')
 */
export function calculateRegionStats(
    parcels: ParcelMarkerData[],
    districts: District[],
    level: 'sig' | 'emd' = 'sig'
): RegionStats[] {
    const stats = new Map<string, {
        name: string;
        prices: number[];
        listingCount: number;
        auctionCount: number;
    }>();

    // 행정구역별 집계
    for (const parcel of parcels) {
        const code = level === 'sig' ? parcel.sigCode : parcel.emdCode;
        if (!code) continue;

        if (!stats.has(code)) {
            const district = districts.find(d => d.code === code || d.id === code);
            stats.set(code, {
                name: district?.name || code,
                prices: [],
                listingCount: 0,
                auctionCount: 0,
            });
        }

        const stat = stats.get(code)!;

        if (parcel.transactionPrice) {
            stat.prices.push(parcel.transactionPrice);
        }
        if (parcel.listingPrice) {
            stat.listingCount++;
        }
        if (parcel.auctionPrice) {
            stat.auctionCount++;
        }
    }

    // 평균 계산
    const result: RegionStats[] = [];
    stats.forEach((stat, code) => {
        const avgPrice = stat.prices.length > 0
            ? Math.round(stat.prices.reduce((sum, p) => sum + p, 0) / stat.prices.length)
            : 0;

        result.push({
            code,
            name: stat.name,
            avgPrice,
            count: stat.prices.length,
            listingCount: stat.listingCount,
            auctionCount: stat.auctionCount,
        });
    });

    // 가격 내림차순 정렬
    return result.sort((a, b) => b.avgPrice - a.avgPrice);
}

/**
 * 가격 분포 계산
 * @param parcels 필지 데이터
 * @param priceField 가격 필드 ('transactionPrice' | 'listingPrice' | 'auctionPrice')
 */
export function calculatePriceDistribution(
    parcels: ParcelMarkerData[],
    priceField: 'transactionPrice' | 'listingPrice' | 'auctionPrice' = 'transactionPrice'
): PriceDistribution[] {
    const prices = parcels
        .map(p => p[priceField])
        .filter((p): p is number => p !== undefined && p !== null && p > 0);

    if (prices.length === 0) {
        return [];
    }

    // 가격 범위 정의 (만원 단위)
    const ranges = [
        { label: '1억 미만', min: 0, max: 10000 },
        { label: '1-3억', min: 10000, max: 30000 },
        { label: '3-5억', min: 30000, max: 50000 },
        { label: '5-10억', min: 50000, max: 100000 },
        { label: '10-20억', min: 100000, max: 200000 },
        { label: '20억 이상', min: 200000, max: Infinity },
    ];

    const distribution = ranges.map(range => ({
        range: range.label,
        count: prices.filter(p => p >= range.min && p < range.max).length,
    }));

    return distribution.filter(d => d.count > 0);
}

// ===== 산업 분석 =====

/**
 * 업종별 분포 계산 (공장 데이터 기반)
 * @param factories 공장 데이터
 */
export function calculateIndustryDistribution(
    factories: FactoryIndex[]
): IndustryDistribution[] {
    const industryCount = new Map<string, number>();

    for (const factory of factories) {
        const industry = factory.businessType || '기타';
        industryCount.set(industry, (industryCount.get(industry) || 0) + 1);
    }

    const total = factories.length;
    const distribution: IndustryDistribution[] = [];

    industryCount.forEach((count, industry) => {
        distribution.push({
            industry,
            count,
            percentage: Math.round((count / total) * 1000) / 10, // 소수점 1자리
        });
    });

    // 개수 내림차순 정렬
    return distribution.sort((a, b) => b.count - a.count);
}

/**
 * 산업단지별 업종 분포
 * @param factories 공장 데이터
 * @param complexId 산업단지 ID
 */
export function calculateComplexIndustryDistribution(
    factories: FactoryIndex[],
    complexId: string
): IndustryDistribution[] {
    // TODO: 공장-산업단지 매핑 데이터 필요
    // 현재는 전체 데이터 반환 (임시)
    return calculateIndustryDistribution(factories);
}

// ===== 매물 분석 =====

/**
 * 매물 현황 계산
 * @param parcels 필지 데이터
 */
export function calculateMarketStatus(parcels: ParcelMarkerData[]): MarketStatus {
    const listings = parcels.filter(p => p.listingPrice);
    const auctions = parcels.filter(p => p.auctionPrice);

    const avgListingPrice = listings.length > 0
        ? Math.round(listings.reduce((sum, p) => sum + (p.listingPrice || 0), 0) / listings.length)
        : 0;

    const avgAuctionPrice = auctions.length > 0
        ? Math.round(auctions.reduce((sum, p) => sum + (p.auctionPrice || 0), 0) / auctions.length)
        : 0;

    // 거래 유형별 분포
    const dealTypeCounts = new Map<string, number>();
    for (const parcel of listings) {
        const dealType = parcel.dealType || '매매';
        dealTypeCounts.set(dealType, (dealTypeCounts.get(dealType) || 0) + 1);
    }

    const dealTypeDistribution = Array.from(dealTypeCounts.entries()).map(([type, count]) => ({
        type,
        count,
    }));

    return {
        totalListings: listings.length,
        totalAuctions: auctions.length,
        avgListingPrice,
        avgAuctionPrice,
        dealTypeDistribution,
    };
}

/**
 * 경매 통계 계산
 * @param parcels 필지 데이터
 */
export function calculateAuctionStats(parcels: ParcelMarkerData[]) {
    const auctions = parcels.filter(p => p.auctionPrice);

    if (auctions.length === 0) {
        return {
            total: 0,
            avgPrice: 0,
            avgFailCount: 0,
            failCountDistribution: [] as { failCount: number; count: number }[],
        };
    }

    const avgPrice = Math.round(
        auctions.reduce((sum, p) => sum + (p.auctionPrice || 0), 0) / auctions.length
    );

    const avgFailCount = auctions.reduce((sum, p) => sum + (p.auctionFailCount || 0), 0) / auctions.length;

    // 유찰 횟수 분포
    const failCounts = new Map<number, number>();
    for (const auction of auctions) {
        const failCount = auction.auctionFailCount || 0;
        failCounts.set(failCount, (failCounts.get(failCount) || 0) + 1);
    }

    const failCountDistribution = Array.from(failCounts.entries())
        .map(([failCount, count]) => ({ failCount, count }))
        .sort((a, b) => a.failCount - b.failCount);

    return {
        total: auctions.length,
        avgPrice,
        avgFailCount: Math.round(avgFailCount * 10) / 10,
        failCountDistribution,
    };
}

// ===== 면적 분석 =====

/**
 * 면적 분포 계산
 * @param parcels 필지 데이터
 */
export function calculateAreaDistribution(parcels: ParcelMarkerData[]): PriceDistribution[] {
    const areas = parcels.map(p => p.area).filter(Boolean);

    if (areas.length === 0) {
        return [];
    }

    // 면적 범위 정의 (㎡ 단위)
    const ranges = [
        { label: '100평 미만', min: 0, max: 330 },
        { label: '100-300평', min: 330, max: 990 },
        { label: '300-500평', min: 990, max: 1650 },
        { label: '500-1000평', min: 1650, max: 3300 },
        { label: '1000-3000평', min: 3300, max: 9900 },
        { label: '3000평 이상', min: 9900, max: Infinity },
    ];

    const distribution = ranges.map(range => ({
        range: range.label,
        count: areas.filter(a => a >= range.min && a < range.max).length,
    }));

    return distribution.filter(d => d.count > 0);
}

// ===== 복합 분석 =====

/**
 * Top N 통계 계산
 * @param items 항목 배열
 * @param keyFn 키 추출 함수
 * @param limit 상위 N개
 */
export function calculateTopN<T>(
    items: T[],
    keyFn: (item: T) => string,
    limit: number = 10
): { key: string; count: number }[] {
    const counts = new Map<string, number>();

    for (const item of items) {
        const key = keyFn(item);
        counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

/**
 * 평균/중앙값/표준편차 계산
 */
export function calculateBasicStats(values: number[]) {
    if (values.length === 0) {
        return { avg: 0, median: 0, stdDev: 0, min: 0, max: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
        avg: Math.round(avg),
        median,
        stdDev: Math.round(stdDev),
        min: sorted[0],
        max: sorted[sorted.length - 1],
    };
}
