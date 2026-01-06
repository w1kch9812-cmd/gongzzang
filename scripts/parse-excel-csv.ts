// scripts/parse-excel-csv.ts
// Excel/CSV 파일 파싱 (공장, 지식산업센터)

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import iconv from 'iconv-lite';
import { NON_SHP_SOURCES, OUTPUT_DIRS } from './data.config';

// CSV 파싱 (간단한 버전)
function parseCSV(content: string): Record<string, any>[] {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/("([^"]*?)"|[^,]+)/g) || [];
        const row: Record<string, any> = {};

        headers.forEach((header, index) => {
            let value = values[index] || '';
            value = value.trim().replace(/^"|"$/g, '');
            row[header] = value;
        });

        rows.push(row);
    }

    return rows;
}

// 공장 데이터 파싱
async function parseFactories(): Promise<void> {
    console.log('\n🏭 공장 데이터 파싱...');

    const config = NON_SHP_SOURCES.factories;
    const inputPath = path.join(process.cwd(), 'rawdata', config.rawFiles[0]);
    const outputPath = path.join(process.cwd(), config.outputProperties);
    const indexOutputPath = outputPath.replace('.json', '-index.json');

    if (!fs.existsSync(inputPath)) {
        console.warn('  ⚠️  파일 없음:', inputPath);
        return;
    }

    // Excel 읽기
    console.log('  Excel 파일 로딩...');
    const workbook = XLSX.readFile(inputPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];

    console.log('  총', data.length, '개 행');

    // 인천만 필터 (실제 필드: 시도명, 공장주소, 공장주소_지번)
    const filtered = data.filter((row) => {
        const sido = row['시도명'] || '';
        const addr = row['공장주소'] || row['공장주소_지번'] || '';
        return sido.includes('인천') || addr.includes('인천');
    });

    console.log('  인천:', filtered.length, '개');

    // 공장 상세 데이터 (전체 속성)
    const factories = filtered.map((row, index) => {
        return {
            id: row['공장관리번호'] || 'factory-' + (index + 1),
            name: row['회사명'] || '공장 ' + (index + 1),
            address: row['공장주소'] || row['공장주소_지번'] || '',
            businessType: row['업종명'] || row['대표업종'] || '',
            employeeCount: parseInt(row['종업원합계'] || '0') || undefined,
            area: parseFloat(row['용지면적'] || '0') || undefined,
            coord: null as [number, number] | null,  // 지오코딩 필요
            knowledgeCenterName: row['지식산업센터명']?.trim() || undefined,
            sigName: row['시군구명'],
        };
    });

    // 공장 인덱스 데이터 (마커용 - id, name, coord, businessType만)
    const factoriesIndex = factories.map(f => ({
        id: f.id,
        name: f.name,
        coord: f.coord,
        businessType: f.businessType,
    }));

    // 출력 디렉토리 생성
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 상세 JSON 저장
    fs.writeFileSync(outputPath, JSON.stringify(factories, null, 2));
    console.log('  ✅ 상세 저장:', outputPath, '(' + factories.length + '개)');

    // 인덱스 JSON 저장 (압축, 공백 제거)
    fs.writeFileSync(indexOutputPath, JSON.stringify(factoriesIndex));
    const indexSize = (fs.statSync(indexOutputPath).size / 1024).toFixed(1);
    console.log('  ✅ 인덱스 저장:', indexOutputPath, '(' + factoriesIndex.length + '개,', indexSize + 'KB)');

    // 지오코딩이 필요한 항목 수 출력
    const needsGeocode = factories.filter(f => !f.coord).length;
    if (needsGeocode > 0) {
        console.log('  ⚠️  지오코딩 필요:', needsGeocode, '개');
    }
}

