# 네이버 지도 GL 내부 구조 분석 가이드

> 브라우저 콘솔을 통해 네이버 지도의 POI, 레이어, 스타일 요소를 분석하는 방법

## 1. Mapbox GL 인스턴스 접근

네이버 지도 GL 모드는 내부적으로 Mapbox GL을 사용합니다.

### 글로벌 변수 확인

```javascript
// 지도 관련 글로벌 변수 찾기
Object.keys(window).filter(k => k.toLowerCase().includes('map'))
// 결과: ['__naverMap', '__mapboxGL', '__NAVER_MAP__', '__MAPBOX_GL__', ...]
```

### Mapbox GL 인스턴스 가져오기

```javascript
// 방법 1: __naverMap에서 접근 (권장)
const naverMap = window.__naverMap || window.__NAVER_MAP__;
const mb = naverMap._mapbox;

// 방법 2: 직접 접근 (설정에 따라 다를 수 있음)
const mb = window.__mapboxGL || window.__MAPBOX_GL__;

// 인스턴스 확인
console.log(mb);  // Map 객체 출력
```

## 2. 스타일 및 레이어 분석

### 전체 스타일 가져오기

```javascript
const style = mb.getStyle();
console.log(style);

// 스타일 구성 요소
console.log('Sources:', Object.keys(style.sources));
console.log('Layers:', style.layers.length);
console.log('Sprite:', style.sprite);
console.log('Glyphs:', style.glyphs);
```

### 레이어 목록 조회

```javascript
// 전체 레이어 목록
const layers = mb.getStyle().layers;
console.log(`총 ${layers.length}개 레이어`);

// 레이어 타입별 분류
const byType = {};
layers.forEach(l => {
    byType[l.type] = (byType[l.type] || 0) + 1;
});
console.table(byType);
// 예: { symbol: 120, line: 45, fill: 30, ... }
```

### 심볼 레이어만 필터링

```javascript
const symbolLayers = layers.filter(l => l.type === 'symbol');
console.log(`심볼 레이어: ${symbolLayers.length}개`);
```

## 3. 네이버 네이티브 레이어 분석

### 커스텀 레이어 제외하고 네이버 원본 레이어만 조회

```javascript
// 프로젝트에서 추가한 레이어 패턴 (프로젝트마다 다름)
const ourPatterns = [
    'vt-',           // 벡터 타일 레이어
    'tx-',           // 실거래 마커
    'factory',       // 공장 마커
    'knowledge',     // 지식산업센터
    'parcel',        // 필지
    'complex',       // 산업단지
    'auction',       // 경매
    'focus',         // 포커스 모드
];

const nativeLayers = mb.getStyle().layers.filter(l => {
    if (l.type !== 'symbol') return false;
    const id = l.id.toLowerCase();
    return !ourPatterns.some(p => id.includes(p));
});

console.log(`네이버 네이티브 심볼 레이어: ${nativeLayers.length}개`);
```

### 레이어 상세 속성 분석

```javascript
// 각 레이어의 주요 속성 출력
nativeLayers.forEach(l => {
    const layout = l.layout || {};
    const paint = l.paint || {};

    console.log({
        id: l.id,
        source: l.source,
        'source-layer': l['source-layer'],
        minzoom: l.minzoom,
        maxzoom: l.maxzoom,
        // 아이콘 관련
        'icon-image': layout['icon-image'],
        'icon-size': layout['icon-size'],
        'icon-text-fit': layout['icon-text-fit'],
        'icon-text-fit-padding': layout['icon-text-fit-padding'],
        // 텍스트 관련
        'text-field': layout['text-field'],
        'text-font': layout['text-font'],
        'text-size': layout['text-size'],
        // 텍스트 헤일로 (배경 효과)
        'text-halo-color': paint['text-halo-color'],
        'text-halo-width': paint['text-halo-width'],
    });
});
```

## 4. icon-text-fit 분석

네이버가 POI에 `icon-text-fit` (아이콘이 텍스트 크기에 맞게 늘어남)을 사용하는지 확인:

