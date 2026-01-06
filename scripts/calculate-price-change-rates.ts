// scripts/calculate-price-change-rates.ts
// 각 필지별 가격 증감률 계산 (1년/3년/5년)
// parcels.json의 transactions 배열을 기반으로 계산

import * as fs from 'fs';
import * as path from 'path';

const INPUT_PATH = path.join(process.cwd(), 'public/data/properties/parcels.json');
const OUTPUT_PATH = path.join(process.cwd(), 'public/data/properties/parcels.json');

interface Transaction {
    date: string;
    price: number;
    type?: string;
}

interface Parcel {
    PNU?: string;
    id?: string;
    transactions?: Transaction[];
    transactionPrice?: number;
    // 새로 추가될 속성
    priceChangeRate1?: number;  // 1년 전 대비 증감률 (%)
    priceChangeRate3?: number;  // 3년 전 대비 증감률 (%)
    priceChangeRate5?: number;  // 5년 전 대비 증감률 (%)
    [key: string]: any;
}

/**
 * 증감률 계산 함수
 * @param transactions 거래 이력 (정렬되지 않음)
 * @param years 비교 기간 (년)
 * @returns 증감률 (%) 또는 null (계산 불가)
 */
function calculatePriceChangeRate(transactions: Transaction[], years: number): number | null {
    if (!transactions || transactions.length < 2) return null;

    // 날짜순 정렬 (최신순)
    const sorted = [...transactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const latestTransaction = sorted[0];
    const latestPrice = latestTransaction.price;
    const latestDate = new Date(latestTransaction.date);

    // N년 전 목표 날짜 계산
    const targetDate = new Date(latestDate);
    targetDate.setFullYear(targetDate.getFullYear() - years);

    // 목표 날짜와 가장 가까운 과거 거래 찾기
    let compareTransaction: Transaction | null = null;
    let minTimeDiff = Infinity;

    for (const transaction of sorted) {
        const transactionDate = new Date(transaction.date);
        if (transactionDate <= targetDate) {
            const timeDiff = Math.abs(targetDate.getTime() - transactionDate.getTime());
            if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                compareTransaction = transaction;
            }
        }
    }

    // 비교할 과거 거래가 없으면 null
    if (!compareTransaction) return null;

    // 증감률 계산 (%)
    const changeRate = ((latestPrice - compareTransaction.price) / compareTransaction.price) * 100;

    // 소수점 2자리까지
    return Math.round(changeRate * 100) / 100;
}

async function main() {
    console.log('📊 필지별 가격 증감률 계산 시작...');

    // 입력 파일 확인
    if (!fs.existsSync(INPUT_PATH)) {
        console.error('❌ parcels.json 파일이 없습니다.');
        process.exit(1);
    }

    // 데이터 로드
    const parcels: Parcel[] = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'));
    console.log(`   총 ${parcels.length}개 필지 로드됨`);

    // 통계
    let withTransactions = 0;
    let with2PlusTransactions = 0;
    let calculated1y = 0;
    let calculated3y = 0;
    let calculated5y = 0;

    // 각 필지별 증감률 계산
    for (const parcel of parcels) {
        if (!parcel.transactions || parcel.transactions.length === 0) continue;
        withTransactions++;

        if (parcel.transactions.length < 2) continue;
        with2PlusTransactions++;

        // 1년 증감률
        const rate1 = calculatePriceChangeRate(parcel.transactions, 1);
        if (rate1 !== null) {
            parcel.priceChangeRate1 = rate1;
            calculated1y++;
        }

        // 3년 증감률
        const rate3 = calculatePriceChangeRate(parcel.transactions, 3);
        if (rate3 !== null) {
            parcel.priceChangeRate3 = rate3;
            calculated3y++;
        }

        // 5년 증감률
        const rate5 = calculatePriceChangeRate(parcel.transactions, 5);
        if (rate5 !== null) {
            parcel.priceChangeRate5 = rate5;
            calculated5y++;
        }
    }

    // 저장
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(parcels, null, 2));

    console.log('');
    console.log(`✅ 가격 증감률 계산 완료!`);
    console.log(`   - 거래 이력 있음: ${withTransactions}개`);
    console.log(`   - 2건 이상 이력: ${with2PlusTransactions}개`);
    console.log(`   - 1년 증감률 계산됨: ${calculated1y}개`);
    console.log(`   - 3년 증감률 계산됨: ${calculated3y}개`);
    console.log(`   - 5년 증감률 계산됨: ${calculated5y}개`);
    console.log(`   - 출력: ${OUTPUT_PATH}`);

    // 샘플 출력
    const samplesWithRate = parcels.filter(p => p.priceChangeRate3 !== undefined).slice(0, 5);
    if (samplesWithRate.length > 0) {
        console.log('\n📋 샘플 (3년 증감률 있는 필지):');
        for (const p of samplesWithRate) {
            const id = p.PNU || p.id;
            console.log(`   ${id}: ${p.priceChangeRate1?.toFixed(1)}% (1년) / ${p.priceChangeRate3?.toFixed(1)}% (3년) / ${p.priceChangeRate5?.toFixed(1) || 'N/A'}% (5년)`);
        }
    }
}

main().catch(console.error);
