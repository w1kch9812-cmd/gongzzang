// scripts/add-mock-property-types.js
// 실거래가 마커에 다양한 매물 유형(공장, 창고, 지산) mock 데이터 추가

const fs = require('fs');
const path = require('path');

const markersPath = path.join(__dirname, '../public/data/properties/parcel-markers.json');

console.log('📦 실거래가 마커에 매물 유형(propertyType) mock 데이터 추가...');

// 마커 로드
const markers = JSON.parse(fs.readFileSync(markersPath, 'utf-8'));
console.log(`   총 ${markers.length}개 마커 로드됨`);

// 실거래가 있는 마커만 필터
const txMarkers = markers.filter(m => m.type & 1);
console.log(`   실거래가 있는 마커: ${txMarkers.length}개`);

// 매물 유형 설정 (propertyType)
// factory: 공장 (teal)
// warehouse: 창고 (orange)
// knowledge-center: 지식산업센터 (violet)
// land: 토지 (green) - 기본값
const mockPropertyTypes = [
    { type: 'factory', ratio: 0.20 },           // 20% 공장
    { type: 'warehouse', ratio: 0.15 },         // 15% 창고
    { type: 'knowledge-center', ratio: 0.10 }, // 10% 지산
    // 나머지 55%는 land (토지) - 기본값
];

let changedCount = 0;
const changeStats = {};

// 해시 기반으로 일관된 변경 (ID 기반)
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash);
}

txMarkers.forEach((marker) => {
    const hash = hashCode(marker.id);
    const normalized = (hash % 10000) / 10000; // 0~1 사이 값

    let cumulative = 0;
    let assigned = false;

    for (const mockType of mockPropertyTypes) {
        cumulative += mockType.ratio;
        if (normalized < cumulative) {
            marker.propertyType = mockType.type;
            changedCount++;
            changeStats[mockType.type] = (changeStats[mockType.type] || 0) + 1;
            assigned = true;
            break;
        }
    }

    // 기본값: land (토지)
    if (!assigned) {
        marker.propertyType = 'land';
        changeStats['land'] = (changeStats['land'] || 0) + 1;
    }
});

console.log(`\n   ✅ 매물 유형 할당 완료`);
const labels = {
    'factory': '공장',
    'warehouse': '창고',
    'knowledge-center': '지산',
    'land': '토지',
};
Object.entries(changeStats).forEach(([type, count]) => {
    const pct = ((count / txMarkers.length) * 100).toFixed(1);
    console.log(`      - ${labels[type] || type}: ${count}개 (${pct}%)`);
});

// 저장
fs.writeFileSync(markersPath, JSON.stringify(markers));
console.log(`\n💾 저장 완료: ${markersPath}`);

// 검증
const verifyMarkers = JSON.parse(fs.readFileSync(markersPath, 'utf-8'));
const verify = verifyMarkers.filter(m => m.type & 1 && m.propertyType).slice(0, 15);
console.log('\n📋 변경 후 샘플 (propertyType 포함):');
verify.forEach(m => {
    console.log(`   [${labels[m.propertyType] || m.propertyType}] ${m.jibun} - ${m.transactionPrice}만원`);
});
