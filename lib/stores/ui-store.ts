// lib/stores/ui-store.ts
// UI 상태 관리

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { LayerType, ParcelColorMode } from '@/types/data';

const DEFAULT_VISIBLE_LAYERS: LayerType[] = [
    'parcel',
    'industrial-cluster',
    'industrial-complex',
    'knowledge-center',
    'factory',
    'transaction-marker',
    'listing-marker',
    'auction-marker',
];

interface UIState {
    // 레이어 표시
    visibleLayers: Set<LayerType>;
    parcelColorMode: ParcelColorMode;
    dataVisualizationEnabled: boolean;
    transactionYear: number | null;  // deprecated - use transactionYearRange
    transactionYearRange: { from: number; to: number } | null;  // 년도 범위 필터
    priceChangePeriod: 1 | 3 | 5 | 'custom';
    priceChangeRange: { from: string; to: string } | null;
    activityPeriod: 1 | 3 | 5;

    // 마커 표시 설정
    transactionMarkerViewMode: 'average' | 'all';
    transactionPriceDisplayMode: 'perPyeong' | 'total';  // 평단가 or 총거래가
    clusteringDisableZoom: number;

    // 3D 뷰
    tiltEnabled: boolean;
    terrainEnabled: boolean;

    // 사이드바
    rightSidebarWidth: number;

    // 좌측 사이드 패널 (DetailPanel, AnalysisPanel 통합 관리)
    activeSidePanel: 'detail' | 'analysis' | null;

    // 분석 모달
    analysisModalOpen: boolean;
    analysisTarget: { level: 'sig' | 'emd'; code: string; name: string } | null;

    // 마커 샘플링
    markerSampleRate: number;
    hiddenMarkerCount: number;

    // 지역 마커 호버 상태
    hoveredRegionCode: string | null;
    hoveredRegionLevel: 'sig' | 'emd' | null;
}

interface UIActions {
    toggleLayer: (layer: LayerType) => void;
    setParcelColorMode: (mode: ParcelColorMode) => void;
    setDataVisualizationEnabled: (enabled: boolean) => void;
    setTransactionYear: (year: number | null) => void;  // deprecated
    setTransactionYearRange: (range: { from: number; to: number } | null) => void;
    setPriceChangePeriod: (period: 1 | 3 | 5 | 'custom') => void;
    setPriceChangeRange: (range: { from: string; to: string } | null) => void;
    setActivityPeriod: (period: 1 | 3 | 5) => void;
    setTransactionMarkerViewMode: (mode: 'average' | 'all') => void;
    setTransactionPriceDisplayMode: (mode: 'perPyeong' | 'total') => void;
    setClusteringDisableZoom: (zoom: number) => void;

    setTiltEnabled: (enabled: boolean) => void;
    setTerrainEnabled: (enabled: boolean) => void;

    setRightSidebarWidth: (width: number) => void;

    // 좌측 사이드 패널 제어
    openSidePanel: (panel: 'detail' | 'analysis') => void;
    closeSidePanel: () => void;
    toggleSidePanel: (panel: 'detail' | 'analysis') => void;

    setAnalysisModalOpen: (open: boolean) => void;
    setAnalysisTarget: (target: { level: 'sig' | 'emd'; code: string; name: string } | null) => void;
    openAnalysisModal: (level: 'sig' | 'emd', code: string, name: string) => void;

    setMarkerSampleRate: (rate: number) => void;
    setHiddenMarkerCount: (count: number) => void;

