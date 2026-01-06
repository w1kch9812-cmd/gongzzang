# Deck.gl + Naver Maps GL 모드 통합 가이드

> 60fps 유지하면서 수만 개의 마커를 WebGL로 렌더링하는 방법

## 1. 아키텍처 개요

### 1.1 핵심 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    Naver Maps GL Mode                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                 Internal Mapbox GL                       ││
│  │  - MVT 폴리곤 렌더링 (UnifiedPolygonGLLayer)            ││
│  │  - 지도 타일, 라벨 등                                    ││
│  └─────────────────────────────────────────────────────────┘│
│                              ↑                               │
│                     map._mapbox 접근                         │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ 뷰 상태 동기화 (rAF)
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                   독립 Deck.gl 인스턴스                      │
│  - 별도 Canvas + WebGL Context                              │
│  - ScatterplotLayer로 마커 렌더링                           │
│  - Supercluster로 클러스터링                                │
│  - pointer-events: none (지도 조작 허용)                    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 왜 이 구조인가?

**시도한 방법들과 결과:**

| 방법 | FPS (급격한 줌) | 마커 표시 | tilt/bearing | 결과 |
|------|----------------|----------|--------------|------|
| MapboxOverlay (interleaved: true) | 20fps | O | O | 렌더 루프 동기화 오버헤드 |
| MapboxOverlay (interleaved: false) | 60fps | X | X | 마커 안 보임, 동기화 실패 |
| 독립 Deck + rAF 동기화 | 60fps | O | O | **채택** |

**MapboxOverlay의 문제점:**
- `interleaved: true`: Mapbox GL의 렌더 루프에 Deck.gl이 삽입되어 매 프레임 전체 맵 재렌더링
- `interleaved: false`: Naver Maps GL 내부 Mapbox와 별도 Canvas 간 동기화 실패

## 2. 구현 원리

### 2.1 독립 Deck 인스턴스

```typescript
// 지도 컨테이너 위에 Deck용 div 생성
const deckContainer = document.createElement('div');
deckContainer.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;  // 마우스 이벤트 통과
    z-index: 100;
`;
mapContainer.appendChild(deckContainer);

// Deck 인스턴스 생성
const deck = new Deck({
    parent: deckContainer,
    controller: false,      // Naver Maps가 제어
    initialViewState: getViewState(),
    layers: [],
    pickingRadius: 0,       // 피킹 비활성화
    style: {
        pointerEvents: 'none',  // Canvas도 이벤트 통과
    },
});
```

### 2.2 requestAnimationFrame 동기화 루프

```typescript
const syncLoop = () => {
    if (!deckRef.current) return;

    // Mapbox GL에서 현재 뷰 상태 가져오기
    const viewState = {
        longitude: mbMap.getCenter().lng,
        latitude: mbMap.getCenter().lat,
        zoom: mbMap.getZoom(),
        pitch: mbMap.getPitch() || 0,
        bearing: mbMap.getBearing() || 0,
    };

    // 뷰 상태 변경 감지
    const viewStateKey = `${viewState.longitude},${viewState.latitude},${viewState.zoom},...`;

    if (viewStateKey !== lastViewStateRef.current) {
        lastViewStateRef.current = viewStateKey;

        // 줌 레벨 변경 시 클러스터 업데이트
        const currentZoom = Math.floor(viewState.zoom);
        if (currentZoom !== lastZoomRef.current) {
            lastZoomRef.current = currentZoom;
            updateClusters();
            deck.setProps({ viewState, layers: [newLayer] });
        } else {
            // 위치만 변경 시 뷰만 업데이트
            deck.setProps({ viewState });
        }
    }

    requestAnimationFrame(syncLoop);
};
```

### 2.3 클러스터링 (Supercluster)

```typescript
// Supercluster 설정
const supercluster = new Supercluster({
    radius: 80,      // 클러스터 반경 (픽셀)
    maxZoom: 19,     // 최대 줌
    minZoom: 0,      // 최소 줌
    minPoints: 2,    // 최소 포인트 수
});

// GeoJSON Feature 로드
supercluster.load(geoFeatures);

// 현재 뷰포트의 클러스터 가져오기
const clusters = supercluster.getClusters(
    [west, south, east, north],  // bbox
    Math.floor(zoom)              // 정수 줌 레벨
);
```

### 2.4 ScatterplotLayer 렌더링

```typescript
const createMarkerLayer = (clusters) => {
    return new ScatterplotLayer({
        id: 'markers',
        data: clusters,
        pickable: false,         // 피킹 비활성화 (성능)
        stroked: true,
        filled: true,
        radiusUnits: 'pixels',
        getPosition: d => d.geometry.coordinates,
        getRadius: d => d.properties.cluster
            ? Math.min(Math.sqrt(d.properties.point_count) * 3 + 8, 30)
            : 5,
        getFillColor: d => MARKER_COLORS[d.properties.type],
        getLineColor: [255, 255, 255, 255],
        transitions: {},         // 전환 효과 비활성화 (성능)
    });
};
```

## 3. 데이터 흐름

```
┌────────────────┐
│  Zustand Store │
│  - parcels     │
│  - districts   │
│  - complexes   │
│  - knowledge   │
└───────┬────────┘
        │ useMemo
        ↓
