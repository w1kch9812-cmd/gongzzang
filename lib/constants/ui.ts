// lib/constants/ui.ts
// UI 관련 상수 (Single Source of Truth)

// ========================================
// 사이드 패널
// ========================================

/**
 * 좌측 사이드 패널 폭 (DetailPanel, AnalysisPanel 공통)
 */
export const SIDE_PANEL_WIDTH = 400;

/**
 * 비교 패널 폭
 */
export const COMPARE_PANEL_WIDTH = 380;

/**
 * 사이드 패널 전환 애니메이션 시간 (ms)
 */
export const SIDE_PANEL_TRANSITION_DURATION = 300;

/**
 * 사이드 패널 z-index
 */
export const SIDE_PANEL_Z_INDEX = 10003;

// ========================================
// 우측 사이드바 (RightSidebar)
// ========================================

/**
 * 우측 사이드바 - 접힌 상태 폭 (아이콘만)
 */
export const RIGHT_SIDEBAR_COLLAPSED = 48;

/**
 * 우측 사이드바 - 확장 상태 폭 (아이콘 + 패널)
 */
export const RIGHT_SIDEBAR_EXPANDED = 408; // 48 + 360

// ========================================
// 레이어 컨트롤 패널
// ========================================

/**
 * 레이어 컨트롤 패널 z-index
 */
export const LAYER_CONTROL_Z_INDEX = 1000;

/**
 * 레이어 컨트롤 패널 폭
 */
export const LAYER_CONTROL_WIDTH = 260;

// ========================================
// 모달
// ========================================

/**
 * 분석 모달 z-index
 */
export const ANALYSIS_MODAL_Z_INDEX = 10002;

/**
 * 상세 필터 모달 z-index
 */
export const FILTER_MODAL_Z_INDEX = 10001;

// ========================================
// 반응형 브레이크포인트
// ========================================

export const BREAKPOINTS = {
    mobile: 768,
    tablet: 1024,
    desktop: 1280,
} as const;
