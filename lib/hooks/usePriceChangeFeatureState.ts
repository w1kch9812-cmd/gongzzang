// lib/hooks/usePriceChangeFeatureState.ts
// Feature State 기반 증감률 색상 적용

import { useEffect, useRef, useCallback } from 'react';
import { useDataStore } from '@/lib/stores/data-store';
import { useMapStore } from '@/lib/stores/map-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { calculatePriceChangeRate, getPeriodDateRange } from '@/lib/utils/priceChangeCalculator';
import { logger } from '@/lib/utils/logger';

interface UsePriceChangeFeatureStateProps {
    mapboxGL: any;
    ready: boolean;
}

/**
 * Feature State를 사용하여 PMTiles 폴리곤에 증감률 색상 적용
 * - 뷰포트 내 필지만 처리 (성능 최적화)
 * - 새 타일 로드 시 자동 상태 적용
 * - 날짜 범위 변경 시 즉시 반영
 */
export function usePriceChangeFeatureState({ mapboxGL, ready }: UsePriceChangeFeatureStateProps) {
    const appliedStatesRef = useRef<Set<string>>(new Set());
    const isApplyingRef = useRef(false);
    const lastClearedRef = useRef(false); // ⚡ 중복 초기화 방지

    const parcels = useDataStore((state) => state.parcels);
    const currentBounds = useMapStore((state) => state.currentBounds);
    const parcelColorMode = useUIStore((state) => state.parcelColorMode);
    const dataVisualizationEnabled = useUIStore((state) => state.dataVisualizationEnabled);
    const priceChangePeriod = useUIStore((state) => state.priceChangePeriod);
    const priceChangeRange = useUIStore((state) => state.priceChangeRange);

    // ⚡ 성능 최적화: currentBounds를 ref로 추적 (의존성에서 제외)
    const currentBoundsRef = useRef(currentBounds);
    currentBoundsRef.current = currentBounds;

    // 증감률 계산 및 Feature State 적용
    const applyPriceChangeStates = useCallback(() => {
        if (!mapboxGL || !ready) return;
        if (parcelColorMode !== 'price-change' || !dataVisualizationEnabled) return;
        if (isApplyingRef.current) return;

        isApplyingRef.current = true;
        lastClearedRef.current = false; // 적용 중이므로 초기화 상태 해제

        try {
            const { from, to } = getPeriodDateRange(priceChangePeriod, priceChangeRange);

            // 뷰포트 내 필지만 필터링 (성능 최적화) - ref 사용
            let targetParcels = parcels;
            const bounds = currentBoundsRef.current;
            if (bounds) {
                const { minLng, maxLng, minLat, maxLat } = bounds;
                targetParcels = parcels.filter(p => {
                    const [lng, lat] = p.coord;
                    return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
                });
            }

            let appliedCount = 0;
            let skippedCount = 0;

            for (const parcel of targetParcels) {
                // 거래 이력이 2건 이상인 경우만 처리
                if (!parcel.transactions || parcel.transactions.length < 2) {
                    skippedCount++;
                    continue;
                }

                const rate = calculatePriceChangeRate(parcel.transactions, from, to);
                if (rate === null) {
                    skippedCount++;
                    continue;
                }

                try {
                    mapboxGL.setFeatureState(
                        { source: 'vt-parcels', sourceLayer: 'parcels', id: parcel.id },
                        { priceChangeRate: rate }
                    );
                    appliedStatesRef.current.add(parcel.id);
                    appliedCount++;
                } catch {
                    // 피처가 아직 로드되지 않은 경우 무시
                }
            }

            logger.log(`📊 [FeatureState] 증감률 적용: ${appliedCount}개 (스킵: ${skippedCount}개, 기간: ${from} ~ ${to})`);
        } finally {
            isApplyingRef.current = false;
        }
    // ⚡ currentBounds 제거 - ref로 대체하여 불필요한 콜백 재생성 방지
    }, [mapboxGL, ready, parcels, parcelColorMode, dataVisualizationEnabled, priceChangePeriod, priceChangeRange]);

    // Feature State 초기화
    const clearPriceChangeStates = useCallback(() => {
        if (!mapboxGL || !ready) return;

        // ⚡ 중복 초기화 방지 - 이미 초기화된 상태면 스킵
        if (lastClearedRef.current && appliedStatesRef.current.size === 0) {
            return;
        }

        for (const id of appliedStatesRef.current) {
            try {
                mapboxGL.removeFeatureState(
                    { source: 'vt-parcels', sourceLayer: 'parcels', id },
                    'priceChangeRate'
                );
            } catch {
                // 무시
            }
        }
        appliedStatesRef.current.clear();
        lastClearedRef.current = true; // 초기화 완료 표시
        logger.log(`🧹 [FeatureState] 증감률 상태 초기화`);
    }, [mapboxGL, ready]);

    // 증감률 모드 활성화 시 상태 적용
    useEffect(() => {
        if (!ready || !mapboxGL) return;

        if (parcelColorMode === 'price-change' && dataVisualizationEnabled) {
            // 증감률 모드 활성화
            applyPriceChangeStates();

            // 새 타일 로드 시 상태 재적용
            const handleSourceData = (e: any) => {
                if (e.sourceId === 'vt-parcels' && e.isSourceLoaded) {
                    // 약간의 지연 후 적용 (타일 렌더링 대기)
                    setTimeout(applyPriceChangeStates, 100);
                }
            };

            mapboxGL.on('sourcedata', handleSourceData);

            return () => {
                mapboxGL.off('sourcedata', handleSourceData);
            };
        } else {
            // 다른 모드로 전환 시 상태 초기화
            clearPriceChangeStates();
        }
    }, [ready, mapboxGL, parcelColorMode, dataVisualizationEnabled, applyPriceChangeStates, clearPriceChangeStates]);

    // 기간 변경 시 재적용
    useEffect(() => {
        if (!ready || parcelColorMode !== 'price-change' || !dataVisualizationEnabled) return;
        applyPriceChangeStates();
    }, [ready, priceChangePeriod, priceChangeRange, applyPriceChangeStates, parcelColorMode, dataVisualizationEnabled]);

    // 뷰포트 변경 시 재적용 (debounce)
    useEffect(() => {
        if (!ready || parcelColorMode !== 'price-change' || !dataVisualizationEnabled) return;

        const timeoutId = setTimeout(applyPriceChangeStates, 200);
        return () => clearTimeout(timeoutId);
    }, [currentBounds, ready, applyPriceChangeStates, parcelColorMode, dataVisualizationEnabled]);

    return { applyPriceChangeStates, clearPriceChangeStates };
}
