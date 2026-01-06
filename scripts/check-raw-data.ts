// scripts/check-raw-data.ts
// 원본 데이터 구조 확인

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import * as iconv from 'iconv-lite';

// 1. 공장 데이터 확인
function checkFactories() {
    console.log('🏭 공장 원본 데이터 확인...\n');

    const excelPath = path.join(process.cwd(), 'rawdata/전국공장등록현황.xlsx');
    const wb = XLSX.readFile(excelPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);

    console.log(`총 ${data.length}개 공장`);

    // 인천 데이터만 필터
    const incheon = data.filter((row: any) => row['시도명'] === '인천광역시');
    console.log(`인천: ${incheon.length}개`);

    // 샘플 출력
    console.log('\n샘플 (인천 첫 3개):');
    incheon.slice(0, 3).forEach((row: any, i: number) => {
        console.log(`\n[${i + 1}]`);
        console.log(`  회사명: ${row['회사명']}`);
        console.log(`  도로명주소: ${row['공장주소']}`);
        console.log(`  지번주소: ${row['공장주소_지번']}`);
        console.log(`  시군구: ${row['시군구명']}`);
    });

    // 주소 필드 존재 여부
    const withRoad = incheon.filter((row: any) => row['공장주소']).length;
    const withJibun = incheon.filter((row: any) => row['공장주소_지번']).length;

    console.log(`\n주소 현황:`);
    console.log(`  도로명주소 있음: ${withRoad}/${incheon.length} (${(withRoad/incheon.length*100).toFixed(1)}%)`);
    console.log(`  지번주소 있음: ${withJibun}/${incheon.length} (${(withJibun/incheon.length*100).toFixed(1)}%)`);
}

// 2. 지식산업센터 데이터 확인
function checkKnowledgeCenters() {
    console.log('\n\n🏢 지식산업센터 원본 데이터 확인...\n');

    const csvPath = path.join(process.cwd(), 'rawdata/한국산업단지공단_전국지식산업센터현황_20240630.csv');
    const buf = fs.readFileSync(csvPath);
    const text = (iconv as any).decode(buf, 'euc-kr');
    const lines = text.split('\n').filter((line: string) => line.trim());

    console.log(`총 ${lines.length - 1}개 (헤더 제외)`);

    // 헤더 파싱
    const headers = lines[0].split(',');
    console.log(`\n헤더: ${headers.join(', ')}`);

    // 인천 데이터만 필터
    const incheonLines = lines.slice(1).filter((line: string) => line.startsWith('인천'));
    console.log(`\n인천: ${incheonLines.length}개`);

    // 샘플 출력
    console.log('\n샘플 (인천 첫 3개):');
    incheonLines.slice(0, 3).forEach((line: string, i: number) => {
        const cols = line.split(',');
        console.log(`\n[${i + 1}]`);
        console.log(`  센터명: ${cols[2]}`);
        console.log(`  시도: ${cols[0]}`);
        console.log(`  시군구: ${cols[1]}`);
        console.log(`  전체 컬럼 수: ${cols.length}`);
        console.log(`  Raw: ${line.substring(0, 200)}...`);
    });
}

async function main() {
    checkFactories();
    checkKnowledgeCenters();
}

main().catch(console.error);
