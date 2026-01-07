// 실거래가 점 마커 레이어 (Mapbox GL 네이티브 렌더링)
// 겹치는 마커를 작은 점으로 표시

'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useMapStore, type OverlappingTxMarker } from '@/lib/stores/map-store';
import { logger } from '@/lib/utils/logger';
// ✅ 설정 파일 사용 (Single Source of Truth)
import { COLORS, OPACITY } from '@/lib/config/style.config';
import { LAYER_IDS, SOURCE_IDS } from '@/lib/config/layer.config';
import { ZOOM_LEVELS } from '@/lib/config/map.config';

interface TransactionDotsLayerProps {
    map: naver.maps.Map | null;
}

// ✅ 설정 파일에서 색상 가져오기
const PROPERTY_TYPE_COLORS: Record<string, string> = {
    factory: COLORS.entity.factory,
    'knowledge-center': COLORS.entity.knowledgeCenter,
    warehouse: COLORS.entity.warehouse,
    land: COLORS.entity.land,
};

const DEFAULT_COLOR = COLORS.ui.text.muted;

export default function TransactionDotsLayer({ map }: TransactionDotsLayerProps) {
    const sourceAddedRef = useRef(false);
    const mapboxRef = useRef<any>(null);

    // 겹치는 마커 데이터
    const overlappingMarkers = useMapStore((state) => state.overlappingTxMarkers);

    // ✅ GeoJSON 변환 메모이제이션
    const geoJSON = useMemo(() => {
        return {
            type: 'FeatureCollection' as const,
            features: overlappingMarkers.map((m) => ({
                type: 'Feature' as const,
                geometry: {
                    type: 'Point' as const,
                    coordinates: [m.lng, m.lat] as [number, number],
                },
                properties: {
                    id: m.id,
                    propertyType: m.propertyType,
                    color: PROPERTY_TYPE_COLORS[m.propertyType] || DEFAULT_COLOR,
                },
            })),
        };
    }, [overlappingMarkers]);

    // ✅ 레이어 설정 함수 메모이제이션
    const setupAndUpdate = useCallback((mbMap: any) => {
        try {
            // 소스가 없으면 생성, 있으면 데이터만 업데이트
            if (!mbMap.getSource(SOURCE_IDS.transactionDots)) {
                mbMap.addSource(SOURCE_IDS.transactionDots, {
                    type: 'geojson',
                    data: geoJSON,
                });
                sourceAddedRef.current = true;
            } else {
                const source = mbMap.getSource(SOURCE_IDS.transactionDots);
                if (source) {
                    source.setData(geoJSON);
                }
            }

            // ✅ 레이어 ID 설정 파일 사용
            if (!mbMap.getLayer(LAYER_IDS.markers.transactions.dots)) {
                mbMap.addLayer({
                    id: LAYER_IDS.markers.transactions.dots,
                    type: 'circle',
                    source: SOURCE_IDS.transactionDots,
                    minzoom: ZOOM_LEVELS.PARCEL.min, // 14
                    paint: {
                        'circle-radius': 2,
                        'circle-color': ['get', 'color'],
                        'circle-opacity': OPACITY.circle.default,
                    },
                });
            }

            if (geoJSON.features.length > 0) {
                logger.log(`[TransactionDotsLayer] 점 마커 업데이트: ${geoJSON.features.length}개`);
            }
        } catch (e) {
            logger.warn('[TransactionDotsLayer] 레이어 설정 실패:', e);
        }
    }, [geoJSON]);

    // 레이어 설정 및 데이터 업데이트
    useEffect(() => {
        if (!map) return;

        // 내부 Mapbox GL 인스턴스 접근
        const mbMap = (map as any)._mapbox;
        if (!mbMap) {
            logger.warn('[TransactionDotsLayer] Mapbox GL 인스턴스를 찾을 수 없습니다');
            return;
        }
        mapboxRef.current = mbMap;

        // 스타일이 이미 로드되었으면 바로 실행
        if (mbMap.isStyleLoaded()) {
            setupAndUpdate(mbMap);
        } else {
            mbMap.once('style.load', () => setupAndUpdate(mbMap));
        }
    }, [map, setupAndUpdate]);

    // 컴포넌트 언마운트 시에만 정리
    useEffect(() => {
        return () => {
            if (mapboxRef.current && sourceAddedRef.current) {
                try {
                    if (mapboxRef.current.getLayer(LAYER_IDS.markers.transactions.dots)) {
                        mapboxRef.current.removeLayer(LAYER_IDS.markers.transactions.dots);
                    }
                    if (mapboxRef.current.getSource(SOURCE_IDS.transactionDots)) {
                        mapboxRef.current.removeSource(SOURCE_IDS.transactionDots);
                    }
                } catch (e) {
                    // 정리 중 에러 무시
                }
                sourceAddedRef.current = false;
            }
            logger.log('[TransactionDotsLayer] 정리 완료');
        };
    }, []);

    return null;
}
