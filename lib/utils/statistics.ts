// lib/utils/statistics.ts
// 통계 계산 유틸리티 함수

export interface Statistics {
    avg: number;
    min: number;
    max: number;
    median: number;
    count: number;
    stdDev: number;
}

/**
 * 숫자 배열의 통계 계산
 */
export function calculateStatistics(values: number[]): Statistics {
    if (values.length === 0) {
        return { avg: 0, min: 0, max: 0, median: 0, count: 0, stdDev: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const median = values.length % 2 === 0
        ? (sorted[values.length / 2 - 1] + sorted[values.length / 2]) / 2
        : sorted[Math.floor(values.length / 2)];

    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
        avg,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median,
        count: values.length,
        stdDev,
    };
}

/**
 * 배열을 키 함수로 그룹화
 */
export function groupBy<T>(
    array: T[],
    keyFn: (item: T) => string
): Map<string, T[]> {
    const map = new Map<string, T[]>();
    array.forEach(item => {
        const key = keyFn(item);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
    });
    return map;
}

/**
 * 안전한 가격 포맷팅 (null/undefined 처리)
 */
export function formatPrice(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) {
        return '-';
    }
    if (value >= 10000) {
        return `${(value / 10000).toFixed(1)}억`;
    }
    if (value >= 1000) {
        return `${Math.round(value / 1000)}천만`;
    }
    return `${value.toLocaleString()}만원`;
}

/**
 * 평당 가격 계산
 */
export function calculatePricePerPyeong(price: number, areaInSquareMeters: number): number {
    if (areaInSquareMeters <= 0) return 0;
    return price / (areaInSquareMeters / 3.3058);
}

/**
 * 면적을 평으로 변환
 */
export function squareMetersToPyeong(squareMeters: number): number {
    return squareMeters / 3.3058;
}

/**
 * 평을 제곱미터로 변환
 */
export function pyeongToSquareMeters(pyeong: number): number {
    return pyeong * 3.3058;
}

/**
 * 백분율 계산
 */
export function calculatePercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return (value / total) * 100;
}

/**
 * 변화율 계산
 */
export function calculateChangeRate(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
}
