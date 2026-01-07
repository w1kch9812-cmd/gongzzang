// lib/config/layer.config.ts
// 레이어 설정 - Single Source of Truth

/** 레이어 ID (모든 레이어 ID의 단일 소스) */
export const LAYER_IDS = {
    /** 폴리곤 레이어 */
    polygons: {
        sido: {
            fill: 'vt-sido-fill',
            line: 'vt-sido-line',
            label: 'vt-sido-label',
        },
        sig: {
            fill: 'vt-sig-fill',
            line: 'vt-sig-line',
            label: 'vt-sig-label',
        },
        emd: {
            fill: 'vt-emd-fill',
            line: 'vt-emd-line',
            label: 'vt-emd-label',
        },
        parcels: {
            fill: 'vt-parcels-fill',
            line: 'vt-parcels-line',
        },
        complex: {
            fill: 'vt-complex-fill',
            line: 'vt-complex-line',
            label: 'vt-complex-label',
            glow: {
                outer: 'vt-complex-glow-outer',
                mid: 'vt-complex-glow-mid',
                inner: 'vt-complex-glow-inner',
            },
        },
        lots: {
            fill: 'vt-lots-fill',
            line: 'vt-lots-line',
        },
        industries: {
            fill: 'vt-industries-fill',
            line: 'vt-industries-line',
        },
    },

    /** 마커 레이어 (GeoJSON) */
    markers: {
        factories: {
            points: 'factory-points',
            labels: 'factory-labels',
        },
        transactions: {
            dots: 'transaction-dots-layer',
        },
    },

    /** 분포 레이어 */
    distributions: {
        factoryZones: {
            fill: 'factory-zones-fill',
            line: 'factory-zones-outline',
        },
    },
} as const;

/** 소스 ID */
export const SOURCE_IDS = {
    sido: 'sido',
    sig: 'sig',
    emd: 'emd',
    parcels: 'parcels',
    complex: 'complex',
    lots: 'lots',
    industries: 'industries',
    factories: 'factories',
    transactionDots: 'transaction-dots',
    factoryZones: 'factory-zones',
} as const;

/** PMTiles URL */
export const PMTILES_URLS = {
    sido: 'pmtiles://sido',
    sig: 'pmtiles://sig',
    emd: 'pmtiles://emd',
    parcels: 'pmtiles://parcels',
    complex: 'pmtiles://complex',
    lots: 'pmtiles://lots',
    industries: 'pmtiles://industries',
} as const;

/** 레이어 헬퍼 */
export const LayerHelper = {
    /** 줌 레벨에 따른 활성 폴리곤 레이어 ID 반환 */
    getActivePolygonLayers(zoom: number): string[] {
        if (zoom <= 7) {
            return [
                LAYER_IDS.polygons.sido.fill,
                LAYER_IDS.polygons.sido.line,
            ];
        }
        if (zoom <= 11) {
            return [
                LAYER_IDS.polygons.sig.fill,
                LAYER_IDS.polygons.sig.line,
            ];
        }
        if (zoom <= 13) {
            return [
                LAYER_IDS.polygons.emd.fill,
                LAYER_IDS.polygons.emd.line,
            ];
        }
        return [
            LAYER_IDS.polygons.parcels.fill,
            LAYER_IDS.polygons.parcels.line,
        ];
    },

    /** 산업단지 관련 모든 레이어 ID */
    getAllComplexLayers(): string[] {
        return [
            LAYER_IDS.polygons.complex.fill,
            LAYER_IDS.polygons.complex.line,
            LAYER_IDS.polygons.complex.label,
            LAYER_IDS.polygons.complex.glow.outer,
            LAYER_IDS.polygons.complex.glow.mid,
            LAYER_IDS.polygons.complex.glow.inner,
        ];
    },

    /** 특정 엔티티의 모든 레이어 ID */
    getEntityLayers(entity: 'parcels' | 'complex' | 'lots' | 'industries'): string[] {
        const layers = LAYER_IDS.polygons[entity];
        if ('glow' in layers) {
            // complex의 경우 glow 포함
            const { fill, line, label, glow } = layers as typeof LAYER_IDS.polygons.complex;
            return [fill, line, label!, Object.values(glow)].flat();
        }
        return Object.values(layers);
    },

    /** 레이어 그룹 일괄 제어 */
    setLayerGroupVisibility(
        map: any,
        group: keyof typeof LAYER_IDS.polygons,
        visible: boolean
    ): void {
        const layers = this.getEntityLayers(group as any);
        const visibility = visible ? 'visible' : 'none';

        layers.forEach(layerId => {
            try {
                map.setLayoutProperty(layerId, 'visibility', visibility);
            } catch (e) {
                // 레이어가 없으면 무시
            }
        });
    },
} as const;

/** 타입 정의 */
export type LayerId = typeof LAYER_IDS[keyof typeof LAYER_IDS];
export type SourceId = typeof SOURCE_IDS[keyof typeof SOURCE_IDS];
