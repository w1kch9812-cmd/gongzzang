# GL 벡터 렌더링 분석 리포트

> 현재 innerHTML 방식 vs GL 벡터 렌더링 대안 비교

## 현재 구현 상태

### 1. HTMLMarkerLayer (운영 중)
```typescript
// DOM 요소 + innerHTML 방식
const container = document.createElement('div');
container.innerHTML = `<div style="...">...</div>`;
new naver.maps.Marker({ icon: { content: container } });
```

| 항목 | 평가 |
|------|------|
| **렌더링 품질** | ⭐⭐⭐⭐⭐ 완벽 (CSS 기반) |
| **텍스트 선명도** | ⭐⭐⭐⭐⭐ 브라우저 네이티브 |
| **그림자/효과** | ⭐⭐⭐⭐⭐ CSS filter/box-shadow |
| **성능** | ⭐⭐ 100-500개 마커까지 |
| **메모리** | ⭐⭐ DOM 노드 오버헤드 |
| **인터랙션** | ⭐⭐⭐⭐⭐ CSS hover, 트랜지션 |

### 2. DeckGLMarkerLayer (대기 중)
```typescript
// Canvas → PNG → Deck.gl IconLayer
const canvas = createAuctionMarkerIcon({ price, area });
const iconUrl = canvas.toDataURL('image/png');
new IconLayer({ getIcon: () => ({ url: iconUrl, ... }) });
```

| 항목 | 평가 |
|------|------|
| **렌더링 품질** | ⭐⭐⭐⭐ 높음 (2x 스케일) |
| **텍스트 선명도** | ⭐⭐⭐⭐ Canvas 2D 고품질 |
| **그림자/효과** | ⭐⭐⭐⭐ Canvas shadow API |
| **성능** | ⭐⭐⭐⭐⭐ GPU 가속, 수천 개 가능 |
| **메모리** | ⭐⭐⭐⭐ 텍스처 캐싱 효율적 |
| **인터랙션** | ⭐⭐⭐ Picking만 지원 |

---

## GL 벡터 렌더링 대안 분석

### 방법 1: Deck.gl TextLayer + ScatterplotLayer

```typescript
// 텍스트만 TextLayer로
new TextLayer({
    data: markers,
    getText: d => d.price,
    getPosition: d => d.coord,
    fontFamily: 'Arial',
    fontWeight: 600,
    getSize: 14,
    getColor: [255, 255, 255],
    background: true,
    getBackgroundColor: [234, 82, 82],
    backgroundPadding: [8, 4],
});
```

| 장점 | 단점 |
|------|------|
| GPU 가속 | 복잡한 마커 UI 불가능 |
| 텍스트 선명 (SDF) | 둥근 모서리 배경 미지원 |
| 동적 스케일링 | 다중 행 레이아웃 제한 |

**적합성**: 단순 가격 라벨만 필요할 때 ⭐⭐⭐

### 방법 2: Mapbox GL Symbol Layer + Sprite Atlas

```typescript
// 스프라이트 이미지 생성 후 심볼 레이어
mbMap.addImage('auction-marker', spriteImage);
mbMap.addLayer({
    id: 'auction-symbols',
    type: 'symbol',
    source: 'auction-data',
    layout: {
        'icon-image': 'auction-marker',
        'text-field': ['get', 'price'],
        'text-font': ['Open Sans Bold'],
    },
});
```

| 장점 | 단점 |
|------|------|
| 네이티브 Mapbox 지원 | 스프라이트 아틀라스 관리 필요 |
| SDF 텍스트 우수 | 동적 마커 생성 복잡 |
| 레이블 충돌 방지 | 가격별 다른 스프라이트 필요 |

**적합성**: 정적 마커 + 텍스트 라벨 ⭐⭐⭐

### 방법 3: Canvas-to-Texture (현재 DeckGLMarkerLayer)

```typescript
// 현재 구현된 방식
const canvas = createAuctionMarkerIcon(data);
const dataUrl = canvas.toDataURL();
new IconLayer({ getIcon: () => ({ url: dataUrl }) });
```

| 장점 | 단점 |
|------|------|
| **완벽한 디자인 재현** | 동적 변경 시 재생성 필요 |
| Canvas 2D 고품질 | 텍스처 메모리 사용 |
| 기존 마커 함수 재사용 | 픽셀 스케일 고정 |
| 캐싱으로 성능 최적화 | |

**적합성**: 복잡한 마커 UI 필요할 때 ⭐⭐⭐⭐⭐