    setHoveredRegion: (code: string | null, level: 'sig' | 'emd' | null) => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
    subscribeWithSelector((set) => ({
        // State
        visibleLayers: new Set(DEFAULT_VISIBLE_LAYERS),
        parcelColorMode: 'price',
        dataVisualizationEnabled: false,
        transactionYear: null,
        // 기본값: 최근 5년 (실거래 마커 갯수 절반 감소 효과)
        transactionYearRange: { from: new Date().getFullYear() - 4, to: new Date().getFullYear() },
        priceChangePeriod: 3,
        priceChangeRange: null,
        activityPeriod: 3,
        transactionMarkerViewMode: 'average',
        transactionPriceDisplayMode: 'total',  // 기본값: 총거래가 (area 데이터 없음)
        clusteringDisableZoom: 17,

        tiltEnabled: false,
        terrainEnabled: false,

        rightSidebarWidth: 48,

        activeSidePanel: null,

        analysisModalOpen: false,
        analysisTarget: null,

        markerSampleRate: 0.4,
        hiddenMarkerCount: 0,

        hoveredRegionCode: null,
        hoveredRegionLevel: null,

        // Actions
        toggleLayer: (layer) => set((state) => {
            const newLayers = new Set(state.visibleLayers);
            if (newLayers.has(layer)) {
                newLayers.delete(layer);
            } else {
                newLayers.add(layer);
            }
            return { visibleLayers: newLayers };
        }),

        setParcelColorMode: (mode) => set({ parcelColorMode: mode }),
        setDataVisualizationEnabled: (enabled) => set({ dataVisualizationEnabled: enabled }),
        setTransactionYear: (year) => set({ transactionYear: year }),
        setTransactionYearRange: (range) => set({ transactionYearRange: range }),
        setPriceChangePeriod: (period) => set({ priceChangePeriod: period }),
        setPriceChangeRange: (range) => set({ priceChangeRange: range }),
        setActivityPeriod: (period) => set({ activityPeriod: period }),
        setTransactionMarkerViewMode: (mode) => set({ transactionMarkerViewMode: mode }),
        setTransactionPriceDisplayMode: (mode) => set({ transactionPriceDisplayMode: mode }),
        setClusteringDisableZoom: (zoom) => set({ clusteringDisableZoom: zoom }),

        setTiltEnabled: (enabled) => set({ tiltEnabled: enabled }),
        setTerrainEnabled: (enabled) => set({ terrainEnabled: enabled }),

        setRightSidebarWidth: (width) => set({ rightSidebarWidth: width }),

        // 좌측 사이드 패널 제어
        openSidePanel: (panel) => {
            // 패널 전환 시 이전 맥락의 선택 상태 초기화
            const currentPanel = useUIStore.getState().activeSidePanel;
            if (currentPanel && currentPanel !== panel) {
                // 다른 패널로 전환 시 선택 해제
                import('@/lib/stores/selection-store').then(({ useSelectionStore }) => {
                    useSelectionStore.getState().clearSelection();
                });
            }
            set({ activeSidePanel: panel });
        },
        closeSidePanel: () => set({ activeSidePanel: null }),
        toggleSidePanel: (panel) => set((state) => ({
            activeSidePanel: state.activeSidePanel === panel ? null : panel,
        })),

        setAnalysisModalOpen: (open) => set({ analysisModalOpen: open }),
        setAnalysisTarget: (target) => set({ analysisTarget: target }),
        openAnalysisModal: (level, code, name) => set({
            analysisModalOpen: true,
            analysisTarget: { level, code, name },
        }),

        setMarkerSampleRate: (rate) => set({ markerSampleRate: rate }),
        setHiddenMarkerCount: (count) => set({ hiddenMarkerCount: count }),

        setHoveredRegion: (code, level) => set({ hoveredRegionCode: code, hoveredRegionLevel: level }),
    }))
);

// 셀렉터
export const useVisibleLayers = () => useUIStore((state) => state.visibleLayers);

export const useActiveSidePanel = () => useUIStore((state) => state.activeSidePanel);

export const useSidePanelActions = () =>
    useUIStore(
        useShallow((state) => ({
            openSidePanel: state.openSidePanel,
            closeSidePanel: state.closeSidePanel,
            toggleSidePanel: state.toggleSidePanel,
        }))
    );

export const useAnalysisModal = () =>
    useUIStore(
        useShallow((state) => ({
            open: state.analysisModalOpen,
            target: state.analysisTarget,
        }))
    );

export const useAnalysisModalActions = () =>
    useUIStore(
        useShallow((state) => ({
            setOpen: state.setAnalysisModalOpen,
            setTarget: state.setAnalysisTarget,
            openModal: state.openAnalysisModal,
        }))
    );

export const useMarkerSampling = () =>
    useUIStore(
        useShallow((state) => ({
            sampleRate: state.markerSampleRate,
            hiddenCount: state.hiddenMarkerCount,
        }))
    );

export const useMarkerSamplingActions = () =>
    useUIStore(
        useShallow((state) => ({
            setSampleRate: state.setMarkerSampleRate,
            setHiddenCount: state.setHiddenMarkerCount,
        }))
    );

// 마커 레이어 설정 (렌더링 최적화용)
export const useMarkerLayerSettings = () =>
    useUIStore(
        useShallow((state) => ({
            visibleLayers: state.visibleLayers,
            clusteringDisableZoom: state.clusteringDisableZoom,
            markerSampleRate: state.markerSampleRate,
            transactionYearRange: state.transactionYearRange,
            transactionPriceDisplayMode: state.transactionPriceDisplayMode,
        }))
    );

// 마커 레이어 액션
export const useMarkerLayerActions = () =>
    useUIStore(
        useShallow((state) => ({
            setHiddenMarkerCount: state.setHiddenMarkerCount,
        }))
    );