```javascript
const withIconTextFit = nativeLayers.filter(l => {
    const fit = l.layout?.['icon-text-fit'];
    return fit && fit !== 'none';
});

console.log(`icon-text-fit 사용 레이어: ${withIconTextFit.length}개`);
withIconTextFit.forEach(l => {
    console.log({
        id: l.id,
        fit: l.layout['icon-text-fit'],
        padding: l.layout['icon-text-fit-padding'],
    });
});

// 2024년 분석 결과:
// - 65개 네이티브 심볼 레이어 중 6개만 icon-text-fit 사용 (9%)
// - 주로 도로 번호 표시용 (도로번호, 지방도, 국도, 고속도로 등)
```

## 5. 아이콘+텍스트 조합 분석

```javascript
const withIconAndText = nativeLayers.filter(l => {
    const hasIcon = l.layout?.['icon-image'];
    const hasText = l.layout?.['text-field'];
    return hasIcon && hasText;
});

console.log(`아이콘+텍스트 조합: ${withIconAndText.length}개`);

// 각 레이어의 fit 설정 확인
withIconAndText.forEach(l => {
    const fit = l.layout?.['icon-text-fit'];
    console.log(`${l.id}: fit=${fit || 'undefined'}`);
});

// 분석 결과:
// - 28개 레이어가 아이콘+텍스트 함께 사용
// - 대부분 fit=undefined 또는 fit=none (아이콘 크기 고정)
```

## 6. 텍스트 헤일로(Halo) 분석

네이버는 POI 배경을 위해 `icon-text-fit` 대신 `text-halo`를 주로 사용:

```javascript
const withHalo = nativeLayers.filter(l => {
    const haloWidth = l.paint?.['text-halo-width'];
    return haloWidth && haloWidth > 0;
});

console.log(`text-halo 사용 레이어: ${withHalo.length}개`);

withHalo.forEach(l => {
    console.log({
        id: l.id,
        haloColor: l.paint['text-halo-color'],
        haloWidth: l.paint['text-halo-width'],
        haloBlur: l.paint['text-halo-blur'],
    });
});
```

## 7. 특정 레이어 상세 조회

```javascript
// 레이어 ID로 직접 조회
const layer = mb.getLayer('레이어-아이디');
console.log(layer);

// 레이어의 현재 페인트/레이아웃 속성
console.log(mb.getLayoutProperty('레이어-아이디', 'icon-size'));
console.log(mb.getPaintProperty('레이어-아이디', 'text-color'));
```

## 8. 소스(Source) 분석

```javascript
const sources = mb.getStyle().sources;

Object.entries(sources).forEach(([name, source]) => {
    console.log({
        name,
        type: source.type,
        url: source.url,
        tiles: source.tiles,
        minzoom: source.minzoom,
        maxzoom: source.maxzoom,
    });
});
```

## 9. 스프라이트(아이콘 이미지) 조회

```javascript
// 로드된 모든 이미지 목록
const images = Object.keys(mb.style.imageManager.images);
console.log(`로드된 이미지: ${images.length}개`);
console.log(images.slice(0, 20)); // 처음 20개

// 특정 이미지 확인
if (mb.hasImage('poi-icon-name')) {
    console.log('이미지 존재함');
}
```

## 10. 실시간 레이어 가시성 제어 (디버깅용)

```javascript
// 레이어 숨기기
mb.setLayoutProperty('레이어-아이디', 'visibility', 'none');

// 레이어 보이기
mb.setLayoutProperty('레이어-아이디', 'visibility', 'visible');

// 모든 심볼 레이어 토글
nativeLayers.forEach(l => {
    mb.setLayoutProperty(l.id, 'visibility', 'none');
});
```

## 11. 유용한 분석 스크립트 모음

### 전체 분석 (복사해서 콘솔에 붙여넣기)

