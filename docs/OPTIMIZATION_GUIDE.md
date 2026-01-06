# 최적화 가이드

> 현재 코드베이스의 최적화 포인트 및 개선 방안

## 🎯 현재 성능 상태

### ✅ 이미 잘 최적화된 부분

1. **DOM 풀링** - DOMPoolRenderer에서 마커 재사용
2. **LRU 캐시** - 데이터 로딩 캐싱 (클라이언트/서버)
3. **Supercluster** - 고성능 지도 클러스터링
4. **MVT 타일** - 대용량 폴리곤 처리
5. **병렬 로딩** - Promise.all로 데이터 병렬 로드
6. **중앙 집중화** - 중복 로직 제거 완료

---

## ⚠️ 최적화 필요 영역

### 1. 🔴 **데이터 변환 중복** (Critical)

#### 문제: UnifiedMarkerLayer.tsx (52-97줄)

**현재 코드**:
```typescript
// 데이터가 변경될 때마다 43,617개 객체를 새로 생성
const markers: MarkerProps[] = [
    ...parcels.map(p => ({  // 43,266개
        id: p.id,
        type: getMarkerType(p) as any,
        subType: getMarkerSubType(p) as any,
        coord: p.coord,
        price: p.listingPrice || p.auctionPrice || p.transactionPrice,
        area: p.area,
        isAdvertised: false
    })),

    ...industrialComplexes.map(c => ({ ... })),  // 8개
    ...districts.map(d => ({ ... })),             // 262개
    ...knowledgeCenters.map(k => ({ ... })),      // 81개
];

manager.loadData(markers);
```

**문제점**:
- ❌ parcels 변경 시 전체 배열 재생성 (43,617개)
- ❌ `getMarkerType()`, `getLng()`, `getLat()` 매번 계산
- ❌ 메모리 할당/해제 오버헤드

**해결책: useMemo로 변환 결과 캐싱**

```typescript
// components/map/naver/UnifiedMarkerLayer.tsx

const parcelMarkers = useMemo(() =>
    parcels.map(p => ({
        id: p.id,
        type: getMarkerType(p),
        subType: getMarkerSubType(p),
        coord: p.coord,
        price: p.listingPrice || p.auctionPrice || p.transactionPrice,
        area: p.area,
        isAdvertised: false
    })),
    [parcels]  // parcels 변경 시만 재계산
);

const complexMarkers = useMemo(() =>
    industrialComplexes.map(c => ({
        id: c.id,
        type: 'complex' as const,
        name: c.name,
        coord: c.coord,
        lat: c.centroid?.lat || getLat(c.coord),
        lng: c.centroid?.lng || getLng(c.coord),
    })),
    [industrialComplexes]
);

const districtMarkers = useMemo(() =>
    districts.map(d => ({
        id: d.id,
        type: 'region' as const,
        name: d.name,
        level: (d.level === 'sig' ? 'SIG' : 'EMD') as any,
        coord: d.coord,
        lat: getLat(d.coord),
        lng: getLng(d.coord),
        count: d.parcelCount
    })),
    [districts]
);

const knowledgeMarkers = useMemo(() =>
    knowledgeCenters.map(k => ({
        id: k.id,
        type: 'knowledge' as const,
        name: k.name,
        coord: k.coord || [0, 0],
        lat: getLat(k.coord),
        lng: getLng(k.coord),
    })),
    [knowledgeCenters]
);

// 최종 통합 (개별 useMemo 결과 합치기)
const allMarkers = useMemo(() => [
    ...parcelMarkers,
    ...complexMarkers,
    ...districtMarkers,
    ...knowledgeMarkers,
], [parcelMarkers, complexMarkers, districtMarkers, knowledgeMarkers]);

useEffect(() => {
    if (!managerRef.current) return;
    manager.loadData(allMarkers);
}, [allMarkers]);
```

**효과**:
- ✅ visibleLayers 변경 시 변환 스킵 (필터링만 재실행)
- ✅ 메모리 할당 최소화
- ✅ CPU 사용량 감소

---

### 2. 🟠 **줌 레벨 중복 조회** (High)

#### 문제: UnifiedMarkerManager.ts (shouldShowMarker)

