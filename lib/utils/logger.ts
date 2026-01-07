// lib/utils/logger.ts - 환경 기반 로거
// 개발 환경에서만 로그 출력, 프로덕션에서는 warn/error만 출력

const isDev = process.env.NODE_ENV === 'development';
// ⚡ 성능: 로그 완전 비활성화 (렉 해결용)
const ENABLE_LOGS = false;

export const logger = {
    /** 일반 로그 (개발 환경에서만 출력) */
    log: (...args: unknown[]) => {
        if (isDev && ENABLE_LOGS) console.log(...args);
    },

    /** 정보 로그 (개발 환경에서만 출력) */
    info: (...args: unknown[]) => {
        if (isDev && ENABLE_LOGS) console.info(...args);
    },

    /** 디버그 로그 (개발 환경에서만 출력) */
    debug: (...args: unknown[]) => {
        if (isDev && ENABLE_LOGS) console.debug(...args);
    },

    /** 경고 로그 (항상 출력) */
    warn: (...args: unknown[]) => {
        console.warn(...args);
    },

    /** 에러 로그 (항상 출력) */
    error: (...args: unknown[]) => {
        console.error(...args);
    },

    /** 성능 측정 시작 (개발 환경에서만) */
    time: (label: string) => {
        if (isDev) console.time(label);
    },

    /** 성능 측정 종료 (개발 환경에서만) */
    timeEnd: (label: string) => {
        if (isDev) console.timeEnd(label);
    },

    /** 그룹 시작 (개발 환경에서만) */
    group: (label: string) => {
        if (isDev) console.group(label);
    },

    /** 그룹 종료 (개발 환경에서만) */
    groupEnd: () => {
        if (isDev) console.groupEnd();
    },
};

export default logger;
