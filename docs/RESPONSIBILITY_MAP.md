# Gongzzang 시스템 책임 분담 맵

> 각 모듈이 담당하는 역할과 책임을 명확히 정의

## 📂 레이어별 책임

### 🗄️ 데이터 계층 (Data Layer)

#### [lib/data/loadData.ts](lib/data/loadData.ts)
**책임**: 데이터 로딩, 캐싱, 정규화
- ✅ 초기 데이터 로딩 (`loadParcels`, `loadDistricts`, etc.)
- ✅ 온디맨드 데이터 로딩 (`loadParcelDetail`)
- ✅ LRU 캐시 관리 (클라이언트 사이드)
- ✅ 원본 데이터 → 내부 타입 변환 (`normalizeParcel`, `normalizeDistrict`)

**의존성**:
- `@/lib/utils/dataHelpers` (좌표 변환, fetch 래퍼, 타입 계산)
- `@/types/data` (타입 정의)

---

#### [lib/utils/dataHelpers.ts](lib/utils/dataHelpers.ts)
**책임**: 데이터 처리 유틸리티 (Single Source of Truth)
- ✅ 좌표 변환 (`normalizeCoordinate`, `coordToLatLng`, `getLng`, `getLat`)
- ✅ fetch + 에러 처리 통합 (`fetchData`)
- ✅ 타입 플래그 계산 (`calculateParcelType`, `hasTransactionPrice`, etc.)
- ✅ 마커 타입 변환 (`getMarkerType`, `getMarkerSubType`)
- ✅ 로깅 헬퍼 (`logLoadStart`, `logLoadComplete`)
- ✅ 범위 검사 (`isInBounds`)

**의존성**: 없음 (순수 유틸리티)

---

#### [app/api/parcel/[pnu]/route.ts](app/api/parcel/[pnu]/route.ts)
**책임**: 서버 사이드 필지 상세 정보 API
- ✅ 필지 상세 정보 조회 (PNU 기반)
- ✅ 서버 사이드 캐싱 (Map 기반, 최대 1000개)
- ✅ 에러 처리 (404, 500)

**의존성**: Node.js fs, path

---

### 🎛️ 상태 관리 계층 (State Layer)

#### [lib/store.ts](lib/store.ts)
**책임**: 전역 상태 관리 (Zustand)
- ✅ 지도 상태 (mapReady, currentZoom, currentBounds)
- ✅ 데이터 저장 (parcels, districts, industrialComplexes, etc.)
- ✅ 선택 상태 (selectedParcel, selectedComplex, etc.)
- ✅ 포커스 모드 (focusMode, focusedComplex)
- ✅ 레이어 가시성 (visibleLayers, toggleLayer)
- ✅ 필터 설정 (parcelColorMode, transactionYear, etc.)

**의존성**:
- `zustand` (상태 관리 라이브러리)
- `@/types/data` (타입 정의)

---

### 🗺️ 지도 설정 계층 (Map Config Layer)

#### [lib/map/zoomConfig.ts](lib/map/zoomConfig.ts)
**책임**: 줌 레벨 & 클러스터링 설정 (Single Source of Truth)
- ✅ 줌 레벨 상수 (ZOOM_SIDO, ZOOM_SIG, ZOOM_EMD, ZOOM_PARCEL)
- ✅ 핵심 전환점 (THRESHOLD_*)
- ✅ 클러스터 설정 (CLUSTER_CONFIG)
- ✅ 클러스터링 단계 정의 (CLUSTERING_STAGES)
- ✅ 표시 조건 함수 (`shouldShowParcelMarkers`, `shouldShowRegionMarkers`, etc.)
- ✅ 마커 타입별 표시 조건 (`shouldShowMarkerByType`)
- ✅ 클러스터링 단계 판단 (`getClusteringStage`)

**의존성**: 없음 (순수 설정)

---

### 🎯 마커 시스템 (Marker System)

#### [lib/markers/UnifiedMarkerManager.ts](lib/markers/UnifiedMarkerManager.ts)
**책임**: 마커 데이터 관리 & 렌더링 조율
- ✅ Supercluster 인스턴스 관리 (집계 로직 포함)
- ✅ 원본 데이터 저장 (`rawData`, `advertisements`)
- ✅ 필터 적용 (`applyFilters`, `shouldShowMarker`)
- ✅ 뷰포트 기반 클러스터 쿼리 (`getClusters`)
- ✅ 렌더러 조율 (DOMPoolRenderer, OffscreenRenderer)
- ✅ 지도 이벤트 리스닝 (moveend, zoomend)

**의존성**:
- `supercluster` (클러스터링 라이브러리)
- `./renderers/DOMPoolRenderer` (DOM 마커 렌더러)
- `./renderers/OffscreenRenderer` (광고 마커 렌더러)
- `@/lib/map/zoomConfig` (줌 설정)