┌────────────────┐
│  GeoJSON       │
│  Features[]    │
└───────┬────────┘
        │ supercluster.load()
        ↓
┌────────────────┐
│  Supercluster  │
│  (R-tree 인덱스)│
└───────┬────────┘
        │ getClusters(bbox, zoom)
        ↓
┌────────────────┐
│  Clusters[]    │
│  (현재 뷰포트)  │
└───────┬────────┘
        │ ScatterplotLayer
        ↓
┌────────────────┐
│  Deck.gl       │
│  WebGL 렌더링   │
└────────────────┘
```

## 4. 성능 특성

### 4.1 측정 결과

| 항목 | 시간 | 비고 |
|------|------|------|
| Supercluster.getClusters() | 0.1-0.5ms | R-tree 덕분에 매우 빠름 |
| ScatterplotLayer 생성 | 0.0-0.1ms | 데이터만 전달 |
| deck.setProps() | 0.1-0.2ms | GPU 버퍼 업데이트 |
| 전체 syncLoop | < 1ms | 60fps 여유 |

### 4.2 메모리 사용량

```
Supercluster 인덱스: ~10MB (43,000개 포인트)
Deck.gl GPU 버퍼: ~5MB
총: ~15MB
```

### 4.3 60fps 유지 조건

1. **pointer-events: none** - 마우스 이벤트가 지도로 직접 전달
2. **독립 WebGL Context** - Mapbox GL 렌더 루프와 분리
3. **rAF 동기화** - 프레임 드롭 없이 뷰 동기화
4. **변경 감지** - 뷰 상태가 같으면 업데이트 안 함
5. **정수 줌에서만 클러스터 업데이트** - 연속 줌 중 불필요한 재계산 방지

## 5. 우려점 및 제한사항

### 5.1 마커 클릭 불가

**현재 상태:**
- `pointer-events: none`으로 설정하여 마커 클릭이 불가능
- 모든 마우스 이벤트가 지도로 직접 전달됨

**해결 방안 (향후 구현):**
```typescript
// 1. Mapbox GL 레이어 위에 클릭 레이어 추가
mbMap.on('click', (e) => {
    const point = [e.lngLat.lng, e.lngLat.lat];
    const nearestCluster = findNearestCluster(clustersRef.current, point, threshold);
    if (nearestCluster) {
        handleClusterClick(nearestCluster);
    }
});

// 2. 또는 특정 영역만 pointer-events 활성화
// (복잡도 증가, 권장하지 않음)
```

### 5.2 두 개의 WebGL Context

**현재 상태:**
- Naver Maps GL (내부 Mapbox GL): WebGL Context 1
- Deck.gl: WebGL Context 2

**우려점:**
- GPU 메모리 사용량 증가
- 일부 저사양 기기에서 Context 생성 실패 가능
- 모바일에서 최대 8-16개 Context 제한

**모니터링 방법:**
```javascript
// Context 수 확인
const canvases = document.querySelectorAll('canvas');
console.log('Canvas count:', canvases.length);
```

### 5.3 동기화 지연

**현재 상태:**
- rAF 기반 동기화로 1프레임(~16ms) 지연 가능
- 급격한 줌/팬 시 마커가 약간 늦게 따라올 수 있음

**최소화 방법:**
- 뷰 상태 변경 감지 즉시 업데이트
- 정밀도 조절로 불필요한 업데이트 방지

### 5.4 클러스터 업데이트 타이밍

**현재 로직:**
- 정수 줌 레벨 변경 시에만 클러스터 업데이트
- 예: 12.0 → 12.9는 업데이트 안 함, 12.9 → 13.0은 업데이트

**우려점:**
- 줌 12.9와 13.0 사이에서 클러스터가 갑자기 변경될 수 있음
- 연속 줌 애니메이션 중 "점프" 현상 발생 가능

**대안:**
```typescript
// 0.5 단위로 업데이트 (더 부드러움, CPU 사용량 증가)
const roundedZoom = Math.round(viewState.zoom * 2) / 2;
if (roundedZoom !== lastZoomRef.current) {
    // 클러스터 업데이트
}
```

### 5.5 Tilt/Bearing과 마커

**현재 상태:**
- Deck.gl의 pitch/bearing이 Mapbox GL과 동기화됨
- ScatterplotLayer는 2D이므로 tilt 시 원형 유지

**예상 동작:**
- 지도 기울임 시 마커는 항상 화면과 수직 (빌보드 효과)
- 3D 느낌을 주려면 IconLayer + sizeScale 사용 필요

### 5.6 Hot Reload 시 Canvas 누적

**현재 상태:**
- 개발 중 Hot Reload 시 cleanup 함수가 제대로 실행되지 않을 수 있음
- Canvas가 누적되어 성능 저하

**해결:**
- useEffect cleanup에서 확실히 정리
- 컴포넌트 마운트 시 기존 Container 확인 후 제거

## 6. 향후 개선 방향

### 6.1 마커 클릭 구현

```typescript
// Mapbox GL 네이티브 클릭 이벤트로 가장 가까운 클러스터 찾기
mbMap.on('click', (e) => {
    const clickPoint = [e.lngLat.lng, e.lngLat.lat];
    const pixels = mbMap.project(e.lngLat);

    // 클러스터 중 가장 가까운 것 찾기
    let nearest = null;
    let minDist = Infinity;

    for (const cluster of clustersRef.current) {
        const clusterPixels = mbMap.project({
            lng: cluster.geometry.coordinates[0],
            lat: cluster.geometry.coordinates[1],
        });
        const dist = Math.hypot(
            pixels.x - clusterPixels.x,
            pixels.y - clusterPixels.y
        );
        if (dist < minDist && dist < 20) {  // 20px 이내
            minDist = dist;
            nearest = cluster;
        }
    }

    if (nearest) {
        if (nearest.properties.cluster) {
            // 클러스터 확대
            const expansionZoom = supercluster.getClusterExpansionZoom(
                nearest.properties.cluster_id
            );
            map.morph(
                new naver.maps.LatLng(
                    nearest.geometry.coordinates[1],
                    nearest.geometry.coordinates[0]
                ),
                Math.min(expansionZoom, 19)
            );
        } else {
            // 개별 마커 클릭
            onMarkerClick(nearest.properties);
        }
    }
});
```

### 6.2 TextLayer 추가 (가격 표시)

```typescript
const textLayer = new TextLayer({
    id: 'price-labels',
    data: clusters.filter(c => !c.properties.cluster && c.properties.price),
    getPosition: d => d.geometry.coordinates,
    getText: d => formatPrice(d.properties.price),
    getSize: 12,
    getColor: [0, 0, 0, 255],
    getTextAnchor: 'middle',
    getPixelOffset: [0, -15],
    fontFamily: 'Pretendard, sans-serif',
    background: true,
    getBackgroundColor: [255, 255, 255, 220],
});

