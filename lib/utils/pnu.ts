// lib/utils/pnu.ts - PNU (필지고유번호) 파싱 유틸리티

/**
 * PNU 구조 (19자리):
 * - 0-1: 시도 코드 (2자리)
 * - 2-4: 시군구 코드 (3자리, 누적 5자리)
 * - 5-7: 읍면동 코드 (3자리, 누적 8자리)
 * - 8-9: 리 코드 (2자리, 누적 10자리)
 * - 10: 대/산/블록 구분 (1: 대, 2: 산)
 * - 11-14: 본번 (4자리)
 * - 15-18: 부번 (4자리)
 */

/** 시도 코드 추출 (2자리) */
export function extractSido(pnu: string): string {
    return pnu.substring(0, 2);
}

/** 시군구 코드 추출 (5자리) */
export function extractSig(pnu: string): string {
    return pnu.substring(0, 5);
}

/** 읍면동 코드 추출 (8자리) */
export function extractEmd(pnu: string): string {
    return pnu.substring(0, 8);
}

/** 읍면동+리 코드 추출 (10자리) */
export function extractEmdFull(pnu: string): string {
    return pnu.substring(0, 10);
}

/** 레벨별 지역 코드 추출 */
export function extractRegionCode(pnu: string, level: 'sido' | 'sig' | 'emd'): string {
    switch (level) {
        case 'sido': return extractSido(pnu);
        case 'sig': return extractSig(pnu);
        case 'emd': return extractEmd(pnu);
    }
}

/** PNU 유효성 검사 */
export function isValidPnu(pnu: string): boolean {
    return typeof pnu === 'string' && pnu.length === 19 && /^\d{19}$/.test(pnu);
}

/** 지번 파싱 (본번-부번) */
export function parseJibun(pnu: string): { main: number; sub: number; isSan: boolean } {
    const isSan = pnu.charAt(10) === '2';
    const main = parseInt(pnu.substring(11, 15), 10);
    const sub = parseInt(pnu.substring(15, 19), 10);
    return { main, sub, isSan };
}

/** 지번 문자열 생성 */
export function formatJibun(pnu: string): string {
    const { main, sub, isSan } = parseJibun(pnu);
    const prefix = isSan ? '산 ' : '';
    return sub > 0 ? `${prefix}${main}-${sub}` : `${prefix}${main}`;
}
