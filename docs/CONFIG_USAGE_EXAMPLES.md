# 설정 파일 사용 예시

> 단일 소스(Single Source of Truth) 적용 실전 예제

---

## 🎯 Before & After 비교

### 예시 1: 레이어 추가

#### ❌ Before (하드코딩)

```typescript
// components/map/naver/UnifiedPolygonGLLayer.tsx

// 레이어 추가
map.addLayer({
    id: 'vt-parcels-fill',  // 오타 위험!
    source: 'parcels',
    type: 'fill',
});

// 나중에 레이어 제거
map.removeLayer('vt-parcel-fill');  // 's' 빠짐! 런타임 에러!
```

#### ✅ After (설정 사용)

```typescript
import { LAYER_IDS, SOURCE_IDS } from '@/lib/config/layer.config';

// 레이어 추가 (자동완성 됨!)
map.addLayer({
    id: LAYER_IDS.polygons.parcels.fill,  // 'vt-parcels-fill'
    source: SOURCE_IDS.parcels,             // 'parcels'
    type: 'fill',
});

// 레이어 제거 (오타 불가능!)
map.removeLayer(LAYER_IDS.polygons.parcels.fill);
```

---

### 예시 2: 줌 레벨 조건

#### ❌ Before

```typescript
// 여러 곳에 흩어진 줌 레벨 하드코딩
if (zoom >= 14) {
    showParcels();
}

if (zoom < 12) {
    showSig();
} else if (zoom < 14) {
    showEmd();
}

// 나중에 "필지를 줌 13부터 표시하자"고 하면?
// → 모든 파일에서 14를 찾아서 13으로 변경해야 함!
```

#### ✅ After

```typescript
import { ZOOM_LEVELS, ZoomHelper } from '@/lib/config/map.config';

// 의미 있는 헬퍼 사용
if (ZoomHelper.shouldShowParcels(zoom)) {
    showParcels();
}

// 레벨 확인
const level = ZoomHelper.getLevel(zoom);
switch (level) {
    case 'SIG':
        showSig();
        break;
    case 'EMD':
        showEmd();
        break;
    case 'PARCEL':
        showParcels();
        break;
}

// 나중에 변경하려면?
// → map.config.ts에서 PARCEL.min만 변경하면 모든 곳 자동 적용!
```

---

### 예시 3: 색상 사용

#### ❌ Before

```typescript
// 곳곳에 흩어진 색상 하드코딩
const markerStyle = {
    backgroundColor: '#1d4ed8',
    borderColor: '#1e40af',
    color: '#ffffff',
};

// 실거래 점 색상
'circle-color': '#059669',

// 공장 아이콘 색상
fill: '#0066FF',

// 브랜드 색상 변경 시 → 모든 파일 뒤져서 수정해야 함!
```

#### ✅ After

```typescript
import { COLORS, StyleHelper } from '@/lib/config/style.config';

// 선택된 마커 스타일
const markerStyle = StyleHelper.createMarkerStyle('selected');
// {
//   backgroundColor: '#1D4ED8',
//   borderColor: '#1E40AF',
//   color: '#FFFFFF',
//   ...
// }

// 실거래 점 색상
'circle-color': COLORS.entity.transaction,  // '#059669'

// 공장 아이콘 색상
fill: COLORS.entity.factory,  // '#0066FF'

// 브랜드 색상 변경 시 → style.config.ts 한 곳만 수정!
```

---

## 🎨 실전 적용 예시

### 컴포넌트에서 사용

#### UnifiedPolygonGLLayer.tsx

