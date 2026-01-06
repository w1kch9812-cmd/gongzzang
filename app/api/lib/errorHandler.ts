// app/api/lib/errorHandler.ts - API 에러 처리 표준화

import { NextResponse } from 'next/server';

interface ApiErrorResponse {
    error: string;
    message: string;
    timestamp: string;
}

/**
 * API 에러 응답 생성 헬퍼
 * @param operation - 실패한 작업명 (예: 'Geocoding', 'Directions')
 * @param error - 발생한 에러
 * @param statusCode - HTTP 상태 코드 (기본: 500)
 */
export function handleApiError(
    operation: string,
    error: unknown,
    statusCode: number = 500
): NextResponse<ApiErrorResponse> {
    // 프로덕션에서는 상세 에러 로깅 (서버 사이드)
    if (process.env.NODE_ENV === 'production') {
        console.error(`[API Error] ${operation}:`, error);
    } else {
        console.error(`[API Error] ${operation}:`, error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
        {
            error: `${operation} failed`,
            message: errorMessage,
            timestamp: new Date().toISOString(),
        },
        { status: statusCode }
    );
}

/**
 * 필수 파라미터 검증 헬퍼
 * @param params - 검증할 파라미터 객체
 * @param required - 필수 파라미터 키 배열
 * @returns 누락된 파라미터 배열 또는 null
 */
export function validateRequiredParams(
    params: Record<string, string | null>,
    required: string[]
): string[] | null {
    const missing = required.filter(key => !params[key]);
    return missing.length > 0 ? missing : null;
}

/**
 * 400 Bad Request 응답 생성
 */
export function badRequest(message: string): NextResponse {
    return NextResponse.json(
        {
            error: 'Bad Request',
            message,
            timestamp: new Date().toISOString(),
        },
        { status: 400 }
    );
}
