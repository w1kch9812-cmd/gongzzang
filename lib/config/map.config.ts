// lib/config/map.config.ts
// 지도 설정 - Single Source of Truth

/** 줌 레벨 정의 */
export const ZOOM_LEVELS = {
    /** 시도 레벨 (0-7) */
    SIDO: {
        min: 0,
        max: 7,
        default: 6,
    },
    /** 시군구 레벨 (8-11) */
    SIG: {
        min: 8,
        max: 11,
        default: 10,
    },
    /** 읍면동 레벨 (12-13) */
    EMD: {
        min: 12,
        max: 13,
        default: 12,
    },
    /** 필지 레벨 (14-22) */
    PARCEL: {
        min: 14,
        max: 22,
        default: 16,
    },
} as const;

/** 줌 레벨 헬퍼 함수 */
export const ZoomHelper = {
    /** 현재 줌이 어느 레벨인지 반환 */
    getLevel(zoom: number): 'SIDO' | 'SIG' | 'EMD' | 'PARCEL' {
        if (zoom <= ZOOM_LEVELS.SIDO.max) return 'SIDO';
        if (zoom <= ZOOM_LEVELS.SIG.max) return 'SIG';
        if (zoom <= ZOOM_LEVELS.EMD.max) return 'EMD';
        return 'PARCEL';
    },

    /** @deprecated Use getLevel() instead */
    getDistrictLevel(zoom: number): 'SIDO' | 'SIG' | 'EMD' | 'PARCEL' {
        return this.getLevel(zoom);
    },

    /** 특정 레벨에 속하는지 확인 */
    isLevel(zoom: number, level: keyof typeof ZOOM_LEVELS): boolean {
        const range = ZOOM_LEVELS[level];
        return zoom >= range.min && zoom <= range.max;
    },

    /** 필지가 보여야 하는 줌인지 확인 */
    shouldShowParcels(zoom: number): boolean {
        return zoom >= ZOOM_LEVELS.PARCEL.min;
    },

    /** 마커 샘플링이 필요한 줌인지 확인 */
    shouldSampleMarkers(zoom: number): boolean {
        return zoom >= 15;  // 고줌에서 샘플링
    },
} as const;

/** 지도 기본값 */
export const MAP_DEFAULTS = {
    center: { lat: 37.4563, lng: 126.7052 } as const,
    zoom: ZOOM_LEVELS.SIG.default,
    minZoom: ZOOM_LEVELS.SIDO.min,
    maxZoom: ZOOM_LEVELS.PARCEL.max,
    customStyleId: 'cdeeedd6-4ca4-41b5-ada8-6cba6e2046bd',
} as const;

/** 지역 코드 */
export const REGION_CODES = {
    INCHEON: '28',
    SEOUL: '11',
} as const;
