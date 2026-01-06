# 필지 데이터 구조 (Single Source of Truth)

## 📦 현재 사용 중인 파일

### `parcel-markers.json` ⭐ (단일 소스)
- **크기**: 7.6 MB
- **용도**:
  - 마커 렌더링 (UnifiedMarkerLayer)
  - 폴리곤 색상 (Feature State)
  - API 응답 (/api/parcel/[pnu])
- **구조**:
  ```json
  {
    "id": "2820010100115940000",
    "coord": [126.70951, 37.44105],  // polylabel (정확한 중심)
    "type": 1,  // 비트플래그: 1=실거래, 2=매물, 4=경매
    "area": 1234,
    "jibun": "1594 도",
    "sigCode": "28200",
    "emdCode": "2820010100",
    "transactionPrice": 332223,
    "listingPrice": 0,
    "auctionPrice": 0,
    "propertyType": "land",
    "transactions": [...],  // 실거래 이력
    "listings": [...],      // 매물 이력
    "auctions": [...]       // 경매 이력
  }
  ```

## 🗺️ PMTiles (Geometry만)

### `tiles/parcels.pmtiles`
- **용도**: 폴리곤 geometry만 제공 (불변)
- **속성**: PNU, jibun, AREA (최소한의 정보)
- **특징**:
  - geometry는 변하지 않으므로 재생성 불필요
  - 비즈니스 데이터는 Feature State로 동적 연결

## ⚡ Feature State 매핑

```typescript
// UnifiedPolygonGLLayer.tsx
parcelMarkers.forEach(parcel => {
  mbMap.setFeatureState(
    { source: 'vt-parcels', id: parcel.id },
    {
      type: parcel.type,
      hasTransaction: (parcel.type & 1) !== 0,
      hasListing: (parcel.type & 2) !== 0,
      hasAuction: (parcel.type & 4) !== 0,
      transactionPrice: parcel.transactionPrice,
      listingPrice: parcel.listingPrice,
      auctionPrice: parcel.auctionPrice,
    }
  );
});
```

## 🚫 사용 중지된 파일

### `parcels.json` (레거시)
- **문제점**:
  - coord가 bbox 좌측하단 (polylabel 아님)
  - parcel-markers.json과 데이터 불일치
  - 중복 데이터 (13.8 MB)
- **삭제 가능**: API가 parcel-markers.json으로 변경됨

## 📝 데이터 업데이트 방법

### 실거래/매물/경매 추가 시
1. `parcel-markers.json` 업데이트
2. 애플리케이션 재시작 시 자동 로드
3. Feature State로 즉시 반영 ⚡
4. **PMTiles 재생성 불필요!**

### 필지 geometry 변경 시 (드물음)
1. GeoJSON 업데이트
2. PMTiles 재생성 (`npm run data:tiles`)
3. `parcel-markers.json`은 유지

## 🔄 마이그레이션 완료

- ✅ API 라우트: `parcels.json` → `parcel-markers.json`
- ✅ 폴리곤 색상: PMTiles properties → Feature State
- ✅ 마커 렌더링: 변경 없음 (이미 parcel-markers 사용)
- ✅ 좌표 일치: 모든 곳에서 polylabel 사용

---

**마지막 업데이트**: 2026-01-06
**구조**: Single Source of Truth + Feature State
