// lib/stores/index.ts
// 하위 호환성을 위한 통합 re-export

// ===== 타입 =====
export type {
    DataTypeFilter,
    DealTypeFilter,
    DealType,
    DealCategory,
    FloorType,
    DealTypePrice,
    FilterState,
    SavedFilter,
    FilterPreset,
    Selection,
    FavoriteItem,
    CompareItem,
    RecentItem,
    RegionAggregationData,
    PropertyType,
} from './types';

export { DEFAULT_FILTER, FILTER_PRESETS } from './types';

// ===== 개별 스토어 =====
export { useMapStore } from './map-store';
export { useDataStore } from './data-store';
export { useSelectionStore } from './selection-store';
export { useFilterStore } from './filter-store';
export { useUIStore } from './ui-store';
export { usePreferencesStore } from './preferences-store';

// ===== 셀렉터 re-export =====

// map-store
export { useCurrentLocation, useSetCurrentLocation } from './map-store';

// selection-store
export {
    useSelectedParcel,
    useFocusMode,
    useFocusModeState,
    useEnterFocusMode,
    useExitFocusMode,
    useSelectionState,
    useSelectionSetters,
    useClearAllSelections,
} from './selection-store';

// filter-store
export {
    useFilter,
    useFilteredParcels,
    useFilterPanelOpen,
    useFilterActions,
    useIsFilterActive,
    useFilteredCount,
    useTimeline,
    useTimelineActions,
    useSavedFilters,
    useActiveFilterId,
    useFilterPresetActions,
} from './filter-store';

// ui-store
export {
    useVisibleLayers,
    useAnalysisModal,
    useAnalysisModalActions,
    useMarkerSampling,
    useMarkerSamplingActions,
} from './ui-store';
