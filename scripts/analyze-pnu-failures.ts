// scripts/analyze-pnu-failures.ts
// PNU 변환 실패 원인 분석

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

async function analyzefailures() {
    console.log('❌ PNU 변환 실패 원인 분석\n');

    // 1. factories.json 로드
    const factoriesPath = path.join(process.cwd(), 'public/data/properties/factories.json');
    const factories = JSON.parse(fs.readFileSync(factoriesPath, 'utf-8'));

    // 2. Excel 로드
    const excelPath = path.join(process.cwd(), 'rawdata/전국공장등록현황.xlsx');
    const wb = XLSX.readFile(excelPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData: any[] = XLSX.utils.sheet_to_json(ws);
    const incheonRaw = rawData.filter(row => row['시도명'] === '인천광역시');

    // 3. 실패한 공장 분류
    const failed = factories.filter((f: any) => !f.pnu || f.pnu.length !== 19);

    console.log(`총 실패: ${failed.length}개\n`);

    // 원인별 분류
    const reasons: Record<string, any[]> = {
        '좌표 없음': [],
        'Excel에서 찾을 수 없음': [],
        '지번주소 없음': [],
        '기타': []
    };

    for (const factory of failed) {
        // 좌표 없음
        if (!factory.coord || !factory.coord[0] || !factory.coord[1]) {
            reasons['좌표 없음'].push(factory);
            continue;
        }

        // Excel에서 찾을 수 없음
        const rawFactory = incheonRaw.find(r => r['회사명'] === factory.name);
        if (!rawFactory) {
            reasons['Excel에서 찾을 수 없음'].push(factory);
            continue;
        }

        // 지번주소 없음
        if (!rawFactory['공장주소_지번']) {
            reasons['지번주소 없음'].push(factory);
            continue;
        }

        // 기타
        reasons['기타'].push({
            ...factory,
            excelJibun: rawFactory['공장주소_지번']
        });
    }

    // 원인별 출력
    for (const [reason, items] of Object.entries(reasons)) {
        console.log(`📍 ${reason}: ${items.length}개`);

        if (items.length > 0 && items.length <= 10) {
            items.forEach((item, i) => {
                if (reason === '기타') {
                    console.log(`   [${i + 1}] ${item.name}`);
                    console.log(`       Excel 지번: ${item.excelJibun}`);
                    console.log(`       좌표: ${item.coord}`);
                    console.log(`       emdCode: ${item.emdCode || '없음'}`);
                } else {
                    console.log(`   [${i + 1}] ${item.name}`);
                }
            });
        } else if (items.length > 10) {
            items.slice(0, 3).forEach((item, i) => {
                console.log(`   [${i + 1}] ${item.name}`);
            });
            console.log(`   ... 외 ${items.length - 3}개`);
        }

        console.log('');
    }

    // 통계
    console.log('📊 요약');
    console.log(`   총 공장: ${factories.length}개`);
    console.log(`   성공: ${factories.length - failed.length}개 (${((factories.length - failed.length) / factories.length * 100).toFixed(1)}%)`);
    console.log(`   실패: ${failed.length}개 (${(failed.length / factories.length * 100).toFixed(1)}%)`);
    console.log('');
    console.log('   실패 원인:');
    for (const [reason, items] of Object.entries(reasons)) {
        console.log(`     - ${reason}: ${items.length}개 (${(items.length / failed.length * 100).toFixed(1)}%)`);
    }
}

analyzefailures().catch(console.error);
