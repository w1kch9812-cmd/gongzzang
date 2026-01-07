// lib/config/ui.config.ts
// UI 레이아웃 설정 - Single Source of Truth
// ⚠️ 이 파일의 값을 변경하면 전체 레이아웃에 영향을 줍니다.

/** 패널 크기 및 레이아웃 */
export const PANEL = {
    /** 좌측 사이드 패널 (DetailPanel, AnalysisPanel 공통) */
    side: {
        width: 400,
        zIndex: 10003,
        transition: 300, // ms
    },

    /** 비교 패널 */
    compare: {
        width: 380,
    },

    /** 우측 사이드바 */
    right: {
        collapsed: 48,   // 아이콘만
        expanded: 408,   // 48 + 360
        panelWidth: 360, // 확장 시 패널 부분만의 폭
    },

    /** 레이어 컨트롤 패널 */
    layer: {
        width: 260,
        zIndex: 1000,
    },
} as const;

/** 모달 설정 */
export const MODAL = {
    /** 분석 모달 */
    analysis: {
        zIndex: 10002,
    },

    /** 상세 필터 모달 */
    filter: {
        zIndex: 10001,
        width: 400,
    },
} as const;

/** 반응형 브레이크포인트 */
export const BREAKPOINTS = {
    mobile: 768,
    tablet: 1024,
    desktop: 1280,
} as const;

/** UI 헬퍼 함수 */
export const UIHelper = {
    /** 우측 사이드바 오프셋 계산 */
    getRightSidebarOffset(collapsed: boolean): number {
        return collapsed
            ? -PANEL.right.panelWidth
            : PANEL.right.collapsed;
    },

    /** 화면 크기 체크 */
    isMobile(width: number): boolean {
        return width < BREAKPOINTS.mobile;
    },

    isTablet(width: number): boolean {
        return width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
    },

    isDesktop(width: number): boolean {
        return width >= BREAKPOINTS.desktop;
    },
} as const;

// ===== 하위 호환성을 위한 개별 export (Deprecated) =====

/** @deprecated Use PANEL.side.width from '@/lib/config/ui.config' */
export const SIDE_PANEL_WIDTH = PANEL.side.width;

/** @deprecated Use PANEL.compare.width from '@/lib/config/ui.config' */
export const COMPARE_PANEL_WIDTH = PANEL.compare.width;

/** @deprecated Use PANEL.side.transition from '@/lib/config/ui.config' */
export const SIDE_PANEL_TRANSITION_DURATION = PANEL.side.transition;

/** @deprecated Use PANEL.side.zIndex from '@/lib/config/ui.config' */
export const SIDE_PANEL_Z_INDEX = PANEL.side.zIndex;

/** @deprecated Use PANEL.right.collapsed from '@/lib/config/ui.config' */
export const RIGHT_SIDEBAR_COLLAPSED = PANEL.right.collapsed;

/** @deprecated Use PANEL.right.expanded from '@/lib/config/ui.config' */
export const RIGHT_SIDEBAR_EXPANDED = PANEL.right.expanded;

/** @deprecated Use PANEL.layer.zIndex from '@/lib/config/ui.config' */
export const LAYER_CONTROL_Z_INDEX = PANEL.layer.zIndex;

/** @deprecated Use PANEL.layer.width from '@/lib/config/ui.config' */
export const LAYER_CONTROL_WIDTH = PANEL.layer.width;

/** @deprecated Use MODAL.analysis.zIndex from '@/lib/config/ui.config' */
export const ANALYSIS_MODAL_Z_INDEX = MODAL.analysis.zIndex;

/** @deprecated Use MODAL.filter.zIndex from '@/lib/config/ui.config' */
export const FILTER_MODAL_Z_INDEX = MODAL.filter.zIndex;

/** 타입 정의 */
export type PanelKey = keyof typeof PANEL;
export type ModalKey = keyof typeof MODAL;
