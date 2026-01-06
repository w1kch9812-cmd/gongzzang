# PMTiles 가이드

> 대용량 지도 데이터를 단일 파일로 효율적으로 서빙하는 방법

## 🎯 PMTiles란?

**PMTiles (Protomaps Tiles)**: 수많은 MVT 타일 파일을 **하나의 정적 파일**로 묶어서 서빙하는 포맷

### 기존 방식 vs PMTiles

#### ❌ 기존 방식 (개별 타일 파일)
```
tiles/
├── 8/
│   ├── 221/
│   │   ├── 99.pbf
│   │   └── 100.pbf
│   └── 222/
├── 9/
├── 10/
...
└── 17/
    └── ... (수만 개 파일)
```

**문제점**:
- 수만 개의 파일 관리 필요
- 서버 파일 시스템 부하
- 배포 시 느림
- CDN 캐싱 비효율

#### ✅ PMTiles 방식 (단일 파일)
```
public/tiles/
├── parcels.pmtiles      (12MB, 모든 줌 레벨 포함)
├── districts.pmtiles    (1.5MB)
└── complexes.pmtiles    (50KB)
```

**장점**:
- ✅ 파일 1개로 관리
- ✅ HTTP Range Request로 필요한 부분만 다운로드
- ✅ CDN 친화적
- ✅ GitHub Pages/Vercel/Netlify 배포 가능

---

## 🔥 핵심: 모든 줌 레벨이 있어도 최적화됨!

### "전체 12MB인데 다 다운로드하나요?" → **NO!** ❌

PMTiles는 **필요한 타일만 부분 요청**으로 가져옵니다.

### 작동 원리

```
parcels.pmtiles (12MB)
├─ 헤더 (1KB) ──────────────┐
├─ 타일 디렉토리 (10KB) ────┤  ← 처음에만 다운로드
├─ 메타데이터 (1KB) ────────┘
├─ 줌 8 타일들 (50KB)
├─ 줌 9 타일들 (100KB)
├─ 줌 10 타일들 (200KB)
...
├─ 줌 14 타일 #1234 (5KB) ← 현재 뷰포트에서 필요한 타일만 요청
├─ 줌 14 타일 #1235 (5KB)
└─ 줌 17 타일들 (8MB)
```

#### 1단계: 초기 로딩 (~12KB)
```http
GET /tiles/parcels.pmtiles
Range: bytes=0-12000

응답: 헤더 + 디렉토리 + 메타데이터만 (12KB)
```

#### 2단계: 필요한 타일만 요청 (~20KB)
```http
GET /tiles/parcels.pmtiles
Range: bytes=524288-544000

응답: 줌 14, 타일(221, 99)만 (20KB)
```

**결과**: 전체 12MB 중 **32KB만 다운로드** (99.7% 절약!)

---

## 📊 실제 사용 예시 (43,266개 필지)

### 케이스 1: 줌 8 (전국 뷰)
```
사용자가 보는 것: 시군구 클러스터 (11개)
다운로드: 헤더(12KB) + 줌8 타일(10KB) = 22KB
전체 파일: 12MB
절약: 99.8%
```

### 케이스 2: 줌 12 (남동구 확대)
```
사용자가 보는 것: 읍면동 클러스터 (10개 동)
다운로드: 헤더(12KB) + 줌12 타일(30KB) = 42KB
전체 파일: 12MB
절약: 99.6%
```

### 케이스 3: 줌 14 (논현동 확대)
```
사용자가 보는 것: 개별 필지 300개
다운로드: 헤더(12KB) + 줌14 타일 4개(50KB) = 62KB
전체 파일: 12MB
절약: 99.5%
```

### 케이스 4: 줌 17 (필지 1개 확대)
```
사용자가 보는 것: 상세 필지 1개
다운로드: 헤더(12KB) + 줌17 타일 1개(5KB) = 17KB
전체 파일: 12MB
절약: 99.9%
```

---

## 🚀 성능 비교

### 개별 타일 방식 (기존)
| 줌 | 요청 수 | 다운로드 |
|-----|---------|----------|
| 8 | 1개 | 10KB |
| 12 | 4개 | 40KB |
| 14 | 9개 | 90KB |
| 17 | 16개 | 160KB |

**문제**: 요청 수가 많음 (HTTP 오버헤드)

### PMTiles 방식
| 줌 | 요청 수 | 다운로드 |
|-----|---------|----------|
| 8 | 2개 (헤더+타일) | 22KB |
| 12 | 2개 | 42KB |
| 14 | 2-3개 | 62KB |
| 17 | 2개 | 17KB |

