# TODO

> 프로젝트 작업 현황 및 향후 계획

## ✅ 완료된 작업

### UI/UX 개선 (2025-12-29)

- [x] DetailedFilterModal 필터 구조 재정비
  - 탭 구조 변경: 기본→매물, 가격→거래, 건축+시설→건물
  - 면적 탭 신설 (가격 탭에서 분리)
  - 경매 탭에서 물건종류 삭제 (매물유형과 중복)
  - 초기화 버튼 단일화 (헤더 제거, 하단만 유지)
  - 승강기 폼 통합 (승용/화물 → 하나의 폼)
  - `docs/FILTER_GUIDE.md` 문서 작성

- [x] TopFilterBar 구조 정리
  - 불필요한 탭(일반/경매) 제거
  - 간결한 팝오버 필터 유지

- [x] RightSidebar 구현
  - 관심 매물, 비교함, 최근 본 기능
  - 슬라이드 애니메이션

### 데이터 구조

- [x] PNU 기반 데이터 구조 정립
- [x] 필지 데이터: PNU를 Primary Key로 사용
- [x] 공장 데이터: PNU 필드 보유 (99.6% 완료)
- [x] 행정구역 코드 (`sigCode`, `emdCode`) 추가

### 유틸리티 함수

- [x] `lib/utils/pnuHelpers.ts` - PNU 파싱 및 행정구역 추출
  - `parsePNU()`: PNU 구조 파싱
  - `extractAdminCodes()`: 행정구역 코드 추출
  - `getSidoCode()`, `getSigCode()`, `getEmdCode()`: 개별 코드 추출
  - `coordToPNU()`: 좌표 → PNU 변환 (네이버 API)
  - `buildPNU()`: PNU 생성

- [x] `lib/utils/clusterHelpers.ts` - 클러스터링 헬퍼
  - `clusterByAdminCode()`: 행정구역별 그룹화
  - `clusterByComplex()`: 산업단지별 그룹화
  - `getAdminStats()`: 행정구역별 통계
  - `getComplexStats()`: 산업단지별 통계

### 스크립트

- [x] `scripts/enrich-knowledge-centers-pnu.ts` - 지식산업센터 PNU 보완
- [x] `scripts/map-parcels-to-complexes.ts` - 필지-산업단지 매핑 (Point-in-Polygon)

### 문서

- [x] `docs/PNU_GUIDE.md` - PNU 구조 및 변환 규칙
- [x] `docs/PNU_MANAGEMENT.md` - PNU 기반 데이터 관리 가이드
- [x] `docs/RESPONSIBILITY_MAP.md` - 시스템 책임 분담 맵
- [x] `docs/PMTILES_GUIDE.md` - PMTiles 최적화 원리
- [x] `docs/OPTIMIZATION_GUIDE.md` - 코드 최적화 가이드

### 코드 최적화

- [x] `DeckGLMarkerLayer.tsx`: useMemo 적용 (데이터 변환 캐싱)
- [x] `UnifiedPolygonGLLayer.tsx`: 메모리 최적화 (타일 캐시 최소화)

---

## 🔄 진행 중

### PMTiles 생성

- [ ] WSL 환경에서 PMTiles 생성 (경로 문제 해결 필요)
  - sido.geojson (351MB) → sido.pmtiles
  - sig.geojson (1.6MB) → sig.pmtiles
  - emd.geojson (5.1MB) → emd.pmtiles
  - parcels.geojson (31MB) → parcels.pmtiles
  - complex.geojson (96KB) → complex.pmtiles
  - lots.geojson (245KB) → lots.pmtiles
  - industries.geojson (1.1MB) → industries.pmtiles

**WSL 마운트 방법**:
```bash
# WSL에서 E 드라이브 마운트
sudo mount -t drvfs E: /mnt/e

# PMTiles 생성
cd /mnt/e/gongzzang
bash scripts/generate-pmtiles.sh
```

---

## ⏳ 대기 중 (의존성 필요)

### 지식산업센터 PNU 보완

- [ ] 네이버 API 키 설정 (.env.local)
  ```
  NAVER_CLIENT_ID=your_client_id
  NAVER_CLIENT_SECRET=your_client_secret
  ```

- [ ] 스크립트 실행
  ```bash
  npm run enrich:knowledge-pnu
  ```

- 현황: 81개 중 52개(64%)가 PNU 필요 (29개는 이미 보유, 9개는 좌표 없음)

### 필지-산업단지 매핑

