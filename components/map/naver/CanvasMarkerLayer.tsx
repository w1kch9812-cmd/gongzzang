// components/map/naver/CanvasMarkerLayer.tsx
// Canvas 기반 고성능 마커 레이어
// UnifiedMarkerLayer에서 계산된 비겹침 마커 데이터를 Canvas로 렌더링

'use client';

import { useEffect, useRef } from 'react';
import { useMapStore, type NonOverlappingTxMarker } from '@/lib/stores/map-store';
import { useSelectionStore } from '@/lib/stores/selection-store';
import { CanvasMarkerRenderer, type MarkerData } from '@/lib/map/CanvasMarkerRenderer';
import { loadParcelDetail } from '@/lib/data/loadData';
import { logger } from '@/lib/utils/logger';

interface CanvasMarkerLayerProps {
    map: naver.maps.Map | null;
}

export default function CanvasMarkerLayer({ map }: CanvasMarkerLayerProps) {
    const rendererRef = useRef<CanvasMarkerRenderer | null>(null);

    // 스토어에서 비겹침 마커 데이터 가져오기
    const nonOverlappingMarkers = useMapStore((state) => state.nonOverlappingTxMarkers);
    const selectedParcel = useSelectionStore((state) => state.selectedParcel);
    const setSelectedParcel = useSelectionStore((state) => state.setSelectedParcel);

    // Canvas 렌더러 초기화
    useEffect(() => {
        if (!map) return;

        const mapboxGL = (map as any)._mapbox;
        if (!mapboxGL) {
            logger.warn('[CanvasMarkerLayer] Mapbox GL 인스턴스를 찾을 수 없음');
            return;
        }

        // 렌더러 생성
        rendererRef.current = new CanvasMarkerRenderer(mapboxGL);

        // 클릭 핸들러
        rendererRef.current.setOnClick(async (marker) => {
            logger.log(`🎨 [CanvasMarkerLayer] 마커 클릭: ${marker.id}`);

            // 상세 정보 로드
            const detail = await loadParcelDetail(marker.id);
            if (detail) {
                setSelectedParcel(detail);
            }
        });

        logger.log('🎨 [CanvasMarkerLayer] 초기화 완료');

        return () => {
            rendererRef.current?.destroy();
            rendererRef.current = null;
        };
    }, [map, setSelectedParcel]);

    // 마커 데이터 업데이트
    useEffect(() => {
        logger.log(`🎨 [CanvasMarkerLayer] nonOverlappingMarkers 변경: ${nonOverlappingMarkers.length}개, renderer=${!!rendererRef.current}`);

        if (!rendererRef.current) return;

        // NonOverlappingTxMarker → MarkerData 변환
        const markers: MarkerData[] = nonOverlappingMarkers.map(m => ({
            id: m.id,
            lng: m.lng,
            lat: m.lat,
            price: m.price,
            propertyType: m.propertyType,
            jibun: m.jibun,
            transactionDate: m.transactionDate,
            area: m.area,
        }));

        rendererRef.current.updateMarkers(markers);

        if (markers.length > 0) {
            logger.log(`🎨 [CanvasMarkerLayer] 마커 업데이트 완료: ${markers.length}개`);
        }
    }, [nonOverlappingMarkers]);

    // 선택 상태 업데이트
    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.setSelectedMarkerId(selectedParcel?.id ?? null);
        }
    }, [selectedParcel]);

    return null;
}
