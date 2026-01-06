# PNU 기반 데이터 관리 가이드

> 필지고유번호(PNU)를 중심으로 한 데이터 관리 전략

## 📋 PNU 관리 현황

### ✅ PNU로 관리 가능한 데이터

| 데이터 타입 | PNU 적용 | 현황 | 설명 |
|------------|---------|------|------|
| **필지 (Parcel)** | ✅ 완료 | `id: "2814010100001000021"` | Primary Key로 PNU 사용 중 |
| **공장 (Factory)** | ✅ 완료 | `pnu: "2820010700106180009"` | PNU 필드 보유 (14,130/14,193개) |
| **지식산업센터** | ⚠️ 부분 | `pnu: "2820010100115500001"` | 81개 중 29개만 PNU 보유 |

### ❌ PNU로 관리 불가능한 데이터

| 데이터 타입 | 이유 | 현재 ID | 대안 |
|------------|------|---------|------|
| **산업단지** | 수백~수천 개 필지 집합 | `id: "228140"` (행정코드) | 필지에 `industrialComplexId` 추가 |
| **행정구역** | 추상적 구역 개념 | `id: "28140"` (행정코드) | PNU에서 행정코드 추출 |

---

## 🔧 구현된 유틸리티

### 1. PNU 파싱 및 행정구역 추출

```typescript
// lib/utils/pnuHelpers.ts

import { parsePNU, extractAdminCodes } from '@/lib/utils/pnuHelpers';

// PNU 파싱
const parsed = parsePNU('2814010100001000001');
// {
//   sido: "28",
//   sig: "28140",
//   emd: "2814010100",
//   ri: "281401010000",
//   bonbun: 1,
//   bubun: 0,
//   type: "1",
//   jibun: "1"
// }

// 행정구역 코드 추출
const codes = extractAdminCodes('2814010100001000001');
// {
//   sidoCode: "28",      // 인천광역시
//   sigCode: "28140",    // 남동구
//   emdCode: "2814010100", // 논현동
//   riCode: "281401010000"
// }
```

### 2. 행정구역별 클러스터링

```typescript
// lib/utils/clusterHelpers.ts

import { clusterByAdminCode, getAdminStats } from '@/lib/utils/clusterHelpers';

// 시군구별 그룹화
const sigClusters = clusterByAdminCode(parcels, 'sig');
// Map {
//   "28140" => [필지1, 필지2, ...],  // 남동구
//   "28110" => [필지3, 필지4, ...],  // 중구
//   ...
// }

// 읍면동별 그룹화
const emdClusters = clusterByAdminCode(parcels, 'emd');
// Map {
//   "2814010100" => [필지1, 필지2, ...],  // 논현동
//   "2814010200" => [필지3, 필지4, ...],  // 간석1동
//   ...
// }

// 통계 계산
const stats = getAdminStats(parcels, 'sig');
// [
//   { code: "28140", count: 5000, avgPrice: 500000, totalArea: 1234567 },
//   { code: "28110", count: 3000, avgPrice: 450000, totalArea: 987654 },
//   ...
// ]
```

### 3. 산업단지별 클러스터링

```typescript
import { clusterByComplex, getComplexStats } from '@/lib/utils/clusterHelpers';

// 산업단지별 그룹화 (필지에 industrialComplexId 있어야 함)
const complexClusters = clusterByComplex(parcels);
// Map {
//   "228140" => [필지1, 필지2, ...],  // 남동국가산업단지
//   "228150" => [필지3, 필지4, ...],  // 서운산업단지
//   ...
// }

// 산업단지별 통계
const complexStats = getComplexStats(parcels);
```

---

## 🗺️ PNU 기반 데이터 흐름

```
┌─────────────┐
│  원본 데이터  │ (SHP, CSV, Excel)
└──────┬──────┘
       │
       ↓ 지오코딩 / PNU 변환
┌──────────────────┐
│ PNU 정규화 데이터 │
│ - parcels.json   │ ← id: PNU
│ - factories.json │ ← pnu: PNU
└────────┬─────────┘
         │
         ├─→ PNU 파싱 → 행정구역 코드 추출
         │              (시도/시군구/읍면동)
         │
         ├─→ 공간 쿼리 → 산업단지 매핑
         │              (Point-in-Polygon)
         │
         └─→ 클러스터링 → 행정구역별/산업단지별 집계
```

