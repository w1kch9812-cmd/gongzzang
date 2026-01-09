// 공장 밀집지역 폴리곤 레이어 (채우기 + 외곽선)
// 저줌에서 공장 밀집 지역을 폴리곤으로 표시

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '@/lib/utils/logger';
import { getDataUrl } from '@/lib/data/dataUrl';
// ✅ 설정 파일 사용 (Single Source of Truth)
import { COLORS, OPACITY } from '@/lib/config/style.config';
import { LAYER_IDS, SOURCE_IDS } from '@/lib/config/layer.config';
import { ZOOM_LEVELS } from '@/lib/config/map.config';

interface FactoryDistributionLayerProps {
    map: naver.maps.Map | null;
}

// ✅ 설정 파일에서 줌 레벨 가져오기
const MIN_ZOOM = 6;
const FADE_START_ZOOM = ZOOM_LEVELS.EMD.min;      // 12
const FADE_END_ZOOM = ZOOM_LEVELS.PARCEL.min;     // 14

export default function FactoryDistributionLayer({ map }: FactoryDistributionLayerProps) {
    const sourceAddedRef = useRef(false);
    const mapboxRef = useRef<any>(null);
    const [geoJSON, setGeoJSON] = useState<any>(null);

    // GeoJSON 로드 (파일이 없으면 스킵 - 선택사항)
    useEffect(() => {
        // ✅ 파일이 없을 수 있으므로 fetch 자체를 하지 않음
        // fetch(getDataUrl('/data/entities/factory-contours.json'))
        //     .then((res) => res.ok ? res.json() : null)
        //     .then((data) => {
        //         if (data) {
        //             setGeoJSON(data);
        //             logger.log(`[FactoryDistribution] 폴리곤 로드: ${data.features?.length}개`);
        //         }
        //     })
        //     .catch(() => {});
    }, []);

    // ✅ 레이어 설정 함수 메모이제이션
    const setupLayer = useCallback((mbMap: any) => {
        if (!geoJSON) return;

        try {
            // 기존 레이어 제거 (재설정)
            if (mbMap.getLayer(LAYER_IDS.distributions.factoryZones.line)) {
                mbMap.removeLayer(LAYER_IDS.distributions.factoryZones.line);
            }
            if (mbMap.getLayer(LAYER_IDS.distributions.factoryZones.fill)) {
                mbMap.removeLayer(LAYER_IDS.distributions.factoryZones.fill);
            }
            if (mbMap.getSource(SOURCE_IDS.factoryZones)) {
                mbMap.removeSource(SOURCE_IDS.factoryZones);
            }

            // ✅ 소스 추가 (설정 파일 ID 사용)
            mbMap.addSource(SOURCE_IDS.factoryZones, {
                type: 'geojson',
                data: geoJSON,
            });
            sourceAddedRef.current = true;
            logger.log(`[FactoryDistribution] 소스 추가됨, features: ${geoJSON.features?.length}`);

            // ✅ 1. 반투명 채우기 (먼저 추가)
            mbMap.addLayer({
                id: LAYER_IDS.distributions.factoryZones.fill,
                type: 'fill',
                source: SOURCE_IDS.factoryZones,
                minzoom: MIN_ZOOM,
                paint: {
                    'fill-color': COLORS.entity.factory,
                    'fill-opacity': [
                        'interpolate', ['linear'], ['zoom'],
                        FADE_START_ZOOM, OPACITY.polygon.default,  // 줌 12: 0.3
                        FADE_END_ZOOM, 0,                           // 줌 14: 투명
                    ],
                },
            });
            logger.log('[FactoryDistribution] fill 레이어 추가됨');

            // ✅ 2. 외곽선 (fill 위에)
            mbMap.addLayer({
                id: LAYER_IDS.distributions.factoryZones.line,
                type: 'line',
                source: SOURCE_IDS.factoryZones,
                minzoom: MIN_ZOOM,
                paint: {
                    'line-color': COLORS.entity.factory,
                    'line-width': 1.5,
                    'line-opacity': [
                        'interpolate', ['linear'], ['zoom'],
                        FADE_START_ZOOM, 1,     // 줌 12: 100%
                        FADE_END_ZOOM, 0,       // 줌 14: 투명
                    ],
                },
            });
            logger.log('[FactoryDistribution] outline 레이어 추가됨');
            logger.log('[FactoryDistribution] 폴리곤 레이어 설정 완료');
        } catch (e) {
            logger.warn('[FactoryDistribution] 레이어 설정 실패:', e);
        }
    }, [geoJSON]);

    // Mapbox GL 레이어 설정
    useEffect(() => {
        if (!map || !geoJSON) return;

        const mbMap = (map as any)._mapbox;
        if (!mbMap) return;
        mapboxRef.current = mbMap;

        if (mbMap.isStyleLoaded()) {
            setupLayer(mbMap);
        } else {
            mbMap.once('style.load', () => setupLayer(mbMap));
            setTimeout(() => {
                if (!mbMap.getSource(SOURCE_IDS.factoryZones)) {
                    setupLayer(mbMap);
                }
            }, 100);
        }
    }, [map, geoJSON, setupLayer]);

    // 정리
    useEffect(() => {
        return () => {
            if (mapboxRef.current && sourceAddedRef.current) {
                try {
                    // ✅ 레이어 제거 (설정 파일 ID 사용)
                    [LAYER_IDS.distributions.factoryZones.fill, LAYER_IDS.distributions.factoryZones.line]
                        .forEach((id) => {
                            if (mapboxRef.current.getLayer(id)) {
                                mapboxRef.current.removeLayer(id);
                            }
                        });
                    if (mapboxRef.current.getSource(SOURCE_IDS.factoryZones)) {
                        mapboxRef.current.removeSource(SOURCE_IDS.factoryZones);
                    }
                } catch (e) {}
                sourceAddedRef.current = false;
            }
        };
    }, []);

    return null;
}
