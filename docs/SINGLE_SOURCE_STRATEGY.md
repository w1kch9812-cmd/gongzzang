# 단일 소스 전략 (Single Source of Truth Strategy)

> 작성일: 2026-01-07
> 목적: 중앙 집중식 설정 관리 및 일괄 제어

---

## 📋 목차

1. [현재 문제점 분석](#1-현재-문제점-분석)
2. [단일 소스 설계](#2-단일-소스-설계)
3. [일괄 관리 시스템](#3-일괄-관리-시스템)
4. [마이그레이션 가이드](#4-마이그레이션-가이드)

---

## 1. 현재 문제점 분석

### 🔴 Critical: 분산된 설정값

#### 문제 1: 줌 레벨 하드코딩 (5개 파일)

```typescript
// ❌ 여러 곳에서 하드코딩
// UnifiedMarkerLayer.tsx
if (zoom >= 14) { ... }

// TransactionDotsLayer.tsx
minzoom: 14

// FactoryDistributionLayer.tsx
const FADE_START_ZOOM = 12;
const FADE_END_ZOOM = 14;

// UnifiedPolygonGLLayer.tsx
if (zoom < 14) { ... }
```

**문제**: 줌 레벨 기준을 변경하려면 **5개 파일**을 모두 수정해야 함

---

#### 문제 2: 색상 하드코딩 (26개 파일, 387개 인스턴스)

```typescript
// ❌ 곳곳에 흩어진 색상
// NaverMap.tsx
backgroundColor: '#e5e3df'

// UnifiedMarkerLayer.tsx
bgColor: '#1d4ed8'
borderColor: '#1e40af'
textColor: '#ffffff'

// UnifiedPolygonGLLayer.tsx
'rgba(59, 130, 246, 0.5)'
'rgba(239, 68, 68, 0.5)'
```

**문제**: 브랜드 색상 변경 시 **26개 파일, 387곳**을 찾아 수정해야 함

---

#### 문제 3: 레이어 ID 문자열 하드코딩 (4개 파일, 91개 인스턴스)

```typescript
// ❌ 문자열 하드코딩
map.addLayer({ id: 'vt-parcels-fill' });
map.removeLayer('vt-parcels-fill');
map.setLayoutProperty('vt-parcels-fill', ...);

// 오타 위험
map.addLayer({ id: 'vt-parcel-fill' });  // 's' 빠짐!
```

**문제**:
- 오타 발생 시 런타임 에러
- 리팩토링 어려움
- ID 변경 시 일일이 찾아서 수정

---

#### 문제 4: 타입 플래그 분산 해석

```typescript
// ❌ 여러 곳에서 다르게 해석
// dataHelpers.ts
export const hasTransactionPrice = (type: number) => (type & 1) !== 0;

// UnifiedMarkerLayer.tsx
if (parcel.type === 1) { ... }  // 직접 비교

// filter-store.ts
if (filter.dataType === 'transaction' && !hasTransactionPrice(parcel.type))
```

**문제**: 비트 플래그 의미를 여러 곳에서 다르게 해석

---

#### 문제 5: 설정값 중복 정의

```typescript
// ❌ 같은 설정이 여러 곳에
// constants.ts
export const CLUSTER_RADIUS = 80;

// UnifiedMarkerLayer.tsx
const CLUSTER_OPTIONS = {
    radius: 80,  // 중복!
}

// MarkerManager.ts
const POOL_SIZE_LIMITS = {
    factory: 200,  // 어디서 온 숫자?
}
```

---

## 2. 단일 소스 설계

### 2.1 🎯 설정 파일 구조

```
lib/config/
├── index.ts              # 통합 export
├── map.config.ts         # 지도 설정
├── layer.config.ts       # 레이어 설정
├── style.config.ts       # 스타일 설정
├── marker.config.ts      # 마커 설정
├── performance.config.ts # 성능 설정
└── types.ts              # 타입 정의
```

---

### 2.2 📐 map.config.ts - 지도 설정

```typescript
// lib/config/map.config.ts

/** 줌 레벨 정의 (Single Source of Truth) */
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
```

**사용 예시**:

```typescript
// ✅ 어디서든 일관되게 사용
import { ZOOM_LEVELS, ZoomHelper } from '@/lib/config/map.config';

// 레이어에서
minzoom: ZOOM_LEVELS.PARCEL.min,  // 14

// 조건문에서
if (ZoomHelper.shouldShowParcels(currentZoom)) { ... }

// 레벨 확인
const level = ZoomHelper.getLevel(currentZoom);  // 'PARCEL'
```

---

### 2.3 🎨 style.config.ts - 스타일 설정

```typescript
// lib/config/style.config.ts

/** 색상 팔레트 (Design System) */
export const COLORS = {
    /** 브랜드 색상 */
    brand: {
        primary: '#0066FF',
        secondary: '#7C3AED',
        accent: '#F97316',
    },

    /** 엔티티 색상 */
    entity: {
        factory: '#0066FF',
        factoryGlow: 'rgba(0, 102, 255, 0.4)',
        knowledgeCenter: '#7C3AED',
        warehouse: '#EA580C',
        land: '#16A34A',
        complex: '#F97316',
        listing: '#2563EB',
        auction: '#DC2626',
        transaction: '#059669',
    },

    /** UI 색상 */
    ui: {
        background: '#FFFFFF',
        mapBackground: '#E5E3DF',
        border: '#E5E7EB',
        text: {
            primary: '#111827',
            secondary: '#6B7280',
            muted: '#9CA3AF',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
    },

    /** 선택 상태 색상 */
    selection: {
        selected: '#1D4ED8',
        selectedBorder: '#1E40AF',
        hover: '#3B82F6',
    },

    /** 가격 히트맵 색상 */
    heatmap: {
        low: 'rgba(59, 130, 246, 0.5)',    // 파랑
        mid: 'rgba(255, 220, 0, 0.5)',     // 노랑
        high: 'rgba(239, 68, 68, 0.5)',    // 빨강
    },
} as const;

/** 투명도 */
export const OPACITY = {
    polygon: {
        default: 0.3,
        dataViz: 0.5,
        hover: 0.6,
        selected: 0.7,
    },
    marker: {
        default: 0.92,
        hover: 1,
        offscreen: {
            min: 0.3,
            max: 1,
        },
    },
} as const;

/** 그림자 */
export const SHADOWS = {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 2px 6px rgba(0, 0, 0, 0.12)',
    lg: '0 4px 12px rgba(0, 0, 0, 0.15)',
    xl: '0 8px 24px rgba(0, 0, 0, 0.2)',
    marker: '0 2px 6px rgba(0, 0, 0, 0.12)',
    selected: '0 4px 12px rgba(29, 78, 216, 0.4)',
} as const;

/** 테두리 반경 */
export const BORDER_RADIUS = {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '100px',
    marker: '100px',
    panel: '12px',
} as const;

/** 폰트 크기 */
export const FONT_SIZE = {
    xs: '10px',
    sm: '11px',
    md: '12px',
    lg: '13px',
    xl: '14px',
    '2xl': '16px',
} as const;

/** Z-Index 레이어 */
export const Z_INDEX = {
    map: 0,
    polygons: 100,
    markers: {
        base: 1000,
        hover: 10000,
        selected: 10001,
    },
    ui: {
        panels: 1000,
        modal: 2000,
        tooltip: 3000,
        toast: 4000,
    },
} as const;

/** Z-Index 헬퍼 */
export const ZIndexHelper = {
    /** 위도 기반 z-index 계산 (남쪽 마커가 위) */
    fromLatitude(lat: number, baseLayer: number = Z_INDEX.markers.base): number {
        const normalizedLat = ((38 - lat) / 5) * 1000;
        return baseLayer + Math.floor(normalizedLat);
    },
} as const;
```

**사용 예시**:

```typescript
// ✅ 어디서든 일관된 색상 사용
import { COLORS, SHADOWS, BORDER_RADIUS, Z_INDEX } from '@/lib/config/style.config';

// 마커 스타일
const markerStyle = {
    backgroundColor: COLORS.ui.background,
    border: `1px solid ${COLORS.ui.border}`,
    borderRadius: BORDER_RADIUS.marker,
    boxShadow: SHADOWS.marker,
};

// 선택된 필지 스타일
const selectedStyle = {
    backgroundColor: COLORS.selection.selected,
    boxShadow: SHADOWS.selected,
};

// z-index 계산
const zIndex = ZIndexHelper.fromLatitude(37.4563);
```

---

### 2.4 🗺️ layer.config.ts - 레이어 설정

```typescript
// lib/config/layer.config.ts

/** 레이어 ID (Single Source of Truth) */
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
        return Object.values(layers).flat();
    },
} as const;
```

**사용 예시**:

```typescript
// ✅ 타입 안전한 레이어 ID 사용
import { LAYER_IDS, SOURCE_IDS, LayerHelper } from '@/lib/config/layer.config';

// 레이어 추가
map.addLayer({
    id: LAYER_IDS.polygons.parcels.fill,  // 자동완성됨!
    source: SOURCE_IDS.parcels,
    type: 'fill',
});

// 레이어 제거 (오타 방지)
map.removeLayer(LAYER_IDS.polygons.parcels.fill);

// 줌에 따른 레이어 활성화
const activeLayers = LayerHelper.getActivePolygonLayers(currentZoom);
activeLayers.forEach(id => map.setLayoutProperty(id, 'visibility', 'visible'));
```

---

### 2.5 📍 marker.config.ts - 마커 설정

```typescript
// lib/config/marker.config.ts

import { ZOOM_LEVELS } from './map.config';

/** 마커 타입 (모든 마커 타입의 단일 소스) */
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
```

---

### 2.6 ⚡ performance.config.ts - 성능 설정

```typescript
// lib/config/performance.config.ts

/** 디바운스/스로틀 시간 */
export const TIMING = {
    debounce: {
        search: 300,
        mapMove: 100,
        resize: 200,
        markerLayer: 150,
        filter: 50,
    },
    animation: {
        bounce: 1000,
        float: 3000,
        morph: 300,
        fade: 200,
        transition: 300,
    },
    polling: {
        projection: 100,
        maxRetries: 30,
    },
} as const;

/** 데이터 제한 */
export const DATA_LIMITS = {
    maxMarkersPerType: 10000,
    maxClustersPerView: 500,
    batchSize: 100,
    maxCacheSize: 1000,
} as const;

/** 렌더링 우선순위 */
export const RENDER_PRIORITY = {
    polygons: 0,      // 즉시
    markers: 100,     // 100ms 지연
    dots: 200,        // 200ms 지연
} as const;
```

---

### 2.7 📦 index.ts - 통합 Export

```typescript
// lib/config/index.ts

// 지도 설정
export * from './map.config';

// 스타일 설정
export * from './style.config';

// 레이어 설정
export * from './layer.config';

// 마커 설정
export * from './marker.config';

// 성능 설정
export * from './performance.config';

// 편의 함수: 모든 설정을 한 번에 가져오기
export { default as CONFIG } from './all.config';
```

```typescript
// lib/config/all.config.ts
import * as MapConfig from './map.config';
import * as StyleConfig from './style.config';
import * as LayerConfig from './layer.config';
import * as MarkerConfig from './marker.config';
import * as PerformanceConfig from './performance.config';

/** 모든 설정을 포함하는 통합 객체 */
export default {
    map: MapConfig,
    style: StyleConfig,
    layer: LayerConfig,
    marker: MarkerConfig,
    performance: PerformanceConfig,
} as const;
```

---

## 3. 일괄 관리 시스템

### 3.1 🎛️ 설정 관리자 (ConfigManager)

```typescript
// lib/config/ConfigManager.ts

import CONFIG from './all.config';

/** 설정 관리자 (일괄 제어) */
export class ConfigManager {
    private static instance: ConfigManager;
    private config = CONFIG;

    private constructor() {}

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    /** 전체 설정 가져오기 */
    getAll() {
        return this.config;
    }

    /** 특정 카테고리 설정 가져오기 */
    get<T extends keyof typeof CONFIG>(category: T) {
        return this.config[category];
    }

    /** 설정 검증 */
    validate(): boolean {
        const errors: string[] = [];

        // 줌 레벨 검증
        const { ZOOM_LEVELS } = this.config.map;
        Object.entries(ZOOM_LEVELS).forEach(([key, range]) => {
            if (range.min > range.max) {
                errors.push(`${key}: min (${range.min}) > max (${range.max})`);
            }
        });

        // 색상 검증
        const { COLORS } = this.config.style;
        const validateHex = (color: string) => /^#[0-9A-Fa-f]{6}$/.test(color);

        Object.entries(COLORS.entity).forEach(([key, color]) => {
            if (!validateHex(color) && !color.startsWith('rgba')) {
                errors.push(`Invalid color for ${key}: ${color}`);
            }
        });

        if (errors.length > 0) {
            console.error('❌ 설정 검증 실패:', errors);
            return false;
        }

        console.log('✅ 설정 검증 성공');
        return true;
    }

    /** 설정 요약 출력 (디버깅용) */
    summary() {
        console.log('📋 설정 요약:');
        console.log('  지도:', {
            줌레벨: Object.keys(this.config.map.ZOOM_LEVELS).length,
            기본중심: this.config.map.MAP_DEFAULTS.center,
        });
        console.log('  스타일:', {
            색상팔레트: Object.keys(this.config.style.COLORS).length,
            투명도레벨: Object.keys(this.config.style.OPACITY).length,
        });
        console.log('  레이어:', {
            폴리곤레이어: Object.keys(this.config.layer.LAYER_IDS.polygons).length,
            소스: Object.keys(this.config.layer.SOURCE_IDS).length,
        });
        console.log('  마커:', {
            타입: Object.keys(this.config.marker.MARKER_TYPES).length,
            풀제한: Object.keys(this.config.marker.MARKER_POOL_LIMITS).length,
        });
    }

    /** 환경별 설정 오버라이드 (개발/프로덕션) */
    applyEnvironment(env: 'development' | 'production') {
        if (env === 'development') {
            // 개발 환경: 샘플링 비활성화
            (this.config.marker.MARKER_SAMPLING as any).enabled = false;
            console.log('🔧 개발 모드: 마커 샘플링 비활성화');
        }
    }
}

// 싱글톤 인스턴스 export
export const configManager = ConfigManager.getInstance();
```

---

### 3.2 🔧 설정 검증 스크립트

```typescript
// scripts/validate-config.ts

import { configManager } from '@/lib/config/ConfigManager';

/** 설정 검증 실행 */
function main() {
    console.log('🔍 설정 검증 시작...\n');

    // 요약 출력
    configManager.summary();
    console.log('');

    // 검증 실행
    const isValid = configManager.validate();

    if (!isValid) {
        process.exit(1);
    }

    console.log('\n✅ 모든 설정이 올바릅니다');
}

main();
```

**package.json에 추가**:

```json
{
  "scripts": {
    "config:validate": "npx tsx scripts/validate-config.ts",
    "config:summary": "npx tsx -e \"require('./lib/config/ConfigManager').configManager.summary()\""
  }
}
```

---

### 3.3 🎨 테마 전환 시스템

```typescript
// lib/config/themes.ts

import { COLORS, OPACITY, SHADOWS } from './style.config';

/** 테마 정의 */
export const THEMES = {
    light: {
        colors: COLORS,
        opacity: OPACITY,
        shadows: SHADOWS,
    },
    dark: {
        colors: {
            ...COLORS,
            ui: {
                ...COLORS.ui,
                background: '#1F2937',
                mapBackground: '#111827',
                border: '#374151',
                text: {
                    primary: '#F9FAFB',
                    secondary: '#D1D5DB',
                    muted: '#9CA3AF',
                },
            },
        },
        opacity: OPACITY,
        shadows: {
            ...SHADOWS,
            md: '0 2px 6px rgba(0, 0, 0, 0.5)',
            lg: '0 4px 12px rgba(0, 0, 0, 0.6)',
        },
    },
} as const;

/** 테마 관리자 */
export class ThemeManager {
    private currentTheme: keyof typeof THEMES = 'light';

    setTheme(theme: keyof typeof THEMES) {
        this.currentTheme = theme;
        this.applyTheme();
    }

    getTheme() {
        return THEMES[this.currentTheme];
    }

    private applyTheme() {
        const theme = THEMES[this.currentTheme];

        // CSS 변수 업데이트 (전역)
        document.documentElement.style.setProperty(
            '--bg-color',
            theme.colors.ui.background
        );
        document.documentElement.style.setProperty(
            '--text-color',
            theme.colors.ui.text.primary
        );
        // ... 기타 CSS 변수
    }

    toggle() {
        this.setTheme(this.currentTheme === 'light' ? 'dark' : 'light');
    }
}

export const themeManager = new ThemeManager();
```

---

## 4. 마이그레이션 가이드

### 4.1 📝 단계별 마이그레이션

#### Phase 1: 설정 파일 생성 (1일)

1. `lib/config/` 폴더 생성
2. 위의 설정 파일들 생성
3. ConfigManager 구현
4. 검증 스크립트 추가

#### Phase 2: 기존 코드 마이그레이션 (2-3일)

**우선순위 1: 레이어 ID 교체**

```bash
# 자동 교체 스크립트
npx tsx scripts/migrate-layer-ids.ts
```

```typescript
// scripts/migrate-layer-ids.ts
import * as fs from 'fs';
import * as path from 'path';

const REPLACEMENTS = {
    "'vt-parcels-fill'": "LAYER_IDS.polygons.parcels.fill",
    '"vt-parcels-fill"': "LAYER_IDS.polygons.parcels.fill",
    // ... 모든 레이어 ID
};

function migrateFile(filePath: string) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    Object.entries(REPLACEMENTS).forEach(([old, newValue]) => {
        if (content.includes(old)) {
            content = content.replace(new RegExp(old, 'g'), newValue);
            changed = true;
        }
    });

    if (changed) {
        // import 추가
        if (!content.includes('LAYER_IDS')) {
            content = `import { LAYER_IDS } from '@/lib/config/layer.config';\n${content}`;
        }
        fs.writeFileSync(filePath, content);
        console.log(`✅ ${filePath} 마이그레이션 완료`);
    }
}

// components/ 폴더 내 모든 .tsx 파일 처리
// ...
```

**우선순위 2: 색상 교체**

수동으로 교체 (자동화 어려움):

```typescript
// ❌ Before
backgroundColor: '#1d4ed8'

// ✅ After
import { COLORS } from '@/lib/config';
backgroundColor: COLORS.selection.selected
```

**우선순위 3: 줌 레벨 교체**

```typescript
// ❌ Before
if (zoom >= 14) { ... }

// ✅ After
import { ZOOM_LEVELS, ZoomHelper } from '@/lib/config';
if (ZoomHelper.shouldShowParcels(zoom)) { ... }
```

---

### 4.2 ✅ 마이그레이션 체크리스트

**설정 파일**
- [ ] map.config.ts 생성
- [ ] style.config.ts 생성
- [ ] layer.config.ts 생성
- [ ] marker.config.ts 생성
- [ ] performance.config.ts 생성
- [ ] ConfigManager.ts 구현
- [ ] 검증 스크립트 추가

**코드 마이그레이션**
- [ ] UnifiedPolygonGLLayer.tsx - 레이어 ID 교체
- [ ] UnifiedMarkerLayer.tsx - 마커 타입/줌 레벨 교체
- [ ] TransactionDotsLayer.tsx - 레이어 ID 교체
- [ ] FactoryDistributionLayer.tsx - 레이어 ID/색상 교체
- [ ] NaverMap.tsx - 지도 기본값 교체
- [ ] MarkerManager.ts - 풀 크기/타입 교체

**검증**
- [ ] `npm run config:validate` 성공
- [ ] `npm run config:summary` 출력 확인
- [ ] TypeScript 컴파일 에러 없음
- [ ] 런타임 에러 없음
- [ ] 화면 표시 정상

---

## 5. 혜택 요약

### ✅ 단일 소스 적용 후

| 변경 사항 | Before | After |
|-----------|--------|-------|
| 줌 레벨 변경 | 5개 파일 수정 | **1개 파일 수정** |
| 색상 변경 | 26개 파일 수정 | **1개 파일 수정** |
| 레이어 ID 변경 | 91개 문자열 찾기 | **1개 상수 변경** |
| 오타 위험 | 런타임 에러 | **컴파일 타임 감지** |
| 일괄 관리 | 불가능 | **ConfigManager로 가능** |

### 🎯 실제 사례

**예시 1: 필지 표시 줌 레벨 변경**

```typescript
// ❌ Before: 5개 파일 수정
// UnifiedMarkerLayer.tsx
if (zoom >= 14) { ... }  // 14 → 13 수정

// TransactionDotsLayer.tsx
minzoom: 14,  // 14 → 13 수정

// ... 3개 파일 더

// ✅ After: 1곳만 수정
// lib/config/map.config.ts
PARCEL: {
    min: 13,  // 14 → 13
    max: 22,
}

// 모든 곳에서 자동 반영됨!
```

**예시 2: 브랜드 색상 변경**

```typescript
// ❌ Before: 26개 파일, 387곳 수정
// 찾기: #0066FF
// 바꾸기: #0052CC (일일이 확인하며 교체)

// ✅ After: 1곳만 수정
// lib/config/style.config.ts
entity: {
    factory: '#0052CC',  // #0066FF → #0052CC
}

// 모든 공장 마커 색상 자동 변경!
```

**예시 3: 다크 모드 지원**

```typescript
// ❌ Before: 불가능 (하드코딩된 색상)

// ✅ After: 테마 전환 한 줄
import { themeManager } from '@/lib/config/themes';

themeManager.setTheme('dark');
// 모든 색상 자동 전환!
```

---

## 6. 참고 자료

- [constants.ts](../lib/constants.ts) - 현재 상수 파일
- [zoomConfig.ts](../lib/map/zoomConfig.ts) - 줌 레벨 설정
- [Design System Best Practices](https://www.designsystems.com/)
- [Single Source of Truth Pattern](https://en.wikipedia.org/wiki/Single_source_of_truth)

---

**마지막 업데이트**: 2026-01-07
