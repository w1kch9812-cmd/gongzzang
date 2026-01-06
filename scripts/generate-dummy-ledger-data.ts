/**
 * 토지대장/건축물대장/실거래가 더미 데이터 생성 스크립트
 *
 * 참고 API:
 * - 토지대장: https://www.vworld.kr/dtna/dtna_apiSvcFc_s001.do?apiNum=128
 * - 건축물대장: https://www.data.go.kr/data/15134735/openapi.do
 *
 * 생성 데이터:
 * 1. 토지대장: 공부상 면적, 지목, 소유구분
 * 2. 건축물대장: 건축면적, 연면적, 용도, 층수, 구조
 * 3. 실거래 이력: 최근 5년간 거래 내역
 */

import * as fs from 'fs';
import * as path from 'path';

// 타입 정의
interface LandLedger {
    lndpclAr: number;           // 면적(㎡) - 공부상 면적
    lndcgrCode: string;         // 지목코드
    lndcgrCodeNm: string;       // 지목명
    posesnSeCode: string;       // 소유구분코드
    posesnSeCodeNm: string;     // 소유구분명
    lastUpdtDt: string;         // 데이터기준일자
}

interface BuildingLedger {
    archArea: number;           // 건축면적(㎡)
    totArea: number;            // 연면적(㎡)
    platArea: number;           // 대지면적(㎡)
    mainPurpsCdNm: string;      // 주용도
    grndFlrCnt: number;         // 지상층수
    ugrndFlrCnt: number;        // 지하층수
    bcRat: number;              // 건폐율(%)
    vlRat: number;              // 용적률(%)
    strctCdNm: string;          // 구조
    heit: number;               // 높이(m)
    useAprDay: string;          // 사용승인일
}

interface Transaction {
    date: string;               // YYYY-MM-DD
    price: number;              // 만원
    area?: number;              // 거래 면적
    type?: string;              // 거래 유형
}

interface Parcel {
    pnu: string;
    jibun?: string;
    area: number;
    emdCode?: string;
    center: [number, number];
    type: number;
    landLedger?: LandLedger;
    buildingLedger?: BuildingLedger;
    transactions?: Transaction[];
    transactionPrice?: number;
    [key: string]: unknown;
}

// 지목 코드 및 명칭
const LAND_CATEGORIES = [
    { code: '01', name: '전' },
    { code: '02', name: '답' },
    { code: '03', name: '과수원' },
    { code: '04', name: '목장용지' },
    { code: '05', name: '임야' },
    { code: '07', name: '대' },
    { code: '08', name: '공장용지' },
    { code: '09', name: '학교용지' },
    { code: '10', name: '주차장' },
    { code: '11', name: '주유소용지' },
    { code: '12', name: '창고용지' },
    { code: '13', name: '도로' },
    { code: '14', name: '철도용지' },
    { code: '18', name: '잡종지' },
];

// 소유구분
const OWNERSHIP_TYPES = [
    { code: '01', name: '개인' },
    { code: '02', name: '국유지' },
    { code: '03', name: '시/도유지' },
    { code: '04', name: '군유지' },
    { code: '05', name: '법인' },
    { code: '06', name: '종중' },
    { code: '07', name: '종교단체' },
];

// 건물 주용도
const BUILDING_PURPOSES = [
    '공장',
    '창고시설',
    '제1종근린생활시설',
    '제2종근린생활시설',
    '판매시설',
    '운수시설',
    '업무시설',
    '숙박시설',
    '위락시설',
    '자동차관련시설',
];

// 건물 구조
const BUILDING_STRUCTURES = [
    '철근콘크리트구조',
    '철골구조',
    '철골철근콘크리트구조',
    '조적구조',
    '목구조',
    '철골조',
    '경량철골구조',
];

// 랜덤 유틸리티
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
    const val = Math.random() * (max - min) + min;
    return parseFloat(val.toFixed(decimals));
}

