/**
 * 샘플 광고 데이터 추가 스크립트
 * 산업단지 4개, 지식산업센터 3개에 광고 속성 추가
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../public/data/properties');

// 광고 대상 산업단지 (인천 지역 포함)
const AD_COMPLEXES = [
    // 인천 지역 (화면에 바로 보임)
    { id: '128010', phoneNumber: '032-111-2222', thumbnailUrl: 'https://picsum.photos/seed/namdong/200/200' },  // 남동국가산업단지
    { id: '228030', phoneNumber: '032-222-3333', thumbnailUrl: 'https://picsum.photos/seed/incheon/200/200' },  // 인천산업단지
    { id: '228060', phoneNumber: '032-333-4444', thumbnailUrl: 'https://picsum.photos/seed/songdo/200/200' },   // 송도지식산업단지
    { id: '228050', phoneNumber: '032-444-5555', thumbnailUrl: 'https://picsum.photos/seed/cheongna/200/200' }, // 청라1산업단지
];

// 광고 대상 지식산업센터 (3개)
const AD_KNOWLEDGE_CENTERS = [
    { id: 'kic-1', phoneNumber: '032-345-6789', thumbnailUrl: 'https://picsum.photos/seed/kic1/200/200' },   // 계양DSE
    { id: 'kic-65', phoneNumber: '032-456-7890', thumbnailUrl: 'https://picsum.photos/seed/kic2/200/200' },  // 에이스하이테크시티청라
    { id: 'kic-43', phoneNumber: '032-567-8901', thumbnailUrl: 'https://picsum.photos/seed/kic3/200/200' },  // 부평테크노타워
];

async function main() {
    // 산업단지 처리
    const complexesPath = path.join(DATA_DIR, 'complexes.json');
    const complexes = JSON.parse(fs.readFileSync(complexesPath, 'utf-8'));

    let complexAdCount = 0;
    for (const complex of complexes) {
        const adInfo = AD_COMPLEXES.find(ad => ad.id === complex.id);
        if (adInfo) {
            complex.isAd = true;
            complex.phoneNumber = adInfo.phoneNumber;
            complex.thumbnailUrl = adInfo.thumbnailUrl;
            complexAdCount++;
            console.log(`✅ 산업단지 광고 추가: ${complex.name} (${complex.id})`);
        }
    }

    fs.writeFileSync(complexesPath, JSON.stringify(complexes, null, 2), 'utf-8');
    console.log(`\n📦 산업단지 광고 ${complexAdCount}개 추가 완료`);

    // 지식산업센터 처리
    const kcPath = path.join(DATA_DIR, 'knowledge-centers-index.json');
    const knowledgeCenters = JSON.parse(fs.readFileSync(kcPath, 'utf-8'));

    let kcAdCount = 0;
    for (const kc of knowledgeCenters) {
        const adInfo = AD_KNOWLEDGE_CENTERS.find(ad => ad.id === kc.id);
        if (adInfo) {
            kc.isAd = true;
            kc.phoneNumber = adInfo.phoneNumber;
            kc.thumbnailUrl = adInfo.thumbnailUrl;
            kcAdCount++;
            console.log(`✅ 지식산업센터 광고 추가: ${kc.name} (${kc.id})`);
        }
    }

    fs.writeFileSync(kcPath, JSON.stringify(knowledgeCenters), 'utf-8');
    console.log(`\n🏢 지식산업센터 광고 ${kcAdCount}개 추가 완료`);

    console.log('\n✨ 샘플 광고 데이터 추가 완료!');
}

main().catch(console.error);