```typescript
import { LAYER_IDS, SOURCE_IDS, PMTILES_URLS, LayerHelper } from '@/lib/config/layer.config';
import { COLORS, OPACITY, StyleHelper } from '@/lib/config/style.config';
import { ZOOM_LEVELS } from '@/lib/config/map.config';

// ===== 소스 추가 =====
map.addSource(SOURCE_IDS.parcels, {
    type: 'vector',
    tiles: [PMTILES_URLS.parcels],
    promoteId: 'PNU',
    minzoom: ZOOM_LEVELS.PARCEL.min,
    maxzoom: ZOOM_LEVELS.PARCEL.max,
});

// ===== 레이어 추가 =====
map.addLayer({
    id: LAYER_IDS.polygons.parcels.fill,
    source: SOURCE_IDS.parcels,
    type: 'fill',
    minzoom: ZOOM_LEVELS.PARCEL.min,
    paint: {
        'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            COLORS.selection.selected,
            COLORS.ui.mapBackground,
        ],
        'fill-opacity': OPACITY.polygon.default,
    },
});

// ===== 줌에 따라 레이어 전환 =====
useEffect(() => {
    const activeLayers = LayerHelper.getActivePolygonLayers(currentZoom);

    // 모든 폴리곤 레이어 숨김
    Object.values(LAYER_IDS.polygons).forEach(group => {
        Object.values(group).forEach(layerId => {
            if (typeof layerId === 'string') {
                map.setLayoutProperty(layerId, 'visibility', 'none');
            }
        });
    });

    // 활성 레이어만 표시
    activeLayers.forEach(layerId => {
        map.setLayoutProperty(layerId, 'visibility', 'visible');
    });
}, [currentZoom]);

// ===== 레이어 그룹 일괄 제어 =====
const toggleParcels = (visible: boolean) => {
    LayerHelper.setLayerGroupVisibility(map, 'parcels', visible);
};
```

#### UnifiedMarkerLayer.tsx

```typescript
import { ZOOM_LEVELS, ZoomHelper } from '@/lib/config/map.config';
import { COLORS, SHADOWS, BORDER_RADIUS, PADDING, FONT_SIZE } from '@/lib/config/style.config';
import { MARKER_TYPES, CLUSTER_CONFIG, MarkerHelper } from '@/lib/config/marker.config';

// ===== 마커 필터링 =====
const filteredMarkers = allMarkers.filter(marker => {
    // 줌에 따라 표시 여부 결정
    if (!MarkerHelper.shouldShow(marker.type, currentZoom)) {
        return false;
    }

    // 샘플링 적용
    if (MarkerHelper.shouldSample(currentZoom)) {
        const hash = getSamplingHash(marker.id);
        const rate = MarkerHelper.getSamplingRate(currentZoom);
        if (hash % 100 >= rate * 100) {
            return false;
        }
    }

    return true;
});

// ===== Supercluster 설정 =====
const supercluster = new Supercluster({
    radius: CLUSTER_CONFIG.radius,
    minPoints: CLUSTER_CONFIG.minPoints,
    maxZoom: CLUSTER_CONFIG.maxZoom.general,
});

// ===== 마커 스타일 =====
const createMarkerElement = (type: MarkerType) => {
    const div = document.createElement('div');

    if (type === MARKER_TYPES.transaction) {
        // 실거래 마커
        Object.assign(div.style, {
            padding: PADDING.marker.sm,
            backgroundColor: COLORS.ui.background,
            borderRadius: BORDER_RADIUS.marker,
            boxShadow: SHADOWS.marker,
            fontSize: FONT_SIZE.md,
            color: COLORS.ui.text.primary,
        });
    } else if (type === MARKER_TYPES.factory) {
        // 공장 마커
        Object.assign(div.style, {
            padding: PADDING.marker.md,
            backgroundColor: COLORS.entity.factory,
            borderRadius: BORDER_RADIUS.md,
            color: COLORS.ui.background,
        });
    }

    return div;
};
```

---

## 🔧 일괄 관리 예시

### 레이어 가시성 일괄 제어

```typescript
import { LayerHelper, LAYER_IDS } from '@/lib/config/layer.config';

// ===== 개별 제어 (Before) =====
map.setLayoutProperty('vt-complex-fill', 'visibility', 'none');
map.setLayoutProperty('vt-complex-line', 'visibility', 'none');
map.setLayoutProperty('vt-complex-label', 'visibility', 'none');
map.setLayoutProperty('vt-complex-glow-outer', 'visibility', 'none');
map.setLayoutProperty('vt-complex-glow-mid', 'visibility', 'none');
map.setLayoutProperty('vt-complex-glow-inner', 'visibility', 'none');

// ===== 일괄 제어 (After) =====
LayerHelper.setLayerGroupVisibility(map, 'complex', false);
```

### 색상 테마 전환

```typescript
import { COLORS } from '@/lib/config/style.config';

// ===== 라이트 모드 =====
const lightColors = COLORS;

// ===== 다크 모드 (확장) =====
const darkColors = {
    ...COLORS,
    ui: {
        ...COLORS.ui,
        background: '#1F2937',
        mapBackground: '#111827',
        text: {
            primary: '#F9FAFB',
            secondary: '#D1D5DB',
            muted: '#9CA3AF',
        },
    },
};

// 테마 적용
const applyTheme = (isDark: boolean) => {
    const theme = isDark ? darkColors : lightColors;

    // 모든 마커에 자동 적용
    document.documentElement.style.setProperty('--bg-color', theme.ui.background);
    document.documentElement.style.setProperty('--text-color', theme.ui.text.primary);
};
```

