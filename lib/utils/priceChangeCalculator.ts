// lib/utils/priceChangeCalculator.ts
// 가격 증감률 계산 유틸리티

import type { TransactionHistory, ParcelMarkerData } from '@/types/data';

/**
 * 날짜 범위 기반 증감률 계산
 * @param transactions 거래 이력 (최신순 정렬)
 * @param fromDate 시작 날짜 (YYYY-MM-DD)
 * @param toDate 종료 날짜 (YYYY-MM-DD)
 * @returns 증감률 (-1 ~ 1, null = 계산 불가)
 */
export function calculatePriceChangeRate(
    transactions: TransactionHistory[] | undefined,
    fromDate: string,
    toDate: string
): number | null {
    if (!transactions || transactions.length < 2) return null;

    // toDate 이전의 가장 최근 거래 찾기
    const latestTx = transactions.find(t => t.date <= toDate);
    if (!latestTx) return null;

    // fromDate 이전의 가장 최근 거래 찾기
    const pastTx = transactions.find(t => t.date <= fromDate);
    if (!pastTx) return null;

    // 같은 거래면 증감률 0
    if (latestTx.date === pastTx.date) return 0;

    // 증감률 계산
    const rate = (latestTx.price - pastTx.price) / pastTx.price;
    return rate;
}

/**
 * N년 전 대비 증감률 계산
 * @param transactions 거래 이력
 * @param years 비교 기간 (년)
 * @returns 증감률 (-1 ~ 1, null = 계산 불가)
 */
export function calculatePriceChangeRateByYears(
    transactions: TransactionHistory[] | undefined,
    years: number
): number | null {
    if (!transactions || transactions.length < 2) return null;

    const now = new Date();
    const toDate = now.toISOString().split('T')[0];

    const pastDate = new Date(now);
    pastDate.setFullYear(pastDate.getFullYear() - years);
    const fromDate = pastDate.toISOString().split('T')[0];

    return calculatePriceChangeRate(transactions, fromDate, toDate);
}

/**
 * 뷰포트 내 필지들의 증감률 일괄 계산
 * @param parcels 필지 목록
 * @param fromDate 시작 날짜
 * @param toDate 종료 날짜
 * @returns PNU -> 증감률 Map
 */
export function calculateBulkPriceChangeRates(
    parcels: ParcelMarkerData[],
    fromDate: string,
    toDate: string
): Map<string, number> {
    const result = new Map<string, number>();

    for (const parcel of parcels) {
        const rate = calculatePriceChangeRate(parcel.transactions, fromDate, toDate);
        if (rate !== null) {
            result.set(parcel.id, rate);
        }
    }

    return result;
}

// 증감률 → 색상 변환은 lib/utils/colors.ts로 통합됨
export { changeRateToColor as priceChangeRateToColor } from './colors';

/**
 * 기간 프리셋에서 날짜 범위 계산
 * @param period 기간 (1, 3, 5년 또는 'custom')
 * @param customRange 사용자 지정 범위
 * @returns { from, to } 날짜
 */
export function getPeriodDateRange(
    period: 1 | 3 | 5 | 'custom',
    customRange?: { from: string; to: string } | null
): { from: string; to: string } {
    if (period === 'custom' && customRange) {
        return customRange;
    }

    const years = period === 'custom' ? 3 : period;
    const now = new Date();
    const toDate = now.toISOString().split('T')[0];

    const pastDate = new Date(now);
    pastDate.setFullYear(pastDate.getFullYear() - years);
    const fromDate = pastDate.toISOString().split('T')[0];

    return { from: fromDate, to: toDate };
}
