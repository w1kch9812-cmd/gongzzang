// lib/config/performance.config.ts
// 성능 설정 - Single Source of Truth

/** 디바운스/스로틀 시간 */
export const TIMING = {
    debounce: {
        search: 300,
        mapMove: 100,
        resize: 200,
        markerLayer: 150,
        filter: 50,
    },
    animation: {
        bounce: 1000,
        float: 3000,
        morph: 300,
        fade: 200,
        transition: 300,
    },
    polling: {
        projection: 100,
        maxRetries: 30,
    },
} as const;

/** 데이터 제한 */
export const DATA_LIMITS = {
    maxMarkersPerType: 10000,
    maxClustersPerView: 500,
    batchSize: 100,
    maxCacheSize: 1000,
} as const;

/** 렌더링 우선순위 (ms) */
export const RENDER_PRIORITY = {
    polygons: 0,      // 즉시
    markers: 100,     // 100ms 지연
    dots: 200,        // 200ms 지연
} as const;

/** 화면 여백 */
export const EDGE_PADDING = {
    offscreen: 8,     // 오프스크린 마커 가장자리 여백 (px)
    map: 20,          // 지도 영역 여백 (px)
} as const;

/** 바운스 애니메이션 */
export const BOUNCE_DISTANCE = 4;  // 바운스 이동 거리 (px)

/** 오프스크린 투명도 */
export const OFFSCREEN_OPACITY = {
    maxRatio: 2,      // 화면 대각선 대비 최대 거리 비율
    min: 0.3,         // 최소 투명도
} as const;
