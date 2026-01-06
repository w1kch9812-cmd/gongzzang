# PNU (필지고유번호) 가이드

> 지번, 도로명주소, 좌표를 PNU로 변환하는 규칙과 방법

## 📐 PNU 구조

### 기본 구성 (19자리)

```
[시도][시군구][읍면동][  리  ][본번][부번][대산]
  2     3      3      2     4    4    1
```

**예시**: `2814010100001000001`
- `28`: 인천광역시
- `140`: 남동구
- `101`: 논현동
- `00`: 리 (동 지역은 00)
- `0001`: 본번 1번
- `0000`: 부번 없음 (0000)
- `1`: 대지

---

## 🔢 각 필드 규칙

### 1. 시도 코드 (2자리)

| 코드 | 지역 |
|------|------|
| 11 | 서울특별시 |
| 26 | 부산광역시 |
| 27 | 대구광역시 |
| 28 | **인천광역시** |
| 29 | 광주광역시 |
| 30 | 대전광역시 |
| 31 | 울산광역시 |
| 36 | 세종특별자치시 |
| 41 | 경기도 |
| 42 | 강원도 |
| 43 | 충청북도 |
| 44 | 충청남도 |
| 45 | 전라북도 |
| 46 | 전라남도 |
| 47 | 경상북도 |
| 48 | 경상남도 |
| 50 | 제주특별자치도 |

---

### 2. 시군구 코드 (3자리)

**인천광역시 예시**:
- `110`: 중구
- `140`: 남동구
- `150`: 연수구
- `170`: 서구
- `185`: 계양구
- `200`: 강화군
- `210`: 옹진군
- `237`: 미추홀구
- `245`: 부평구
- `260`: 동구

---

### 3. 읍면동 코드 (3자리)

**남동구 예시**:
- `101`: 논현동
- `102`: 간석1동
- `103`: 간석2동
- `104`: 간석3동
- `105`: 간석4동
- `106`: 구월1동
- `107`: 구월2동
- `108`: 만수1동
- `109`: 만수2동
- `110`: 만수3동

---

### 4. 리 코드 (2자리)

- **동 지역**: `00` (항상)
- **읍/면 지역**: 리 코드 (01~99)

**예시**:
- 논현동 → `00`
- 강화군 강화읍 국화리 → `01` (리 순서에 따라)

---

### 5. 본번 (4자리)

- 지번의 본번을 4자리로 제로 패딩
- 범위: `0001` ~ `9999`

**예시**:
- 1번지 → `0001`
- 123번지 → `0123`
- 1234번지 → `1234`

---

### 6. 부번 (4자리)

- 지번의 부번을 4자리로 제로 패딩
- 부번이 없으면 `0000`
- 범위: `0000` ~ `9999`

**예시**:
- 1번지 → `0000` (부번 없음)
- 1-2번지 → `0002`
- 1-123번지 → `0123`
- 1-1234번지 → `1234`

---

### 7. 대/산 구분 (1자리)

| 코드 | 의미 | 설명 |
|------|------|------|
| **1** | 대지 | 일반 필지 (택지, 공장용지, 대지 등) |
| **2** | 산 | 임야 (산림, 목장용지 등) |
| **0** | 블록 | 집합건물 (아파트, 오피스텔 등) |

**중요**:
- 대부분의 산업단지/공장 필지는 **대지(1)**
- 산림지역은 **산(2)**
- 아파트/오피스텔 같은 집합건물은 **블록(0)** + 층/호수 추가 정보 필요

---

## 🔄 변환 예시

### 1️⃣ 지번 → PNU

**입력**: 인천광역시 남동구 논현동 1-2번지 (대지)

**단계**:
1. 시도: 인천 → `28`
2. 시군구: 남동구 → `140`
3. 읍면동: 논현동 → `101`
4. 리: 동 지역 → `00`
5. 본번: 1번지 → `0001`
6. 부번: 2번지 → `0002`
7. 대/산: 대지 → `1`

**결과**: `2814010100001000021`

---

**입력**: 인천광역시 강화군 강화읍 국화리 산 123번지

**단계**:
1. 시도: 인천 → `28`
2. 시군구: 강화군 → `200`
3. 읍면동: 강화읍 → `250` (예시)
4. 리: 국화리 → `01` (예시)
5. 본번: 123번지 → `0123`
6. 부번: 없음 → `0000`
7. 대/산: 산 → `2`

**결과**: `2820025001012300002`

---

### 2️⃣ 도로명주소 → PNU

도로명주소는 **직접 변환 불가** → 지오코딩 API 필요

**프로세스**:
```
도로명주소
    ↓ (지오코딩 API)
좌표 (위도/경도)
    ↓ (역지오코딩 API)
법정동 코드 + 지번
    ↓
PNU
```