---

#### [lib/markers/renderers/DOMPoolRenderer.ts](lib/markers/renderers/DOMPoolRenderer.ts)
**책임**: DOM 기반 마커 렌더링 & 인터랙션
- ✅ DOM 풀링 (마커 재사용)
- ✅ 마커 HTML 렌더링 (innerHTML 사용)
  - 클러스터 마커 (`renderCluster`)
  - 필지 마커 (`renderPropertyMarker`, `renderTransactionMarker`)
  - 지역 마커 (`renderRegionMarker`)
  - 산업단지 마커 (`renderComplexMarker`)
  - 지식산업센터 마커 (`renderKnowledgeMarker`)
- ✅ 클릭 이벤트 처리 (`handleClick`)
- ✅ CustomEvent 발생 (`marker-click`)

**의존성**:
- `naver.maps.Marker` (네이버 지도 API)

---

#### [lib/markers/renderers/OffscreenRenderer.ts](lib/markers/renderers/OffscreenRenderer.ts)
**책임**: 오프스크린 광고 마커 렌더링
- ✅ 광고 마커 전용 렌더링
- ✅ 뷰포트 밖 마커 표시 (항상 보임)

**의존성**:
- `naver.maps.Marker` (네이버 지도 API)

---

### ⚛️ React 컴포넌트 계층 (Component Layer)

#### [components/map/naver/UnifiedMarkerLayer.tsx](components/map/naver/UnifiedMarkerLayer.tsx)
**책임**: React ↔ 마커 시스템 연결
- ✅ UnifiedMarkerManager 생명주기 관리 (초기화, 파괴)
- ✅ Zustand 상태 → MarkerProps 변환
- ✅ 데이터 변경 감지 및 로딩
- ✅ 필터 상태 동기화

**의존성**:
- `@/lib/store` (Zustand)
- `@/lib/markers/UnifiedMarkerManager` (마커 매니저)
- `@/lib/utils/dataHelpers` (좌표/타입 헬퍼)

---

#### [components/map/naver/UnifiedPolygonGLLayer.tsx](components/map/naver/UnifiedPolygonGLLayer.tsx)
**책임**: MVT 폴리곤 렌더링
- ✅ Naver Maps GL Layer 관리
- ✅ MVT 타일 소스 설정
- ✅ 가격 기반 색상 표현식 적용
- ✅ 클릭 이벤트 처리 (필지 선택)

**의존성**:
- `@/lib/hooks/usePriceColorExpression` (색상 표현식 훅)
- `@/lib/store` (Zustand)

---

#### [components/map/NaverMap.tsx](components/map/NaverMap.tsx)
**책임**: 네이버 지도 메인 컨테이너
- ✅ 지도 인스턴스 생성
- ✅ 초기 설정 (중심 좌표, 줌 레벨)
- ✅ 레이어 컴포넌트 마운트

**의존성**:
- `@/lib/store` (Zustand)
- 레이어 컴포넌트들 (UnifiedMarkerLayer, UnifiedPolygonGLLayer, etc.)

---

## 🔄 데이터 흐름

```
[초기 로딩]
1. app/page.tsx
   ↓ useEffect
2. loadAllData() (lib/data/loadData.ts)
   ↓ fetchData() (lib/utils/dataHelpers.ts)
3. normalize*() 함수들
   ↓
4. Zustand Store (lib/store.ts)
   ↓
5. UnifiedMarkerLayer.tsx
   ↓ 데이터 변환 (getMarkerType, getLng, etc.)
6. UnifiedMarkerManager.ts
   ↓ Supercluster 로드
7. DOMPoolRenderer.ts
   ↓ innerHTML 렌더링
8. 지도에 마커 표시


[클릭 이벤트]
1. DOMPoolRenderer.handleClick()
   ↓ CustomEvent 발생
2. window.dispatchEvent('marker-click')
   ↓ (현재 미연결 ⚠️)
3. UnifiedMarkerLayer.tsx (TODO)
   ↓ loadParcelDetail() 호출
4. app/api/parcel/[pnu]/route.ts
   ↓ 데이터 반환
5. Zustand Store.setSelectedParcel()
   ↓
6. 상세 패널 표시 (TODO: UI 없음)


[필터 변경]
1. 사용자 액션 (TODO: FilterPanel 없음)
   ↓
2. Zustand Store.toggleLayer()
   ↓
3. UnifiedMarkerLayer.tsx (useEffect)
   ↓
4. UnifiedMarkerManager.applyFilters()
   ↓ shouldShowMarker() 필터링
5. Supercluster 재로드
   ↓
6. DOMPoolRenderer 재렌더링


[줌 변경]
1. 사용자 줌 조작
   ↓ Naver Maps 이벤트
2. UnifiedMarkerManager (zoomend 리스너)
   ↓ getClusteringStage() (zoomConfig.ts)
3. Supercluster.getClusters(zoom)
   ↓ 줌 레벨에 맞는 클러스터 반환
4. DOMPoolRenderer.render()
   ↓ renderCluster() or renderLeaf()
5. 지도 업데이트
```