---

## 📊 데이터 필드 구조

### 필지 (ParcelMarkerData)

```typescript
interface ParcelMarkerData {
    id: string;                    // ✅ PNU (Primary Key)
    coord: [number, number];       // 중심 좌표 (파생 데이터)
    type: number;                  // 비트 플래그 (1=실거래, 2=매물, 4=경매)
    area: number;                  // 면적
    sigCode?: string;              // ✅ 시군구 코드 (PNU에서 추출 가능)
    emdCode?: string;              // ✅ 읍면동 코드 (PNU에서 추출 가능)
    industrialComplexId?: string;  // 🔄 산업단지 ID (공간 쿼리로 추가)
}
```

### 공장 (Factory)

```typescript
interface Factory {
    id: string;                    // 공장등록번호
    pnu: string;                   // ✅ PNU (필지 참조)
    name: string;
    coord: [number, number];
    emdCode?: string;              // ✅ 읍면동 코드
}
```

### 지식산업센터 (KnowledgeIndustryCenter)

```typescript
interface KnowledgeIndustryCenter {
    id: string;
    name: string;
    pnu?: string;                  // ⚠️ 부분 보유 (29/81개)
    pnuList?: string[];            // 여러 필지에 걸친 경우
    coord: [number, number] | null;
}
```

---

## 🚀 작업 스크립트

### PNU 보완

```bash
# 지식산업센터 PNU 보완 (네이버 API 필요)
npm run enrich:knowledge-pnu

# 환경변수 설정 (.env.local)
NAVER_CLIENT_ID=your_client_id
NAVER_CLIENT_SECRET=your_client_secret
```

### 산업단지 매핑

```bash
# 필지에 산업단지 ID 매핑 (Point-in-Polygon)
npm run map:complex

# 필요 라이브러리: @turf/boolean-point-in-polygon, @turf/helpers
```

---

## 🔍 활용 예시

### 1. 특정 필지의 행정구역 확인

```typescript
import { extractAdminCodes } from '@/lib/utils/pnuHelpers';

const pnu = "2814010100001000001";
const codes = extractAdminCodes(pnu);

console.log(codes.emdCode);  // "2814010100" (논현동)
```

### 2. 읍면동별 필지 수 집계

```typescript
import { clusterByAdminCode } from '@/lib/utils/clusterHelpers';

const clusters = clusterByAdminCode(parcels, 'emd');

for (const [emdCode, items] of clusters) {
    console.log(`${emdCode}: ${items.length}개 필지`);
}
```

### 3. 특정 산업단지의 필지 찾기

```typescript
const namdongParcels = parcels.filter(
    p => p.industrialComplexId === "228140"
);

console.log(`남동국가산단: ${namdongParcels.length}개 필지`);
```

### 4. 특정 공장이 위치한 필지 정보 가져오기

```typescript
const factory = factories.find(f => f.id === "112002020539080");
if (factory.pnu) {
    const parcelInfo = await loadParcelDetail(factory.pnu);
    console.log(parcelInfo);
}
```

---

## ⚠️ 주의사항

### 1. PNU 길이 검증

```typescript
// PNU는 항상 19자리
if (pnu.length !== 19) {
    console.error('유효하지 않은 PNU:', pnu);
}
```

### 2. 좌표 → PNU 변환 제한

- 네이버 API 호출 제한: 100ms 간격 권장
- 변환 실패 가능성 존재 (신규 필지, API 응답 오류)
- 리(里) 코드는 API에서 제공 안 함 → `00` 사용

### 3. 산업단지 매핑 정확도

- Point-in-Polygon 알고리즘 사용
- 필지 중심 좌표 기준 (경계가 아님)
- 경계선 근처 필지는 수동 확인 필요

---

## 📝 변경 이력

| 날짜 | 변경 내용 |
|------|-----------|
| 2025-12-26 | 초기 문서 생성, PNU 관리 전략 수립 |
| 2025-12-26 | pnuHelpers.ts, clusterHelpers.ts 구현 완료 |
