// lib/utils/hash.ts
// 해시 유틸리티 (성능 최적화용)

// 문자열 해시 캐시 (WeakMap 불가 - string은 primitive)
const hashCache = new Map<string, number>();

// 캐시 크기 제한 (메모리 누수 방지)
const MAX_CACHE_SIZE = 100000;

/**
 * 문자열을 32비트 정수 해시로 변환 (캐싱됨)
 * 동일 ID에 대해 항상 같은 해시 반환
 */
export function getStringHash(str: string): number {
    // 캐시 확인
    const cached = hashCache.get(str);
    if (cached !== undefined) {
        return cached;
    }

    // 캐시 크기 제한 - LRU 대신 간단히 절반 삭제
    if (hashCache.size >= MAX_CACHE_SIZE) {
        const keysToDelete = Array.from(hashCache.keys()).slice(0, MAX_CACHE_SIZE / 2);
        keysToDelete.forEach(k => hashCache.delete(k));
    }

    // 해시 계산 (djb2 변형)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }

    // 캐시에 저장
    hashCache.set(str, hash);
    return hash;
}

/**
 * 해시를 0~1 사이 값으로 정규화
 */
export function normalizeHash(hash: number): number {
    return (Math.abs(hash) % 10000) / 10000;
}

/**
 * 문자열 ID의 정규화된 해시 반환 (0~1)
 * 샘플링에 사용
 */
export function getSamplingHash(id: string): number {
    return normalizeHash(getStringHash(id));
}

/**
 * 캐시 통계 (디버깅용)
 */
export function getHashCacheStats(): { size: number; maxSize: number } {
    return { size: hashCache.size, maxSize: MAX_CACHE_SIZE };
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearHashCache(): void {
    hashCache.clear();
}
