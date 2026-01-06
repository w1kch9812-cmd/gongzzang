// lib/markers/utils.ts
// 마커 관련 공통 유틸리티 함수

/** 가격 포맷 (만원 단위 → 읽기 쉬운 형식) */
export function formatPrice(price: number): string {
    if (price >= 10000) {
        const billions = Math.floor(price / 10000);
        const remainder = price % 10000;
        if (remainder >= 1000) {
            return `${billions}억${Math.floor(remainder / 1000)}천`;
        }
        return `${billions}억`;
    }
    if (price >= 1000) {
        return `${(price / 1000).toFixed(1)}천`;
    }
    return `${price}만`;
}

/** 면적 포맷 (m² → 평) */
export function formatArea(areaM2: number): number {
    // 1평 = 3.3058 m²
    return Math.round(areaM2 / 3.3058);
}

/** 면적 문자열 포맷 */
export function formatAreaString(areaM2: number): string {
    return `${formatArea(areaM2)}평`;
}
