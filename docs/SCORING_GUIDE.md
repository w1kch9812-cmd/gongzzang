# 분석 패널 스코어링 가이드

> 투자 매력도, 산업 집적도, 경매 동향 스코어링 로직 상세 정의

---

## 1. 데이터 소스

### 1.1 필지 데이터 (ParcelMarkerData)

```typescript
interface ParcelMarkerData {
    pnu: string;                    // 필지고유번호 (19자리)
    center: [lng, lat];             // 중심 좌표
    type: number;                   // 비트 플래그: 1=실거래, 2=매물, 4=경매
    area: number;                   // 면적 (㎡)
    transactionPrice?: number;      // 실거래가 (만원)
    listingPrice?: number;          // 매물가 (만원)
    auctionPrice?: number;          // 경매가 (만원)
    sigCode?: string;               // 시군구 코드 (5자리)
    emdCode?: string;               // 읍면동 코드 (10자리)
    propertyType?: PropertyType;    // 매물 유형
}

type PropertyType = 'factory' | 'knowledge-center' | 'warehouse' | 'land';
```

### 1.2 공장 데이터 (FactoryIndex)

```typescript
interface FactoryIndex {
    id: string;           // PNU 기반 ID
    name: string;         // 공장명
    coord: [lng, lat];    // 좌표
    businessType: string; // 업종
}
```

### 1.3 데이터 접근 방법

```typescript
// 전체 필지 (필터 적용됨)
const allParcels = useFilteredParcels();

// 전체 공장
const allFactories = useDataStore((state) => state.factories);

// 지역 필터링
const parcels = allParcels.filter(p => p.sigCode === regionCode);  // 시군구
const parcels = allParcels.filter(p => p.emdCode === regionCode);  // 읍면동
```

---

## 2. 투자 매력도 (PriceAnalysis.tsx)

### 2.1 가격 경쟁력

#### 참조 데이터
| 필드 | 설명 | 용도 |
|------|------|------|
| `transactionPrice` | 실거래가 (만원) | 가격 계산 |
| `area` | 면적 (㎡) | 평당가 계산 |
| `propertyType` | 매물 유형 | 동일 유형 비교 |

#### 계산 로직

**Step 1: 지역 내 주요 매물 유형 파악**
```typescript
const dominantPropertyType = useMemo(() => {
    const typeCounts = new Map<string, number>();
    parcels.forEach(p => {
        const type = p.propertyType || 'unknown';
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });
    // 가장 많은 유형 반환
    let maxType = 'factory';
    let maxCount = 0;
    typeCounts.forEach((count, type) => {
        if (count > maxCount) { maxCount = count; maxType = type; }
    });
    return maxType;
}, [parcels]);
```

**Step 2: 인천 전체 평당가 계산 (동일 매물 유형만)**
```typescript
const incheonStats = useMemo(() => {
    // 동일 매물 유형만 필터
    const sameTypeParcels = allParcels.filter(p =>
        p.propertyType === dominantPropertyType
    );

    // 실거래 + 면적 있는 것만
    const txWithArea = sameTypeParcels.filter(p =>
        p.type & 1 &&                    // 실거래 플래그
        p.transactionPrice > 0 &&
        p.area > 0
    );

    // 평당가 계산: 가격 / (면적 / 3.3058)
    const avgPricePerPyeong = txWithArea.reduce((sum, p) =>
        sum + (p.transactionPrice / (p.area / 3.3058)), 0
    ) / txWithArea.length;

    return { avgPricePerPyeong, txCount: txWithArea.length };
}, [allParcels, dominantPropertyType]);
```

**Step 3: 지역 평당가 계산**
```typescript
const regionPricePerPyeong = useMemo(() => {
    const txWithArea = parcels.filter(p =>
        p.type & 1 && p.transactionPrice > 0 && p.area > 0
    );
    if (txWithArea.length === 0) return 0;

    return txWithArea.reduce((sum, p) =>
        sum + (p.transactionPrice / (p.area / 3.3058)), 0
    ) / txWithArea.length;
}, [parcels]);
```

**Step 4: 점수 변환**
```typescript
const priceRatio = regionPricePerPyeong / incheonStats.avgPricePerPyeong;
const priceCompetitiveness = Math.round(
    Math.max(0, Math.min(100, 50 + (1 - priceRatio) * 100))
);
```