---

## 🎨 렌더링 흐름

```
UnifiedMarkerManager
  ├─ 데이터 필터링 (shouldShowMarker)
  ├─ Supercluster 쿼리 (getClusters)
  └─ 렌더러 호출
      │
      ├─ DOMPoolRenderer (일반 마커)
      │   ├─ 풀에서 DOM 요소 가져오기
      │   ├─ innerHTML로 내용 업데이트
      │   ├─ naver.maps.Marker 생성/업데이트
      │   └─ 클릭 이벤트 핸들러 연결
      │
      └─ OffscreenRenderer (광고 마커)
          └─ 항상 표시되는 마커 렌더링
```

---

## 📊 모듈 간 의존성 그래프

```
types/data.ts (타입 정의)
    ↑
    ├─ lib/utils/dataHelpers.ts (순수 유틸리티)
    │       ↑
    │       ├─ lib/data/loadData.ts (데이터 로딩)
    │       │       ↑
    │       │       └─ lib/store.ts (상태 관리)
    │       │               ↑
    │       └───────────────┤
    │                       │
    ├─ lib/map/zoomConfig.ts (줌 설정)
    │       ↑               │
    │       └───────────────┤
    │                       │
    └─ lib/markers/UnifiedMarkerManager.ts
            ↑               │
            ├─ DOMPoolRenderer.ts
            └─ OffscreenRenderer.ts
                    ↑
                    └─ components/map/naver/UnifiedMarkerLayer.tsx
                            ↑
                            └─ components/map/NaverMap.tsx
                                    ↑
                                    └─ app/page.tsx
```

**의존성 방향**: 하위 → 상위 (단방향)
**결합도**: 낮음 (각 모듈은 독립적)

---

## ⚙️ 설정 파일 vs 로직 파일

### 설정 파일 (Configuration)
- `lib/map/zoomConfig.ts` - 줌 레벨 상수, 클러스터링 설정
- `lib/utils/dataHelpers.ts` - 순수 함수 유틸리티

### 로직 파일 (Business Logic)
- `lib/data/loadData.ts` - 데이터 로딩, 캐싱
- `lib/markers/UnifiedMarkerManager.ts` - 마커 관리, 필터링
- `lib/markers/renderers/DOMPoolRenderer.ts` - 렌더링, 이벤트

### 상태 파일 (State Management)
- `lib/store.ts` - 전역 상태 (Zustand)

### 연결 파일 (Integration)
- `components/map/naver/UnifiedMarkerLayer.tsx` - React ↔ 마커 시스템

---

## 🔍 책임 경계

| 질문 | 담당 모듈 |
|------|-----------|
| 좌표를 변환하려면? | `lib/utils/dataHelpers.ts` |
| 필지 데이터를 로드하려면? | `lib/data/loadData.ts` |
| 필지를 선택하려면? | `lib/store.ts` (setSelectedParcel) |
| 줌 레벨에 따라 마커를 표시하려면? | `lib/map/zoomConfig.ts` (shouldShowMarkerByType) |
| 클러스터를 생성하려면? | `lib/markers/UnifiedMarkerManager.ts` (Supercluster) |
| 마커를 그리려면? | `lib/markers/renderers/DOMPoolRenderer.ts` |
| 마커 클릭을 처리하려면? | `DOMPoolRenderer.handleClick` → `UnifiedMarkerLayer` (TODO) |
| 필터를 적용하려면? | `lib/store.ts` (toggleLayer) → `UnifiedMarkerManager.applyFilters` |

---

---

## 🎛️ 필터 시스템 (Filter System)

### DetailedFilterModal 레이아웃

3-column 레이아웃 구조:

