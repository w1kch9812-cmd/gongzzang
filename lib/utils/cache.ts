// lib/utils/cache.ts - 캐시 유틸리티 (Single Source of Truth)

/**
 * LRU(Least Recently Used) 캐시
 * Map의 삽입 순서를 활용해 가장 오래된 항목을 자동 제거
 */
export class LRUCache<T> {
    private cache = new Map<string, T>();
    private readonly maxSize: number;

    constructor(maxSize: number) {
        this.maxSize = maxSize;
    }

    get(key: string): T | undefined {
        if (!this.cache.has(key)) return undefined;

        // LRU: 접근 시 맨 뒤로 이동 (가장 최근)
        const value = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key: string, value: T): void {
        // 이미 있으면 삭제 후 맨 뒤에 추가
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // 가장 오래된 항목(첫 번째) 제거
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) this.cache.delete(oldest);
        }
        this.cache.set(key, value);
    }

    has(key: string): boolean {
        return this.cache.has(key);
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }
}