```javascript
(function analyzeNaverMap() {
    const naverMap = window.__naverMap || window.__NAVER_MAP__;
    if (!naverMap?._mapbox) {
        console.error('네이버 맵 인스턴스를 찾을 수 없습니다');
        return;
    }

    const mb = naverMap._mapbox;
    const style = mb.getStyle();

    // 기본 정보
    console.group('📊 네이버 지도 분석');
    console.log('Sources:', Object.keys(style.sources).length);
    console.log('Layers:', style.layers.length);

    // 레이어 타입별 분류
    const byType = {};
    style.layers.forEach(l => {
        byType[l.type] = (byType[l.type] || 0) + 1;
    });
    console.table(byType);

    // 심볼 레이어 분석
    const symbols = style.layers.filter(l => l.type === 'symbol');
    const withFit = symbols.filter(l => {
        const fit = l.layout?.['icon-text-fit'];
        return fit && fit !== 'none';
    });
    const withHalo = symbols.filter(l => {
        return l.paint?.['text-halo-width'] > 0;
    });

    console.log('\n🔤 심볼 레이어 분석:');
    console.log(`  전체: ${symbols.length}개`);
    console.log(`  icon-text-fit 사용: ${withFit.length}개`);
    console.log(`  text-halo 사용: ${withHalo.length}개`);

    console.groupEnd();

    return { mb, style, symbols, withFit, withHalo };
})();
```

## 분석 결과 요약 (2024년 기준)

| 항목 | 수치 | 비고 |
|------|------|------|
| 전체 스프라이트 이미지 | 476개 | pstatic.net에서 로드 |
| Stretchable (9-slice) 이미지 | **0개** | 네이버는 사용 안함 |
| 네이티브 심볼 레이어 | 65개 | 커스텀 레이어 제외 |
| icon-text-fit 사용 | 6개 (9%) | 도로번호 표시용 |
| 아이콘+텍스트 조합 | 28개 | 대부분 fit=none |
| text-halo 사용 | 다수 | POI 배경 효과 |

## 12. 충돌 감지 전략 분석

네이버가 심볼 충돌을 어떻게 처리하는지 분석:

```javascript
const symbols = mb.getStyle().layers.filter(l => l.type === 'symbol');

// 충돌 허용 설정 분류
const collisionGroups = {
    bothAllow: [],      // 둘 다 overlap 허용
    iconAllow: [],      // 아이콘만 허용
    textAllow: [],      // 텍스트만 허용
    noneAllow: [],      // 둘 다 불허 (기본값)
};

symbols.forEach(l => {
    const iconAllow = l.layout?.['icon-allow-overlap'] === true;
    const textAllow = l.layout?.['text-allow-overlap'] === true;

    if (iconAllow && textAllow) collisionGroups.bothAllow.push(l.id);
    else if (iconAllow) collisionGroups.iconAllow.push(l.id);
    else if (textAllow) collisionGroups.textAllow.push(l.id);
    else collisionGroups.noneAllow.push(l.id);
});

console.log('충돌 감지 전략:');
console.log(`  둘 다 허용: ${collisionGroups.bothAllow.length}개`);
console.log(`  아이콘만 허용: ${collisionGroups.iconAllow.length}개`);
console.log(`  텍스트만 허용: ${collisionGroups.textAllow.length}개`);
console.log(`  기본값 (불허): ${collisionGroups.noneAllow.length}개`);
```

### 분석 결과

| 충돌 전략 | 레이어 수 | 용도 |
|-----------|----------|------|
| 둘 다 허용 (bothAllow) | 7개 | 교통정보, 실시간 마커 |
| 아이콘만 허용 | 0개 | - |
| 텍스트만 허용 | 0개 | - |
| 기본값 (불허) | ~58개 | 일반 POI, 지명 |

**시사점**: 대부분의 POI는 충돌 감지 활성화 (겹치면 숨김)

## 13. 줌 레벨 분포 분석

```javascript
const zoomRanges = {};
symbols.forEach(l => {
    const min = l.minzoom ?? 0;
    const max = l.maxzoom ?? 22;
    const key = `${min}-${max}`;
    zoomRanges[key] = (zoomRanges[key] || 0) + 1;
});

// 정렬해서 출력
Object.entries(zoomRanges)
    .sort((a, b) => b[1] - a[1])
    .forEach(([range, count]) => {
        console.log(`  ${range}: ${count}개`);
    });
```