### 방법 4: 커스텀 WebGL 셰이더

```glsl
// GLSL 프래그먼트 셰이더로 둥근 사각형 + 텍스트
float roundedBox(vec2 uv, vec2 size, float radius) {
    vec2 q = abs(uv) - size + radius;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}
```

| 장점 | 단점 |
|------|------|
| 최대 성능 | 구현 복잡도 최상 |
| 완전한 커스텀 | 폰트 아틀라스 필요 |
| 애니메이션 가능 | 유지보수 어려움 |

**적합성**: 특수 시각화 요구사항 ⭐⭐

---

## 품질 비교

### 텍스트 렌더링 품질

| 방법 | 14px 기준 선명도 | 확대 시 품질 |
|------|------------------|--------------|
| DOM innerHTML | ⭐⭐⭐⭐⭐ 완벽 | ⭐⭐⭐⭐⭐ 벡터 |
| Canvas 2D (2x) | ⭐⭐⭐⭐ 고품질 | ⭐⭐⭐ 픽셀화 |
| TextLayer SDF | ⭐⭐⭐⭐ 고품질 | ⭐⭐⭐⭐ 스케일러블 |
| Symbol Layer | ⭐⭐⭐⭐ 고품질 | ⭐⭐⭐⭐ 스케일러블 |

### 디자인 재현도

| 요소 | DOM | Canvas | TextLayer | Symbol |
|------|-----|--------|-----------|--------|
| 둥근 모서리 배경 | ✅ | ✅ | ⚠️ 사각만 | ⚠️ 스프라이트 |
| 다중 행 텍스트 | ✅ | ✅ | ⚠️ 제한적 | ⚠️ 제한적 |
| 그라데이션 | ✅ | ✅ | ❌ | ❌ |
| 그림자 | ✅ | ✅ | ⚠️ 제한적 | ⚠️ 제한적 |
| 뱃지 (유찰 등) | ✅ | ✅ | ❌ | ⚠️ 별도 레이어 |
| 호버 효과 | ✅ | ❌ | ❌ | ⚠️ 별도 처리 |

---

## 결론 및 권장사항

### 🏆 최적 접근법: Canvas-to-IconLayer (방법 3)

**이유:**
1. **품질 유지**: Canvas 2D의 고품질 렌더링 + 2x 스케일로 Retina 대응
2. **디자인 재현**: 현재 마커 디자인 100% 구현 가능
3. **성능**: GPU 가속으로 수천 개 마커 처리
4. **코드 재사용**: 기존 `lib/markers/` 함수 그대로 활용
5. **캐싱**: `iconAtlas` Map으로 중복 생성 방지

### 구현 전략

```
[현재]                    [목표]
HTMLMarkerLayer ────────→ DeckGLMarkerLayer (활성화)
(DOM 마커)                (Canvas → IconLayer)

성능: 100-500개         성능: 5,000+개
품질: ⭐⭐⭐⭐⭐            품질: ⭐⭐⭐⭐
```

### 추가 최적화 옵션

1. **고밀도 줌 레벨에서만 상세 마커**
   - 줌 14-16: 간단 마커 (가격만)
   - 줌 17+: 상세 마커 (면적, 뱃지 포함)

2. **클러스터 마커는 별도 처리**
   - ScatterplotLayer (원형) 또는
   - 별도 Canvas 아이콘

3. **텍스처 아틀라스 통합**
   - 개별 dataURL 대신 단일 아틀라스
   - WebGL 텍스처 바인딩 최소화

### 비활성화 유지 이유

현재 `DeckGLMarkerLayer`가 비활성화된 이유:
- HTMLMarkerLayer가 기능적으로 완성됨
- 데이터 양이 아직 DOM 처리 가능 범위
- 클릭/호버 인터랙션이 DOM에서 더 자연스러움

**활성화 시점**: 마커 수가 500개를 초과하거나 지연이 발생할 때

---

## 요약

| 질문 | 답변 |
|------|------|
| innerHTML 맞지? | ✅ HTMLMarkerLayer는 DOM innerHTML 방식 |
| GL 벡터로 완벽한 품질? | ⭐⭐⭐⭐ Canvas→IconLayer로 95% 재현 가능 |
| 권장 방식 | Canvas 2D → PNG → Deck.gl IconLayer |
| 추가 개발 필요? | DeckGLMarkerLayer 이미 구현됨, 활성화만 하면 됨 |
