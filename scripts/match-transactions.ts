/**
 * 실거래가 데이터를 필지에 매칭하는 스크립트
 *
 * 매칭 전략:
 * 1. CSV에서 읍면동명 + 지번 추출
 * 2. 읍면동명 → emdCode 변환
 * 3. emdCode + 지번 → PNU 매칭
 * 4. 매칭된 필지에 transactions 배열 추가
 *
 * 제한사항:
 * - 토지 실거래가는 지번이 100% 마스킹되어 매칭 불가
 * - 공장창고 실거래가는 약 50%만 완전한 지번 제공
 */

import * as fs from 'fs';
import * as path from 'path';
import iconv from 'iconv-lite';

// 타입 정의
interface Transaction {
    date: string;      // YYYY-MM-DD
    price: number;     // 만원
    area?: number;     // 면적 (㎡)
    type?: string;     // 거래 유형
}

interface Parcel {
    pnu: string;
    jibun?: string;
    emdCode?: string;
    sigCode?: string;
    transactions?: Transaction[];
    transactionPrice?: number;
    [key: string]: unknown;
}

interface District {
    id: string;
    name: string;
    [key: string]: unknown;
}

interface CsvTransaction {
    emdName: string;      // 읍면동명
    jibun: string;        // 지번 (예: "649-3", "산4-1")
    date: string;         // YYYY-MM-DD
    price: number;        // 만원
    area?: number;        // 면적
    type: string;         // 공장창고 or 토지
}

// 경로 설정
const RAWDATA_DIR = path.join(process.cwd(), 'rawdata');
const DATA_DIR = path.join(process.cwd(), 'public/data/entities');

// CSV 파일 목록
const CSV_FILES = {
    factory: '공장창고등(매매)_실거래가_20260106171307.csv',
    land: '토지(매매)_실거래가_20260106171311.csv',
};

/**
 * CSV 파일 파싱 (cp949 인코딩)
 */
