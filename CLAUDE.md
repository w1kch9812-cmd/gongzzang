# Gongzzang 프로젝트

> 산업단지 부동산 정보 시각화 플랫폼

## 프로젝트 개요

인천 지역의 산업단지, 필지, 실거래가, 매물, 경매 정보를 지도 기반으로 시각화하는 웹 애플리케이션

## ⚠️ 필독 문서 (작업 전 반드시 참조할 것!)

> **중요**: 코드 작성/수정 전에 아래 문서를 **반드시** 읽고 패턴을 따를 것!

### 📐 아키텍처 & 구조
- **`docs/ARCHITECTURE_GUIDE.md`** ⭐ - 대용량 지도 시각화 구현 가이드
  - MVT 타일링 전략, 메모리 최적화, 성능 패턴
  - **구현 시 이 문서의 패턴을 반드시 따를 것**

- **`docs/RESPONSIBILITY_MAP.md`** ⭐ - 시스템 책임 분담 맵
  - 각 모듈의 역할과 책임
  - 데이터 흐름 및 의존성 그래프
  - **로직 작성 전 어느 파일이 담당하는지 먼저 확인**

### 📂 파일 & 코드
- **`docs/FILE_STRUCTURE.md`** - 프로젝트 파일 구조
  - 현재 사용 중인 파일 목록  
  - 미사용/삭제 가능 파일 분류
  - 파일 변경 시 자동 업데이트

- **`docs/OPTIMIZATION_GUIDE.md`** ⭐ - 성능 최적화 가이드
  - 최적화 포인트 및 해결책
  - **중복/불필요한 계산 방지 패턴**
  - useMemo, 줌 레벨 캐싱 등

### 📊 데이터 & API
- **`docs/PNU_GUIDE.md`** - PNU (필지고유번호) 가이드
  - PNU 구조 및 규칙 (19자리 코드)
  - 지번/도로명주소/좌표 → PNU 변환
  - 대/산/블록 구분, API 연동 예시

- **`docs/PMTILES_GUIDE.md`** ⭐ - PMTiles 최적화 가이드
  - **모든 줌 레벨이 있어도 최적화되는 원리**
  - HTTP Range Request로 필요한 타일만 다운로드
  - 43,266개 필지를 32KB로 서빙하는 방법

### 🔍 디버깅 & 분석
- **`docs/NAVER_MAP_INSPECTION.md`** - 네이버 지도 내부 분석 가이드
  - 브라우저 콘솔로 Mapbox GL 인스턴스 접근
  - POI/레이어/스타일 요소 분석 방법
  - `icon-text-fit`, `text-halo` 등 속성 분석

## 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js | 16+ |
| UI | Mantine | 7.x |
| 상태관리 | Zustand | 5.x |
| 지도 | Naver Maps API (GL 모드) | - |
| 마커 렌더링 | Deck.gl | 9.x |
| 클러스터링 | Supercluster | 8.x |

## 프로젝트 구조

```
gongzzang/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 메인 페이지
│   └── api/               # API 라우트
├── components/            # React 컴포넌트
│   ├── map/              # 지도 관련
│   ├── markers/          # 마커 컴포넌트
│   └── panel/            # 패널 컴포넌트
├── lib/                   # 유틸리티
│   ├── stores/           # Zustand 스토어 (모듈화)
│   │   ├── types.ts      # 공유 타입 및 상수
│   │   ├── map-store.ts  # 지도 상태
│   │   ├── data-store.ts # 데이터 관리
│   │   ├── selection-store.ts # 선택 상태 및 포커스 모드
│   │   ├── filter-store.ts    # 필터 상태
│   │   ├── ui-store.ts        # UI 상태
│   │   ├── preferences-store.ts # 사용자 설정
│   │   └── index.ts      # 통합 export
│   └── data/             # 데이터 로더
├── types/data.ts          # TypeScript 타입 정의
├── public/data/           # 정적 데이터
└── scripts/              # 데이터 처리 스크립트
```

## Store 구조 (Zustand)

모듈화된 store 아키텍처:

| Store | 역할 | 주요 상태 |
|-------|------|----------|
| **map-store** | 지도 상태 | mapInstance, currentBounds, currentZoom, currentLocation |
| **data-store** | 데이터 관리 | parcels, factories, districts, regionAggregations |
| **selection-store** | 선택/포커스 | selection, selectedParcel, focusMode, focusedComplex |
| **filter-store** | 필터 상태 | filter, filteredParcels, savedFilters, timeline |
| **ui-store** | UI 상태 | visibleLayers, parcelColorMode, analysisModal |
| **preferences-store** | 사용자 설정 | favorites, mapPreferences |

**사용법:**
```typescript
// 직접 import (권장 - 성능 최적화)
import { useMapStore } from '@/lib/stores/map-store';
import { useDataStore } from '@/lib/stores/data-store';
import { useUIStore } from '@/lib/stores/ui-store';

// 편의 훅 사용
import { useFilter, useFilterActions } from '@/lib/stores/filter-store';
import { useSelectionState, useFocusMode } from '@/lib/stores/selection-store';
```