### 분석 결과

| 줌 범위 | 레이어 수 | 비고 |
|---------|----------|------|
| 0-22 | 40개 | 전체 줌에서 표시 |
| 15-22 | 27개 | 고배율 상세 POI |
| 13-22 | 17개 | 중배율 이상 |
| 17-22 | 7개 | 최고배율 전용 |
| 10-22 | 5개 | 중배율 이상 |

## 14. 데이터 기반 스타일링 분석

```javascript
// 동적 텍스트 크기 사용 레이어
const withDynamicSize = symbols.filter(l => {
    const size = l.layout?.['text-size'];
    return Array.isArray(size) || (typeof size === 'object');
});

console.log(`동적 text-size: ${withDynamicSize.length}개`);

// 표현식 예시 출력
withDynamicSize.slice(0, 3).forEach(l => {
    console.log(`${l.id}:`, JSON.stringify(l.layout['text-size']));
});
```

### 분석 결과

- 동적 `text-size` 사용: 30개 레이어
- 주로 `interpolate` 표현식 사용 (줌 기반 크기 조절)

**표현식 예시**:
```javascript
// 줌 레벨에 따른 텍스트 크기 보간
["interpolate", ["linear"], ["zoom"],
    15, 11,   // zoom 15 → 11px
    17, 12    // zoom 17 → 12px
]
```

## 15. 타일 소스 분석

```javascript
const sources = mb.getStyle().sources;
Object.entries(sources).forEach(([name, src]) => {
    if (src.tiles) {
        console.log(`${name}: ${src.tiles[0]}`);
        console.log(`  zoom: ${src.minzoom ?? 0}-${src.maxzoom ?? 22}`);
    }
});
```

### 분석 결과

| 소스 | URL 패턴 | 줌 범위 |
|------|----------|---------|
| land | nmap-data.pstatic.net/renderer/v2/tile/{x}/{y}/{z}... | 0-17 |
| base | nmap-data.pstatic.net/renderer/v2/tile/... | 0-17 |
| poi | nmap-data.pstatic.net/renderer/v2/tile/... | 0-17 |

**특징**: 모든 타일은 zoom 17까지만 생성, 이후는 오버줌

## 16. 폰트 스택 분석

```javascript
const fontStacks = new Set();
symbols.forEach(l => {
    const fonts = l.layout?.['text-font'];
    if (fonts) fontStacks.add(JSON.stringify(fonts));
});

console.log('사용 폰트:');
fontStacks.forEach(f => console.log(`  ${f}`));
```

### 분석 결과

| 폰트 스택 | 용도 |
|-----------|------|
| `["Noto Sans CJK KR Bold", "Arial Unicode MS Bold"]` | 강조 텍스트 |
| `["Noto Sans CJK KR Regular", "Arial Unicode MS Regular"]` | 일반 텍스트 |
| `["Noto Sans CJK KR Medium", ...]` | 중간 굵기 |

**SDF 폰트 URL**: `https://mape.pstatic.net/styler/api/v1/font/sdf/{fontstack}/{range}.pbf`

### 네이버의 POI 렌더링 전략

1. **고정 크기 아이콘**: 모든 476개 이미지가 고정 사이즈 (stretchable 0개)
2. **텍스트 헤일로**: 둥근 배경 대신 `text-halo`로 가독성 확보
3. **심볼 레이어**: Mapbox GL 네이티브 심볼 레이어 활용
4. **도로 번호만 예외**: 도로 번호 표시에만 `icon-text-fit` 사용 (그러나 stretchable 아님)

### 우리 프로젝트의 차별점

우리 `pill-bg` 이미지는 **현재 맵에서 유일한 stretchable 이미지**입니다:
- 9-slice 스트레칭으로 텍스트 길이에 맞게 배경 확장
- `icon-text-fit: both` + `stretchX/stretchY` 조합
- 네이버 기본 스타일과는 완전히 다른 접근

### 시사점

