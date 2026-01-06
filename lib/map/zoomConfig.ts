// lib/map/zoomConfig.ts - 줌 레벨 상수 Single Source of Truth

import type { ZoomRange } from '@/types/map';

// ===== 행정구역 레벨별 줌 범위 =====

export const ZOOM_SIDO: ZoomRange = { min: 0, max: 8 };
export const ZOOM_SIG: ZoomRange = { min: 8, max: 12 };
export const ZOOM_EMD: ZoomRange = { min: 12, max: 14 };
export const ZOOM_PARCEL: ZoomRange = { min: 14, max: 22 };

// ===== 핵심 전환점 =====

export const THRESHOLD_SIDO_TO_SIG = 8;
export const THRESHOLD_SIG_TO_EMD = 12;
export const THRESHOLD_REGION_TO_PARCEL = 14;

// ===== 표시 조건 함수 =====

/** 필지 마커 표시 조건 (줌 14+) */
export const shouldShowParcelMarkers = (zoom: number): boolean => {
    return zoom >= ZOOM_PARCEL.min;
};

/** 행정구역 마커 표시 조건 (줌 8-13) */
export const shouldShowRegionMarkers = (zoom: number): boolean => {
    return zoom >= ZOOM_SIG.min && zoom < ZOOM_PARCEL.min;
};

/** 시군구 레벨 표시 조건 */
export const shouldShowSIG = (zoom: number): boolean => {
    return zoom >= ZOOM_SIG.min && zoom < ZOOM_EMD.min;
};

/** 읍면동 레벨 표시 조건 */
export const shouldShowEMD = (zoom: number): boolean => {
    return zoom >= ZOOM_EMD.min && zoom < ZOOM_PARCEL.min;
};

/** 현재 줌에 맞는 행정구역 레벨 반환 */
export const getDistrictLevel = (zoom: number): 'sido' | 'sig' | 'emd' | 'parcel' => {
    if (zoom < ZOOM_SIG.min) return 'sido';
    if (zoom < ZOOM_EMD.min) return 'sig';
    if (zoom < ZOOM_PARCEL.min) return 'emd';
    return 'parcel';
};

// ===== 클러스터 설정 =====

export const CLUSTER_CONFIG = {
    radius: 80,
    minZoom: ZOOM_PARCEL.min,
    maxZoom: 20,
    minPoints: 2,
} as const;

// ===== 클러스터링 단계 정의 =====

/**
 * 필지 마커의 3단계 클러스터링
 *
 * Stage 1 (줌 8-12): 시군구 클러스터 (SIG)
 *   - "인천 남동구" 같은 시군구 단위로 집계
 *   - 예: "남동구 5,432개 필지"
 *
 * Stage 2 (줌 12-14): 읍면동 클러스터 (EMD)
 *   - "논현동" 같은 읍면동 단위로 집계
 *   - 예: "논현동 1,234개 필지"
 *
 * Stage 3 (줌 14+): 필지 개별 마커 또는 소규모 클러스터
 *   - 개별 필지 표시
 *   - 밀집 지역만 클러스터링 (반경 80px)
 */
export const CLUSTERING_STAGES = {
    SIG: { zoom: ZOOM_SIG, label: '시군구 클러스터' },
    EMD: { zoom: ZOOM_EMD, label: '읍면동 클러스터' },
    PARCEL: { zoom: ZOOM_PARCEL, label: '필지 개별/소규모 클러스터' },
} as const;

/** 현재 줌에 맞는 클러스터링 단계 반환 */
export const getClusteringStage = (zoom: number): 'SIG' | 'EMD' | 'PARCEL' => {
    if (zoom < ZOOM_EMD.min) return 'SIG';
    if (zoom < ZOOM_PARCEL.min) return 'EMD';
    return 'PARCEL';
};

// ===== 마커 표시 여부 판단 함수 (중앙 집중식) =====

/** 마커 타입별 표시 여부 판단 */
export const shouldShowMarkerByType = (
    type: 'region' | 'property' | 'transaction' | 'complex' | 'knowledge' | 'factory' | 'poi',
    zoom: number,
    level?: 'SIG' | 'EMD'
): boolean => {
    switch (type) {
        case 'region':
            if (level === 'SIG') return shouldShowSIG(zoom);
            if (level === 'EMD') return shouldShowEMD(zoom);
            return shouldShowRegionMarkers(zoom);

        case 'property':
        case 'transaction':
        case 'factory':
            return shouldShowParcelMarkers(zoom);

        case 'complex':
        case 'knowledge':
        case 'poi':
            return true; // 전 줌 레벨 표시

        default:
            return false;
    }
};
