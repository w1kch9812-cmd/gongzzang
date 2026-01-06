// scripts/test-deck-coords.ts
// Deck.gl 좌표 시스템 디버그

import * as fs from 'fs';
import * as path from 'path';

// Deck.gl와 Mapbox GL의 좌표 시스템 체크
async function main() {
    console.log('🔍 Deck.gl 좌표 시스템 분석\n');

    // 마커 데이터 로드
    const markersPath = path.join(process.cwd(), 'public/data/properties/parcel-markers.json');
    const markers = JSON.parse(fs.readFileSync(markersPath, 'utf-8'));

    console.log('샘플 마커 좌표 (Deck.gl가 받는 형식):');
    for (let i = 0; i < Math.min(5, markers.length); i++) {
        const m = markers[i];
        console.log(`  [${i}] ${m.jibun}`);
        console.log(`      coord: [${m.coord[0]}, ${m.coord[1]}]`);
        console.log(`      (경도, 위도) = (${m.coord[0]}°E, ${m.coord[1]}°N)`);
        console.log('');
    }

    console.log('\n📐 Deck.gl + Mapbox GL 좌표 시스템:');
    console.log('  - Deck.gl IconLayer getPosition: [lng, lat] 형식');
    console.log('  - Mapbox GL 내부: WGS84 (EPSG:4326)');
    console.log('  - MapboxOverlay는 자동으로 LNGLAT 좌표계 사용');
    console.log('');

    console.log('📊 좌표 범위 분석:');
    const lngs = markers.map((m: any) => m.coord[0]).filter((x: number) => x);
    const lats = markers.map((m: any) => m.coord[1]).filter((x: number) => x);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    console.log(`  경도 범위: ${minLng.toFixed(6)} ~ ${maxLng.toFixed(6)}`);
    console.log(`  위도 범위: ${minLat.toFixed(6)} ~ ${maxLat.toFixed(6)}`);
    console.log('');
    console.log('  예상 지역: 인천 (경도 ~126.4-126.9, 위도 ~37.3-37.6)');
    console.log(`  ✅ 좌표 범위 ${(minLng >= 126 && maxLng <= 127 && minLat >= 37 && maxLat <= 38) ? '정상' : '비정상'}`);
    console.log('');

    // IconLayer 설정 체크
    console.log('🎨 IconLayer 설정 분석:');
    console.log('  현재 설정:');
    console.log('    getPosition: (d) => d.position  // [lng, lat]');
    console.log('    anchorX: d.width / 2');
    console.log('    anchorY: d.height  // 하단 중앙 (꼬리 끝)');
    console.log('    sizeUnits: pixels');
    console.log('    billboard: true');
    console.log('');

    console.log('⚠️  잠재적 문제점:');
    console.log('  1. coordinateSystem 미지정 → 기본값 LNGLAT 사용');
    console.log('  2. sizeScale이 1이 아닌 경우 아이콘 크기가 달라짐');
    console.log('  3. MapboxOverlay의 interleaved: true는 올바름');
    console.log('');

    console.log('🔧 해결책 제안:');
    console.log('  Option 1: IconLayer에 명시적으로 coordinateSystem 설정');
    console.log('    coordinateSystem: COORDINATE_SYSTEM.LNGLAT');
    console.log('');
    console.log('  Option 2: 네이버 지도 GL의 viewport/projection 확인');
    console.log('    - Naver Maps GL이 내부 Mapbox GL과 좌표계 동기화 확인');
    console.log('    - getViewportBBox가 올바른 경계 반환하는지 확인');
}

main().catch(console.error);
