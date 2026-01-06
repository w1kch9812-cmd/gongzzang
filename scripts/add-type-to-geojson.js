// scripts/add-type-to-geojson.js
// GeoJSON 필지 데이터에 type 속성 추가 (서버사이드 색상 적용용)
//
// type 값:
//   0 = 정보 없음 (기본 회색)
//   1 = 실거래 (초록색)
//   2 = 매물 (파란색)
//   4 = 경매 (빨간색)

const fs = require('fs');
const path = require('path');

// 파일 경로
const markersPath = path.join(__dirname, '../public/data/properties/parcel-markers.json');
const geojsonPath = path.join(__dirname, '../temp/parcels.geojson');
const outputPath = path.join(__dirname, '../temp/parcels-with-type.geojson');

console.log('📦 GeoJSON에 type 속성 추가 시작...');

// 1. parcel-markers.json에서 PNU → type 맵 생성
console.log('   1. parcel-markers.json 로드...');
const markers = JSON.parse(fs.readFileSync(markersPath, 'utf-8'));
const pnuTypeMap = new Map();

markers.forEach(m => {
    pnuTypeMap.set(m.id, m.type);
});

console.log(`      - ${pnuTypeMap.size}개 PNU 매핑 완료`);

// type별 통계
const typeStats = { 0: 0, 1: 0, 2: 0, 4: 0 };
markers.forEach(m => {
    typeStats[m.type] = (typeStats[m.type] || 0) + 1;
});
console.log(`      - type 분포: 없음=${typeStats[0]}, 실거래=${typeStats[1]}, 매물=${typeStats[2]}, 경매=${typeStats[4]}`);

// 2. GeoJSON 로드
console.log('   2. parcels.geojson 로드...');
if (!fs.existsSync(geojsonPath)) {
    console.error(`❌ 파일 없음: ${geojsonPath}`);
    console.log('   먼저 npm run data:shp 를 실행하세요.');
    process.exit(1);
}

const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
console.log(`      - ${geojson.features.length}개 피처 로드`);

// 3. 각 피처에 type 속성 추가
console.log('   3. type 속성 추가 중...');
let matched = 0;
let unmatched = 0;

geojson.features.forEach(feature => {
    const pnu = feature.properties?.PNU;
    if (pnu && pnuTypeMap.has(pnu)) {
        feature.properties.type = pnuTypeMap.get(pnu);
        matched++;
    } else {
        feature.properties.type = 0; // 기본값
        unmatched++;
    }
});

console.log(`      - 매칭됨: ${matched}개`);
console.log(`      - 미매칭: ${unmatched}개 (type=0)`);

// 4. 저장
console.log('   4. 저장 중...');
fs.writeFileSync(outputPath, JSON.stringify(geojson), 'utf-8');

const inputSize = (fs.statSync(geojsonPath).size / 1024 / 1024).toFixed(2);
const outputSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);

console.log('');
console.log('✅ 완료!');
console.log(`   입력: ${geojsonPath} (${inputSize} MB)`);
console.log(`   출력: ${outputPath} (${outputSize} MB)`);
console.log('');
console.log('📋 다음 단계:');
console.log('   1. mv temp/parcels-with-type.geojson temp/parcels.geojson');
console.log('   2. npm run data:tiles (PMTiles 재생성)');
console.log('');
console.log('💡 PMTiles 생성 후 Mapbox GL 스타일에서 type 기반 색상 적용:');
console.log('   ["match", ["get", "type"],');
console.log('     1, "#22C55E",  // 실거래 - 초록');
console.log('     2, "#0066FF",  // 매물 - 파랑');
console.log('     4, "#EA5252",  // 경매 - 빨강');
console.log('     "#d1d5db"      // 기본 - 회색');
console.log('   ]');
