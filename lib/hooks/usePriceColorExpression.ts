// lib/hooks/usePriceColorExpression.ts
// 뷰포트 기반 실거래가 색상 보간 표현식 생성
//
// 전략: GeoJSON/PMTiles에 transactionPrice 속성이 있으면
// Mapbox GL interpolate 표현식으로 동적 색상 보간 (O(1) 성능)
// 없으면 기본 색상 반환
//
// 성능 최적화: bounds 변경 시 스로틀링 (200ms)

import { useMemo, useRef, useEffect, useState } from 'react';
import { useDataStore } from '@/lib/stores/data-store';
import { useMapStore } from '@/lib/stores/map-store';
import { useFilterStore } from '@/lib/stores/filter-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { logger } from '@/lib/utils/logger';
import { PRICE_COLORS, CHANGE_COLORS } from '@/lib/utils/colors';
import type { Expression } from 'mapbox-gl';
import type { ViewportBounds } from '@/types/data';

// IQR 방식 이상치 제거
function calculatePriceRange(prices: number[]): { min: number; max: number } {
    if (prices.length === 0) return { min: 0, max: 0 };
    if (prices.length === 1) return { min: prices[0], max: prices[0] };

    const sorted = [...prices].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    const lowerBound = Math.max(0, q1 - 1.5 * iqr);
    const upperBound = q3 + 1.5 * iqr;

    const filtered = sorted.filter(p => p >= lowerBound && p <= upperBound);

    return {
        min: filtered[0] ?? sorted[0],
        max: filtered[filtered.length - 1] ?? sorted[sorted.length - 1],
    };
}

// 스로틀링 간격 (ms)
const THROTTLE_MS = 200;

/**
 * 뷰포트 내 필지의 가격 범위 계산 (스로틀링 적용 + 타임라인 연동)
 */
function useViewportPriceRange() {
    const parcels = useDataStore((state) => state.parcels);
    const currentBounds = useMapStore((state) => state.currentBounds);
    const timelineEnabled = useFilterStore((state) => state.timelineEnabled);
    const timelineDate = useFilterStore((state) => state.timelineDate);

    // 스로틀링된 bounds (빠른 이동 중에는 이전 값 유지)
    const [throttledBounds, setThrottledBounds] = useState<ViewportBounds | null>(currentBounds);
    const lastUpdateRef = useRef<number>(0);
    const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const now = Date.now();
        const elapsed = now - lastUpdateRef.current;

        if (elapsed >= THROTTLE_MS) {
            // 스로틀링 간격 경과 → 즉시 업데이트
            lastUpdateRef.current = now;
            setThrottledBounds(currentBounds);
        } else {
            // 간격 미경과 → 대기 후 업데이트 예약
            if (pendingUpdateRef.current) {
                clearTimeout(pendingUpdateRef.current);
            }
            pendingUpdateRef.current = setTimeout(() => {
                lastUpdateRef.current = Date.now();
                setThrottledBounds(currentBounds);
            }, THROTTLE_MS - elapsed);
        }

        return () => {
            if (pendingUpdateRef.current) {
                clearTimeout(pendingUpdateRef.current);
            }
        };
    }, [currentBounds]);

    return useMemo(() => {
        // 타임라인 날짜 기준 필터링
        const timelineFilter = (p: typeof parcels[0]) => {
            if (!timelineEnabled || !timelineDate) return true;
            // transactionDate 속성이 있으면 필터링
            // TODO: 실제 데이터에 transactionDate 속성 추가 필요
            // 현재는 타임라인이 켜져 있으면 모든 필지를 표시하되
            // 가격 계산에 타임라인 날짜를 반영
            return true;
        };

        if (!throttledBounds) {
            // bounds가 없으면 전체 필지 사용
            const prices = parcels
                .filter(p => p.transactionPrice && p.transactionPrice > 0 && timelineFilter(p))
                .map(p => p.transactionPrice!);
            return calculatePriceRange(prices);
        }

        // 뷰포트 내 필지만 필터링
        const { minLng, maxLng, minLat, maxLat } = throttledBounds;
        const viewportParcels = parcels.filter(p => {
            if (!p.transactionPrice || p.transactionPrice <= 0) return false;
            if (!timelineFilter(p)) return false;
            const [lng, lat] = p.coord;
            return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
        });

        const prices = viewportParcels.map(p => p.transactionPrice!);

        // 타임라인이 활성화되어 있으면 로그 출력
        if (timelineEnabled && timelineDate) {
            logger.log(`📅 [Timeline] ${timelineDate} 기준 가격 범위 계산 (${prices.length}개 필지)`);
        }

        return calculatePriceRange(prices);
    }, [parcels, throttledBounds, timelineEnabled, timelineDate]);
}

/**
 * 가격 스펙트럼 색상 표현식 생성 (순수 함수)
 */
