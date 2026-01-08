// components/map/naver/CanvasMarkerLayer.tsx
// Canvas 기반 고성능 마커 레이어
// UnifiedMarkerLayer에서 계산된 비겹침 마커 데이터를 Canvas로 렌더링

'use client';

import { useEffect, useRef } from 'react';
import { useMapStore } from '@/lib/stores/map-store';
import { useSelectionStore } from '@/lib/stores/selection-store';
import { CanvasMarkerRenderer, type TransactionMarker, type ListingMarker, type AuctionMarker, type AnyMarker } from '@/lib/map/CanvasMarkerRenderer';
import { loadParcelDetail } from '@/lib/data/loadData';
import { logger } from '@/lib/utils/logger';

interface CanvasMarkerLayerProps {
    map: naver.maps.Map | null;
}

export default function CanvasMarkerLayer({ map }: CanvasMarkerLayerProps) {
    const rendererRef = useRef<CanvasMarkerRenderer | null>(null);

    // 스토어에서 마커 데이터 가져오기
    const nonOverlappingMarkers = useMapStore((state) => state.nonOverlappingTxMarkers);
    const listingMarkers = useMapStore((state) => state.listingCanvasMarkers);
    const auctionMarkers = useMapStore((state) => state.auctionCanvasMarkers);
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
        rendererRef.current.setOnClick(async (marker: AnyMarker) => {
            logger.log(`🎨 [CanvasMarkerLayer] 마커 클릭: ${marker.id}, type=${marker.type}`);

            // 실거래 마커인 경우 상세 정보 로드
            if (marker.type === 'transaction') {
                const detail = await loadParcelDetail(marker.id);
                if (detail) {
                    setSelectedParcel(detail);
                }
            }
            // TODO: 다른 마커 타입 클릭 처리
        });

        logger.log('🎨 [CanvasMarkerLayer] 초기화 완료');

        return () => {
            rendererRef.current?.destroy();
            rendererRef.current = null;
        };
    }, [map, setSelectedParcel]);

    // 마커 데이터 업데이트 (실거래 + 매물 + 경매 통합)
    useEffect(() => {
        if (!rendererRef.current) return;

        // 실거래 마커 변환
        const txMarkers: TransactionMarker[] = nonOverlappingMarkers.map(m => ({
            type: 'transaction' as const,
            id: m.id,
            lng: m.lng,
            lat: m.lat,
            price: m.price,
            propertyType: m.propertyType,
            jibun: m.jibun,
            transactionDate: m.transactionDate,
            area: m.area,
        }));

        // 매물 마커 변환
        const listMarkers: ListingMarker[] = listingMarkers.map(m => ({
            type: 'listing' as const,
            id: m.id,
            lng: m.lng,
            lat: m.lat,
            price: m.price,
            area: m.area,
            dealType: m.dealType,
            propertyType: m.propertyType,
        }));

        // 경매 마커 변환
        const aucMarkers: AuctionMarker[] = auctionMarkers.map(m => ({
            type: 'auction' as const,
            id: m.id,
            lng: m.lng,
            lat: m.lat,
            price: m.price,
            area: m.area,
            failCount: m.failCount,
            propertyType: m.propertyType,
        }));

        // 모든 마커 통합
        const allMarkers: AnyMarker[] = [...txMarkers, ...listMarkers, ...aucMarkers];
        rendererRef.current.updateMarkers(allMarkers);

        const counts = [
            txMarkers.length > 0 ? `실거래 ${txMarkers.length}` : null,
            listMarkers.length > 0 ? `매물 ${listMarkers.length}` : null,
            aucMarkers.length > 0 ? `경매 ${aucMarkers.length}` : null,
        ].filter(Boolean).join(', ');

        if (allMarkers.length > 0) {
            logger.log(`🎨 [CanvasMarkerLayer] 마커 업데이트: ${counts}`);
        }
    }, [nonOverlappingMarkers, listingMarkers, auctionMarkers]);

    // 선택 상태 업데이트
    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.setSelectedMarkerId(selectedParcel?.id ?? null);
        }
    }, [selectedParcel]);

    return null;
}