- 네이버는 "텍스트에 맞춰 늘어나는 배경" UI를 사용하지 않음
- 둥근 사각형 배경이 필요하면 우리처럼 stretchable 이미지 직접 구현 필요
- 간단한 배경 효과만 필요하면 `text-halo` 사용 (성능 우수)
- 복잡한 배경은 래스터 캐시 또는 별도 레이어 필요

## 17. 도로 지오메트리 ↔ 라벨 연결 구조

도로는 **지오메트리(선)**와 **라벨(이름)**이 분리되어 있으며, `link_id`로 연결됩니다.

### 연결 구조

```
┌─────────────────────────────────────────────────────────────┐
│  Road Geometry Layer (line/fill)                            │
│  ─────────────────────────────────                          │
│  link_id: "1940056801"                                      │
│  ufid: "..."                                                │
│  cate1: "1", cate2: "1", cate3: "0"  (도로 분류)            │
│  std_code: "..."                                            │
│  (이름 없음!)                                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │  link_id로 매칭
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  Road Label Layer (LABELPATH/symbol)                        │
│  ───────────────────────────────────                        │
│  link_id: "1940056801"  ← 동일한 ID                         │
│  ufid: "..."                                                │
│  nm: "경부고속도로"                                         │
│  nm:en: "Gyeongbu Expwy"                                    │
│  nm_short: "경부"                                           │
└─────────────────────────────────────────────────────────────┘
```

### 분리 이유

1. **렌더링 최적화**: 지오메트리(선)는 매 줌에서 그려야 하지만, 라벨은 충돌 회피/간략화 필요
2. **라벨 배치**: 도로 라벨은 곡선을 따라 배치되어야 해서 별도 LABELPATH 처리
3. **중복 방지**: 같은 도로가 여러 세그먼트로 나뉘어도 라벨은 한 번만 표시

### 도로 지오메트리 속성 조회

```javascript
const mb = window.__naverMap._mapbox;

const roadFeatures = mb.queryRenderedFeatures()
    .filter(f => f.layer.id.includes('도로'));

// 속성 키 확인
const allKeys = new Set();
roadFeatures.forEach(f => {
    Object.keys(f.properties).forEach(k => allKeys.add(k));
});
console.log('🔑 도로 지오메트리 속성:', [...allKeys].sort());
// 결과: ['cate1', 'cate2', 'cate3', 'link_id', 'maxlv', 'minlv', 'std_code', 'ufid']
```

### 도로 라벨 속성 조회

```javascript
const mb = window.__naverMap._mapbox;

const labelLayers = mb.getStyle().layers
    .filter(l => l.type === 'symbol' && l.id.includes('LABELPATH'))
    .map(l => l.id);

const labels = mb.queryRenderedFeatures({ layers: labelLayers });

// 속성 키 확인
const allKeys = new Set();
labels.forEach(l => {
    Object.keys(l.properties).forEach(k => allKeys.add(k));
});
console.log('🔑 도로 라벨 속성:', [...allKeys].sort());
// 결과: ['link_id', 'maxlv', 'minlv', 'nm', 'nm:en', 'nm_short', 'std_code', 'sz', 'ufid', 'width']
```

### 클릭한 도로의 이름 찾기

```javascript
const mb = window.__naverMap._mapbox;

mb.on('click', (e) => {
    // 클릭 지점의 도로 지오메트리
    const roadGeom = mb.queryRenderedFeatures(e.point)
        .find(f => f.layer.type === 'line' && f.properties.link_id);

    if (!roadGeom) return;

    const linkId = roadGeom.properties.link_id;
    console.log('🛣️ 클릭한 도로 link_id:', linkId);

    // 화면의 모든 라벨에서 같은 link_id 찾기
    const labelLayers = mb.getStyle().layers
        .filter(l => l.id.includes('LABELPATH'))
        .map(l => l.id);

    const labels = mb.queryRenderedFeatures({ layers: labelLayers });
    const matchingLabel = labels.find(l => l.properties.link_id === linkId);

    if (matchingLabel) {
        console.log('📍 도로 이름:', matchingLabel.properties.nm);
        console.log('📍 영문 이름:', matchingLabel.properties['nm:en']);
    } else {
        console.log('⚠️ 라벨이 현재 뷰포트에 없음');
    }
});
```