## 명령어

```bash
# 개발 서버
npm run dev

# 빌드
npm run build

# 데이터 처리
npm run data:build         # 전체
npm run data:shp           # SHP -> GeoJSON
npm run data:props         # 속성 JSON 추출
npm run data:tiles         # MVT 타일 생성
npm run data:excel         # Excel/CSV 파싱

# 샘플 데이터 생성
npx tsx scripts/generate-sample-data.ts

# 지오코딩 (API 키 필요)
set NAVER_CLIENT_ID=xxx && set NAVER_CLIENT_SECRET=xxx && npx tsx scripts/geocode-addresses.ts

# 인덱스 파일 재생성 (지오코딩 후 필수!)
npx tsx scripts/regenerate-index.ts
```

### ⚠️ 인덱스 파일 재생성 주의사항

지오코딩 후 **반드시** `regenerate-index.ts` 실행 필요:

```bash
npx tsx scripts/regenerate-index.ts
```

**문제 상황**: 지오코딩 스크립트가 `factories.json`은 업데이트하지만,
`factories-index.json`이 손상되거나 인코딩 문제가 발생할 수 있음.

**증상**:
- 브라우저에서 `coord: null` 반환
- 마커가 표시되지 않음
- `withCoord: 0개` 로그 출력

**해결**: `regenerate-index.ts` 실행으로 전체 데이터에서 인덱스 재생성

## 환경변수 (.env.local)

```
NAVER_CLIENT_ID=xxx
NAVER_CLIENT_SECRET=xxx
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=xxx
```

## 데이터 설정

모든 데이터 소스 설정: `scripts/data.config.ts`

## 주요 타입

- `ParcelMarkerData` - 필지 마커 데이터
- `District` - 행정구역
- `IndustrialComplex` - 산업단지
- `KnowledgeCenterIndex` / `KnowledgeIndustryCenter` - 지식산업센터 (인덱스/상세)
- `FactoryIndex` / `Factory` - 공장 (인덱스/상세)

### 인덱스/상세 분리 패턴

포인트 데이터(공장, 지식산업센터)는 **인덱스/상세 분리**:

| 구분 | 인덱스 (마커용) | 상세 (클릭 시) |
|------|----------------|---------------|
| 공장 | `FactoryIndex` (id, name, coord, businessType) | `Factory` (전체 속성) |
| 지식산업센터 | `KnowledgeCenterIndex` (id, name, coord, status) | `KnowledgeIndustryCenter` |

**파일 구조**:
```
public/data/properties/
├── factories-index.json      (~1.7MB, 마커 렌더링용)
├── factories.json            (~4MB, 상세 조회용)
├── knowledge-centers-index.json (~7KB)
└── knowledge-centers.json    (~100KB)
```

**로더 사용법**:
```typescript
// 초기 로드 (인덱스만)
const factories = await loadFactories();  // FactoryIndex[]

// 클릭 시 상세 로드
const detail = await loadFactoryDetail(id);  // Factory | null
```

## 줌 레벨 구조

> **Single Source of Truth**: `lib/map/zoomConfig.ts`

| 상수 | 범위 | 표시 |
|------|------|------|
| ZOOM_SIDO | 0-8 | 시/도 |
| ZOOM_SIG | 8-12 | 시/군/구 |
| ZOOM_EMD | 12-14 | 읍/면/동 |
| ZOOM_PARCEL | 14-22 | 개별 필지 |

### 오버줌(Overzoom) 전략

PMTiles는 필요한 줌 레벨까지만 생성하고, 그 이상은 **오버줌**으로 처리:

| PMTiles | 생성 줌 | 표시 줌 | 오버줌 |
|---------|---------|---------|--------|
| sido | 0-8 | 0-8 | 없음 |
| sig | 0-12 | 8-12 | 없음 |
| emd | 0-14 | 12-14 | 없음 |
| parcels | 12-17 | 14-22 | 17→22 |
| complex | **0-16** | **0-22** | 16→22 |

**오버줌 설정 방법** (레이어에서):
```typescript
// 소스: 타일이 존재하는 범위
map.addSource('parcels', { maxzoom: 17 });
// 레이어: 오버줌으로 22까지 표시
map.addLayer({ maxzoom: 22 });
```

**산업단지(complex)**: 모든 줌 레벨(0-22)에서 표시됨

## 현재 데이터 현황

| 데이터 | 개수 |
|--------|------|
| 시군구 | 11개 |
| 읍면동 | 251개 |
| 필지 | 43,266개 |
| 산업단지 | 8개 |
| 공장 | 14,193개 |
| 지식산업센터 | 81개 |

## 주의사항

1. GeoJSON 직접 서빙 금지 - MVT 타일과 속성 JSON만 사용
2. 좌표계는 WGS84 (EPSG:4326)
3. 인코딩: SHP=euc-kr, CSV=cp949
4. 지역 필터: 코드 28 (인천)
5. 타입 플래그: 1=실거래, 2=매물, 4=경매
6. React Strict Mode 비활성화 필수 (지도 이중 렌더링 방지)

## 네이버 지도 GL 모드 + Mapbox GL 내부 접근

