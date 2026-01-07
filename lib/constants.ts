// lib/constants.ts
// 프로젝트 전역 상수 (Single Source of Truth)

// ===== 클러스터 설정 =====

export const CLUSTER_RADIUS = {
    default: 80,
    dense: 120,      // 밀집 지역용
    sparse: 60,      // 희박 지역용
} as const;

export const CLUSTER_MAX_ZOOM = {
    ic: 14,          // 산업단지 (더 낮은 줌에서 개별 표시)
    kc: 16,          // 지식산업센터
    transaction: 18, // 실거래
    listing: 18,     // 매물
    auction: 18,     // 경매
} as const;

export const CLUSTER_MIN_POINTS = 2;

// ===== 마커 표시 제한 =====

export const MAX_OFFSCREEN_MARKERS = {
    ic: 4,           // 오프스크린 산업단지 최대 개수
    kc: 3,           // 오프스크린 지식산업센터 최대 개수
} as const;

// ===== 화면 여백 =====

export const EDGE_PADDING = {
    offscreen: 8,    // 오프스크린 마커 가장자리 여백 (px)
    map: 20,         // 지도 영역 여백 (px)
} as const;

// ===== 애니메이션 =====

export const ANIMATION_DURATION = {
    bounce: 1000,    // 바운스 애니메이션 (ms)
    float: 3000,     // 플로팅 애니메이션 (ms)
    morph: 300,      // 지도 이동 애니메이션 (ms)
    fade: 200,       // 페이드 애니메이션 (ms)
} as const;

export const BOUNCE_DISTANCE = 4;  // 바운스 이동 거리 (px)

// ===== 투명도 =====

export const OPACITY = {
    offscreenMaxRatio: 2,  // 화면 대각선 대비 최대 거리 비율
    minOpacity: 0.3,       // 최소 투명도
    hoverOpacity: 1,       // 호버 시 투명도
} as const;

// ===== 지도 관련 =====

export const MAP_DEFAULTS = {
    center: { lat: 37.4563, lng: 126.7052 },  // 인천 중심
    zoom: 11,
    minZoom: 6,
    maxZoom: 21,
} as const;

// ===== 인천 지역 코드 =====

export const INCHEON_CODE = '28';

// ===== 데이터 제한 =====

export const DATA_LIMITS = {
    maxMarkersPerType: 10000,
    maxClustersPerView: 500,
    batchSize: 100,
} as const;

// ===== 디바운스/스로틀 =====

export const DEBOUNCE_MS = {
    search: 300,
    mapMove: 100,
    resize: 200,
    markerLayer: 150,  // 마커 레이어 업데이트 스로틀
} as const;

// ===== 클러스터 줌 레벨 =====

export const CLUSTER_MAX_ZOOM_GENERAL = 22;  // 일반 클러스터 최대 줌

// ===== 엔티티 색상 (Single Source of Truth) =====

export const ENTITY_COLORS = {
    factory: '#0066FF',              // 공장 - 파랑
    factoryGlow: 'rgba(0, 102, 255, 0.4)',  // 공장 그림자
    knowledgeCenter: '#7C3AED',      // 지식산업센터 - 보라
    warehouse: '#EA580C',            // 창고 - 주황
    land: '#16A34A',                 // 토지 - 초록
    complex: '#F97316',              // 산업단지 - 주황
    listing: '#2563EB',              // 매물 - 파랑
    auction: '#DC2626',              // 경매 - 빨강
    transaction: '#059669',          // 실거래 - 에메랄드
} as const;