#### 점수 변환표
| 지역/인천 비율 | 의미 | 점수 |
|---------------|------|------|
| 0.5 | 50% 저렴 | 100점 |
| 0.7 | 30% 저렴 | 80점 |
| 1.0 | 동일 | 50점 |
| 1.3 | 30% 비쌈 | 20점 |
| 1.5 | 50% 비쌈 | 0점 |

---

### 2.2 유동성

#### 참조 데이터
| 필드 | 설명 | 용도 |
|------|------|------|
| `type & 1` | 실거래 플래그 | 거래 건수 집계 |
| `sigCode` / `emdCode` | 지역 코드 | 지역 필터링 |

#### 계산 로직

**Step 1: 인천 전체 거래 건수**
```typescript
const incheonTxCount = allParcels.filter(p => p.type & 1).length;
```

**Step 2: 지역 거래 건수**
```typescript
const regionTxCount = parcels.filter(p => p.type & 1).length;
```

**Step 3: 비중 계산 및 점수 변환**
```typescript
const txRatio = regionTxCount / incheonTxCount;
const avgRatio = 0.1;  // 인천 시군구 약 10개 → 평균 10%

const liquidityScore = Math.round(
    Math.max(0, Math.min(100, 50 + (txRatio - avgRatio) * 300))
);
```

#### 점수 변환표
| 거래 비중 | 평균 대비 | 점수 |
|----------|----------|------|
| 26.7% | +16.7%p | 100점 |
| 20% | +10%p | 80점 |
| 10% | 0%p (평균) | 50점 |
| 5% | -5%p | 35점 |
| 0% | -10%p | 20점 |

---

### 2.3 시장 안정성

#### 참조 데이터
| 필드 | 설명 | 용도 |
|------|------|------|
| `type & 1` | 실거래 플래그 | 거래 건수 |
| `type & 2` | 매물 플래그 | 매물 건수 |
| `type & 4` | 경매 플래그 | 경매 건수 |

#### 계산 로직

**Step 1: 지역 내 거래 유형별 건수**
```typescript
const stats = {
    transaction: { count: parcels.filter(p => p.type & 1).length },
    listing: { count: parcels.filter(p => p.type & 2).length },
    auction: { count: parcels.filter(p => p.type & 4).length },
};
```

**Step 2: 경매 비율 계산**
```typescript
const totalDeals = stats.transaction.count + stats.listing.count + stats.auction.count;
const auctionRatio = stats.auction.count / totalDeals;  // 0~1
```

**Step 3: 점수 변환**
```typescript
// 경매 비율 0% → 80점, 20% → 50점, 40%+ → 20점
const marketStability = Math.round(
    Math.max(0, Math.min(100, 80 - auctionRatio * 150))
);
```

#### 점수 변환표
| 경매 비율 | 의미 | 점수 |
|----------|------|------|
| 0% | 경매 없음 | 80점 |
| 13% | 낮음 | 60점 |
| 20% | 보통 | 50점 |
| 40% | 높음 | 20점 |
| 53%+ | 매우 높음 | 0점 |

---

### 2.4 종합 점수

```typescript
const total = Math.round(
    (priceCompetitiveness + liquidityScore + marketStability) / 3
);
```

#### 등급 판정
| 종합 점수 | 등급 | 배지 색상 |
|----------|------|----------|
| 70점 이상 | 좋음 | 초록 (green) |
| 50~69점 | 보통 | 노랑 (yellow) |
| 50점 미만 | 주의 | 빨강 (red) |

---

## 3. 산업 집적도 (IndustryAnalysis.tsx)

### 3.1 참조 데이터

| 데이터 | 필드 | 설명 |
|--------|------|------|
| 전체 공장 | `allFactories` | 인천 전체 공장 목록 |
| 공장 ID | `factory.id` | PNU 기반, 앞 5자리 = 시군구 |

### 3.2 계산 로직

**Step 1: 지역 내 공장 필터링**
```typescript
const factories = allFactories.filter(f => {
    const code = regionLevel === 'sig'
        ? f.id?.substring(0, 5)   // 시군구: 앞 5자리
        : f.id?.substring(0, 10); // 읍면동: 앞 10자리
    return code === regionCode;
});
```

