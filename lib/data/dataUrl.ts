// lib/data/dataUrl.ts
// 데이터 URL 헬퍼 - Single Source of Truth
//
// 모든 데이터 로딩에서 이 함수를 사용하여 일관된 URL 생성

// R2 CDN URL (Cloudflare R2 퍼블릭 액세스)
const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_URL || '';

/**
 * 데이터 URL 생성 헬퍼
 * R2 URL이 설정되면 R2에서, 아니면 로컬에서 로드
 *
 * @param path 데이터 경로 (예: '/data/entities/parcels.json')
 * @returns 완전한 URL
 */
export function getDataUrl(path: string): string {
    if (R2_BASE_URL) {
        return `${R2_BASE_URL}${path}`;
    }
    return path;
}

/**
 * R2 URL이 설정되어 있는지 확인
 */
export function isR2Configured(): boolean {
    return !!R2_BASE_URL;
}

/**
 * R2 기본 URL 반환
 */
export function getR2BaseUrl(): string {
    return R2_BASE_URL;
}
