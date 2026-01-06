// lib/stores/preferences-store.ts
// 사용자 설정 관리 (관심 매물, 비교함, 최근 본)

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { FavoriteItem, CompareItem, RecentItem } from './types';
import { storage } from '@/lib/utils/storage';

interface PreferencesState {
    favorites: FavoriteItem[];
    compareList: CompareItem[];
    recentItems: RecentItem[];
}

interface PreferencesActions {
    // 관심 매물
    addToFavorites: (item: Omit<FavoriteItem, 'addedAt'>) => void;
    removeFromFavorites: (id: string) => void;
    updateFavoriteMemo: (id: string, memo: string) => void;
    isFavorite: (id: string) => boolean;

    // 비교함
    addToCompare: (item: Omit<CompareItem, 'addedAt'>) => void;
    removeFromCompare: (id: string) => void;
    clearCompare: () => void;
    isInCompare: (id: string) => boolean;

    // 최근 본
    addToRecent: (item: Omit<RecentItem, 'viewedAt'>) => void;
    clearRecent: () => void;
}

type PreferencesStore = PreferencesState & PreferencesActions;

export const usePreferencesStore = create<PreferencesStore>()(
    subscribeWithSelector((set, get) => ({
        // State (localStorage에서 초기화)
        favorites: storage.favorites.load(),
        compareList: storage.compareList.load(),
        recentItems: storage.recentItems.load(),

        // 관심 매물
        addToFavorites: (item) => {
            const newItem: FavoriteItem = {
                ...item,
                addedAt: new Date().toISOString(),
            };
            const updated = [...get().favorites, newItem];
            set({ favorites: updated });
            storage.favorites.save(updated);
        },

        removeFromFavorites: (id) => {
            const updated = get().favorites.filter((f) => f.id !== id);
            set({ favorites: updated });
            storage.favorites.save(updated);
        },

        updateFavoriteMemo: (id, memo) => {
            const updated = get().favorites.map((f) =>
                f.id === id ? { ...f, memo } : f
            );
            set({ favorites: updated });
            storage.favorites.save(updated);
        },

        isFavorite: (id) => get().favorites.some((f) => f.id === id),

        // 비교함 (최대 3개)
        addToCompare: (item) => {
            const current = get().compareList;
            if (current.length >= 3) {
                alert('비교는 최대 3개까지만 가능합니다.');
                return;
            }
            const newItem: CompareItem = {
                ...item,
                addedAt: new Date().toISOString(),
            };
            const updated = [...current, newItem];
            set({ compareList: updated });
            storage.compareList.save(updated);
        },

        removeFromCompare: (id) => {
            const updated = get().compareList.filter((c) => c.id !== id);
            set({ compareList: updated });
            storage.compareList.save(updated);
        },

        clearCompare: () => {
            set({ compareList: [] });
            storage.compareList.save([]);
        },

        isInCompare: (id) => get().compareList.some((c) => c.id === id),

        // 최근 본 (최대 20개)
        addToRecent: (item) => {
            const current = get().recentItems;
            const filtered = current.filter((r) => r.id !== item.id);
            const newItem: RecentItem = {
                ...item,
                viewedAt: new Date().toISOString(),
            };
            const updated = [newItem, ...filtered].slice(0, 20);
            set({ recentItems: updated });
            storage.recentItems.save(updated);
        },

        clearRecent: () => {
            set({ recentItems: [] });
            storage.recentItems.save([]);
        },
    }))
);
