// scripts/analyze-other-failures.ts
// "기타" 실패 원인 상세 분석

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

async function analyzeOtherFailures() {
    console.log('🔍 "기타" 실패 케이스 상세 분석\n');

    // 1. factories.json 로드
    const factoriesPath = path.join(process.cwd(), 'public/data/properties/factories.json');
    const factories = JSON.parse(fs.readFileSync(factoriesPath, 'utf-8'));

    // 2. Excel 로드
    const excelPath = path.join(process.cwd(), 'rawdata/전국공장등록현황.xlsx');
    const wb = XLSX.readFile(excelPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData: any[] = XLSX.utils.sheet_to_json(ws);
    const incheonRaw = rawData.filter(row => row['시도명'] === '인천광역시');

    // 3. "기타" 실패 케이스 찾기
    const otherFailures: any[] = [];

    for (const factory of factories) {
        // PNU가 없고
        if (factory.pnu && factory.pnu.length === 19) continue;

        // 좌표는 있고
        if (!factory.coord || !factory.coord[0] || !factory.coord[1]) continue;

        // Excel에서 찾을 수 있고
        const rawFactory = incheonRaw.find((r: any) => r['회사명'] === factory.name);
        if (!rawFactory) continue;

        // 지번주소도 있는데
        if (!rawFactory['공장주소_지번']) continue;

        // 실패한 경우
        otherFailures.push({
            name: factory.name,
            coord: factory.coord,
            emdCode: factory.emdCode,
            jibunAddress: factory.jibunAddress || rawFactory['공장주소_지번'],
            excelJibun: rawFactory['공장주소_지번'],
            sigungu: rawFactory['시군구명']
        });
    }

    console.log(`총 ${otherFailures.length}개\n`);

    // 샘플 10개 출력
    console.log('샘플 10개:\n');
    otherFailures.slice(0, 10).forEach((item, i) => {
        console.log(`[${i + 1}] ${item.name}`);
        console.log(`    시군구: ${item.sigungu}`);
        console.log(`    좌표: [${item.coord[0]}, ${item.coord[1]}]`);
        console.log(`    emdCode: ${item.emdCode || '❌ 없음'}`);
        console.log(`    Excel 지번: ${item.excelJibun}`);
        console.log('');
    });

    // emdCode 유무 통계
    const withEmdCode = otherFailures.filter(f => f.emdCode).length;
    const withoutEmdCode = otherFailures.filter(f => !f.emdCode).length;

    console.log('\n📊 emdCode 유무:');
    console.log(`   emdCode 있음: ${withEmdCode}개`);
    console.log(`   emdCode 없음: ${withoutEmdCode}개`);

    // 시군구별 통계
    const bySigungu: Record<string, number> = {};
    otherFailures.forEach(f => {
        bySigungu[f.sigungu] = (bySigungu[f.sigungu] || 0) + 1;
    });

    console.log('\n📍 시군구별 분포:');
    for (const [sigungu, count] of Object.entries(bySigungu).sort((a, b) => b[1] - a[1])) {
        console.log(`   ${sigungu}: ${count}개`);
    }
}

analyzeOtherFailures().catch(console.error);
