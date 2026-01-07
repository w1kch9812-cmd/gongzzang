// lib/stores/selection-store.ts
// 선택 상태 관리

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type {
    ParcelDetail,
    IndustrialComplexDetail,
    KnowledgeIndustryCenter,
    Factory,
} from '@/types/data';
import type { Selection } from './types';

interface SelectionState {
    selection: Selection;
    focusMode: boolean;
    focusedComplex: IndustrialComplexDetail | null;
    focusModeShowLots: boolean;
    focusModeShowIndustries: boolean;
    focusModeHighlightRoads: string[];
}

interface SelectionActions {
    setSelection: (selection: Selection) => void;
    clearSelection: () => void;

    // 호환성: 개별 setter
    setSelectedParcel: (parcel: ParcelDetail | null) => void;
    setSelectedComplex: (complex: IndustrialComplexDetail | null) => void;
    setSelectedKnowledgeCenter: (center: KnowledgeIndustryCenter | null) => void;
    setSelectedFactory: (factory: Factory | null) => void;

    // 포커스 모드
    enterFocusMode: (complex: IndustrialComplexDetail) => void;
    exitFocusMode: () => void;
    setFocusModeShowLots: (show: boolean) => void;
    setFocusModeShowIndustries: (show: boolean) => void;
    setFocusModeHighlightRoads: (roads: string[]) => void;
}

interface SelectionGetters {
    selectedParcel: ParcelDetail | null;
    selectedComplex: IndustrialComplexDetail | null;
    selectedKnowledgeCenter: KnowledgeIndustryCenter | null;
    selectedFactory: Factory | null;
}

type SelectionStore = SelectionState & SelectionActions & SelectionGetters;

export const useSelectionStore = create<SelectionStore>()(
    subscribeWithSelector((set, get) => ({
        // State
        selection: null,
        focusMode: false,
        focusedComplex: null,
        focusModeShowLots: true,
        focusModeShowIndustries: false,
        focusModeHighlightRoads: [],

        // Computed getters
        get selectedParcel() {
            const sel = get().selection;
            return sel?.type === 'parcel' ? sel.data : null;
        },
        get selectedComplex() {
            const sel = get().selection;
            return sel?.type === 'complex' ? sel.data : null;
        },
        get selectedKnowledgeCenter() {
            const sel = get().selection;
            return sel?.type === 'knowledge' ? sel.data : null;
        },
        get selectedFactory() {
            const sel = get().selection;
            return sel?.type === 'factory' ? sel.data : null;
        },

        // Actions
        setSelection: (selection) => set({ selection }),
        clearSelection: () => set({ selection: null }),

        setSelectedParcel: (parcel) => {
            set({ selection: parcel ? { type: 'parcel', data: parcel } : null });
            // UI 패널 열기 (동기적으로 처리)
            if (parcel) {
                // 동적 import 대신 직접 호출 (이미 로드된 모듈)
                const { useUIStore } = require('@/lib/stores/ui-store');
                useUIStore.getState().openSidePanel('detail');
            }
        },
        setSelectedComplex: (complex) => {
            set({ selection: complex ? { type: 'complex', data: complex } : null });
            // UI 패널 열기
            if (complex) {
                import('@/lib/stores/ui-store').then(({ useUIStore }) => {
                    useUIStore.getState().openSidePanel('detail');
                });
            }
        },
        setSelectedKnowledgeCenter: (center) =>
            set({ selection: center ? { type: 'knowledge', data: center } : null }),
        setSelectedFactory: (factory) => {
            set({ selection: factory ? { type: 'factory', data: factory } : null });
            // UI 패널 열기
            if (factory) {
                import('@/lib/stores/ui-store').then(({ useUIStore }) => {
                    useUIStore.getState().openSidePanel('detail');
                });
            }
        },

        enterFocusMode: (complex) => {
            set({
                focusMode: true,
                focusedComplex: complex,
                selection: { type: 'complex', data: complex },
            });
            // UI 패널 열기
            import('@/lib/stores/ui-store').then(({ useUIStore }) => {
                useUIStore.getState().openSidePanel('detail');
            });
        },

        exitFocusMode: () => {
            set({
                focusMode: false,
                focusedComplex: null,
                focusModeHighlightRoads: [],
                selection: null,
            });
        },

        setFocusModeShowLots: (show) => set({ focusModeShowLots: show }),
        setFocusModeShowIndustries: (show) => set({ focusModeShowIndustries: show }),
        setFocusModeHighlightRoads: (roads) => set({ focusModeHighlightRoads: roads }),
    }))
);

// 셀렉터
export const useSelectedParcel = () =>
    useSelectionStore((state) => state.selectedParcel);

export const useFocusMode = () =>
    useSelectionStore(
        useShallow((state) => ({
            focusMode: state.focusMode,
            focusedComplex: state.focusedComplex,
            showLots: state.focusModeShowLots,
            showIndustries: state.focusModeShowIndustries,
            highlightRoads: state.focusModeHighlightRoads,
        }))
    );

export const useFocusModeState = useFocusMode;

export const useEnterFocusMode = () =>
    useSelectionStore((state) => state.enterFocusMode);

export const useExitFocusMode = () =>
    useSelectionStore((state) => state.exitFocusMode);

export const useSelectionState = () =>
    useSelectionStore(
        useShallow((state) => {
            const sel = state.selection;
            return {
                selectedParcel: sel?.type === 'parcel' ? sel.data : null,
                selectedComplex: sel?.type === 'complex' ? sel.data : null,
                selectedKnowledgeCenter: sel?.type === 'knowledge' ? sel.data : null,
                selectedFactory: sel?.type === 'factory' ? sel.data : null,
            };
        })
    );

export const useSelectionSetters = () =>
    useSelectionStore(
        useShallow((state) => ({
            setSelectedParcel: state.setSelectedParcel,
            setSelectedComplex: state.setSelectedComplex,
            setSelectedKnowledgeCenter: state.setSelectedKnowledgeCenter,
            setSelectedFactory: state.setSelectedFactory,
        }))
    );

export const useClearAllSelections = () =>
    useSelectionStore((state) => state.clearSelection);

// 마커 레이어용 선택 상태 + 액션
export const useMarkerLayerSelection = () =>
    useSelectionStore(
        useShallow((state) => ({
            selection: state.selection,
            setSelectedParcel: state.setSelectedParcel,
            enterFocusMode: state.enterFocusMode,
        }))
    );
