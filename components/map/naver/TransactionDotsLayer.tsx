// 실거래가 점 마커 레이어 (Mapbox GL 네이티브 렌더링)
// 겹치는 마커를 작은 점으로 표시 (공장 마커와 동일한 방식)

'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useMapStore, type OverlappingTxMarker } from '@/lib/stores/map-store';
import { logger } from '@/lib/utils/logger';

interface TransactionDotsLayerProps {
    map: naver.maps.Map | null;
}

// 매물 유형별 색상
const PROPERTY_TYPE_COLORS: Record<string, string> = {
    factory: '#0D9488',           // teal-600
    'knowledge-center': '#7C3AED', // violet-600
    warehouse: '#EA580C',          // orange-600
    land: '#16A34A',              // green-600
};

const DEFAULT_COLOR = '#64748B'; // slate-500

export default function TransactionDotsLayer({ map }: TransactionDotsLayerProps) {
    const sourceAddedRef = useRef(false);
    const mapboxRef = useRef<any>(null);

    // 겹치는 마커 데이터
    const overlappingMarkers = useMapStore((state) => state.overlappingTxMarkers);

    // GeoJSON 형식으로 변환
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

        // 레이어 설정 및 데이터 업데이트
        const setupAndUpdate = () => {
            try {
                // 소스가 없으면 생성, 있으면 데이터만 업데이트
                if (!mbMap.getSource('transaction-dots')) {
                    mbMap.addSource('transaction-dots', {
                        type: 'geojson',
                        data: geoJSON,
                    });
                    sourceAddedRef.current = true;
                } else {
                    const source = mbMap.getSource('transaction-dots');
                    if (source) {
                        source.setData(geoJSON);
                    }
                }

                // 레이어 추가 (없을 때만)
                if (!mbMap.getLayer('transaction-dots-layer')) {
                    mbMap.addLayer({
                        id: 'transaction-dots-layer',
                        type: 'circle',
                        source: 'transaction-dots',
                        minzoom: 14, // ZOOM_PARCEL.min (DOM 실거래가 마커와 동일)
                        paint: {
                            'circle-radius': 2,
                            'circle-color': ['get', 'color'],
                            'circle-opacity': 0.85,
                        },
                    });
                }

                if (geoJSON.features.length > 0) {
                    logger.log(`[TransactionDotsLayer] 점 마커 업데이트: ${geoJSON.features.length}개`);
                }
            } catch (e) {
                logger.warn('[TransactionDotsLayer] 레이어 설정 실패:', e);
            }
        };

        // 스타일이 이미 로드되었으면 바로 실행
        if (mbMap.isStyleLoaded()) {
            setupAndUpdate();
        } else {
            mbMap.once('style.load', setupAndUpdate);
        }

        // cleanup은 map이 바뀔 때만 실행 (geoJSON 변경 시에는 실행 안함)
    }, [map, geoJSON]);

    // 컴포넌트 언마운트 시에만 정리
    useEffect(() => {
        return () => {
            if (mapboxRef.current && sourceAddedRef.current) {
                try {
                    if (mapboxRef.current.getLayer('transaction-dots-layer')) {
                        mapboxRef.current.removeLayer('transaction-dots-layer');
                    }
                    if (mapboxRef.current.getSource('transaction-dots')) {
                        mapboxRef.current.removeSource('transaction-dots');
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
