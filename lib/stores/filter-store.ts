// lib/stores/filter-store.ts
// 필터 상태 관리

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { ParcelMarkerData } from '@/types/data';
import {
    FilterState,
    SavedFilter,
    DEFAULT_FILTER,
    FILTER_PRESETS,
} from './types';
import { extractSig, extractEmd } from '@/lib/utils/pnu';
import { storage } from '@/lib/utils/storage';
import {
    hasTransactionPrice,
    hasListingPrice,
    hasAuctionPrice,
    isInPriceRange,
} from '@/lib/utils/dataHelpers';

interface FilterStore {
    // State
    filter: FilterState;
    filterPanelOpen: boolean;
    filteredParcels: ParcelMarkerData[];
    savedFilters: SavedFilter[];
    activeFilterId: string | null;

    // Timeline
    timelineEnabled: boolean;
    timelineDate: string | null;
    timelineMinDate: string;
    timelineMaxDate: string;

    // Actions
    setFilter: (filter: Partial<FilterState>) => void;
    resetFilter: () => void;
    setFilterPanelOpen: (open: boolean) => void;
    applyFilter: (parcels: ParcelMarkerData[]) => void;

    // Preset management
    saveFilter: (name: string, description: string) => void;
    loadFilter: (id: string) => void;
    deleteFilter: (id: string) => void;
    loadPreset: (presetId: string) => void;

    // Timeline
    setTimelineEnabled: (enabled: boolean) => void;
    setTimelineDate: (date: string | null) => void;
    setTimelineDateRange: (min: string, max: string) => void;
}

export const useFilterStore = create<FilterStore>()(
    subscribeWithSelector((set, get) => ({
        // State
        filter: DEFAULT_FILTER,
        filterPanelOpen: false,
        filteredParcels: [],
        savedFilters: storage.savedFilters.load(),
        activeFilterId: null,

        // Timeline
        timelineEnabled: false,
        timelineDate: null,
        timelineMinDate: '2020-01-01',
        timelineMaxDate: new Date().toISOString().split('T')[0],

        // Actions
        setFilter: (partial) => {
            set((state) => ({
                filter: { ...state.filter, ...partial },
                activeFilterId: null,
            }));
        },

        resetFilter: () => {
            set({ filter: DEFAULT_FILTER, activeFilterId: null });
        },

        setFilterPanelOpen: (open) => set({ filterPanelOpen: open }),

        applyFilter: (parcels) => {
            const { filter, timelineEnabled, timelineDate } = get();

            const filtered = parcels.filter((parcel) => {
                // 타임라인 필터 (transactions 배열에서 최근 거래일 확인)
                if (timelineEnabled && timelineDate && parcel.transactions?.length) {
                    const latestDate = parcel.transactions[0]?.date;
                    if (latestDate && latestDate > timelineDate) return false;
                }

                // 데이터 유형 필터 (헬퍼 함수 활용)
                if (filter.dataType !== 'all') {
                    if (filter.dataType === 'transaction' && !hasTransactionPrice(parcel.type)) return false;
                    if (filter.dataType === 'listing' && !hasListingPrice(parcel.type)) return false;
                    if (filter.dataType === 'auction' && !hasAuctionPrice(parcel.type)) return false;
                }

                // 거래유형 필터
                if (filter.dealType !== 'all' && parcel.dealType && parcel.dealType !== filter.dealType) {
                    return false;
                }

                // 가격 범위 필터 (헬퍼 함수 활용)
                if (!isInPriceRange(parcel, filter.priceMin, filter.priceMax)) return false;

                // 면적 범위 필터
                const areaPyeong = parcel.area / 3.3058;
                if (filter.areaMin !== null && areaPyeong < filter.areaMin) return false;
                if (filter.areaMax !== null && areaPyeong > filter.areaMax) return false;

                // 지역 필터 (시군구)
                if (filter.selectedSig.length > 0) {
                    const parcelSig = parcel.sigCode || extractSig(parcel.id);
                    if (!filter.selectedSig.includes(parcelSig)) return false;
                }

                // 지역 필터 (읍면동)
                if (filter.selectedEmd.length > 0) {
                    const parcelEmd = parcel.emdCode ? extractEmd(parcel.emdCode) : extractEmd(parcel.id);
                    if (!filter.selectedEmd.some(emd => parcelEmd.startsWith(extractEmd(emd)))) return false;
                }

                // 경매 유찰 횟수 필터
                if (filter.auctionFailCountMin !== null) {
                    if (!parcel.auctionFailCount || parcel.auctionFailCount < filter.auctionFailCountMin) {
                        return false;
                    }
                }

                return true;
            });

            set({ filteredParcels: filtered });
        },

        // Preset management
        saveFilter: (name, description) => {
            const MAX_SAVED_FILTERS = 20;
            const newFilter: SavedFilter = {
                id: `saved-${Date.now()}`,
                name,
                description,
                filter: get().filter,
                createdAt: new Date().toISOString(),
            };

            let updated = [...get().savedFilters, newFilter];
            if (updated.length > MAX_SAVED_FILTERS) {
                updated = updated.slice(-MAX_SAVED_FILTERS);
            }

            set({ savedFilters: updated });
            storage.savedFilters.save(updated);
        },

        loadFilter: (id) => {
            const saved = get().savedFilters.find((f) => f.id === id);
            if (saved) {
                set({ filter: saved.filter, activeFilterId: id });
            }
        },

        deleteFilter: (id) => {
            const updated = get().savedFilters.filter((f) => f.id !== id);
            const currentActiveId = get().activeFilterId;
            set({
                savedFilters: updated,
                activeFilterId: currentActiveId === id ? null : currentActiveId,
            });
            storage.savedFilters.save(updated);
        },

        loadPreset: (presetId) => {
            const preset = FILTER_PRESETS.find((p) => p.id === presetId);
            if (preset) {
                set({
                    filter: { ...DEFAULT_FILTER, ...preset.filter },
                    activeFilterId: presetId,
                });
            }
        },

        // Timeline
        setTimelineEnabled: (enabled) => set({ timelineEnabled: enabled }),
        setTimelineDate: (date) => set({ timelineDate: date }),
        setTimelineDateRange: (min, max) => set({ timelineMinDate: min, timelineMaxDate: max }),
    }))
);