> **중요**: 네이버 지도 GL 모드는 내부적으로 Mapbox GL을 사용함. 고급 기능(3D, tilt, bearing, Deck.gl 통합)은 내부 Mapbox GL 인스턴스를 직접 사용해야 함.

### 내부 Mapbox GL 인스턴스 접근
```typescript
const mapboxGL = (naverMap as any)._mapbox;
```

### 3D 뷰 (Tilt/Bearing) 조작
```typescript
// ❌ 네이버 API 직접 사용 (동작 안함)
(map as any).setOptions({ tilt: 60, bearing: 30 });

// ✅ Mapbox GL 네이티브 API 사용 (올바른 방법)
const mapboxGL = (map as any)._mapbox;
mapboxGL.easeTo({ pitch: 45, bearing: 0, duration: 500 });
mapboxGL.setPitch(60);
mapboxGL.setBearing(30);
mapboxGL.getPitch();
mapboxGL.getBearing();

// 드래그 회전 제어
mapboxGL.dragRotate.disable();
mapboxGL.touchZoomRotate.disableRotation();
```

### Deck.gl 통합 (단일 WebGL 컨텍스트)
```typescript
import { MapboxOverlay } from '@deck.gl/mapbox';

// Mapbox GL 인스턴스 찾기
const mbMap = (naverMap as any)._mapbox;

// MapboxOverlay로 단일 캔버스 렌더링
const overlay = new MapboxOverlay({
    interleaved: true,  // ⭐ 중요: 동일 WebGL 컨텍스트 사용
    layers: [],
});
mbMap.addControl(overlay);
```

### 참고 파일
- `components/map/NaverMap.tsx` - 3D 모드 토글 및 Ctrl+드래그 컨트롤
- `components/map/naver/DeckGLMarkerLayer.tsx` - Deck.gl + Mapbox GL 통합

## 네이버 API 설정

**Maps JS API** (중요: `ncpClientId` 아닌 `ncpKeyId` 사용)
```html
<script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId={Client ID}"></script>
```

**Geocoding API 엔드포인트** (중요: `naveropenapi.apigw.ntruss.com` 아님)
- Geocoding: `https://maps.apigw.ntruss.com/map-geocode/v2/geocode`
- Reverse Geocoding: `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc`

**헤더**
```
X-NCP-APIGW-API-KEY-ID: {Client ID}
X-NCP-APIGW-API-KEY: {Client Secret}
```

## PMTiles 생성 방법

### 사전 요구사항
1. WSL (Windows Subsystem for Linux) 설치됨
2. tippecanoe 설치됨

### WSL 설정 (최초 1회)
```bash
# WSL 설치 확인
wsl --list

# Ubuntu에서 tippecanoe 설치
wsl
sudo apt update
sudo apt install -y tippecanoe

# Windows 드라이브 마운트 (필요시)
sudo mount -t drvfs E: /mnt/e
```

### PMTiles 생성
```bash
# GeoJSON이 temp/에 있어야 함
# 1. SHP → GeoJSON 변환
npm run data:shp

# 2. PMTiles 생성 (WSL에서 실행)
npm run data:tiles
# 또는 직접 실행:
wsl bash scripts/generate-pmtiles.sh
```

## PMTiles 현황

> **오버줌 활용**: 파일 크기 최소화, 레이어 설정으로 22까지 표시

| 파일 | 생성 줌 | 표시 줌 (오버줌) | 용도 |
|------|---------|-----------------|------|
| sido.pmtiles | 0-8 | 0-8 | 시도 폴리곤 |
| sig.pmtiles | 0-12 | 8-12 | 시군구 폴리곤 |
| emd.pmtiles | 0-14 | 12-14 | 읍면동 폴리곤 |
| parcels.pmtiles | 12-17 | 14-22 | 필지 폴리곤 |
| complex.pmtiles | **0-16** | **0-22** | 산업단지 (전체 줌) |
| lots.pmtiles | 12-17 | 12-22 | 용지 폴리곤 |
| industries.pmtiles | 12-17 | 12-22 | 유치업종 폴리곤 |

**공장/지식산업센터**: PMTiles 불필요 (포인트 → JSON + Deck.gl)

## 지오코딩 현황

| 데이터 | 완료 | 성공률 |
|--------|------|--------|
| 지식산업센터 | 72/81 | 88.9% |
| 공장 (PNU) | 14,130/14,193 | 99.6% |
| 공장 (좌표) | 14,123/14,193 | 99.5% |

## TODO

- [x] PMTiles 생성 완료 (7개 파일, ~90 MB)
- [x] 지식산업센터 지오코딩 (72/81, 88.9%)
- [x] 네이버 지도 API 키 업데이트 (uhwy1pqwqr)
- [x] 레이어 활성화 (UnifiedPolygonGLLayer, UnifiedMarkerLayer)
- [x] 공장 지오코딩 + PNU 변환 완료 (14,130/14,193, 99.6%)
- [ ] 실제 실거래가 데이터 연동
- [ ] UI 컴포넌트 활성화 (DetailPanel, FilterPanel 등)