## 18. 국도/고속도로 ID 조회

### 고속도로 목록 조회

```javascript
const mb = window.__naverMap._mapbox;

// 고속도로 관련 레이어 찾기
const hwLayers = mb.getStyle().layers
    .filter(l => l.id.includes('고속도로') || l.id.includes('LABELPATH'))
    .map(l => l.id);

// 고속도로 라벨 조회
const hwLabels = mb.queryRenderedFeatures({ layers: hwLayers })
    .filter(f => f.properties.nm && f.properties.nm.includes('고속도로'));

// 중복 제거 (link_id 기준)
const uniqueHw = new Map();
hwLabels.forEach(f => {
    const p = f.properties;
    if (!uniqueHw.has(p.link_id)) {
        uniqueHw.set(p.link_id, {
            link_id: p.link_id,
            name: p.nm,
            name_en: p['nm:en'],
            name_short: p.nm_short,
        });
    }
});

console.log('🛣️ 현재 화면의 고속도로:');
console.table([...uniqueHw.values()]);
```

### 국도 목록 조회

```javascript
const mb = window.__naverMap._mapbox;

// 국도 번호 레이어 찾기 (도로번호 표시)
const roadNumLayers = mb.getStyle().layers
    .filter(l => l.id.includes('국도') || l.id.includes('도로번호'))
    .map(l => l.id);

console.log('국도 관련 레이어:', roadNumLayers);

// 국도 피처 조회
const nationalRoads = mb.queryRenderedFeatures({ layers: roadNumLayers });

// 국도 번호별 정리
const byNumber = new Map();
nationalRoads.forEach(f => {
    const p = f.properties;
    const num = p.nm || p.road_no || p.text;
    if (num && !byNumber.has(num)) {
        byNumber.set(num, {
            number: num,
            link_id: p.link_id,
            ufid: p.ufid,
        });
    }
});

console.log('🛣️ 현재 화면의 국도:');
console.table([...byNumber.values()]);
```

### 도로 분류 코드 (cate1, cate2, cate3)

```javascript
const mb = window.__naverMap._mapbox;

// 모든 도로의 분류 코드 분석
const roads = mb.queryRenderedFeatures()
    .filter(f => f.properties.cate1 !== undefined);

const categories = new Map();
roads.forEach(f => {
    const p = f.properties;
    const key = `${p.cate1}-${p.cate2}-${p.cate3}`;
    if (!categories.has(key)) {
        categories.set(key, { cate1: p.cate1, cate2: p.cate2, cate3: p.cate3, count: 0 });
    }
    categories.get(key).count++;
});

console.log('도로 분류 코드:');
console.table([...categories.values()].sort((a, b) => b.count - a.count));
```

### 분석 결과

| 분류 코드 | 의미 (추정) |
|-----------|-------------|
| cate1=1 | 고속도로/자동차전용도로 |
| cate1=2 | 국도/일반국도 |
| cate1=3 | 지방도/시도 |
| cate1=4 | 일반도로 |

**참고**: 정확한 분류는 네이버 내부 기준이므로 실제 조회 결과로 확인 필요

### 특정 고속도로 하이라이트 (디버깅용)

```javascript
const mb = window.__naverMap._mapbox;

// 경부고속도로만 빨간색으로 표시
const targetLinkIds = new Set();

// 먼저 경부고속도로의 link_id 수집
mb.queryRenderedFeatures()
    .filter(f => f.properties.nm === '경부고속도로')
    .forEach(f => targetLinkIds.add(f.properties.link_id));

console.log('경부고속도로 link_id:', [...targetLinkIds]);

// 해당 도로 레이어의 색상 변경 (주의: 실험용)
// mb.setPaintProperty('도로레이어ID', 'line-color', [
//     'case',
//     ['in', ['get', 'link_id'], ['literal', [...targetLinkIds]]],
//     '#ff0000',  // 경부고속도로: 빨간색
//     '#888888'   // 나머지: 회색
// ]);
```

