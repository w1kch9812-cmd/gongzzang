// lib/stores/map-store.ts
// 지도 상태 관리

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { ViewportBounds } from '@/types/data';

// 겹치는 실거래 마커 데이터 (Deck.gl 점 렌더링용)
export interface OverlappingTxMarker {
    id: string;
    lng: number;
    lat: number;
    propertyType: string;
}

interface MapState {
    mapReady: boolean;
    mapInstance: any | null;
    currentZoom: number;
    currentBounds: ViewportBounds | null;
    currentLocation: { sido: string; sig: string; emd: string } | null;
    currentMapType: 'normal' | 'satellite' | 'hybrid' | 'terrain';
    // 겹치는 실거래 마커 (Deck.gl로 점 렌더링)
    overlappingTxMarkers: OverlappingTxMarker[];
}

interface MapActions {
    setMapReady: (ready: boolean) => void;
    setMapInstance: (map: any) => void;
    setCurrentZoom: (zoom: number) => void;
    setCurrentBounds: (bounds: ViewportBounds) => void;
    setCurrentLocation: (location: { sido: string; sig: string; emd: string } | null) => void;
    setMapType: (type: 'normal' | 'satellite' | 'hybrid' | 'terrain') => void;
    zoomIn: () => void;
    zoomOut: () => void;
    setOverlappingTxMarkers: (markers: OverlappingTxMarker[]) => void;
}

type MapStore = MapState & MapActions;

export const useMapStore = create<MapStore>()(
    subscribeWithSelector((set, get) => ({
        // State
        mapReady: false,
        mapInstance: null,
        currentZoom: 14,
        currentBounds: null,
        currentLocation: null,
        currentMapType: 'normal',
        overlappingTxMarkers: [],

        // Actions
        setMapReady: (ready) => set({ mapReady: ready }),
        setMapInstance: (map) => set({ mapInstance: map }),
        setCurrentZoom: (zoom) => set({ currentZoom: zoom }),
        setCurrentBounds: (bounds) => set({ currentBounds: bounds }),
        setCurrentLocation: (location) => set({ currentLocation: location }),

        setMapType: (type) => {
            const { mapInstance } = get();
            if (!mapInstance || typeof window === 'undefined' || !window.naver?.maps) return;

            const typeMap: Record<string, string> = {
                normal: 'NORMAL',
                satellite: 'SATELLITE',
                hybrid: 'HYBRID',
                terrain: 'TERRAIN',
            };

            const mapTypeKey = typeMap[type];
            if (!mapTypeKey) return;

            const mapTypeId = (window.naver.maps.MapTypeId as any)[mapTypeKey];
            if (mapTypeId && mapInstance.getMapTypeId() !== mapTypeId) {
                mapInstance.setMapTypeId(mapTypeId);
                set({ currentMapType: type });
            }
        },

        zoomIn: () => {
            const { mapInstance } = get();
            if (mapInstance) {
                mapInstance.setZoom(mapInstance.getZoom() + 1);
            }
        },

        zoomOut: () => {
            const { mapInstance } = get();
            if (mapInstance) {
                mapInstance.setZoom(mapInstance.getZoom() - 1);
            }
        },

        setOverlappingTxMarkers: (markers) => set({ overlappingTxMarkers: markers }),
    }))
);

// ===== 편의 훅 (그룹화된 상태) =====

// 뷰포트 상태 (bounds + zoom) - 마커 레이어용
export const useViewportState = () =>
    useMapStore(
        useShallow((state) => ({
            currentBounds: state.currentBounds,
            currentZoom: state.currentZoom,
        }))
    );

// 위치 정보
export const useCurrentLocation = () => useMapStore((state) => state.currentLocation);
export const useSetCurrentLocation = () => useMapStore((state) => state.setCurrentLocation);
