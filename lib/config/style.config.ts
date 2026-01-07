// lib/config/style.config.ts
// 스타일 설정 - Single Source of Truth (Design System)

/** 색상 팔레트 */
export const COLORS = {
    /** 브랜드 색상 */
    brand: {
        primary: '#0066FF',
        secondary: '#7C3AED',
        accent: '#F97316',
    },

    /** 엔티티 색상 */
    entity: {
        factory: '#0066FF',
        factoryGlow: 'rgba(0, 102, 255, 0.4)',
        knowledgeCenter: '#7C3AED',
        warehouse: '#EA580C',
        land: '#16A34A',
        complex: '#F97316',
        listing: '#2563EB',
        auction: '#DC2626',
        transaction: '#059669',
    },

    /** UI 색상 */
    ui: {
        background: {
            primary: '#FFFFFF',
            secondary: '#F8FAFC',  // Slate 50 (폴리곤 배경)
            tertiary: '#F1F5F9',   // Slate 100
        },
        mapBackground: '#E5E3DF',
        border: {
            default: '#E2E8F0',    // Slate 200
            light: '#CBD5E1',      // Slate 300
            lighter: '#94A3B8',    // Slate 400
        },
        text: {
            primary: '#111827',
            secondary: '#6B7280',
            muted: '#9CA3AF',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
    },

    /** 선택 상태 색상 */
    selection: {
        selected: '#1D4ED8',
        selectedBorder: '#1E40AF',
        selectedText: '#FFFFFF',
        hover: '#3B82F6',
    },

    /** 가격 히트맵 색상 */
    heatmap: {
        low: 'rgba(59, 130, 246, 0.5)',    // 파랑 (저가)
        mid: 'rgba(255, 220, 0, 0.5)',     // 노랑 (중간)
        high: 'rgba(239, 68, 68, 0.5)',    // 빨강 (고가)
    },

    /** 증감률 색상 */
    changeRate: {
        up: 'rgba(239, 68, 68, 0.7)',      // 빨강 (상승)
        neutral: 'rgba(156, 163, 175, 0.3)', // 회색 (중립)
        down: 'rgba(59, 130, 246, 0.7)',   // 파랑 (하락)
    },
} as const;

/** 투명도 */
export const OPACITY = {
    polygon: {
        minimal: 0.3,    // 배경 폴리곤 (시도/시군구/읍면동)
        default: 0.4,    // 일반 폴리곤 (필지)
        dataViz: 0.5,    // 데이터 시각화
        hover: 0.6,      // 호버 상태
        selected: 0.7,   // 선택 상태
    },
    marker: {
        default: 0.92,
        hover: 1,
        offscreen: {
            min: 0.3,
            max: 1,
        },
    },
    circle: {
        default: 0.85,
        hover: 1,
    },
} as const;

/** 그림자 */
export const SHADOWS = {
    none: 'none',
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 2px 6px rgba(0, 0, 0, 0.12)',
    lg: '0 4px 12px rgba(0, 0, 0, 0.15)',
    xl: '0 8px 24px rgba(0, 0, 0, 0.2)',
    marker: '0 2px 6px rgba(0, 0, 0, 0.12)',
    selected: '0 4px 12px rgba(29, 78, 216, 0.4)',
} as const;

/** 테두리 반경 */
export const BORDER_RADIUS = {
    none: '0',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '100px',
    marker: '100px',
    panel: '12px',
} as const;

/** 폰트 크기 */
export const FONT_SIZE = {
    xs: '10px',
    sm: '11px',
    md: '12px',
    lg: '13px',
    xl: '14px',
    '2xl': '16px',
    '3xl': '18px',
} as const;

/** 폰트 두께 */
export const FONT_WEIGHT = {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
} as const;

/** Z-Index 레이어 */
export const Z_INDEX = {
    map: 0,
    polygons: 100,
    markers: {
        base: 1000,
        hover: 10000,
        selected: 10001,
    },
    ui: {
        panels: 1000,
        modal: 2000,
        tooltip: 3000,
        toast: 4000,
    },
} as const;

/** 간격 (Spacing) */
export const SPACING = {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
} as const;

/** 패딩 (Padding) */
export const PADDING = {
    marker: {
        sm: '4px 10px',
        md: '6px 12px',
        lg: '8px 14px',
    },
    panel: {
        sm: '8px',
        md: '12px',
        lg: '16px',
    },
} as const;

/** 스타일 헬퍼 */
export const StyleHelper = {
    /** 위도 기반 z-index 계산 (남쪽 마커가 위) */
    getMarkerZIndex(lat: number, baseLayer: number = Z_INDEX.markers.base): number {
        const normalizedLat = ((38 - lat) / 5) * 1000;
        return baseLayer + Math.floor(normalizedLat);
    },

    /** 가격에 따른 히트맵 색상 */
    getHeatmapColor(price: number, minPrice: number, maxPrice: number): string {
        if (!price || price <= 0) return 'rgba(200, 200, 200, 0.3)';

        const t = Math.min(1, Math.max(0, (price - minPrice) / (maxPrice - minPrice || 1)));

        if (t < 0.5) {
            // 저가 → 중간 (파랑 → 노랑)
            const tt = t * 2;
            const r = Math.round(59 + (255 - 59) * tt);
            const g = Math.round(130 + (220 - 130) * tt);
            const b = Math.round(246 - 246 * tt);
            return `rgba(${r}, ${g}, ${b}, 0.5)`;
        } else {
            // 중간 → 고가 (노랑 → 빨강)
            const tt = (t - 0.5) * 2;
            const r = Math.round(255 - (255 - 239) * tt);
            const g = Math.round(220 - (220 - 68) * tt);
            const b = Math.round(0 + 68 * tt);
            return `rgba(${r}, ${g}, ${b}, 0.5)`;
        }
    },

    /** 증감률에 따른 색상 */
    getChangeRateColor(rate: number | undefined): string {
        if (rate === undefined) return COLORS.changeRate.neutral;

        const threshold = 0.02;

        if (Math.abs(rate) < threshold) {
            return COLORS.changeRate.neutral;
        }

        return rate > 0 ? COLORS.changeRate.up : COLORS.changeRate.down;
    },

    /** 마커 스타일 생성 */
    createMarkerStyle(type: 'transaction' | 'selected' | 'default' = 'default') {
        switch (type) {
            case 'transaction':
                return {
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: PADDING.marker.sm,
                    background: `rgba(255, 255, 255, ${OPACITY.marker.default})`,
                    borderRadius: BORDER_RADIUS.full,
                    border: `1px solid ${COLORS.ui.border.default}`,
                    boxShadow: SHADOWS.marker,
                };
            case 'selected':
                return {
                    padding: PADDING.marker.lg,
                    backgroundColor: COLORS.selection.selected,
                    borderRadius: BORDER_RADIUS.lg,
                    border: `2px solid ${COLORS.selection.selectedBorder}`,
                    boxShadow: SHADOWS.selected,
                    color: COLORS.selection.selectedText,
                };
            default:
                return {
                    backgroundColor: COLORS.ui.background.primary,
                    border: `1px solid ${COLORS.ui.border.default}`,
                    borderRadius: BORDER_RADIUS.md,
                    boxShadow: SHADOWS.md,
                };
        }
    },
} as const;

/** 타입 정의 */
export type ColorKey = keyof typeof COLORS;
export type OpacityKey = keyof typeof OPACITY;
export type ShadowKey = keyof typeof SHADOWS;
