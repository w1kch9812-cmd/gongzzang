// scripts/extract-emd-codes-from-parcels.ts
// parcels.json에서 실제 읍면동 코드 추출 및 분석

import * as fs from 'fs';
import * as path from 'path';

const parcelsPath = path.join(process.cwd(), 'public/data/properties/parcels.json');
const parcels = JSON.parse(fs.readFileSync(parcelsPath, 'utf-8'));

// 읍면동 코드별로 그룹화
const emdGroups = new Map<string, any[]>();

for (const parcel of parcels) {
    if (!parcel.PNU) continue;

    const emdCode = parcel.PNU.substring(5, 8); // 읍면동 3자리
    const fullEmdCode = parcel.PNU.substring(0, 10); // 전체 10자리

    if (!emdGroups.has(emdCode)) {
        emdGroups.set(emdCode, []);
    }
    emdGroups.get(emdCode)!.push({
        pnu: parcel.PNU,
        jibun: parcel.jibun,
        fullEmdCode
    });
}

console.log('📍 parcels.json의 읍면동 코드 분석\n');
console.log(`총 ${emdGroups.size}개 읍면동\n`);

// 각 읍면동별 샘플 지번 출력
const sortedEmds = Array.from(emdGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

for (const [emdCode, parcels] of sortedEmds) {
    const fullCode = parcels[0].fullEmdCode;
    const samples = parcels.slice(0, 3);

    console.log(`읍면동 코드: ${emdCode} (전체: ${fullCode})`);
    console.log(`  필지 수: ${parcels.length}개`);
    console.log(`  샘플 지번:`);
    samples.forEach(s => {
        console.log(`    - ${s.jibun} (PNU: ${s.pnu})`);
    });
    console.log('');
}

// 지번에서 동 이름 추출 시도
console.log('\n🏘️ 지번 주소에서 동 이름 추출\n');

const dongNames = new Map<string, string>();

for (const [emdCode, parcels] of emdGroups) {
    // 첫 번째 필지의 지번에서 동 이름 추출
    const sample = parcels[0];

    // "1594 도" 같은 형식에서 동 이름 없음
    // 하지만 일부는 "간석동 123" 같은 형식일 수 있음

    // 간단히 샘플을 보고 수동으로 판단
    console.log(`${emdCode}: "${sample.jibun}" → emd ${sample.fullEmdCode}`);
}
