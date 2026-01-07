// lib/config/marker.config.ts
// 마커 설정 - Single Source of Truth

import { ZOOM_LEVELS } from './map.config';

/** 마커 타입 */
export const MARKER_TYPES = {
    transaction: 'transaction',
    listing: 'listing',
    auction: 'auction',
    clusterTx: 'cluster-tx',
    clusterProp: 'cluster-prop',
    region: 'region',
    kc: 'kc',
    kcCluster: 'kc-cluster',
    kcAd: 'kc-ad',
    ic: 'ic',
    icCluster: 'ic-cluster',
    icAd: 'ic-ad',
    factory: 'factory',
    factoryCluster: 'factory-cluster',
    warehouse: 'warehouse',
    warehouseCluster: 'warehouse-cluster',
    land: 'land',
    landCluster: 'land-cluster',
} as const;

export type MarkerType = typeof MARKER_TYPES[keyof typeof MARKER_TYPES];

/** 클러스터 설정 */
export const CLUSTER_CONFIG = {
    radius: 80,
    minPoints: 2,
    maxZoom: {
        general: 22,
        ic: 14,
        kc: 16,
        transaction: 18,
        listing: 18,
        auction: 18,
    },
} as const;

/** 마커 풀 크기 제한 */
export const MARKER_POOL_LIMITS: Record<MarkerType, number> = {
    [MARKER_TYPES.transaction]: 100,
    [MARKER_TYPES.listing]: 100,
    [MARKER_TYPES.auction]: 100,
    [MARKER_TYPES.clusterTx]: 50,
    [MARKER_TYPES.clusterProp]: 50,
    [MARKER_TYPES.region]: 30,
    [MARKER_TYPES.kc]: 50,
    [MARKER_TYPES.kcCluster]: 30,
    [MARKER_TYPES.kcAd]: 20,
    [MARKER_TYPES.ic]: 50,
    [MARKER_TYPES.icCluster]: 30,
    [MARKER_TYPES.icAd]: 20,
    [MARKER_TYPES.factory]: 200,
    [MARKER_TYPES.factoryCluster]: 50,
    [MARKER_TYPES.warehouse]: 100,
    [MARKER_TYPES.warehouseCluster]: 30,
    [MARKER_TYPES.land]: 100,
    [MARKER_TYPES.landCluster]: 30,
} as const;

/** 마커 샘플링 설정 */
export const MARKER_SAMPLING = {
    enabled: true,
    thresholdZoom: 15,
    rate: 0.4,  // 40% 표시
} as const;

/** 오프스크린 마커 설정 */
export const OFFSCREEN_MARKER_CONFIG = {
    maxCount: {
        ic: 4,
        kc: 3,
    },
    edgePadding: 8,
    opacityMaxRatio: 2,
    minOpacity: 0.3,
} as const;

/** 마커 표시 조건 헬퍼 */
export const MarkerHelper = {
    /** 줌 레벨에 따라 마커를 표시해야 하는지 확인 */
    shouldShow(markerType: MarkerType, zoom: number): boolean {
        switch (markerType) {
            case MARKER_TYPES.region:
                return zoom < ZOOM_LEVELS.PARCEL.min;
            case MARKER_TYPES.ic:
            case MARKER_TYPES.icCluster:
                return true;  // 모든 줌에서 표시
            case MARKER_TYPES.kc:
            case MARKER_TYPES.kcCluster:
                return zoom >= ZOOM_LEVELS.SIG.min;
            case MARKER_TYPES.factory:
            case MARKER_TYPES.factoryCluster:
                return zoom >= ZOOM_LEVELS.EMD.min;
            default:
                return zoom >= ZOOM_LEVELS.PARCEL.min;
        }
    },

    /** 샘플링 적용 여부 */
    shouldSample(zoom: number): boolean {
        return MARKER_SAMPLING.enabled && zoom >= MARKER_SAMPLING.thresholdZoom;
    },

    /** 샘플링 비율 */
    getSamplingRate(zoom: number): number {
        return MarkerHelper.shouldSample(zoom) ? MARKER_SAMPLING.rate : 1;
    },
} as const;