- [ ] Turf.js 의존성 확인
  - `@turf/boolean-point-in-polygon` ✅ 설치됨
  - `@turf/helpers` ✅ 설치됨

- [ ] 스크립트 실행
  ```bash
  npm run map:complex
  ```

- 예상 결과: 43,266개 필지 중 약 28-30%가 산업단지에 매핑될 것

---

## 📋 향후 계획

### 단기 (1주일 이내)

1. **PMTiles 생성 완료**
   - WSL 마운트 문제 해결
   - 모든 레이어 PMTiles 생성
   - public/tiles/에 배포

2. **지식산업센터 PNU 완성**
   - API 키 설정
   - 52개 센터 PNU 보완
   - 좌표 없는 9개 수동 처리

3. **산업단지 매핑 완료**
   - Point-in-Polygon 실행
   - 필지에 industrialComplexId 추가
   - 매핑 결과 검증

### 중기 (1개월 이내)

4. **UI 컴포넌트 활성화**
   - DetailPanel: 필지 상세 정보 패널
   - FilterPanel: 레이어 필터 패널
   - StatsPanel: 통계 패널 (행정구역별/산업단지별)

5. **실거래가 데이터 연동**
   - 국토교통부 실거래가 API 연동
   - Mock 데이터 → 실제 데이터 대체
   - 거래 내역 시각화

6. **검색 기능 구현**
   - PNU 검색
   - 지번 검색
   - 도로명주소 검색
   - 산업단지명 검색

### 장기 (3개월 이내)

7. **고급 분석 기능**
   - 행정구역별 가격 추이 분석
   - 산업단지별 업종 분포 분석
   - 공장 밀집도 히트맵

8. **사용자 관리**
   - 즐겨찾기 기능
   - 관심 지역 설정
   - 알림 설정

9. **성능 최적화**
   - Web Worker 클러스터링
   - IndexedDB 캐싱
   - Virtual Scrolling (상세 패널)

---

## 🐛 알려진 이슈

### 높은 우선순위

1. **WSL 경로 변환 문제**
   - 증상: `wsl: Failed to translate 'e:\gongzzang'`
   - 해결책: 수동으로 `/mnt/e` 마운트 후 절대 경로 사용
   - 상태: 해결 방법 문서화됨

2. **지도 이중 렌더링**
   - 증상: React Strict Mode에서 지도 컴포넌트 이중 마운트
   - 해결책: next.config.js에서 reactStrictMode: false
   - 상태: ✅ 해결됨

### 낮은 우선순위

3. **좌표 없는 지식산업센터**
   - 9개 센터에 좌표 없음
   - 수동으로 지번주소 → 좌표 변환 필요

4. **대/산 구분 정확도**
   - 네이버 API 응답의 대/산 구분이 부정확할 수 있음
   - 중요한 경우 수동 검증 필요

---

## 📊 데이터 현황

| 데이터 | 총 개수 | PNU 보유 | 완성도 |
|--------|---------|----------|--------|
| 필지 | 43,266 | 43,266 (100%) | ✅ 완료 |
| 공장 | 14,193 | 14,130 (99.6%) | ✅ 거의 완료 |
| 지식산업센터 | 81 | 29 (35.8%) | ⚠️ 보완 필요 |
| 산업단지 | 8 | N/A | - |
| 시군구 | 11 | N/A | - |
| 읍면동 | 251 | N/A | - |

---

## 📝 참고 문서

- [PNU_GUIDE.md](./PNU_GUIDE.md) - PNU 구조 및 변환
- [PNU_MANAGEMENT.md](./PNU_MANAGEMENT.md) - PNU 기반 관리
- [PMTILES_GUIDE.md](./PMTILES_GUIDE.md) - PMTiles 최적화
- [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) - 코드 최적화
- [RESPONSIBILITY_MAP.md](./RESPONSIBILITY_MAP.md) - 책임 분담
- [ARCHITECTURE_GUIDE.md](./ARCHITECTURE_GUIDE.md) - 아키텍처
- [FILTER_GUIDE.md](./FILTER_GUIDE.md) - 필터 시스템 구조
- [DETAIL_PANEL_GUIDE.md](./DETAIL_PANEL_GUIDE.md) - 상세 패널 구조

---

## 🎯 다음 작업

1. ⏰ **즉시**: WSL PMTiles 생성
2. ⏰ **오늘**: 지식산업센터 PNU 보완
3. ⏰ **내일**: 산업단지 매핑 실행
4. ⏰ **이번 주**: UI 컴포넌트 활성화

---

*최종 업데이트: 2025-12-29*
