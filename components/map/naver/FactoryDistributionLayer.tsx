// 공장 밀집지역 폴리곤 레이어 (채우기 + 외곽선)
// 저줌에서 공장 밀집 지역을 폴리곤으로 표시

'use client';

import { useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/utils/logger';
import { ZOOM_EMD, ZOOM_PARCEL } from '@/lib/map/zoomConfig';

interface FactoryDistributionLayerProps {
    map: naver.maps.Map | null;
}

// 공장 색상 (teal)
const FACTORY_COLOR = '#0D9488';

// 줌 레벨 설정
const MIN_ZOOM = 6;
const FADE_START_ZOOM = ZOOM_EMD.min;        // 12
const FADE_END_ZOOM = ZOOM_PARCEL.min;       // 14

// R2 CDN URL (환경변수, 없으면 로컬)
const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_URL || '';

// 사전 계산된 등고선 폴리곤 URL (새 경로: /data/entities/)
const getContoursUrl = () => {
    if (R2_BASE_URL) {
        return `${R2_BASE_URL}/data/entities/factory-contours.json`;
    }
    return '/data/entities/factory-contours.json';
};

export default function FactoryDistributionLayer({ map }: FactoryDistributionLayerProps) {
    const sourceAddedRef = useRef(false);
    const mapboxRef = useRef<any>(null);
    const [geoJSON, setGeoJSON] = useState<any>(null);

    // GeoJSON 로드
    useEffect(() => {
        fetch(getContoursUrl())
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
                if (data) {
                    setGeoJSON(data);
                    logger.log(`[FactoryDistribution] 폴리곤 로드: ${data.features?.length}개`);
                }
            })
            .catch(() => {});
    }, []);

    // Mapbox GL 레이어 설정
    useEffect(() => {
        if (!map || !geoJSON) return;

        const mbMap = (map as any)._mapbox;
        if (!mbMap) return;
        mapboxRef.current = mbMap;

        const setupLayer = () => {
            try {
                // 기존 레이어 제거 (재설정)
                if (mbMap.getLayer('factory-zones-outline')) mbMap.removeLayer('factory-zones-outline');
                if (mbMap.getLayer('factory-zones-fill')) mbMap.removeLayer('factory-zones-fill');
                if (mbMap.getSource('factory-zones')) mbMap.removeSource('factory-zones');

                // 소스 추가
                mbMap.addSource('factory-zones', {
                    type: 'geojson',
                    data: geoJSON,
                });
                sourceAddedRef.current = true;
                logger.log(`[FactoryDistribution] 소스 추가됨, features: ${geoJSON.features?.length}`);

                // 1. 반투명 채우기 (먼저 추가)
                // 줌 12~14에서 페이드 아웃 (공장 점 마커와 반대로)
                mbMap.addLayer({
                    id: 'factory-zones-fill',
                    type: 'fill',
                    source: 'factory-zones',
                    minzoom: MIN_ZOOM,
                    paint: {
                        'fill-color': FACTORY_COLOR,
                        'fill-opacity': [
                            'interpolate', ['linear'], ['zoom'],
                            FADE_START_ZOOM, 0.4,     // 줌 12: 40% (기존)
                            FADE_END_ZOOM, 0,         // 줌 14: 투명 (페이드 아웃)
                        ],
                    },
                });
                logger.log('[FactoryDistribution] fill 레이어 추가됨');

                // 2. 외곽선 (fill 위에)
                mbMap.addLayer({
                    id: 'factory-zones-outline',
                    type: 'line',
                    source: 'factory-zones',
                    minzoom: MIN_ZOOM,
                    paint: {
                        'line-color': FACTORY_COLOR,
                        'line-width': 1.5,
                        'line-opacity': [
                            'interpolate', ['linear'], ['zoom'],
                            FADE_START_ZOOM, 1,       // 줌 12: 100%
                            FADE_END_ZOOM, 0,         // 줌 14: 투명 (페이드 아웃)
                        ],
                    },
                });
                logger.log('[FactoryDistribution] outline 레이어 추가됨');

                logger.log('[FactoryDistribution] 폴리곤 레이어 설정 완료');
            } catch (e) {
                logger.warn('[FactoryDistribution] 레이어 설정 실패:', e);
            }
        };

        if (mbMap.isStyleLoaded()) {
            setupLayer();
        } else {
            mbMap.once('style.load', setupLayer);
            setTimeout(() => {
                if (!mbMap.getSource('factory-zones')) setupLayer();
            }, 100);
        }
    }, [map, geoJSON]);

    // 정리
    useEffect(() => {
        return () => {
            if (mapboxRef.current) {
                try {
                    // 레이어 제거
                    if (sourceAddedRef.current) {
                        ['factory-zones-fill', 'factory-zones-outline']
                            .forEach((id) => {
                                if (mapboxRef.current.getLayer(id)) {
                                    mapboxRef.current.removeLayer(id);
                                }
                            });
                        if (mapboxRef.current.getSource('factory-zones')) {
                            mapboxRef.current.removeSource('factory-zones');
                        }
                    }
                } catch (e) {}
                sourceAddedRef.current = false;
            }
        };
    }, []);

    return null;
}
