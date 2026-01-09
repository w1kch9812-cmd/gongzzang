# Gongzzang 성능 및 구조 개선 제안서

> 작성일: 2026-01-07
> 대상: 성능 최적화, 구조 개선, 렌더링 최적화

---

## 📋 목차

1. [성능 최적화 방안](#1-성능-최적화-방안)
2. [구조적 개선 방안](#2-구조적-개선-방안)
3. [화면 렌더링 최적화](#3-화면-렌더링-최적화)
4. [우선순위 및 로드맵](#4-우선순위-및-로드맵)

---

## 1. 성능 최적화 방안

### 1.1 🔴 Critical: 데이터 변환 메모이제이션

#### 현재 문제
`UnifiedMarkerLayer.tsx`에서 매 렌더링마다 43,617개 객체를 재생성:

```typescript
// ❌ 현재: visibleLayers 변경될 때마다 전체 재생성
const markers = [
    ...parcels.map(p => ({ ... })),           // 43,266개
    ...industrialComplexes.map(c => ({ ... })), // 8개
    // ...
];
```

#### 해결 방안
**단계별 메모이제이션 적용**:

```typescript
// ✅ 개선: 각 데이터 소스별로 useMemo 적용
const parcelMarkers = useMemo(() =>
    parcels.map(p => ({
        id: p.id,
        type: getMarkerType(p),
        coord: p.coord,
        // ...
    })),
    [parcels]  // parcels 변경 시만 재계산
);

const complexMarkers = useMemo(() =>
    industrialComplexes.map(c => ({
        id: c.id,
        type: 'complex' as const,
        coord: c.coord,
        // ...
    })),
    [industrialComplexes]
);

// 최종 통합
const allMarkers = useMemo(() => [
    ...parcelMarkers,
    ...complexMarkers,
    ...districtMarkers,
    ...knowledgeMarkers,
    ...factoryMarkers,
], [parcelMarkers, complexMarkers, districtMarkers, knowledgeMarkers, factoryMarkers]);
```

**예상 효과**:
- 렌더링 시간: 50ms → 5ms (90% 감소)
- visibleLayers 변경 시에도 데이터 변환 스킵
- CPU 사용량 대폭 감소

---

### 1.2 🟠 High: Supercluster 계산 최적화

#### 현재 문제
`Supercluster.load()` 호출이 너무 빈번함:

```typescript
// ❌ 현재: 필터 변경마다 Supercluster 재생성
useEffect(() => {
    const features = allMarkers.map(m => ({...}));
    supercluster.load(features);  // 비용 높음
}, [allMarkers, filters]);
```

#### 해결 방안 A: Incremental Update (점진적 업데이트)

```typescript
// ✅ 필터링만 변경된 경우 Supercluster 재생성 스킵
const baseFeatures = useMemo(() =>
    allMarkers.map(m => ({
        type: 'Feature',
        properties: m,
        geometry: { type: 'Point', coordinates: m.coord }
    })),
    [allMarkers]
);

useEffect(() => {
    // 필터링은 클라이언트에서 (Supercluster 재생성 안함)
    const filtered = baseFeatures.filter(f =>
        matchesFilter(f.properties, currentFilters)
    );

    // 필터링된 데이터만 Supercluster에 로드
    supercluster.load(filtered);
}, [baseFeatures, currentFilters]);
```

#### 해결 방안 B: Web Worker 오프로드 (고급)

대량 데이터(10만+ 필지)일 때만 고려:

```typescript
// worker/clusterWorker.ts
import Supercluster from 'supercluster';

let cluster: Supercluster;

self.onmessage = (e) => {
    if (e.data.type === 'load') {
        cluster = new Supercluster(e.data.options);
        cluster.load(e.data.features);
        self.postMessage({ type: 'ready' });
    }

    if (e.data.type === 'getClusters') {
        const clusters = cluster.getClusters(
            e.data.bbox,
            e.data.zoom
        );
        self.postMessage({ type: 'clusters', data: clusters });
    }
};
```

**예상 효과**:
- 필터 변경 시: 30ms → 5ms (83% 감소)
- 메인 스레드 블로킹 제거 (Web Worker 사용 시)

---

### 1.3 🟠 High: 줌 레벨 중복 조회 제거

#### 현재 문제
필터링 시 `map.getZoom()`을 수만 번 호출:

```typescript
// ❌ shouldShowMarker가 43,617번 호출될 때마다 getZoom() 실행
private shouldShowMarker(p: MarkerProps): boolean {
    const zoom = this.map.getZoom();  // 43,617번 호출!
    // ...
}
```

#### 해결 방안
**줌 레벨을 파라미터로 전달**:

```typescript
// ✅ Store에서 한 번만 조회
const currentZoom = useMapStore(state => state.currentZoom);

// 필터링 시 전달
const filtered = rawData.filter(p => shouldShowMarker(p, currentZoom));

// 함수 시그니처 변경
private shouldShowMarker(p: MarkerProps, zoom: number): boolean {
    // zoom 파라미터 사용 (getZoom() 호출 없음)
    return shouldShowMarkerByType(p.type, zoom, p.level);
}
```

**예상 효과**:
- 필터링 시간: 30ms → 15ms (50% 감소)
- API 호출 43,617번 → 1번

---

### 1.4 🟡 Medium: 이벤트 핸들러 메모이제이션

#### 현재 문제
이벤트 핸들러가 매번 재생성되어 불필요한 리렌더 발생:

```typescript
// ❌ 매 렌더링마다 새 함수 생성
const handleClick = (id) => {
    loadParcelDetail(id).then(...);
};
```

#### 해결 방안
**useCallback으로 안정적인 참조 유지**:

```typescript
// ✅ 의존성 변경 시에만 재생성
const handleParcelClick = useCallback((pnu: string) => {
    loadParcelDetail(pnu).then(detail => {
        if (detail) {
            useSelectionStore.getState().setSelectedParcel(detail);
        }
    });
}, []); // 의존성 없음 (store.getState() 사용)

const handleComplexClick = useCallback((id: string) => {
    loadIndustrialComplexDetail(id).then(detail => {
        if (detail) {
            useSelectionStore.getState().enterFocusMode(detail);
        }
    });
}, []);
```

**예상 효과**:
- 자식 컴포넌트 불필요한 리렌더 방지
- 메모리 사용량 감소

---

### 1.5 🟡 Medium: 필터 표현식 캐싱

#### 현재 문제
`visibleLayers.has()` 다수 호출:

```typescript
// ❌ 매번 계산
manager.applyFilters({
    showListing: visibleLayers.has('listing-marker') || visibleLayers.has('listing'),
    showAuction: visibleLayers.has('auction-marker') || visibleLayers.has('auction'),
    // ...
});
```

#### 해결 방안
**useMemo로 필터 객체 캐싱**:

```typescript
// ✅ visibleLayers 변경 시에만 재계산
const filterConfig = useMemo(() => ({
    showListing: visibleLayers.has('listing-marker') || visibleLayers.has('listing'),
    showAuction: visibleLayers.has('auction-marker') || visibleLayers.has('auction'),
    showTransaction: visibleLayers.has('transaction-marker'),
    showComplex: visibleLayers.has('industrial-complex'),
    showKnowledge: visibleLayers.has('knowledge-center'),
    showFactory: visibleLayers.has('factory'),
}), [visibleLayers]);

useEffect(() => {
    manager?.applyFilters(filterConfig);
}, [filterConfig]);
```

---

### 1.6 🟢 Low: 프로덕션 로그 제거

#### 해결 방안
logger는 이미 구현되어 있으므로 일관성 있게 사용:

```typescript
// ✅ lib/utils/logger.ts 사용
import { logger } from '@/lib/utils/logger';

// console.log 대신 logger 사용 (개발 환경에서만 출력)
logger.log('🎯 클러스터링:', clusters.length);
logger.warn('⚠️ 경고:', error);
logger.error('❌ 에러:', error);
```

**전체 파일 검색 후 일괄 치환 필요**:
- `console.log` → `logger.log`
- `console.warn` → `logger.warn` (프로덕션에서도 출력)
- `console.error` → `logger.error` (프로덕션에서도 출력)

---

## 2. 구조적 개선 방안

### 2.1 🔵 레이어 시스템 재설계

#### 현재 문제
- Deck.gl은 설치되어 있지만 사용 안함
- DOM 마커와 Mapbox GL 레이어가 혼재
- 레이어 관리가 분산되어 있음

#### 개선 방안: 레이어 추상화 계층

**새로운 구조**:

```
LayerRegistry (중앙 관리)
├── PolygonLayers (Mapbox GL)
│   ├── PMTilesLayer (parcels, complex, emd 등)
│   └── GeoJSONLayer (공장 밀도, 실거래 점)
├── MarkerLayers (DOM)
│   ├── ClusterMarkerLayer (Supercluster)
│   └── IconMarkerLayer (단일 아이콘)
└── WebGLLayers (선택적 - 대량 데이터용)
    └── DeckGLLayer (10만+ 포인트)
```

**구현 예시**:

```typescript
// lib/map/LayerRegistry.ts
export class LayerRegistry {
    private layers: Map<string, Layer> = new Map();

    register(id: string, layer: Layer) {
        this.layers.set(id, layer);
    }

    setVisible(id: string, visible: boolean) {
        this.layers.get(id)?.setVisible(visible);
    }

    update(id: string, data: any) {
        this.layers.get(id)?.update(data);
    }

    dispose() {
        this.layers.forEach(l => l.dispose());
    }
}

// 레이어 인터페이스
interface Layer {
    id: string;
    type: 'polygon' | 'marker' | 'webgl';
    setVisible(visible: boolean): void;
    update(data: any): void;
    dispose(): void;
}
```

**효과**:
- 레이어 생명주기 통합 관리
- 디버깅 용이 (레이어 목록 확인)
- 레이어 간 의존성 명확화

---

### 2.2 🔵 Store 리팩토링: 파생 상태 제거

#### 현재 문제
불필요한 상태 중복:

```typescript
// ❌ filteredParcels가 store에 저장됨 (메모리 낭비)
interface FilterStore {
    filter: FilterState;
    filteredParcels: ParcelMarkerData[];  // 파생 상태
}
```

#### 개선 방안
**Selector로 파생 상태 계산**:

```typescript
// ✅ filteredParcels를 getter로 변경
interface FilterStore {
    filter: FilterState;
    // filteredParcels 제거
}

// 파생 상태는 selector로 계산
export const useFilteredParcels = () => {
    const filter = useFilterStore(state => state.filter);
    const allParcels = useDataStore(state => state.parcels);

    return useMemo(() => {
        return Array.from(allParcels.values()).filter(p =>
            matchesFilter(p, filter)
        );
    }, [allParcels, filter]);
};
```

**효과**:
- 메모리 사용량 감소 (중복 데이터 제거)
- 동기화 문제 해결 (단일 진실 공급원)

---

### 2.3 🔵 컴포넌트 분리: 관심사의 분리

#### 현재 문제
`UnifiedMarkerLayer`가 너무 많은 책임:
- 데이터 변환
- 필터링
- 클러스터링
- 렌더링
- 이벤트 처리

#### 개선 방안
**레이어를 여러 컴포넌트로 분리**:

```
UnifiedMarkerLayer (조정자)
├── ClusterManager (클러스터링 로직)
├── MarkerRenderer (DOM 렌더링)
└── MarkerEventHandler (클릭/호버 이벤트)
```

**예시**:

```typescript
// components/map/markers/ClusterManager.tsx
export function useClusterManager(data: MarkerData[], options: ClusterOptions) {
    const superclusterRef = useRef<Supercluster>();

    const features = useMemo(() =>
        data.map(toGeoJSONFeature),
        [data]
    );

    useEffect(() => {
        superclusterRef.current = new Supercluster(options);
        superclusterRef.current.load(features);
    }, [features, options]);

    return {
        getClusters: (bbox: BBox, zoom: number) =>
            superclusterRef.current?.getClusters(bbox, zoom) || []
    };
}

// UnifiedMarkerLayer.tsx (간소화)
export function UnifiedMarkerLayer({ map }) {
    const data = useMarkerData();
    const { getClusters } = useClusterManager(data, CLUSTER_OPTIONS);
    const { renderMarkers } = useMarkerRenderer(map);

    useEffect(() => {
        const clusters = getClusters(currentBounds, currentZoom);
        renderMarkers(clusters);
    }, [currentBounds, currentZoom]);
}
```

---

### 2.4 🔵 타입 안전성 강화

#### 현재 문제
any 타입 남용:

```typescript
// ❌ any 타입
const mapboxGL = (map as any)._mapbox;
const cluster = clusters[i] as any;
```

#### 개선 방안
**타입 정의 추가**:

```typescript
// types/mapbox.ts
export interface MapboxGLInstance {
    getCanvas(): HTMLCanvasElement;
    project(lnglat: [number, number]): { x: number; y: number };
    unproject(point: [number, number]): { lng: number; lat: number };
    setFeatureState(target: FeatureIdentifier, state: any): void;
    // ...
}

// types/naver-maps.d.ts
declare global {
    interface Window {
        naver: typeof naver;
    }

    namespace naver.maps {
        interface Map {
            _mapbox: MapboxGLInstance;  // 타입 추가
        }
    }
}

// 사용
const mapboxGL = map._mapbox as MapboxGLInstance;  // ✅ 타입 안전
```

---

### 2.5 🔵 데이터 로딩 전략 개선

#### 현재 방식
모든 데이터를 초기에 로드 (4.2MB):

```typescript
// ❌ 43,266개 필지 전체 로드
const parcels = await loadParcels();  // 4.2MB
```

#### 개선 방안 A: 청크 로딩

```typescript
// ✅ 시군구별로 분할 로드
const parcels = await loadParcelsBySig('28250');  // 남동구만 (~400KB)

// public/data/entities/parcels-by-sig/
// ├── 28110.json  (중구)
// ├── 28140.json  (동구)
// ├── 28250.json  (남동구)
// └── ...
```

#### 개선 방안 B: 뷰포트 기반 로딩

```typescript
// ✅ 현재 보이는 영역의 데이터만 로드
const loadVisibleParcels = async (bounds: Bounds) => {
    const response = await fetch('/api/parcels', {
        method: 'POST',
        body: JSON.stringify({ bounds })
    });
    return response.json();
};
```

**효과**:
- 초기 로딩 시간: 2초 → 0.5초 (75% 감소)
- 메모리 사용량 감소

---

## 3. 화면 렌더링 최적화

### 3.1 🎨 현재 렌더링 요소 분석

**화면에 표시되는 요소**:

1. **폴리곤 레이어** (Mapbox GL)
   - 행정구역 (시도/시군구/읍면동)
   - 필지 폴리곤
   - 산업단지 폴리곤
   - 용지/업종 폴리곤

2. **마커 레이어** (DOM)
   - 클러스터 마커 (숫자 표시)
   - 개별 필지 마커
   - 산업단지 아이콘
   - 공장/지식산업센터 마커

3. **점 레이어** (Mapbox GL Circle)
   - 실거래가 점
   - 공장 밀도 폴리곤

4. **UI 오버레이**
   - 상단 필터 바
   - 좌측 레이어 컨트롤
   - 우측 상세 패널
   - 하단 위치 바

---

### 3.2 🎨 폴리곤 레이어 최적화

#### A. 줌 레벨별 레이어 전환 개선

**현재**: 모든 레이어가 항상 로드됨

**개선**: 줌 레벨에 따라 동적 로드/언로드

```typescript
// ✅ 필요한 레이어만 로드
useEffect(() => {
    const level = getDistrictLevel(currentZoom);

    // 이전 레벨 레이어 제거 (메모리 절약)
    if (level !== prevLevel) {
        removeLayers(LAYER_IDS[prevLevel]);
        addLayers(LAYER_IDS[level]);
    }
}, [currentZoom]);
```

#### B. Feature State 최적화

**현재**: 모든 필지에 feature-state 적용 시도

**개선**: 보이는 필지에만 적용

```typescript
// ✅ 뷰포트 내 필지만 feature-state 업데이트
const visibleFeatures = mapboxGL.queryRenderedFeatures({
    layers: ['vt-parcels-fill']
});

visibleFeatures.forEach(f => {
    if (f.id === selectedPNU) {
        mapboxGL.setFeatureState(
            { source: 'parcels', id: f.id },
            { selected: true }
        );
    }
});
```

---

### 3.3 🎨 마커 레이어 최적화

#### A. 마커 샘플링 (고줌 레벨)

**현재**: 줌 14+에서 43,266개 마커 모두 렌더링 시도

**개선**: 샘플링 적용

```typescript
// ✅ 고줌에서 마커 샘플링 (40% 표시)
const SAMPLE_RATE = 0.4;
const SAMPLE_ZOOM_THRESHOLD = 15;

const sampledMarkers = useMemo(() => {
    if (currentZoom < SAMPLE_ZOOM_THRESHOLD) {
        return allMarkers;  // 저줌: 전체 표시 (클러스터링됨)
    }

    // 고줌: 샘플링
    return allMarkers.filter((m, idx) => {
        const hash = getSamplingHash(m.id);
        return hash % 100 < (SAMPLE_RATE * 100);
    });
}, [allMarkers, currentZoom]);
```

#### B. 가상 스크롤 (패널용)

**현재**: 상세 패널에서 1,000+ 항목 렌더링 시 느림

**개선**: react-window로 가상 스크롤

```typescript
// ✅ 보이는 항목만 렌더링
import { FixedSizeList } from 'react-window';

<FixedSizeList
    height={600}
    itemCount={filteredParcels.length}
    itemSize={80}
    width="100%"
>
    {({ index, style }) => (
        <ParcelCard
            key={filteredParcels[index].id}
            parcel={filteredParcels[index]}
            style={style}
        />
    )}
</FixedSizeList>
```

---

### 3.4 🎨 UI 오버레이 최적화

#### A. 패널 코드 스플리팅

**현재**: 모든 패널이 초기 번들에 포함

**개선**: 동적 임포트

```typescript
// ✅ 필요할 때만 로드
const DetailPanel = dynamic(() => import('@/components/panel/DetailPanel'), {
    ssr: false,
    loading: () => <div>로딩 중...</div>
});

const AnalysisModal = dynamic(() => import('@/components/panel/AnalysisModal'), {
    ssr: false
});
```

#### B. 패널 렌더링 최적화

**현재**: 패널이 보이지 않아도 렌더링됨

**개선**: 조건부 렌더링

```typescript
// ✅ 열려있을 때만 렌더링
{activeSidePanel === 'detail' && selectedParcel && (
    <DetailPanel parcel={selectedParcel} />
)}

{analysisModalOpen && (
    <AnalysisModal />
)}
```

---

### 3.5 🎨 점진적 렌더링 전략

**현재**: 모든 레이어를 동시에 렌더링

**개선**: 우선순위 기반 렌더링

```typescript
// ✅ 중요도 순서로 렌더링
useEffect(() => {
    // 1단계: 폴리곤 (즉시)
    renderPolygons();

    // 2단계: 마커 (100ms 지연)
    const timer1 = setTimeout(() => {
        renderMarkers();
    }, 100);

    // 3단계: 점 레이어 (200ms 지연)
    const timer2 = setTimeout(() => {
        renderDots();
    }, 200);

    return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
    };
}, [currentZoom]);
```

---

### 3.6 🎨 Mapbox GL 렌더링 최적화

#### A. 레이어 순서 최적화

**원칙**: 아래에서 위로 (fill → line → symbol)

```typescript
// ✅ 올바른 순서
map.addLayer({ id: 'parcels-fill', type: 'fill' });        // 1. 채우기
map.addLayer({ id: 'parcels-line', type: 'line' });        // 2. 외곽선
map.addLayer({ id: 'parcels-label', type: 'symbol' });     // 3. 라벨
```

#### B. Paint 속성 최적화

**현재**: 복잡한 표현식으로 GPU 부담

**개선**: 단순화 및 feature-state 활용

```typescript
// ❌ 복잡한 표현식 (모든 필지마다 계산)
'fill-color': [
    'interpolate', ['linear'],
    ['get', 'avgPrice'],
    minPrice, 'blue',
    maxPrice, 'red'
]

// ✅ Feature State로 미리 계산된 색상 사용
'fill-color': [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    '#1d4ed8',  // 선택됨
    ['coalesce', ['feature-state', 'color'], '#e5e7eb']  // 미리 계산된 색상
]
```

---

## 4. 우선순위 및 로드맵

### Phase 1: Quick Wins (1-2일) 🔴

**즉시 적용 가능, 효과 큼**

1. ✅ **데이터 변환 메모이제이션** (UnifiedMarkerLayer)
   - 파일: `components/map/naver/UnifiedMarkerLayer.tsx`
   - 예상 시간: 2시간
   - 예상 효과: 렌더링 50% 향상

2. ✅ **줌 레벨 중복 조회 제거** (MarkerManager)
   - 파일: `lib/map/MarkerManager.ts`
   - 예상 시간: 1시간
   - 예상 효과: 필터링 50% 향상

3. ✅ **이벤트 핸들러 메모이제이션**
   - 파일: 모든 레이어 컴포넌트
   - 예상 시간: 2시간
   - 예상 효과: 리렌더 감소

4. ✅ **필터 표현식 캐싱**
   - 파일: `components/map/naver/UnifiedMarkerLayer.tsx`
   - 예상 시간: 1시간
   - 예상 효과: 필터 변경 응답성 향상

**예상 총 개선**: 렌더링 시간 115ms → 50ms (56% 향상)

---

### Phase 2: 구조 개선 (3-5일) 🟠

**중장기적 유지보수성 향상**

1. ✅ **레이어 시스템 재설계**
   - 새 파일: `lib/map/LayerRegistry.ts`
   - 예상 시간: 1일
   - 효과: 유지보수성 향상

2. ✅ **Store 리팩토링**
   - 파일: `lib/stores/filter-store.ts`
   - 예상 시간: 1일
   - 효과: 메모리 사용량 감소

3. ✅ **컴포넌트 분리**
   - 새 파일: `components/map/markers/ClusterManager.tsx` 등
   - 예상 시간: 2일
   - 효과: 코드 가독성 및 테스트 용이성

4. ✅ **타입 안전성 강화**
   - 파일: `types/mapbox.ts`, `types/naver-maps.d.ts`
   - 예상 시간: 1일
   - 효과: 버그 감소

---

### Phase 3: 고급 최적화 (5-7일) 🟡

**선택적, 대량 데이터 대비**

1. ⚡ **Supercluster Web Worker**
   - 새 파일: `workers/clusterWorker.ts`
   - 예상 시간: 2일
   - 조건: 데이터 10만+ 시

2. ⚡ **데이터 청크 로딩**
   - 새 구조: `public/data/entities/parcels-by-sig/`
   - 예상 시간: 2일
   - 효과: 초기 로딩 75% 감소

3. ⚡ **마커 샘플링**
   - 파일: `components/map/naver/UnifiedMarkerLayer.tsx`
   - 예상 시간: 1일
   - 효과: 고줌 렌더링 향상

4. ⚡ **가상 스크롤** (패널)
   - 파일: `components/panel/DetailPanel.tsx`
   - 예상 시간: 2일
   - 효과: 긴 목록 렌더링 향상

---

## 5. 측정 및 모니터링

### 성능 측정 도구

```typescript
// lib/utils/performance.ts
export class PerformanceMonitor {
    private marks: Map<string, number> = new Map();

    start(label: string) {
        this.marks.set(label, performance.now());
    }

    end(label: string): number {
        const start = this.marks.get(label);
        if (!start) return 0;

        const duration = performance.now() - start;
        logger.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
        this.marks.delete(label);
        return duration;
    }

    measure(label: string, fn: () => void): number {
        this.start(label);
        fn();
        return this.end(label);
    }
}

// 사용 예시
const perf = new PerformanceMonitor();

perf.start('marker-rendering');
renderMarkers(clusters);
perf.end('marker-rendering');  // ⏱️ marker-rendering: 45.32ms
```

### 성능 벤치마크

**목표 성능 지표**:

| 작업 | 현재 | 목표 | 개선율 |
|------|------|------|--------|
| 초기 로딩 | 2.0s | 0.8s | 60% ↓ |
| 필터 변경 | 115ms | 50ms | 56% ↓ |
| 지도 이동 | 35ms | 15ms | 57% ↓ |
| 줌 변경 | 80ms | 40ms | 50% ↓ |

---

## 6. 체크리스트

### Phase 1 Quick Wins

- [ ] UnifiedMarkerLayer 데이터 변환 메모이제이션
- [ ] MarkerManager 줌 레벨 파라미터화
- [ ] 이벤트 핸들러 useCallback 적용
- [ ] 필터 표현식 useMemo 적용
- [ ] console.log → logger 일괄 변경

### Phase 2 구조 개선

- [ ] LayerRegistry 구현
- [ ] FilterStore 파생 상태 제거
- [ ] ClusterManager 컴포넌트 분리
- [ ] Mapbox 타입 정의 추가
- [ ] Naver Maps 타입 보강

### Phase 3 고급 최적화

- [ ] Web Worker 클러스터링
- [ ] 시군구별 데이터 분할
- [ ] 마커 샘플링 구현
- [ ] 가상 스크롤 적용 (패널)
- [ ] IndexedDB 캐싱 (선택)

---

## 7. 참고 자료

- [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) - 기존 최적화 가이드
- [ARCHITECTURE_GUIDE.md](./ARCHITECTURE_GUIDE.md) - 아키텍처 패턴
- [React 성능 최적화 가이드](https://react.dev/learn/render-and-commit)
- [Mapbox GL 성능 가이드](https://docs.mapbox.com/help/troubleshooting/mapbox-gl-js-performance/)
- [Supercluster 문서](https://github.com/mapbox/supercluster)

---

**작성자 노트**: 이 제안서는 현재 코드베이스 분석을 기반으로 작성되었습니다. 실제 적용 시 단계별로 성능을 측정하고 효과를 검증해야 합니다.