**장점**:
- ✅ 요청 수 최소화
- ✅ HTTP/2 멀티플렉싱 활용
- ✅ CDN 캐싱 효율 극대화

---

## 🔧 PMTiles 생성 방법

### 1. GeoJSON → PMTiles

```bash
# tippecanoe 사용
tippecanoe \
  -o public/tiles/parcels.pmtiles \
  -Z8 \        # 최소 줌 (시군구)
  -z17 \       # 최대 줌 (상세 필지)
  -l parcels \ # 레이어 이름
  --drop-densest-as-needed \  # 자동 간소화
  --extend-zooms-if-still-dropping \
  temp/parcels.geojson
```

### 2. 현재 프로젝트 스크립트

```bash
# GeoJSON 생성 (SHP → GeoJSON)
npm run data:shp

# PMTiles 생성 (WSL에서)
npm run data:tiles
```

**스크립트**: [scripts/generate-pmtiles.sh](../scripts/generate-pmtiles.sh)

---

## 📦 현재 프로젝트 PMTiles 계획

| 파일 | 데이터 | 줌 | 예상 크기 | 상태 |
|------|--------|-----|-----------|------|
| `sig.pmtiles` | 시군구 (11개) | 0-12 | ~150KB | ⏳ 미생성 |
| `emd.pmtiles` | 읍면동 (251개) | 8-14 | ~1MB | ⏳ 미생성 |
| `complex.pmtiles` | 산업단지 (8개) | 8-16 | ~30KB | ⏳ 미생성 |
| `lots.pmtiles` | 필지 경계 (간소화) | 12-17 | ~100KB | ⏳ 미생성 |
| `industries.pmtiles` | 공장/지산 (14,274개) | 12-17 | ~1.3MB | ⏳ 미생성 |
| `parcels.pmtiles` | 실거래/매물 (43,266개) | 14-17 | ~12MB | ⏳ 미생성 |

**총 크기**: ~14.6MB (압축 전)
**실제 다운로드** (평균): ~50KB per 사용자

---

## 🎨 프론트엔드 사용법

### 1. protomaps-leaflet 사용 (추천)

```typescript
// components/map/naver/PMTilesLayer.tsx
import { PMTiles, Protocol } from 'pmtiles';

// PMTiles 파일 로드
const pmtiles = new PMTiles('/tiles/parcels.pmtiles');

// Naver Maps GL에 소스 추가
map.data.addGeoJson({
  type: 'vector',
  tiles: pmtiles,
  minzoom: 14,
  maxzoom: 17
});
```

### 2. 직접 구현 (현재 프로젝트)

```typescript
// lib/tiles/PMTilesSource.ts
export class PMTilesSource {
    private pmtiles: PMTiles;
    private cache = new Map<string, ArrayBuffer>();

    constructor(url: string) {
        this.pmtiles = new PMTiles(url);
    }

    async getTile(z: number, x: number, y: number): Promise<ArrayBuffer | null> {
        const key = `${z}/${x}/${y}`;

        // 캐시 확인
        if (this.cache.has(key)) {
            return this.cache.get(key)!;
        }

        // PMTiles에서 타일 가져오기 (HTTP Range Request)
        const tile = await this.pmtiles.getZxy(z, x, y);

        if (tile) {
            this.cache.set(key, tile.data);
        }

        return tile?.data || null;
    }
}
```

---

## ⚙️ 네이버 지도 GL 통합

### UnifiedPolygonGLLayer에서 PMTiles 사용

```typescript
// components/map/naver/UnifiedPolygonGLLayer.tsx

useEffect(() => {
    if (!map) return;

    const protocol = new Protocol();

    // PMTiles 등록
    protocol.add(new PMTiles('/tiles/parcels.pmtiles'));

    // GL 레이어 추가
    const layer = map.addLayer({
        id: 'parcels-fill',
        type: 'fill',
        source: {
            type: 'vector',
            url: 'pmtiles:///tiles/parcels.pmtiles',
            minzoom: 14,
            maxzoom: 17
        },
        'source-layer': 'parcels',
        paint: {
            'fill-color': priceColorExpression,
            'fill-opacity': 0.7
        }
    });

    return () => {
        map.removeLayer('parcels-fill');
    };
}, [map]);
```

---

## 🎯 최적화 팁

### 1. 줌 레벨 설계

```typescript
// 줌 레벨별 데이터 분리
const ZOOM_STRATEGY = {
    overview: { min: 0, max: 12, file: 'sig.pmtiles' },      // 시군구
    district: { min: 8, max: 14, file: 'emd.pmtiles' },      // 읍면동
    parcel: { min: 14, max: 17, file: 'parcels.pmtiles' },   // 필지
};
```