**네이버 지오코딩 API 사용**:
```typescript
// 1. 도로명주소 → 좌표
const geocodeResponse = await fetch(
    `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(roadAddress)}`,
    {
        headers: {
            'X-NCP-APIGW-API-KEY-ID': process.env.NAVER_CLIENT_ID,
            'X-NCP-APIGW-API-KEY': process.env.NAVER_CLIENT_SECRET,
        }
    }
);

// 2. 좌표 → 법정동 + 지번
const reverseResponse = await fetch(
    `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&orders=addr&output=json`,
    {
        headers: {
            'X-NCP-APIGW-API-KEY-ID': process.env.NAVER_CLIENT_ID,
            'X-NCP-APIGW-API-KEY': process.env.NAVER_CLIENT_SECRET,
        }
    }
);

// 3. 법정동 코드 + 지번 → PNU
const pnu = buildPNU({
    sido: '28',
    sigungu: '140',
    emd: '101',
    ri: '00',
    bonbun: '0001',
    bubun: '0002',
    type: '1'  // 대지
});
```

---

### 3️⃣ 좌표 → PNU

좌표만으로는 **직접 변환 불가** → 역지오코딩 API 필요

**네이버 역지오코딩 API**:
```typescript
async function coordToPNU(lng: number, lat: number): Promise<string | null> {
    const response = await fetch(
        `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&orders=legalcode,addr&output=json`,
        {
            headers: {
                'X-NCP-APIGW-API-KEY-ID': process.env.NAVER_CLIENT_ID,
                'X-NCP-APIGW-API-KEY': process.env.NAVER_CLIENT_SECRET,
            }
        }
    );

    const data = await response.json();

    if (data.status.code !== 0) return null;

    const result = data.results[0];
    const region = result.region;
    const land = result.land;

    // PNU 조합
    const pnu = [
        region.area1.code.substring(0, 2),  // 시도
        region.area2.code.substring(2, 5),  // 시군구
        region.area3.code.substring(5, 8),  // 읍면동
        '00',  // 리 (API에서 제공 안 하면 00)
        land.number1.padStart(4, '0'),      // 본번
        land.number2.padStart(4, '0'),      // 부번
        land.type === '1' ? '1' : '2'       // 대/산 (1=대지, 2=산)
    ].join('');

    return pnu;
}
```

---

## 🛠️ PNU 유틸리티 함수

### buildPNU - PNU 생성

```typescript
// lib/utils/pnuHelpers.ts

interface PNUComponents {
    sido: string;        // 2자리
    sigungu: string;     // 3자리
    emd: string;         // 3자리
    ri: string;          // 2자리 (동=00, 읍면=리코드)
    bonbun: number;      // 본번
    bubun: number;       // 부번 (없으면 0)
    type: '1' | '2' | '0';  // 1=대지, 2=산, 0=블록
}

export function buildPNU(components: PNUComponents): string {
    const {
        sido,
        sigungu,
        emd,
        ri,
        bonbun,
        bubun,
        type
    } = components;

    return [
        sido.padStart(2, '0'),
        sigungu.padStart(3, '0'),
        emd.padStart(3, '0'),
        ri.padStart(2, '0'),
        bonbun.toString().padStart(4, '0'),
        bubun.toString().padStart(4, '0'),
        type
    ].join('');
}
```

---

### parsePNU - PNU 파싱

```typescript
export interface ParsedPNU {
    sido: string;
    sigungu: string;
    emd: string;
    ri: string;
    bonbun: number;
    bubun: number;
    type: '1' | '2' | '0';
    jibun: string;  // "1-2" 형식
}

export function parsePNU(pnu: string): ParsedPNU | null {
    if (pnu.length !== 19) {
        console.error('PNU는 19자리여야 합니다');
        return null;
    }

    const sido = pnu.substring(0, 2);
    const sigungu = pnu.substring(2, 5);
    const emd = pnu.substring(5, 8);
    const ri = pnu.substring(8, 10);
    const bonbun = parseInt(pnu.substring(10, 14), 10);
    const bubun = parseInt(pnu.substring(14, 18), 10);
    const type = pnu.substring(18, 19) as '1' | '2' | '0';

    // 지번 형식
    let jibun = bonbun.toString();
    if (bubun > 0) {
        jibun += `-${bubun}`;
    }

    // 산/대 표시
    if (type === '2') {
        jibun = `산 ${jibun}`;
    }

    return {
        sido,
        sigungu,
        emd,
        ri,
        bonbun,
        bubun,
        type,
        jibun
    };
}
```

---

### jibunToPNU - 지번 → PNU