deck.setProps({ layers: [markerLayer, textLayer] });
```

### 6.3 IconLayer로 커스텀 마커

```typescript
const iconLayer = new IconLayer({
    id: 'custom-markers',
    data: clusters,
    getPosition: d => d.geometry.coordinates,
    getIcon: d => ({
        url: d.properties.cluster
            ? '/icons/cluster.png'
            : `/icons/${d.properties.type}.png`,
        width: 32,
        height: 32,
        anchorY: 32,
    }),
    getSize: d => d.properties.cluster
        ? Math.min(d.properties.point_count * 0.5 + 24, 48)
        : 24,
    sizeScale: 1,
});
```

## 7. 디버깅 체크리스트

### 마커가 안 보일 때

- [ ] `console.log(clustersRef.current.length)` 확인
- [ ] Supercluster에 데이터가 로드되었는지 확인
- [ ] Deck 인스턴스가 생성되었는지 확인
- [ ] Container가 지도 위에 있는지 z-index 확인

### FPS가 낮을 때

- [ ] `pointer-events: none` 설정 확인
- [ ] `pickable: false` 또는 `pickingRadius: 0` 확인
- [ ] `transitions: {}` 설정 확인
- [ ] Chrome DevTools Performance 탭에서 병목 확인

### 동기화가 안 될 때

- [ ] `mbMap = (map as any)._mapbox` 가 존재하는지 확인
- [ ] `mbMap.getCenter()`, `mbMap.getZoom()` 값 확인
- [ ] rAF 루프가 실행 중인지 확인
- [ ] cleanup 시 rAF가 취소되는지 확인

### 클러스터가 안 바뀔 때

- [ ] `lastZoomRef.current` 값 확인
- [ ] `Math.floor(zoom)` 계산 확인
- [ ] `supercluster.getClusters()` 결과 확인
- [ ] bbox 좌표가 올바른지 확인

## 8. 파일 구조

```
components/map/naver/
├── DeckGLMarkerLayer.tsx    # Deck.gl 마커 레이어 (이 문서의 구현)
├── UnifiedPolygonGLLayer.tsx # MVT 폴리곤 레이어 (Mapbox GL 네이티브)
└── ...

lib/map/
├── zoomConfig.ts            # 줌 레벨 상수, 클러스터 설정
└── ...
```

## 9. 의존성

```json
{
  "@deck.gl/core": "^9.x",
  "@deck.gl/layers": "^9.x",
  "supercluster": "^8.x"
}
```

## 10. 참고 자료

- [Deck.gl Performance Guide](https://deck.gl/docs/developer-guide/performance)
- [Supercluster](https://github.com/mapbox/supercluster)
- [Mapbox Custom Layers Issue](https://github.com/mapbox/mapbox-gl-js/issues/8159)
- [Deck.gl + Mapbox Integration](https://deck.gl/docs/api-reference/mapbox/overview)