// 셀렉터
export const useFilter = () => useFilterStore((state) => state.filter);
export const useFilteredParcels = () => useFilterStore((state) => state.filteredParcels);
export const useFilterPanelOpen = () => useFilterStore((state) => state.filterPanelOpen);

export const useFilterActions = () =>
    useFilterStore(
        useShallow((state) => ({
            setFilter: state.setFilter,
            resetFilter: state.resetFilter,
            setFilterPanelOpen: state.setFilterPanelOpen,
            applyFilter: state.applyFilter,
        }))
    );

export const useIsFilterActive = () =>
    useFilterStore((state) => {
        const f = state.filter;
        return (
            f.dataType !== 'all' ||
            f.dealType !== 'all' ||
            f.priceMin !== null ||
            f.priceMax !== null ||
            f.areaMin !== null ||
            f.areaMax !== null ||
            f.selectedSig.length > 0 ||
            f.selectedEmd.length > 0 ||
            f.auctionFailCountMin !== null
        );
    });

export const useFilteredCount = () =>
    useFilterStore(
        useShallow((state) => ({
            total: 0, // Will be set from data store
            filtered: state.filteredParcels.length,
        }))
    );

export const useTimeline = () =>
    useFilterStore(
        useShallow((state) => ({
            enabled: state.timelineEnabled,
            date: state.timelineDate,
            minDate: state.timelineMinDate,
            maxDate: state.timelineMaxDate,
        }))
    );

export const useTimelineActions = () =>
    useFilterStore(
        useShallow((state) => ({
            setEnabled: state.setTimelineEnabled,
            setDate: state.setTimelineDate,
            setDateRange: state.setTimelineDateRange,
        }))
    );

export const useSavedFilters = () => useFilterStore((state) => state.savedFilters);
export const useActiveFilterId = () => useFilterStore((state) => state.activeFilterId);

export const useFilterPresetActions = () =>
    useFilterStore(
        useShallow((state) => ({
            saveFilter: state.saveFilter,
            loadFilter: state.loadFilter,
            deleteFilter: state.deleteFilter,
            loadPreset: state.loadPreset,
        }))
    );