```typescript
export interface JibunInput {
    sido: string;        // 시도 코드 (2자리)
    sigungu: string;     // 시군구 코드 (3자리)
    emd: string;         // 읍면동 코드 (3자리)
    ri?: string;         // 리 코드 (2자리, 선택)
    jibun: string;       // "1-2" 또는 "산 123"
}

export function jibunToPNU(input: JibunInput): string {
    const { sido, sigungu, emd, ri = '00', jibun } = input;

    // 산/대 구분
    let type: '1' | '2' = '1';
    let cleanJibun = jibun;

    if (jibun.startsWith('산 ')) {
        type = '2';
        cleanJibun = jibun.substring(2).trim();
    }

    // 본번/부번 분리
    const parts = cleanJibun.split('-');
    const bonbun = parseInt(parts[0], 10);
    const bubun = parts[1] ? parseInt(parts[1], 10) : 0;

    return buildPNU({
        sido,
        sigungu,
        emd,
        ri,
        bonbun,
        bubun,
        type
    });
}
```

---

## 🌍 API 연동 예시

### 도로명주소 → PNU 전체 프로세스

```typescript
// lib/utils/addressToPNU.ts

export async function roadAddressToPNU(roadAddress: string): Promise<string | null> {
    try {
        // 1. 지오코딩: 도로명주소 → 좌표
        const geocodeRes = await fetch(
            `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(roadAddress)}`,
            {
                headers: {
                    'X-NCP-APIGW-API-KEY-ID': process.env.NAVER_CLIENT_ID!,
                    'X-NCP-APIGW-API-KEY': process.env.NAVER_CLIENT_SECRET!,
                }
            }
        );

        const geocodeData = await geocodeRes.json();

        if (geocodeData.status !== 'OK' || geocodeData.addresses.length === 0) {
            return null;
        }

        const { x: lng, y: lat } = geocodeData.addresses[0];

        // 2. 역지오코딩: 좌표 → 법정동 + 지번
        const reverseRes = await fetch(
            `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&orders=legalcode,addr&output=json`,
            {
                headers: {
                    'X-NCP-APIGW-API-KEY-ID': process.env.NAVER_CLIENT_ID!,
                    'X-NCP-APIGW-API-KEY': process.env.NAVER_CLIENT_SECRET!,
                }
            }
        );

        const reverseData = await reverseRes.json();

        if (reverseData.status.code !== 0) return null;

        const result = reverseData.results[0];
        const region = result.region;
        const land = result.land;

        // 3. PNU 조합
        const pnu = buildPNU({
            sido: region.area1.code.substring(0, 2),
            sigungu: region.area2.code.substring(2, 5),
            emd: region.area3.code.substring(5, 8),
            ri: '00',  // API에서 제공 안 하면 00
            bonbun: parseInt(land.number1, 10),
            bubun: land.number2 ? parseInt(land.number2, 10) : 0,
            type: land.type === '1' ? '1' : '2'
        });

        return pnu;
    } catch (error) {
        console.error('도로명주소 → PNU 변환 실패:', error);
        return null;
    }
}
```

---

## 📝 주의사항

### 1. 대/산 구분의 중요성

- **대지(1)**: 건물이 있는 땅, 공장용지, 택지 등
- **산(2)**: 임야, 산림지, 목장용지 등
- **잘못된 구분 시 검색 실패**

**예시**:
```
✅ 올바름: 논현동 1-2 (대지) → ...0001000021
❌ 틀림:   논현동 1-2 (산)   → ...0001000022  (검색 안 됨)
```

---

### 2. 블록(0)의 특수성

집합건물 (아파트, 오피스텔 등)은 PNU에 **층/호수 정보가 추가**:

```
PNU (19자리) + 층(2자리) + 호수(4자리) = 25자리
```

**예시**: 논현동 1-2 아파트 5층 101호
```
2814010100001000020 + 05 + 0101 = 2814010100001000020050101
```

---

### 3. API 응답 검증

네이버 API 응답은 완벽하지 않음:
- 리(里) 코드가 없을 수 있음 → `00` 사용
- 대/산 구분이 틀릴 수 있음 → 수동 확인 필요
- 신규 필지는 누락될 수 있음

---

## 📚 참고 자료

- [국토교통부 부동산 공시가격 알리미](https://www.realtyprice.kr/)
- [네이버 지도 API 문서](https://api.ncloud-docs.com/docs/ai-naver-mapsgeocoding)
- [법정동 코드 조회](https://www.code.go.kr/)

---

## 📝 변경 이력

| 날짜 | 변경 내용 |
|------|-----------|
| 2025-12-23 | 초기 문서 생성, PNU 구조 및 변환 규칙 정의 |