**이유**:
- 줌 8에서 필지 43,266개 표시 불필요 → 시군구만
- 줌 14+에서만 필지 상세 표시

### 2. 속성 최소화

```json
// ❌ 나쁨: 모든 속성 포함 (타일 크기 ↑)
{
  "type": "Feature",
  "properties": {
    "pnu": "2814010100001000021",
    "jibun": "논현동 1-2",
    "area": 1234.5,
    "transactionPrice": 500000000,
    "listingPrice": 550000000,
    "owner": "홍길동",
    "buildingName": "ABC빌딩",
    "..." : "불필요한 정보들"
  }
}

// ✅ 좋음: 필수 속성만 (타일 크기 ↓)
{
  "type": "Feature",
  "properties": {
    "id": "2814010100001000021",
    "p": 500000000,  // price (단축)
    "a": 1234.5,     // area (단축)
    "t": 1           // type (1=실거래, 2=매물, 4=경매)
  }
}
```

### 3. 간소화 (Simplification)

```bash
tippecanoe \
  --drop-densest-as-needed \           # 밀집 지역 자동 간소화
  --simplification=10 \                # 단순화 수준
  --detect-shared-borders \            # 공유 경계선 감지
  --coalesce-densest-as-needed \      # 밀집 폴리곤 병합
  -o output.pmtiles \
  input.geojson
```

**효과**: 파일 크기 50% 감소 (12MB → 6MB)

---

## 📈 메모리 & 네트워크 효율

### 시나리오: 사용자가 인천 → 남동구 → 논현동으로 줌

#### 1. 줌 8 (인천 전체)
```
다운로드: sig.pmtiles 헤더 (12KB) + 줌8 타일 (10KB) = 22KB
메모리: 시군구 11개 폴리곤
```

#### 2. 줌 12 (남동구)
```
다운로드: emd.pmtiles 헤더 (12KB) + 줌12 타일 (30KB) = 42KB
메모리: 읍면동 10개 폴리곤
기존 타일: 캐시됨 (재사용)
```

#### 3. 줌 14 (논현동)
```
다운로드: parcels.pmtiles 헤더 (12KB) + 줌14 타일 (50KB) = 62KB
메모리: 필지 300개 폴리곤
기존 타일: 캐시됨
```

**총 다운로드**: 126KB (전체 14.6MB 중 0.86%)
**총 메모리**: ~321개 폴리곤 (전체 43,266개 중 0.74%)

---

## 🔍 디버깅

### PMTiles 검사 도구

```bash
# pmtiles CLI 설치
npm install -g pmtiles

# 파일 정보 확인
pmtiles show public/tiles/parcels.pmtiles

# 특정 타일 추출
pmtiles tile public/tiles/parcels.pmtiles 14 8849 6004

# 메타데이터 확인
pmtiles metadata public/tiles/parcels.pmtiles
```

### 브라우저 네트워크 탭 확인

```
GET /tiles/parcels.pmtiles
Range: bytes=0-16383
Status: 206 Partial Content
Content-Length: 16384

→ ✅ 정상: Range Request 작동 중
```

---

## 🚨 주의사항

### 1. CORS 설정 필요

**next.config.js**:
```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/tiles/:path*.pmtiles',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Accept-Ranges', value: 'bytes' },
          { key: 'Cache-Control', value: 'public, max-age=31536000' },
        ],
      },
    ];
  },
};
```

### 2. 서버 Range Request 지원 필수

**Vercel/Netlify**: 자동 지원 ✅
**Nginx**: `Accept-Ranges` 활성화 필요
**S3/CloudFront**: 기본 지원 ✅

### 3. 파일 크기 제한

- **GitHub Pages**: 100MB 제한
- **Vercel**: 파일당 제한 없음
- **Netlify**: 파일당 제한 없음

큰 파일은 분할 권장:
```
parcels-part1.pmtiles (10MB)
parcels-part2.pmtiles (10MB)
```

---

## 📚 참고 자료

- [PMTiles 공식 문서](https://github.com/protomaps/PMTiles)
- [tippecanoe 가이드](https://github.com/felt/tippecanoe)
- [MVT 스펙](https://github.com/mapbox/vector-tile-spec)
- [HTTP Range Requests (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)

---

## 📝 변경 이력

| 날짜 | 변경 내용 |
|------|-----------|
| 2025-12-23 | 초기 문서 생성, PMTiles 최적화 원리 설명 |