function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(startYear: number, endYear: number): string {
    const year = randomInt(startYear, endYear);
    const month = randomInt(1, 12).toString().padStart(2, '0');
    const day = randomInt(1, 28).toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 토지대장 더미 데이터 생성
 */
function generateLandLedger(baseArea: number): LandLedger {
    // 공부상 면적은 실제 면적과 약간 다를 수 있음 (측량 오차)
    const variation = randomFloat(0.95, 1.05);
    const officialArea = Math.round(baseArea * variation * 100) / 100;

    const category = randomChoice(LAND_CATEGORIES);
    const ownership = randomChoice(OWNERSHIP_TYPES);

    return {
        lndpclAr: officialArea,
        lndcgrCode: category.code,
        lndcgrCodeNm: category.name,
        posesnSeCode: ownership.code,
        posesnSeCodeNm: ownership.name,
        lastUpdtDt: randomDate(2020, 2025),
    };
}

/**
 * 건축물대장 더미 데이터 생성
 */
function generateBuildingLedger(landArea: number): BuildingLedger | null {
    // 70% 확률로 건물 있음
    if (Math.random() > 0.7) return null;

    const bcRat = randomFloat(40, 70);  // 건폐율 40-70%
    const archArea = Math.round(landArea * (bcRat / 100) * 100) / 100;

    const floors = randomInt(1, 6);
    const basementFloors = Math.random() > 0.7 ? randomInt(1, 2) : 0;

    const vlRat = randomFloat(100, 300);  // 용적률 100-300%
    const totArea = Math.round(landArea * (vlRat / 100) * 100) / 100;

    const floorHeight = randomFloat(3.5, 5);
    const height = floors * floorHeight;

    return {
        archArea,
        totArea,
        platArea: landArea,
        mainPurpsCdNm: randomChoice(BUILDING_PURPOSES),
        grndFlrCnt: floors,
        ugrndFlrCnt: basementFloors,
        bcRat,
        vlRat,
        strctCdNm: randomChoice(BUILDING_STRUCTURES),
        heit: Math.round(height * 10) / 10,
        useAprDay: randomDate(1990, 2024),
    };
}

/**
 * 실거래 이력 더미 데이터 생성
 */
function generateTransactions(landArea: number, hasBuilding: boolean): Transaction[] {
    // 거래 횟수: 0-5회
    const txCount = randomInt(0, 5);
    if (txCount === 0) return [];

    const transactions: Transaction[] = [];

    // 기준 평당가 (만원/평): 공장용지 기준 300-800만원
    const basePricePerPyeong = randomInt(300, 800);
    const pyeong = landArea / 3.3058;

    // 건물이 있으면 가격 상승
    const buildingMultiplier = hasBuilding ? randomFloat(1.3, 2.0) : 1;

    let basePrice = Math.round(pyeong * basePricePerPyeong * buildingMultiplier);

    for (let i = 0; i < txCount; i++) {
        // 연도별 가격 변동 (-10% ~ +15%)
        const yearVariation = randomFloat(0.9, 1.15);
        const price = Math.round(basePrice * yearVariation);

        const year = 2025 - (txCount - i - 1);  // 최신순
        const date = randomDate(year, year);

        transactions.push({
            date,
            price,
            area: hasBuilding ? randomFloat(landArea * 0.4, landArea * 0.7) : landArea,
            type: hasBuilding ? '공장창고' : '토지',
        });

        // 다음 거래를 위한 기준가 업데이트
        basePrice = price;
    }

    // 날짜순 정렬 (최신 먼저)
    transactions.sort((a, b) => b.date.localeCompare(a.date));

    return transactions;
}

/**
 * 메인 함수
 */
async function main() {
    console.log('=== 토지대장/건축물대장/실거래가 더미 데이터 생성 ===\n');

    // 1. 기존 parcels.json 로드
    const parcelsPath = path.join(process.cwd(), 'public/data/entities/parcels.json');
    console.log('1. parcels.json 로드...');

    const parcels: Parcel[] = JSON.parse(fs.readFileSync(parcelsPath, 'utf-8'));
    console.log(`   - 총 필지: ${parcels.length}개`);

    // 2. 더미 데이터 생성
    console.log('\n2. 더미 데이터 생성...');

    let landLedgerCount = 0;
    let buildingLedgerCount = 0;
    let transactionCount = 0;
    let totalTransactions = 0;

    for (const parcel of parcels) {
        const baseArea = parcel.area || randomFloat(100, 2000);

        // 토지대장 생성 (모든 필지)
        parcel.landLedger = generateLandLedger(baseArea);
        landLedgerCount++;

        // 건축물대장 생성 (70% 확률)
        const buildingLedger = generateBuildingLedger(baseArea);
        if (buildingLedger) {
            parcel.buildingLedger = buildingLedger;
            buildingLedgerCount++;
        }

        // 실거래 이력 생성
        const transactions = generateTransactions(baseArea, !!buildingLedger);
        if (transactions.length > 0) {
            parcel.transactions = transactions;
            parcel.transactionPrice = transactions[0].price;
            parcel.type = parcel.type | 1;  // 실거래 플래그 설정
            transactionCount++;
            totalTransactions += transactions.length;
        }
    }

    console.log(`   - 토지대장: ${landLedgerCount}개`);
    console.log(`   - 건축물대장: ${buildingLedgerCount}개`);
    console.log(`   - 실거래 필지: ${transactionCount}개`);
    console.log(`   - 총 거래건수: ${totalTransactions}건`);

    // 3. 저장
    console.log('\n3. 결과 저장...');
    fs.writeFileSync(parcelsPath, JSON.stringify(parcels, null, 2), 'utf-8');
    console.log(`   - 저장: ${parcelsPath}`);

    // 4. 샘플 출력
    console.log('\n=== 샘플 데이터 ===');
    const samples = parcels.filter(p => p.transactions && p.transactions.length > 1).slice(0, 3);

    for (const sample of samples) {
        console.log(`\nPNU: ${sample.pnu}`);
        console.log(`지번: ${sample.jibun}`);
        console.log(`토지대장:`);
        console.log(`  - 면적: ${sample.landLedger?.lndpclAr}㎡`);
        console.log(`  - 지목: ${sample.landLedger?.lndcgrCodeNm}`);
        console.log(`  - 소유구분: ${sample.landLedger?.posesnSeCodeNm}`);
        if (sample.buildingLedger) {
            console.log(`건축물대장:`);
            console.log(`  - 건축면적: ${sample.buildingLedger.archArea}㎡`);
            console.log(`  - 연면적: ${sample.buildingLedger.totArea}㎡`);
            console.log(`  - 용도: ${sample.buildingLedger.mainPurpsCdNm}`);
            console.log(`  - 층수: 지상${sample.buildingLedger.grndFlrCnt}/지하${sample.buildingLedger.ugrndFlrCnt}`);
        }
        console.log(`거래이력 (${sample.transactions?.length}건):`);
        sample.transactions?.forEach(tx => {
            console.log(`  - ${tx.date}: ${tx.price.toLocaleString()}만원 (${tx.area?.toFixed(1)}㎡)`);
        });
    }

    // 5. 통계
    console.log('\n=== 통계 ===');
    const withMultipleTx = parcels.filter(p => p.transactions && p.transactions.length > 1);
    console.log(`복수 거래 필지: ${withMultipleTx.length}개`);

    const avgTxCount = totalTransactions / transactionCount;
    console.log(`평균 거래횟수: ${avgTxCount.toFixed(2)}회`);

    // 지목 분포
    const categoryDist: Record<string, number> = {};
    parcels.forEach(p => {
        const cat = p.landLedger?.lndcgrCodeNm || '미상';
        categoryDist[cat] = (categoryDist[cat] || 0) + 1;
    });
    console.log('\n지목 분포:');
    Object.entries(categoryDist)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([cat, count]) => {
            console.log(`  - ${cat}: ${count}개 (${(count/parcels.length*100).toFixed(1)}%)`);
        });
}

main().catch(console.error);
