// lib/utils/storage.ts - localStorage 유틸리티

const STORAGE_KEYS = {
    SAVED_FILTERS: 'gongzzang-saved-filters',
    FAVORITES: 'gongzzang-favorites',
    COMPARE_LIST: 'gongzzang-compare-list',
    RECENT_ITEMS: 'gongzzang-recent-items',
    PREFERENCES: 'gongzzang-preferences',
} as const;

type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * localStorage에서 데이터 로드 (SSR 안전)
 */
export function loadFromStorage<T>(key: StorageKey, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : fallback;
    } catch (err) {
        console.warn(`[Storage] ${key} 로드 실패:`, err);
        return fallback;
    }
}

/**
 * localStorage에 데이터 저장
 */
export function saveToStorage<T>(key: StorageKey, data: T): boolean {
    if (typeof window === 'undefined') return false;
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (err) {
        console.error(`[Storage] ${key} 저장 실패:`, err);
        return false;
    }
}

/**
 * localStorage에서 데이터 삭제
 */
export function removeFromStorage(key: StorageKey): boolean {
    if (typeof window === 'undefined') return false;
    try {
        localStorage.removeItem(key);
        return true;
    } catch (err) {
        console.error(`[Storage] ${key} 삭제 실패:`, err);
        return false;
    }
}

// 편의 함수들

export const storage = {
    keys: STORAGE_KEYS,

    savedFilters: {
        load: <T>() => loadFromStorage<T[]>(STORAGE_KEYS.SAVED_FILTERS, [] as T[]),
        save: <T>(data: T[]) => saveToStorage(STORAGE_KEYS.SAVED_FILTERS, data),
    },

    favorites: {
        load: <T>() => loadFromStorage<T[]>(STORAGE_KEYS.FAVORITES, [] as T[]),
        save: <T>(data: T[]) => saveToStorage(STORAGE_KEYS.FAVORITES, data),
    },

    compareList: {
        load: <T>() => loadFromStorage<T[]>(STORAGE_KEYS.COMPARE_LIST, [] as T[]),
        save: <T>(data: T[]) => saveToStorage(STORAGE_KEYS.COMPARE_LIST, data),
    },

    recentItems: {
        load: <T>() => loadFromStorage<T[]>(STORAGE_KEYS.RECENT_ITEMS, [] as T[]),
        save: <T>(data: T[]) => saveToStorage(STORAGE_KEYS.RECENT_ITEMS, data),
    },

    preferences: {
        load: <T>(fallback: T) => loadFromStorage<T>(STORAGE_KEYS.PREFERENCES, fallback),
        save: <T>(data: T) => saveToStorage(STORAGE_KEYS.PREFERENCES, data),
    },
};
