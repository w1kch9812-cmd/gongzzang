// scripts/check-pnu-coverage.ts
// PNU 변환 현황 확인

import * as fs from 'fs';
import * as path from 'path';

function checkCoverage() {
    console.log('📊 PNU 변환 현황 확인\n');

    // 1. 지식산업센터
    const kcPath = path.join(process.cwd(), 'public/data/properties/knowledge-centers.json');
    if (fs.existsSync(kcPath)) {
        const centers = JSON.parse(fs.readFileSync(kcPath, 'utf-8'));
        const total = centers.length;
        const withPNU = centers.filter((c: any) => c.pnu && c.pnu.length === 19).length;
        const withCoord = centers.filter((c: any) => c.coord && c.coord[0] && c.coord[1]).length;
        const withoutPNU = centers.filter((c: any) => (!c.pnu || c.pnu.length !== 19) && c.coord && c.coord[0] && c.coord[1]);

        console.log('🏢 지식산업센터');
        console.log(`   총: ${total}개`);
        console.log(`   PNU 있음: ${withPNU}/${total} (${(withPNU/total*100).toFixed(1)}%)`);
        console.log(`   좌표 있음: ${withCoord}/${total} (${(withCoord/total*100).toFixed(1)}%)`);
        console.log(`   PNU 없음 (좌표 있음): ${withoutPNU.length}개`);

        if (withoutPNU.length > 0 && withoutPNU.length <= 10) {
            console.log('\n   PNU 없는 항목:');
            withoutPNU.forEach((c: any, i: number) => {
                console.log(`     [${i + 1}] ${c.name} (${c.emdCode || 'emd코드 없음'})`);
            });
        }
    }

    // 2. 공장
    const factoryPath = path.join(process.cwd(), 'public/data/properties/factories.json');
    if (fs.existsSync(factoryPath)) {
        const factories = JSON.parse(fs.readFileSync(factoryPath, 'utf-8'));
        const total = factories.length;
        const withPNU = factories.filter((f: any) => f.pnu && f.pnu.length === 19).length;
        const withCoord = factories.filter((f: any) => f.coord && f.coord[0] && f.coord[1]).length;

        console.log('\n🏭 공장');
        console.log(`   총: ${total}개`);
        console.log(`   PNU 있음: ${withPNU}/${total} (${(withPNU/total*100).toFixed(1)}%)`);
        console.log(`   좌표 있음: ${withCoord}/${total} (${(withCoord/total*100).toFixed(1)}%)`);
        console.log(`   PNU 없음: ${total - withPNU}개`);
    }

    // 3. 필지
    const parcelPath = path.join(process.cwd(), 'public/data/properties/parcels.json');
    if (fs.existsSync(parcelPath)) {
        const parcels = JSON.parse(fs.readFileSync(parcelPath, 'utf-8'));
        const total = parcels.length;
        const withPNU = parcels.filter((p: any) => p.PNU && p.PNU.length === 19).length;

        console.log('\n📦 필지');
        console.log(`   총: ${total}개`);
        console.log(`   PNU 있음: ${withPNU}/${total} (${(withPNU/total*100).toFixed(1)}%)`);
    }

    console.log('\n✅ 현황 확인 완료');
}

checkCoverage();