**Step 2: 비율 계산**
```typescript
const totalFactories = allFactories.length || 1;
const regionRatio = factories.length / totalFactories;  // 0~1
```

**Step 3: 점수 변환**
```typescript
// 선형 변환: 10% → 50점, 20% → 75점, 5% → 25점
const score = Math.round(
    Math.max(0, Math.min(100, 50 + (regionRatio - 0.1) * 250))
);
```

### 3.3 점수 변환표

| 공장 비율 | 평균 대비 | 점수 |
|----------|----------|------|
| 30% | +20%p | 100점 |
| 20% | +10%p | 75점 |
| 10% | 0%p (평균) | 50점 |
| 5% | -5%p | 37점 |
| 2% | -8%p | 30점 |

### 3.4 등급 판정

| 점수 | 등급 | 배지 색상 |
|------|------|----------|
| 70점 이상 | 높음 | 초록 (green) |
| 40~69점 | 보통 | 노랑 (yellow) |
| 40점 미만 | 낮음 | 빨강 (red) |

### 3.5 UI 표시

```typescript
// 툴팁 텍스트
`인천 전체 공장의 ${(regionRatio * 100).toFixed(1)}%가 이 지역에 위치`
```

---

## 4. 경매 동향 (MarketAnalysis.tsx)

### 4.1 참조 데이터

| 데이터 | 필드 | 설명 |
|--------|------|------|
| 지역 필지 | `parcels` | 지역 코드로 필터링된 필지 |
| 전체 필지 | `allParcels` | 인천 전체 필지 |
| 경매 플래그 | `type & 4` | 경매 여부 |

### 4.2 계산 로직

**Step 1: 지역 경매 비율**
```typescript
const totalItems = marketStats.totalListings +
                   marketStats.totalAuctions +
                   marketStats.totalTransactions;

const auctionRatio = totalItems > 0
    ? (marketStats.totalAuctions / totalItems) * 100
    : 0;
```

**Step 2: 인천 전체 경매 비율**
```typescript
const incheonAuctionCount = allParcels.filter(p => p.type & 4).length;
const incheonTotal = allParcels.length || 1;
const incheonAuctionRatio = (incheonAuctionCount / incheonTotal) * 100;
```

**Step 3: 차이 계산**
```typescript
const ratioDiff = auctionRatio - incheonAuctionRatio;
```

**Step 4: 위험도 판정**
```typescript
const riskLevel = ratioDiff > 10 ? 'high'
                : ratioDiff > 0 ? 'medium'
                : 'low';
```

### 4.3 위험도 판정표

| 차이 (%p) | 등급 | 의미 | 배지 |
|----------|------|------|------|
| +10%p 이상 | high | 인천 평균보다 경매 많음 | 주의 (빨강) |
| 0 ~ +10%p | medium | 인천 평균 수준 | 보통 (노랑) |
| 0%p 미만 | low | 인천 평균보다 경매 적음 | 양호 (초록) |

### 4.4 UI 표시

```typescript
// Progress bar 2개
- 지역 경매 비율: {marketRisk.auctionRatio}%
- 인천 평균: {marketRisk.incheonAvgRatio}%

// 텍스트
marketRisk.ratioDiff > 0
    ? `인천 평균 대비 +${marketRisk.ratioDiff}%p 높음`
    : `인천 평균 대비 ${marketRisk.ratioDiff}%p 낮음`
```

---

## 5. 시뮬레이션(더미) 데이터 목록

> 아래 항목들은 실제 데이터가 없어 `Math.random()` 기반 더미 데이터 사용

### PriceAnalysis
| 항목 | 더미 생성 방식 | 대체 가능 API |
|------|---------------|--------------|
| 가격 추이 (월별) | `generatePriceTrend()` | 국토부 실거래가 API |
| 지역간 지가변동률 | `generateRegionComparison()` | 한국감정원 지가변동률 |
| 전년 대비 증감률 | `Math.random()` | 국토부 실거래가 API |

### IndustryAnalysis
| 항목 | 더미 생성 방식 | 대체 가능 API |
|------|---------------|--------------|
| 평균 건물 연령 | `10 + Math.random() * 20` | 건축물대장 API |
| 신축/노후 비율 | `Math.random()` | 건축물대장 API |
| 공장 면적 구성비 | 고정 비율 `[0.15, 0.35, ...]` | 공장등록 데이터 |