## 19. 도로 식별 분석 결론

### 핵심 발견

**네이버 내부 시스템**:
- 개별 도로(국도 1호선, 국도 3호선 등)를 완벽히 식별함
- 도로 번호 심볼이 정확한 도로 위에 배치됨
- 경로 탐색 기능 작동

**벡터 타일 노출 현황**:

| 도로 유형 | 개별 식별 가능 | 연결 방법 |
|-----------|---------------|-----------|
| 고속도로 | ✅ 가능 | LABELPATH의 `link_id`로 지오메트리와 연결, `nm`에 도로명 포함 |
| 국도 | ❌ 불가능 | 지오메트리의 `std_code`가 모든 국도에서 동일 (`000000020001`) |
| 지방도 | ❌ 불가능 | 국도와 동일한 문제 |

### 데이터 구조 상세

#### 고속도로 (식별 가능)

```
[지오메트리] ←─ link_id ─→ [LABELPATH 라벨]
  - link_id: "12345"            - link_id: "12345"
  - ufid                        - nm: "경부고속도로"
  - cate1/2/3                   - nm:en: "Gyeongbu Expressway"
  - std_code                    - nm_short
```

#### 국도/지방도 (식별 불가능)

```
[지오메트리]                    [도로번호 심볼 (POI)]
  - std_code: "000000020001"    - mid: 728850 (고유 ID)
    ↑ 모든 국도가 동일!         - name_dp: "6" (번호만)
  - cate3: "국도"               - icon_type: "national_road"
  - link_id: 있지만...          - cid: "227770" (카테고리)
    LABELPATH에 국도 라벨 없음!   ↑ link_id 없음! 연결 불가!
```

**검증 결과 (LABELPATH 조회):**
```javascript
// LABELPATH에서 국도 라벨 찾기
const labels = mb.queryRenderedFeatures({ layers: labelLayers });
const 국도라벨 = labels.filter(f => f.properties.nm?.includes('국도'));
// 결과: 0개! - 국도는 LABELPATH에 없음

// 고속도로만 있음
// ['경부고속도로', '서해안고속도로', '제2경인고속도로', ...]
```

### 왜 이런 구조인가?

1. **벡터 타일 최적화**: 개별 도로 ID를 타일에 포함하면 데이터 크기 증가
2. **시각화 분리**: 지오메트리와 심볼을 독립적으로 렌더링 (성능 최적화)
3. **서버 측 처리**: 경로 탐색, 심볼 배치는 서버에서 계산 후 결과만 전송

### 실용적 활용 방안

```javascript
// 고속도로 개별 식별 (가능)
const highwayName = mb.queryRenderedFeatures({
    layers: ['LABELPATH']
}).filter(f => f.properties.nm?.includes('고속도로'));

// 국도는 지오메트리 기준으로만 구분 (cate3: '국도')
// 개별 번호(1호선, 3호선 등) 구분은 불가
const nationalRoadGeometry = mb.queryRenderedFeatures()
    .filter(f => f.properties.cate3 === '국도');

// 도로 번호 심볼 위치 확인 (참고용)
const roadNumberSymbols = mb.queryRenderedFeatures({
    layers: ['도로번호/국도']
});
// 심볼의 좌표는 얻을 수 있지만, 어느 도로와 연결되는지 알 수 없음
```

### 결론

| 항목 | 상태 |
|------|------|
| 고속도로 개별 식별 | ✅ `link_id` + LABELPATH로 가능 |
| 국도 개별 식별 | ❌ 벡터 타일에서 불가능 |
| 지방도 개별 식별 | ❌ 벡터 타일에서 불가능 |
| 도로 유형 구분 (고속도로/국도/지방도) | ✅ `cate1/2/3` 또는 `icon_type`으로 가능 |

> **참고**: 개별 국도/지방도 정보가 필요한 경우, 네이버 경로 탐색 API 또는 별도의 도로망 데이터(국가교통정보센터 등)를 활용해야 합니다.