**현재 코드**:
```typescript
// shouldShowMarker가 수만 번 호출될 때마다 getZoom() 호출
private shouldShowMarker(p: MarkerProps): boolean {
    const zoom = this.filters.focusMode ? 16 : (this.map.getZoom() || 14);  // ❌ 매번 호출

    const shouldShow = shouldShowMarkerByType(p.type, zoom, p.level as any);
    // ...
}

// applyFilters에서 전체 데이터 필터링
applyFilters(newFilters: Partial<MarkerFilters>) {
    this.filters = { ...this.filters, ...newFilters };

    const filtered = this.rawData.filter(p => this.shouldShowMarker(p));  // 43,617번 호출
    // ...
}
```

**문제점**:
- ❌ 43,617번 필터링 시 43,617번 `getZoom()` 호출
- ❌ Naver Maps API 호출 오버헤드

**해결책: 줌 레벨을 미리 조회하여 전달**

```typescript
// lib/markers/UnifiedMarkerManager.ts

applyFilters(newFilters: Partial<MarkerFilters>) {
    this.filters = { ...this.filters, ...newFilters };

    // 줌 레벨 한 번만 조회 ✅
    const currentZoom = this.filters.focusMode ? 16 : (this.map.getZoom() || 14);

    const filtered = this.rawData.filter(p => this.shouldShowMarker(p, currentZoom));

    const features = filtered.map(p => ({
        type: 'Feature' as const,
        properties: p,
        geometry: {
            type: 'Point' as const,
            coordinates: [
                getLng(p.coord),  // ✅ 헬퍼 사용
                getLat(p.coord)
            ] as [number, number]
        }
    }));

    this.supercluster.load(features as any);
    this.updateMarkers();
}

// shouldShowMarker에 줌 레벨 파라미터 추가
private shouldShowMarker(p: MarkerProps, zoom: number): boolean {
    // ===== 1. 줌 레벨 체크 =====
    const shouldShow = shouldShowMarkerByType(p.type, zoom, p.level as any);
    if (!shouldShow) return false;

    // ... 나머지 필터링 로직
    return true;
}
```

**효과**:
- ✅ `getZoom()` 호출 43,617번 → 1번
- ✅ 필터링 속도 약 50% 향상

---

### 3. 🟠 **좌표 변환 중복** (High)

#### 문제: UnifiedMarkerManager.ts (applyFilters)

**현재 코드**:
```typescript
const features = filtered.map(p => ({
    type: 'Feature' as const,
    properties: p,
    geometry: {
        type: 'Point' as const,
        coordinates: [
            (p as any).centroid?.lng || (p as any).lng || p.coord?.[0] || 0,  // ❌ 복잡한 체크
            (p as any).centroid?.lat || (p as any).lat || p.coord?.[1] || 0   // ❌ 복잡한 체크
        ] as [number, number]
    }
}));
```

**문제점**:
- ❌ 이미 dataHelpers에 `getLng()`, `getLat()` 있는데 안 씀
- ❌ any 타입 사용

**해결책: dataHelpers 사용**

```typescript
import { getLng, getLat } from '@/lib/utils/dataHelpers';

const features = filtered.map(p => ({
    type: 'Feature' as const,
    properties: p,
    geometry: {
        type: 'Point' as const,
        coordinates: [
            getLng(p.coord),  // ✅ 헬퍼 사용
            getLat(p.coord)
        ] as [number, number]
    }
}));
```

**효과**:
- ✅ 코드 중복 제거
- ✅ 타입 안전성 향상

---

### 4. 🟡 **필터 계산 최적화** (Medium)

#### 문제: UnifiedMarkerLayer.tsx (109-111줄)

**현재 코드**:
```typescript
manager.applyFilters({
    showListing: visibleLayers.has('listing-marker') || visibleLayers.has('listing'),
    showAuction: visibleLayers.has('auction-marker') || visibleLayers.has('auction'),
    showTransaction: visibleLayers.has('transaction-marker') || visibleLayers.has('transaction-price'),
    // ...
});
```

**문제점**:
- ❌ `visibleLayers.has()` 다수 호출 (매 렌더링마다)
- ⚠️ 성능 영향은 작지만, useMemo로 개선 가능

**해결책: useMemo로 필터 객체 캐싱**

