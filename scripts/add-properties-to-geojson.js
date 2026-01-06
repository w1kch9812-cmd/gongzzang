// scripts/add-properties-to-geojson.js
// GeoJSON 필지 데이터에 type, transactionPrice 속성 추가 (서버사이드 색상 적용용)
//
// type 값 (비트 플래그):
//   0 = 정보 없음 (기본 회색)
//   1 = 실거래 (초록색)
//   2 = 매물 (파란색)
//   4 = 경매 (빨간색)
//
// transactionPrice: 실거래가 (만원/평)

const fs = require('fs');
const path = require('path');

// 파일 경로
const markersPath = path.join(__dirname, '../public/data/properties/parcel-markers.json');
const geojsonPath = path.join(__dirname, '../temp/parcels.geojson');
const outputPath = path.join(__dirname, '../temp/parcels-with-props.geojson');

console.log('📦 GeoJSON에 type, transactionPrice 속성 추가 시작...');

// 1. parcel-markers.json에서 PNU → 속성 맵 생성
console.log('   1. parcel-markers.json 로드...');
const markers = JSON.parse(fs.readFileSync(markersPath, 'utf-8'));
const pnuPropsMap = new Map();

markers.forEach(m => {
    pnuPropsMap.set(m.id, {
        type: m.type,
        transactionPrice: m.transactionPrice || 0,
        listingPrice: m.listingPrice || 0,
        auctionPrice: m.auctionPrice || 0,
    });
});

console.log(`      - ${pnuPropsMap.size}개 PNU 매핑 완료`);

// type별 통계
const typeStats = { 0: 0, 1: 0, 2: 0, 4: 0 };
let transactionCount = 0;
markers.forEach(m => {
    typeStats[m.type] = (typeStats[m.type] || 0) + 1;
    if (m.transactionPrice && m.transactionPrice > 0) transactionCount++;
});
console.log(`      - type 분포: 없음=${typeStats[0] || 0}, 실거래=${typeStats[1] || 0}, 매물=${typeStats[2] || 0}, 경매=${typeStats[4] || 0}`);
console.log(`      - 실거래가 있는 필지: ${transactionCount}개`);

// 2. GeoJSON 로드
console.log('   2. parcels.geojson 로드...');
if (!fs.existsSync(geojsonPath)) {
    console.error(`❌ 파일 없음: ${geojsonPath}`);
    console.log('   먼저 npm run data:shp 를 실행하세요.');
    process.exit(1);
}

const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
console.log(`      - ${geojson.features.length}개 피처 로드`);

// 3. 각 피처에 속성 추가
console.log('   3. 속성 추가 중...');
let matched = 0;
let unmatched = 0;
let withTransaction = 0;

geojson.features.forEach(feature => {
    const pnu = feature.properties?.PNU;
    if (pnu && pnuPropsMap.has(pnu)) {
        const props = pnuPropsMap.get(pnu);
        feature.properties.type = props.type;
        feature.properties.transactionPrice = props.transactionPrice;
        feature.properties.listingPrice = props.listingPrice;
        feature.properties.auctionPrice = props.auctionPrice;
        matched++;
        if (props.transactionPrice > 0) withTransaction++;
    } else {
        feature.properties.type = 0;
        feature.properties.transactionPrice = 0;
        feature.properties.listingPrice = 0;
        feature.properties.auctionPrice = 0;
        unmatched++;
    }
});

console.log(`      - 매칭됨: ${matched}개`);
console.log(`      - 미매칭: ${unmatched}개 (type=0)`);
console.log(`      - 실거래가 포함: ${withTransaction}개`);

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
console.log('   1. copy temp\\parcels-with-props.geojson temp\\parcels.geojson');
console.log('   2. npm run data:tiles (PMTiles 재생성)');
console.log('');
console.log('💡 PMTiles 생성 후 Mapbox GL 스타일에서:');
console.log('');
console.log('   1. type 기반 색상 (실거래/매물/경매 구분):');
console.log('      ["match", ["get", "type"],');
console.log('        1, "#22C55E",  // 실거래 - 초록');
console.log('        2, "#0066FF",  // 매물 - 파랑');
console.log('        4, "#EA5252",  // 경매 - 빨강');
console.log('        "#d1d5db"      // 기본 - 회색');
console.log('      ]');
console.log('');
console.log('   2. transactionPrice 기반 가격 보간:');
console.log('      ["interpolate", ["linear"], ["get", "transactionPrice"],');
console.log('        0, "#d1d5db",      // 가격 없음 - 회색');
console.log('        10000, "#3b82f6",  // 저가 - 파랑');
console.log('        50000, "#10b981",  // 중가 - 녹색');
console.log('        100000, "#ef4444"  // 고가 - 빨강');
console.log('      ]');
console.log('');