---

## 🎯 실전 시나리오

### 시나리오 1: "필지를 줌 13부터 보이게 해주세요"

#### ❌ Before: 5개 파일 수정

1. `UnifiedMarkerLayer.tsx` - `if (zoom >= 14)` → `if (zoom >= 13)`
2. `UnifiedPolygonGLLayer.tsx` - `minzoom: 14` → `minzoom: 13`
3. `TransactionDotsLayer.tsx` - `minzoom: 14` → `minzoom: 13`
4. `FactoryDistributionLayer.tsx` - `FADE_END_ZOOM = 14` → `13`
5. `zoomConfig.ts` - `ZOOM_PARCEL.min = 14` → `13`

#### ✅ After: 1곳만 수정

```typescript
// lib/config/map.config.ts
export const ZOOM_LEVELS = {
    // ...
    PARCEL: {
        min: 13,  // 14 → 13 (여기만 수정!)
        max: 22,
    },
};

// 모든 곳에서 자동 반영됨!
```

---

### 시나리오 2: "공장 색상을 파랑에서 초록으로 바꿔주세요"

#### ❌ Before: 26개 파일, 수십 곳 수정

전체 프로젝트에서 `#0066FF` 찾기 → 공장 관련인지 확인 → 수정

#### ✅ After: 1줄 수정

```typescript
// lib/config/style.config.ts
export const COLORS = {
    entity: {
        factory: '#16A34A',  // #0066FF → #16A34A (여기만!)
        // ...
    },
};

// 모든 공장 마커/아이콘 자동 변경!
```

---

### 시나리오 3: "레이어 이름을 변경해야 해요"

#### ❌ Before: 오타 위험, 일괄 변경 어려움

```typescript
// 91개 문자열을 모두 찾아서 변경
'vt-parcels-fill' → 'layer-parcels-fill'
```

#### ✅ After: 1줄 수정

```typescript
// lib/config/layer.config.ts
export const LAYER_IDS = {
    polygons: {
        parcels: {
            fill: 'layer-parcels-fill',  // 여기만!
            // ...
        },
    },
};

// 모든 곳에서 자동 반영!
```

---

## 📝 마이그레이션 체크리스트

### 단계 1: 설정 파일 import 추가

```typescript
// ✅ 모든 레이어 컴포넌트 상단에 추가
import { LAYER_IDS, SOURCE_IDS, LayerHelper } from '@/lib/config/layer.config';
import { COLORS, SHADOWS, StyleHelper } from '@/lib/config/style.config';
import { ZOOM_LEVELS, ZoomHelper } from '@/lib/config/map.config';
```

### 단계 2: 하드코딩된 값 교체

```typescript
// ❌ Before
if (zoom >= 14) { ... }
map.addLayer({ id: 'vt-parcels-fill' });
backgroundColor: '#1d4ed8'

// ✅ After
if (ZoomHelper.shouldShowParcels(zoom)) { ... }
map.addLayer({ id: LAYER_IDS.polygons.parcels.fill });
backgroundColor: COLORS.selection.selected
```

### 단계 3: TypeScript 타입 체크

```bash
npm run build
# 타입 에러 확인 후 수정
```

---

## 🚀 즉시 적용 가능한 파일

1. **UnifiedPolygonGLLayer.tsx**
   - [ ] LAYER_IDS 사용
   - [ ] COLORS 사용
   - [ ] ZOOM_LEVELS 사용

2. **UnifiedMarkerLayer.tsx**
   - [ ] ZoomHelper 사용
   - [ ] COLORS 사용
   - [ ] MARKER_TYPES 사용

3. **TransactionDotsLayer.tsx**
   - [ ] LAYER_IDS 사용
   - [ ] COLORS 사용

4. **FactoryDistributionLayer.tsx**
   - [ ] LAYER_IDS 사용
   - [ ] COLORS 사용
   - [ ] ZOOM_LEVELS 사용

---

**다음 단계**: [SINGLE_SOURCE_STRATEGY.md](./SINGLE_SOURCE_STRATEGY.md)에서 전체 전략 확인