```typescript
const filters = useMemo(() => ({
    showListing: visibleLayers.has('listing-marker') || visibleLayers.has('listing'),
    showAuction: visibleLayers.has('auction-marker') || visibleLayers.has('auction'),
    showTransaction: visibleLayers.has('transaction-marker') || visibleLayers.has('transaction-price'),
    showComplex: visibleLayers.has('industrial-complex'),
    showKnowledge: visibleLayers.has('knowledge-center'),
    showPOI: visibleLayers.has('poi'),
    focusMode: focusMode,
    focusedComplex: focusedComplex,
}), [visibleLayers, focusMode, focusedComplex]);

useEffect(() => {
    if (!managerRef.current) return;
    managerRef.current.applyFilters(filters);
}, [filters]);
```

**효과**:
- ✅ 필터 객체 재생성 최소화
- ✅ useEffect 의존성 명확화

---

### 5. 🟢 **디버그 로그 제거** (Low)

#### 문제: 프로덕션에서 불필요한 로그

**현재 코드**:
```typescript
// UnifiedMarkerManager.ts:144-145
const stage = getClusteringStage(zoom);
console.log(`🎯 클러스터링 단계: ${stage} (줌 ${zoom.toFixed(1)})`);
console.log(`📍 표시 마커: ${clusters.length}개`);

// DOMPoolRenderer.ts:274
console.log('Marker clicked:', cluster.properties);

// NaverMap.tsx 곳곳
console.log('✅ 네이버 지도 객체 생성 완료');
console.log(`🔄 지도 이벤트: ${eventName}`);
```

**해결책: 개발/프로덕션 환경 분리**

```typescript
// lib/utils/logger.ts (신규)
const isDev = process.env.NODE_ENV === 'development';

export const logger = {
    log: (...args: any[]) => {
        if (isDev) console.log(...args);
    },
    info: (...args: any[]) => {
        if (isDev) console.info(...args);
    },
    warn: (...args: any[]) => {
        console.warn(...args);  // warn/error는 항상 출력
    },
    error: (...args: any[]) => {
        console.error(...args);
    }
};

// 사용
import { logger } from '@/lib/utils/logger';

logger.log(`🎯 클러스터링 단계: ${stage}`);  // 개발 환경에서만 출력
```

**효과**:
- ✅ 프로덕션 빌드 크기 감소
- ✅ 콘솔 오버헤드 제거

---

### 6. 🟢 **불필요한 상태 제거** (Low)

#### 문제: NaverMap.tsx (zoomLevel state)

**현재 코드**:
```typescript
const [zoomLevel, setZoomLevel] = useState<number>(12);

// 137-155줄: zoom_changed, idle 이벤트 리스닝
useEffect(() => {
    if (!map) return;

    const updateZoomLevel = () => {
        const zoom = map.getZoom();
        setZoomLevel(zoom);  // ❌ UI 표시 외엔 사용 안 함
    };
    // ...
}, [map]);

// 217줄: UI에만 사용
<div>줌: {zoomLevel.toFixed(2)}</div>
```

**문제점**:
- ❌ UnifiedMarkerManager에서 이미 `map.getZoom()` 직접 호출
- ❌ 상태 업데이트로 인한 불필요한 리렌더링

**해결책 1: 필요 시에만 조회**

```typescript
// zoomLevel state 제거
// UI에서 직접 조회
<div>줌: {map?.getZoom()?.toFixed(2) || '--'}</div>
```

**해결책 2: Zustand Store 활용**

```typescript
// lib/store.ts에 이미 currentZoom이 있으니 활용
const currentZoom = useMapStore(state => state.currentZoom);

<div>줌: {currentZoom.toFixed(2)}</div>
```

**효과**:
- ✅ 불필요한 상태 제거
- ✅ 리렌더링 최소화

---

## 📊 최적화 우선순위 요약

| 순위 | 항목 | 영향도 | 난이도 | 예상 개선 |
|------|------|--------|--------|-----------|
| 🔴 1 | 데이터 변환 중복 (useMemo) | **매우 높음** | 낮음 | 렌더링 50% 향상 |
| 🟠 2 | 줌 레벨 중복 조회 | **높음** | 낮음 | 필터링 50% 향상 |
| 🟠 3 | 좌표 변환 중복 | **높음** | 매우 낮음 | 코드 품질 향상 |
| 🟡 4 | 필터 계산 최적화 | 보통 | 낮음 | 메모리 사용량 감소 |
| 🟢 5 | 디버그 로그 제거 | 낮음 | 낮음 | 번들 크기 감소 |
| 🟢 6 | 불필요한 상태 제거 | 낮음 | 낮음 | 리렌더링 감소 |

