// lib/utils/colors.ts
// 색상 관련 상수 및 함수 (Single Source of Truth)

// ===== 가격 색상 (가격 스펙트럼) =====

/** 가격 그라데이션 색상 (저가 → 고가) */
export const PRICE_COLORS = {
    low: '#3b82f6',     // 파랑 (최저가)
    mid: '#10b981',     // 녹색 (중간)
    high: '#ef4444',    // 빨강 (최고가)
    default: '#d1d5db', // 회색 (가격 없음)
} as const;

// ===== 증감률 색상 (상승/하락) =====

/** 증감률 색상 (RGB 배열) */
export const CHANGE_COLORS = {
    up: [239, 68, 68] as const,      // 빨강 (상승)
    down: [59, 130, 246] as const,   // 파랑 (하락)
    neutral: [156, 163, 175] as const, // 회색 (변동 없음)
} as const;

/** 증감률 임계값 (±2% 이내는 중립) */
export const CHANGE_THRESHOLD = 0.02;

// ===== 색상 변환 함수 =====

/**
 * 가격을 색상으로 변환 (정규화된 0~1 범위)
 * @param normalizedPrice 0~1 사이의 정규화된 가격
 * @returns hex 색상 문자열
 */
export function priceToColor(normalizedPrice: number): string {
    if (normalizedPrice <= 0) return PRICE_COLORS.low;
    if (normalizedPrice >= 1) return PRICE_COLORS.high;

    // 0~0.5: 파랑→녹색, 0.5~1: 녹색→빨강
    if (normalizedPrice < 0.5) {
        return interpolateHexColor(PRICE_COLORS.low, PRICE_COLORS.mid, normalizedPrice * 2);
    } else {
        return interpolateHexColor(PRICE_COLORS.mid, PRICE_COLORS.high, (normalizedPrice - 0.5) * 2);
    }
}

/**
 * 증감률을 RGBA 색상으로 변환
 * @param rate 증감률 (-1 ~ 1, null = 데이터 없음)
 * @returns [R, G, B, A] 배열 (0-255)
 */
export function changeRateToColor(rate: number | null): [number, number, number, number] {
    if (rate === null) return [0, 0, 0, 0]; // 투명

    // 임계값 이내는 중립
    if (Math.abs(rate) < CHANGE_THRESHOLD) {
        return [...CHANGE_COLORS.neutral, 40] as [number, number, number, number];
    }

    const color = rate > 0 ? CHANGE_COLORS.up : CHANGE_COLORS.down;
    // 투명도: 변동폭에 비례 (0.25 ~ 0.7)
    const alpha = Math.min(0.7, 0.25 + Math.abs(rate) * 0.9) * 255;

    return [color[0], color[1], color[2], Math.round(alpha)];
}

/**
 * RGBA 배열을 CSS rgba() 문자열로 변환
 */
export function rgbaToString(rgba: [number, number, number, number]): string {
    return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${(rgba[3] / 255).toFixed(2)})`;
}

/**
 * RGB 배열을 CSS rgba() 문자열로 변환 (alpha 지정)
 */
export function rgbToRgba(rgb: readonly [number, number, number], alpha: number): string {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

// ===== 헬퍼 함수 =====

/**
 * 두 hex 색상 사이를 보간
 * @param color1 시작 색상 (#RRGGBB)
 * @param color2 끝 색상 (#RRGGBB)
 * @param t 보간 비율 (0~1)
 */
function interpolateHexColor(color1: string, color2: string, t: number): string {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);

    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