```
┌─────────────────────────────────────────────────────────────────┐
│                    DetailedFilterModal (1000px)                  │
├──────────┬──────────────────────┬───────────────────────────────┤
│  1열     │       2열            │            3열                 │
│ 프리셋   │   탭 + 메뉴          │         상세 패널              │
│ (140px)  │    (200px)           │          (flex: 1)            │
├──────────┼──────────────────────┼───────────────────────────────┤
│          │ ┌──────────────────┐ │                               │
│ [프리셋] │ │ 기본 건물 토지.. │ │   선택된 필터의 상세 옵션      │
│          │ └──────────────────┘ │                               │
│ ──────── │                      │   예: 매물유형 → 카드형 선택   │
│          │ ┌──────────────────┐ │       거래유형 → 체크+가격     │
│ [저장됨] │ │ 매물정보 (섹션)  │ │       업종 → 아코디언+검색    │
│          │ │  ├ 매물유형      │ │                               │
│          │ │  └ 거래유형      │ │                               │
│          │ │                  │ │                               │
│          │ │ 면적 (섹션)      │ │                               │
│          │ │  ├ 대지면적      │ │                               │
│          │ │  ├ 연면적        │ │                               │
│          │ │  └ 전용면적      │ │                               │
│          │ └──────────────────┘ │                               │
├──────────┴──────────────────────┴───────────────────────────────┤
│ [초기화]                                    [N개 매물 보기]       │
└─────────────────────────────────────────────────────────────────┘
```

### 탭 및 위계 구조

```typescript
TAB_CONFIG = [
  {
    id: 'basic',    // 기본
    sections: [
      { label: '매물정보', items: ['매물유형', '거래유형'] },
      { label: '면적', items: ['대지면적', '연면적', '전용면적'] }
    ]
  },
  {
    id: 'building', // 건물
    sections: [
      { label: '구조', items: ['주구조', '지상층수', '지하층수'] },
      { label: '건축정보', items: ['준공연도', '건축연한', '건폐율', '용적률', '내진설계'] }
    ]
  },
  {
    id: 'land',     // 토지
    sections: [
      { label: '토지정보', items: ['지목', '용도지역', '공시지가'] },
      { label: '지형', items: ['지형형상', '지형고저', '도로접면'] }
    ]
  },
  {
    id: 'facility', // 시설
    sections: [
      { label: '공장', items: ['업종', '입주가능업종', '공장설립인허가', '산업단지'] },
      { label: '설비', items: ['전력용량', '층고', '바닥하중', '크레인', '도크레벨러', '호이스트'] },
      { label: '지식산업센터', items: ['건물명', '입주가능업종', '입주율', '관리비'] },
      { label: '창고', items: ['창고유형'] }
    ]
  },
  {
    id: 'auction',  // 경매
    sections: [
      { label: '경매정보', items: ['진행상태', '감정가', '최저가율', '유찰횟수', '특이사항'] }
    ]
  }
]
```

### 메뉴 표시 규칙

- **섹션 라벨**: 작은 폰트(`size="xs"`), dimmed 색상, 클릭 불가
- **메뉴 아이템**: 일반 폰트(`size="sm"`), 클릭 시 3열에 상세 패널 표시
- **선택된 아이템**: 파란색 배경, bold 폰트

### 주요 필터 UI 패턴

| 패턴 | 사용처 | 설명 |
|------|--------|------|
| 카드형 복수선택 | 매물유형 | 아이콘+라벨 카드, 복수 선택 가능 |
| 체크박스+가격 | 거래유형 | 체크 시 가격 입력 Collapse 펼침 |
| 범위 입력 | 면적, 가격 | 최소~최대 NumberInput |
| 체크박스 그룹 | 지목, 용도지역 | 복수 선택 가능 |
| 3버튼 선택 | boolean 필터 | 예/아니오/상관없음 |
| 아코디언+검색 | 업종(KSIC) | 카테고리별 아코디언, 검색 지원 |

### FilterState 구조 (lib/store.ts)

```typescript
FilterState = {
  // === 기본 탭 ===
  propertyTypes: PropertyType[];     // 매물유형 (복수선택)
  dealTypes: {
    sale: DealTypePrice;             // 매매 + 가격
    jeonse: DealTypePrice;           // 전세 + 보증금
    monthly: DealTypePrice;          // 월세 + 보증금 + 월세
  };
  landAreaMin/Max, totalFloorAreaMin/Max, exclusiveAreaMin/Max

  // === 공장 탭 ===
  factoryBusinessTypes: string[];    // KSIC 코드
  allowedIndustries: string[];       // 입주가능업종
  factoryApprovalTypes: string[];
  inIndustrialComplex: boolean | null;
  powerCapacityMin/Max, ceilingHeightMin/Max, floorLoadMin/Max
  hasCrane, hasDockLeveler, hasHoist: boolean | null;

  // === 지식산업센터 탭 ===
  kcBuildingName: string;
  kcAllowedIndustries: string[];
  kcOccupancyRateMin/Max, kcManagementFeeMin/Max

  // === 창고/토지/건물/경매 탭 ===
  // ... (상세 필드는 store.ts 참조)
}
```

---

## 📝 변경 이력

| 날짜 | 변경 내용 |
|------|-----------|
| 2025-12-29 | 필터 시스템 레이아웃 및 위계구조 문서화 |
| 2025-12-23 | 초기 문서 생성, 책임 분담 정의 |