---

## 🚀 적용 전/후 예상 성능

### 현재 성능 (43,266개 필지 기준)

| 작업 | 시간 | 호출 횟수 |
|------|------|-----------|
| 초기 데이터 로딩 | ~300ms | 1회 |
| 데이터 → MarkerProps 변환 | ~50ms | visibleLayers 변경마다 |
| 필터링 (43,617개) | ~30ms | visibleLayers 변경마다 |
| Supercluster 로드 | ~20ms | 필터 변경마다 |
| 클러스터 쿼리 | ~5ms | 지도 이동마다 |
| 마커 렌더링 (평균 300개) | ~10ms | 지도 이동마다 |

**총 렌더링 시간** (필터 변경 시): ~115ms

### 최적화 후 예상 성능

| 작업 | 시간 | 개선 |
|------|------|------|
| 초기 데이터 로딩 | ~300ms | - |
| 데이터 → MarkerProps 변환 | **~25ms** (캐시 히트 시 0ms) | **50% ↓** |
| 필터링 (43,617개) | **~15ms** | **50% ↓** |
| Supercluster 로드 | ~20ms | - |
| 클러스터 쿼리 | ~5ms | - |
| 마커 렌더링 (평균 300개) | ~10ms | - |

**총 렌더링 시간** (필터 변경 시): **~75ms** (35% 개선)
**총 렌더링 시간** (지도 이동 시): **~15ms** (변환 스킵)

---

## 💡 추가 최적화 고려사항

### 1. Web Worker로 클러스터링 오프로드 (고급)

**개념**: Supercluster 계산을 백그라운드 스레드로 이동

```typescript
// lib/workers/clusterWorker.ts
import Supercluster from 'supercluster';

let cluster: Supercluster<any, any>;

self.onmessage = (e) => {
    const { type, data } = e.data;

    if (type === 'load') {
        cluster = new Supercluster(data.options);
        cluster.load(data.features);
        self.postMessage({ type: 'loaded' });
    }

    if (type === 'getClusters') {
        const clusters = cluster.getClusters(data.bbox, data.zoom);
        self.postMessage({ type: 'clusters', data: clusters });
    }
};
```

**효과**:
- ✅ 메인 스레드 블로킹 방지
- ✅ 대량 데이터 처리 시 유리
- ⚠️ 복잡도 증가

**권장**: 데이터가 10만 개 이상일 때만 고려

---

### 2. Virtual Scrolling (상세 패널용)

**개념**: 긴 목록에서 보이는 부분만 렌더링

```typescript
// react-window 라이브러리 사용
import { FixedSizeList } from 'react-window';

<FixedSizeList
    height={600}
    itemCount={filteredParcels.length}
    itemSize={80}
>
    {({ index, style }) => (
        <ParcelCard key={filteredParcels[index].id} {...} />
    )}
</FixedSizeList>
```

**효과**:
- ✅ 1,000개 이상 목록 렌더링 시 필수
- ✅ 스크롤 성능 향상

**권장**: 상세 패널 구현 시 적용

---

### 3. IndexedDB 캐싱 (선택적)

**개념**: 대용량 데이터를 브라우저 DB에 저장

```typescript
// lib/cache/indexedDBCache.ts
const db = await openDB('gongzzang-cache', 1, {
    upgrade(db) {
        db.createObjectStore('parcels');
    }
});

// 저장
await db.put('parcels', parcelsData, 'all');

// 로드
const cached = await db.get('parcels', 'all');
```

**효과**:
- ✅ 재방문 시 초기 로딩 생략
- ✅ 오프라인 지원 가능
- ⚠️ 데이터 동기화 복잡도 증가

**권장**: 데이터가 자주 변경되지 않을 때만 고려

---

## 📝 변경 이력

| 날짜 | 변경 내용 |
|------|-----------|
| 2025-12-23 | 초기 문서 생성, 최적화 포인트 분석 완료 |