### MarketAnalysis
| 항목 | 더미 생성 방식 | 대체 가능 API |
|------|---------------|--------------|
| 거래량 추이 (월별) | `generateVolumeHistory()` | 국토부 실거래가 API |
| 공장 등록/폐업 추이 | `generateFactoryTrend()` | 공장등록현황 API |

---

## 6. 전체 데이터 흐름도

```
┌────────────────────────────────────────────────────────────┐
│                     Store (Zustand)                        │
├────────────────────────────────────────────────────────────┤
│  useFilteredParcels()     │  useDataStore()               │
│  → ParcelMarkerData[]     │  → factories: FactoryIndex[]  │
└──────────────┬────────────┴──────────────┬─────────────────┘
               │                           │
               ▼                           ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│   지역 코드로 필터링      │  │   공장 ID 앞자리로 필터링     │
│   sigCode / emdCode      │  │   id.substring(0, 5/10)      │
└──────────────┬───────────┘  └──────────────┬───────────────┘
               │                             │
       ┌───────┴───────┐             ┌───────┴───────┐
       ▼               ▼             ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  지역 필지   │ │ 인천 전체   │ │  지역 공장  │ │ 인천 전체   │
│  parcels    │ │ allParcels  │ │  factories  │ │ allFactories│
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │               │
       └───────┬───────┘               └───────┬───────┘
               ▼                               ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│     비교 및 스코어 계산   │  │     비율 계산 및 스코어       │
├──────────────────────────┤  ├──────────────────────────────┤
│ • 가격 경쟁력 (평당가)    │  │ • 산업 집적도 (공장 비율)    │
│ • 유동성 (거래 비중)     │  │                              │
│ • 시장 안정성 (경매 비율) │  │                              │
│ • 경매 동향 (인천 대비)  │  │                              │
└──────────────────────────┘  └──────────────────────────────┘
               │                               │
               ▼                               ▼
┌────────────────────────────────────────────────────────────┐
│                      UI 렌더링                             │
├────────────────────────────────────────────────────────────┤
│ • Progress bar (점수 시각화)                               │
│ • Badge (등급 표시: 좋음/보통/주의)                        │
│ • Tooltip (상세 설명)                                      │
│ • 색상 코딩 (green/yellow/red)                            │
└────────────────────────────────────────────────────────────┘
```

---

## 7. 관련 파일

| 파일 | 역할 |
|------|------|
| [PriceAnalysis.tsx](../components/analysis/PriceAnalysis.tsx) | 투자 매력도 스코어링 |
| [IndustryAnalysis.tsx](../components/analysis/IndustryAnalysis.tsx) | 산업 집적도 계산 |
| [MarketAnalysis.tsx](../components/analysis/MarketAnalysis.tsx) | 경매 동향 분석 |
| [filter-store.ts](../lib/stores/filter-store.ts) | 필터링된 필지 데이터 |
| [data-store.ts](../lib/stores/data-store.ts) | 공장, 산업단지 데이터 |
| [types/data.ts](../types/data.ts) | 데이터 타입 정의 |

---

## 8. 향후 확장

### 공공 API 연동 시 실제 데이터로 대체 가능한 항목

| 현재 (더미) | API | 엔드포인트 | 응답 데이터 |
|------------|-----|-----------|------------|
| 지가변동률 | 한국감정원 | 지가변동률 조회 | 분기별 변동률 (%) |
| 건물 연령 | 브이월드 | 건축물대장 | useAprDay (사용승인일) |
| 거래량 추이 | 국토부 | 실거래가 공개시스템 | 월별 거래건수 |
| 공장 등록/폐업 | 공공데이터 | 공장등록현황 | 등록/말소 일자 |

### 추가 스코어링 항목 (데이터 확보 시)

| 항목 | 데이터 소스 | 계산 방식 |
|------|------------|----------|
| 접근성 점수 | 도로명주소 API | 고속도로 IC, 항만 거리 |
| 개발 호재 | 국토부 도시계획 | 개발계획 유무 |
| 임대 수익률 | 민간 데이터 | 임대료 / 매매가 |
| 인구 밀도 | 통계청 | 지역 인구 / 면적 |