// 지식산업센터 데이터 파싱
async function parseKnowledgeCenters(): Promise<void> {
    console.log('\n🏢 지식산업센터 데이터 파싱...');

    const config = NON_SHP_SOURCES.knowledgeCenters;
    const inputPath = path.join(process.cwd(), 'rawdata', config.rawFiles[0]);
    const outputPath = path.join(process.cwd(), config.outputProperties);
    const indexOutputPath = outputPath.replace('.json', '-index.json');

    if (!fs.existsSync(inputPath)) {
        console.warn('  ⚠️  파일 없음:', inputPath);
        return;
    }

    // CSV 읽기 (CP949 인코딩)
    console.log('  CSV 파일 로딩 (CP949)...');
    const buffer = fs.readFileSync(inputPath);
    const content = iconv.decode(buffer, 'cp949');
    const data = parseCSV(content);

    console.log('  총', data.length, '개 행');

    // 인천만 필터 (실제 필드: 시도, 공장대표주소(도로명), 공장대표주소(지번))
    const filtered = data.filter((row) => {
        const sido = row['시도'] || '';
        const addr = row['공장대표주소(도로명)'] || row['공장대표주소(지번)'] || '';
        return sido.includes('인천') || addr.includes('인천');
    });

    console.log('  인천:', filtered.length, '개');

    // 지식산업센터 상세 데이터 (전체 속성)
    const centers = filtered.map((row, index) => {
        // 상태 파싱
        let status: '완료신고' | '신설승인' | '변경승인' = '완료신고';
        const rawStatus = row['상태'] || '';
        if (rawStatus.includes('신설')) status = '신설승인';
        if (rawStatus.includes('변경')) status = '변경승인';
        if (rawStatus.includes('완료')) status = '완료신고';

        return {
            id: 'kic-' + (index + 1),
            name: row['지식산업센터명'] || '지식산업센터 ' + (index + 1),
            roadAddress: row['공장대표주소(도로명)'] || '',
            jibunAddress: row['공장대표주소(지번)'] || '',
            status,
            saleType: row['분양형태'] as '분양' | '임대' | undefined,
            landArea: parseFloat(row['용지면적'] || '0') || undefined,
            buildingArea: parseFloat(row['건축면적'] || '0') || undefined,
            floors: parseInt(row['층수'] || '0') || undefined,
            coord: null as [number, number] | null,  // 지오코딩 필요
            sigName: row['시군구'],
            complexName: row['단지명'],
        };
    });

    // 지식산업센터 인덱스 데이터 (마커용 - id, name, coord, status만)
    const centersIndex = centers.map(c => ({
        id: c.id,
        name: c.name,
        coord: c.coord,
        status: c.status,
    }));

    // 출력 디렉토리 생성
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 상세 JSON 저장
    fs.writeFileSync(outputPath, JSON.stringify(centers, null, 2));
    console.log('  ✅ 상세 저장:', outputPath, '(' + centers.length + '개)');

    // 인덱스 JSON 저장 (압축, 공백 제거)
    fs.writeFileSync(indexOutputPath, JSON.stringify(centersIndex));
    const indexSize = (fs.statSync(indexOutputPath).size / 1024).toFixed(1);
    console.log('  ✅ 인덱스 저장:', indexOutputPath, '(' + centersIndex.length + '개,', indexSize + 'KB)');

    // 지오코딩이 필요한 항목 수 출력
    const needsGeocode = centers.filter(c => !c.coord).length;
    if (needsGeocode > 0) {
        console.log('  ⚠️  지오코딩 필요:', needsGeocode, '개');
    }
}

// 메인 함수
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    // 출력 디렉토리 생성
    const propsDir = path.join(process.cwd(), OUTPUT_DIRS.properties);
    if (!fs.existsSync(propsDir)) {
        fs.mkdirSync(propsDir, { recursive: true });
    }

    if (args.length === 0 || args.includes('factories')) {
        await parseFactories();
    }

    if (args.length === 0 || args.includes('knowledge-centers')) {
        await parseKnowledgeCenters();
    }

    console.log('\n✨ Excel/CSV 파싱 완료!');
}

main().catch(console.error);