function parseCsv(filePath: string, type: 'factory' | 'land'): CsvTransaction[] {
    const buffer = fs.readFileSync(filePath);
    const content = iconv.decode(buffer, 'cp949');
    const lines = content.split('\n');

    const transactions: CsvTransaction[] = [];
    let headerFound = false;
    let columns: string[] = [];

    for (const line of lines) {
        // 헤더 찾기
        if (line.startsWith('"NO"')) {
            columns = line.split(',').map(c => c.replace(/"/g, '').trim());
            headerFound = true;
            continue;
        }

        if (!headerFound) continue;
        if (!line.includes('인천광역시')) continue;

        // CSV 파싱 (따옴표 내 콤마 처리)
        const values = parseCSVLine(line);
        if (values.length < 10) continue;

        if (type === 'factory') {
            // 공장창고등: 시군구(1), 지번(3), 거래금액(10), 계약년월(14), 계약일(15), 전용면적(8)
            const fullAddress = values[1];  // "인천광역시 남동구 고잔동"
            const jibun = values[3];        // "649-3" or "6**"
            const priceStr = values[10];    // "38,000"
            const yearMonth = values[14];   // "202512"
            const day = values[15];         // "29"
            const areaStr = values[8];      // "92.56"

            // 마스킹된 지번 스킵
            if (jibun.includes('*')) continue;

            // 읍면동명 추출
            const emdName = extractEmdName(fullAddress);
            if (!emdName) continue;

            // 날짜 파싱
            const date = formatDate(yearMonth, day);
            if (!date) continue;

            // 가격 파싱
            const price = parsePrice(priceStr);
            if (!price) continue;

            transactions.push({
                emdName,
                jibun: normalizeJibun(jibun),
                date,
                price,
                area: parseFloat(areaStr) || undefined,
                type: '공장창고',
            });
        } else {
            // 토지: 시군구(1), 번지(2), 거래금액(9), 계약년월(6), 계약일(7), 계약면적(8)
            const fullAddress = values[1];
            const jibun = values[2];
            const priceStr = values[9];
            const yearMonth = values[6];
            const day = values[7];
            const areaStr = values[8];

            // 마스킹된 지번 스킵
            if (jibun.includes('*')) continue;

            const emdName = extractEmdName(fullAddress);
            if (!emdName) continue;

            const date = formatDate(yearMonth, day);
            if (!date) continue;

            const price = parsePrice(priceStr);
            if (!price) continue;

            transactions.push({
                emdName,
                jibun: normalizeJibun(jibun),
                date,
                price,
                area: parseFloat(areaStr) || undefined,
                type: '토지',
            });
        }
    }

    return transactions;
}

/**
 * CSV 라인 파싱 (따옴표 처리)
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

/**
 * 주소에서 읍면동명 추출
 * "인천광역시 남동구 고잔동" → "고잔동"
 */
function extractEmdName(fullAddress: string): string | null {
    const parts = fullAddress.split(' ');
    if (parts.length >= 3) {
        return parts[2];  // 읍면동
    }
    return null;
}

/**
 * 날짜 포맷팅
 * "202512", "29" → "2025-12-29"
 */
function formatDate(yearMonth: string, day: string): string | null {
    if (!yearMonth || yearMonth.length !== 6) return null;

    const year = yearMonth.substring(0, 4);
    const month = yearMonth.substring(4, 6);
    const dayPadded = day.padStart(2, '0');

    return `${year}-${month}-${dayPadded}`;
}

/**
 * 가격 파싱
 * "38,000" → 38000
 */
function parsePrice(priceStr: string): number | null {
    const cleaned = priceStr.replace(/,/g, '').trim();
    const price = parseInt(cleaned, 10);
    return isNaN(price) ? null : price;
}

/**
 * 지번 정규화
 * "649-3" → "649-3"
 * "산4-1" → "산4-1"
 */
function normalizeJibun(jibun: string): string {
    return jibun.trim().replace(/\s+/g, '');
}

/**
 * 지번에서 본번/부번 추출
 * "649-3" → { main: 649, sub: 3, isSan: false }
 * "산4-1" → { main: 4, sub: 1, isSan: true }
 */
function parseJibun(jibun: string): { main: number; sub: number; isSan: boolean } | null {
    const isSan = jibun.startsWith('산');
    const cleaned = isSan ? jibun.substring(1) : jibun;

    const parts = cleaned.split('-');
    const main = parseInt(parts[0], 10);
    const sub = parts.length > 1 ? parseInt(parts[1], 10) : 0;

    if (isNaN(main)) return null;

    return { main, sub: isNaN(sub) ? 0 : sub, isSan };
}

/**
 * PNU 생성
 * emdCode(10자리) + 대지구분(1자리) + 본번(4자리) + 부번(4자리) = 19자리
 */
function buildPNU(emdCode: string, main: number, sub: number, isSan: boolean): string {
    const landType = isSan ? '2' : '1';  // 1=대, 2=산
    const mainStr = main.toString().padStart(4, '0');
    const subStr = sub.toString().padStart(4, '0');

    return `${emdCode}${landType}${mainStr}${subStr}`;
}

/**
 * 메인 함수
 */
async function main() {
    console.log('=== 실거래가 매칭 스크립트 ===\n');

    // 1. 기존 데이터 로드
    console.log('1. 기존 데이터 로드...');
    const parcelsPath = path.join(DATA_DIR, 'parcels.json');
    const emdPath = path.join(DATA_DIR, 'districts-emd.json');

    const parcels: Parcel[] = JSON.parse(fs.readFileSync(parcelsPath, 'utf-8'));
    const districts: District[] = JSON.parse(fs.readFileSync(emdPath, 'utf-8'));

    console.log(`   - 필지: ${parcels.length}개`);
    console.log(`   - 읍면동: ${districts.length}개`);

    // 2. 읍면동명 → 코드 맵 생성 (남동구만)
    const emdNameToCode = new Map<string, string>();
    districts
        .filter(d => d.id.startsWith('28200'))  // 남동구
        .forEach(d => {
            // 10자리 emdCode 생성 (8자리 + "00")
            emdNameToCode.set(d.name, d.id + '00');
        });
    console.log(`   - 남동구 읍면동 매핑: ${emdNameToCode.size}개`);

    // 3. PNU → 필지 인덱스 맵 생성
    const pnuToIndex = new Map<string, number>();
    parcels.forEach((p, i) => {
        pnuToIndex.set(p.pnu, i);
    });

    // 4. CSV 파일 파싱
    console.log('\n2. CSV 파일 파싱...');
    const allTransactions: CsvTransaction[] = [];

    // 공장창고 실거래가
    const factoryPath = path.join(RAWDATA_DIR, CSV_FILES.factory);
    if (fs.existsSync(factoryPath)) {
        const factoryTx = parseCsv(factoryPath, 'factory');
        console.log(`   - 공장창고: ${factoryTx.length}건 (완전한 지번)`);
        allTransactions.push(...factoryTx);
    }

    // 토지 실거래가 (현재 100% 마스킹되어 있어 스킵)
    const landPath = path.join(RAWDATA_DIR, CSV_FILES.land);
    if (fs.existsSync(landPath)) {
        const landTx = parseCsv(landPath, 'land');
        console.log(`   - 토지: ${landTx.length}건 (완전한 지번)`);
        allTransactions.push(...landTx);
    }

    console.log(`   - 총 파싱: ${allTransactions.length}건`);

    // 5. 필지에 거래 매칭
    console.log('\n3. 필지에 거래 매칭...');
    let matchedCount = 0;
    let unmatchedCount = 0;
    const unmatchedSamples: string[] = [];

    for (const tx of allTransactions) {
        // 읍면동 코드 찾기
        const emdCode = emdNameToCode.get(tx.emdName);
        if (!emdCode) {
            unmatchedCount++;
            if (unmatchedSamples.length < 3) {
                unmatchedSamples.push(`읍면동 못찾음: ${tx.emdName}`);
            }
            continue;
        }

        // 지번 파싱
        const parsed = parseJibun(tx.jibun);
        if (!parsed) {
            unmatchedCount++;
            if (unmatchedSamples.length < 3) {
                unmatchedSamples.push(`지번 파싱 실패: ${tx.jibun}`);
            }
            continue;
        }

        // PNU 생성
        const pnu = buildPNU(emdCode, parsed.main, parsed.sub, parsed.isSan);

        // 필지 찾기
        const parcelIndex = pnuToIndex.get(pnu);
        if (parcelIndex === undefined) {
            unmatchedCount++;
            if (unmatchedSamples.length < 5) {
                unmatchedSamples.push(`PNU 못찾음: ${pnu} (${tx.emdName} ${tx.jibun})`);
            }
            continue;
        }

        // 거래 추가
        const parcel = parcels[parcelIndex];
        if (!parcel.transactions) {
            parcel.transactions = [];
        }

        parcel.transactions.push({
            date: tx.date,
            price: tx.price,
            area: tx.area,
            type: tx.type,
        });

        matchedCount++;
    }

    console.log(`   - 매칭 성공: ${matchedCount}건`);
    console.log(`   - 매칭 실패: ${unmatchedCount}건`);
    if (unmatchedSamples.length > 0) {
        console.log('   - 실패 샘플:');
        unmatchedSamples.forEach(s => console.log(`     * ${s}`));
    }

    // 6. 거래 이력 정렬 및 최신 가격 업데이트
    console.log('\n4. 거래 이력 정렬 및 최신 가격 업데이트...');
    let updatedPriceCount = 0;

    for (const parcel of parcels) {
        if (parcel.transactions && parcel.transactions.length > 0) {
            // 날짜순 정렬 (최신 먼저)
            parcel.transactions.sort((a, b) => b.date.localeCompare(a.date));

            // 최신 거래가로 업데이트
            parcel.transactionPrice = parcel.transactions[0].price;
            updatedPriceCount++;
        }
    }

    console.log(`   - 가격 업데이트: ${updatedPriceCount}개 필지`);

    // 7. 결과 저장
    console.log('\n5. 결과 저장...');
    const outputPath = path.join(DATA_DIR, 'parcels.json');
    fs.writeFileSync(outputPath, JSON.stringify(parcels, null, 2), 'utf-8');
    console.log(`   - 저장: ${outputPath}`);

    // 8. 통계 출력
    console.log('\n=== 결과 요약 ===');
    const withTx = parcels.filter(p => p.transactions && p.transactions.length > 0);
    const multiTx = parcels.filter(p => p.transactions && p.transactions.length > 1);

    console.log(`총 필지: ${parcels.length}개`);
    console.log(`거래 이력 있음: ${withTx.length}개 (${(withTx.length/parcels.length*100).toFixed(2)}%)`);
    console.log(`복수 거래 이력: ${multiTx.length}개`);

    // 샘플 출력
    if (withTx.length > 0) {
        console.log('\n샘플 데이터:');
        withTx.slice(0, 3).forEach(p => {
            console.log(`  PNU: ${p.pnu}`);
            console.log(`  지번: ${p.jibun}`);
            console.log(`  거래: ${JSON.stringify(p.transactions)}`);
            console.log('');
        });
    }
}

main().catch(console.error);