function createPriceExpression(min: number, max: number): Expression {
    // 가격 범위가 없거나 같으면 기본 색상
    if (min === 0 && max === 0) {
        return ['literal', PRICE_COLORS.default] as Expression;
    }

    if (min === max) {
        return ['literal', PRICE_COLORS.mid] as Expression;
    }

    const midPrice = (min + max) / 2;

    return [
        'case',
        ['any',
            ['!', ['has', 'transactionPrice']],
            ['==', ['get', 'transactionPrice'], 0],
            ['==', ['get', 'transactionPrice'], null],
        ],
        'rgba(0, 0, 0, 0.01)',
        [
            'interpolate',
            ['linear'],
            ['get', 'transactionPrice'],
            min, PRICE_COLORS.low,
            midPrice, PRICE_COLORS.mid,
            max, PRICE_COLORS.high,
        ],
    ] as Expression;
}

/**
 * 증감률 색상 표현식 생성 (순수 함수 - 훅 호출 없음)
 * @param min 최소 가격
 * @param max 최대 가격
 */
function createPriceChangeExpression(min: number, max: number): Expression {
    // 중앙값 계산 (상승/하락 기준점)
    const midPrice = (min + max) / 2;

    // 가격 범위가 없으면 기본 투명
    if (min === 0 && max === 0) {
        return ['literal', 'rgba(0, 0, 0, 0)'] as Expression;
    }

    // 증감률 기반 색상 표현식
    return [
        'case',
        // 거래가격이 없으면 투명
        ['any',
            ['!', ['has', 'transactionPrice']],
            ['==', ['get', 'transactionPrice'], 0],
            ['==', ['get', 'transactionPrice'], null],
        ],
        'rgba(0, 0, 0, 0)',

        // priceChangeRate 속성이 있으면 해당 값 사용
        ['has', 'priceChangeRate'],
        [
            'case',
            ['>', ['get', 'priceChangeRate'], 0.02],
            ['rgba', CHANGE_COLORS.up[0], CHANGE_COLORS.up[1], CHANGE_COLORS.up[2],
                ['min', 0.6, ['+', 0.25, ['*', 0.35, ['min', 1, ['abs', ['get', 'priceChangeRate']]]]]]],
            ['<', ['get', 'priceChangeRate'], -0.02],
            ['rgba', CHANGE_COLORS.down[0], CHANGE_COLORS.down[1], CHANGE_COLORS.down[2],
                ['min', 0.6, ['+', 0.25, ['*', 0.35, ['min', 1, ['abs', ['get', 'priceChangeRate']]]]]]],
            `rgba(${CHANGE_COLORS.neutral.join(',')}, 0.15)`,
        ],

        // priceChangeRate가 없으면 중앙값 대비 가격으로 판단
        [
            'case',
            ['>', ['get', 'transactionPrice'], midPrice * 1.1],
            ['rgba', CHANGE_COLORS.up[0], CHANGE_COLORS.up[1], CHANGE_COLORS.up[2],
                ['min', 0.5, ['+', 0.25, ['*', 0.25,
                    ['/', ['-', ['get', 'transactionPrice'], midPrice], ['-', max, midPrice]]]]]],
            ['<', ['get', 'transactionPrice'], midPrice * 0.9],
            ['rgba', CHANGE_COLORS.down[0], CHANGE_COLORS.down[1], CHANGE_COLORS.down[2],
                ['min', 0.5, ['+', 0.25, ['*', 0.25,
                    ['/', ['-', midPrice, ['get', 'transactionPrice']], ['-', midPrice, min]]]]]],
            `rgba(${CHANGE_COLORS.neutral.join(',')}, 0.15)`,
        ],
    ] as Expression;
}

/**
 * 뷰포트 기반 실거래가 색상 표현식 생성
 * parcelColorMode에 따라 다른 표현식 반환:
 * - 'price': 가격 스펙트럼 (저가=파랑 → 고가=빨강)
 * - 'price-change': 증감률 (상승=빨강, 하락=파랑, 투명도=변동폭)
 */
export function usePriceColorExpression(): Expression {
    const parcelColorMode = useUIStore((state) => state.parcelColorMode);
    const { min, max } = useViewportPriceRange(); // 1회만 호출

    // useMemo로 표현식 생성 (min, max, mode가 바뀔 때만 재계산)
    return useMemo(() => {
        if (parcelColorMode === 'price-change') {
            return createPriceChangeExpression(min, max);
        }
        return createPriceExpression(min, max);
    }, [parcelColorMode, min, max]);
}

/**
 * 현재 뷰포트의 가격 범위 반환 (UI 표시용)
 */
export function useViewportPriceRangeInfo() {
    const { min, max } = useViewportPriceRange();
    const currentBounds = useMapStore((state) => state.currentBounds);

    return useMemo(() => ({
        min,
        max,
        hasData: min > 0 || max > 0,
        isViewportBased: !!currentBounds,
    }), [min, max, currentBounds]);
}

export default usePriceColorExpression;
