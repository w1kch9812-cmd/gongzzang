// scripts/generate-sample-data.ts
// 샘플 실거래/매물/경매 데이터 생성

import * as fs from 'fs';
import * as path from 'path';

// 랜덤 숫자 생성
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 랜덤 날짜 생성 (최근 5년)
function randomDate(): string {
    const year = randomInt(2020, 2024);
    const month = String(randomInt(1, 12)).padStart(2, '0');
    const day = String(randomInt(1, 28)).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 필지 샘플 데이터 생성
async function generateParcelSampleData(): Promise<void> {
    console.log('\n📊 필지 샘플 데이터 생성...');

    const inputPath = path.join(process.cwd(), 'public/data/properties/parcels.json');
    const outputPath = inputPath; // 덮어쓰기

    if (!fs.existsSync(inputPath)) {
        console.warn('  ⚠️  parcels.json 없음');
        return;
    }

    const parcels = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    console.log(`  총 ${parcels.length}개 필지`);

    // 샘플 데이터 비율
    const TRANSACTION_RATIO = 0.3;  // 30% 실거래
    const LISTING_RATIO = 0.1;      // 10% 매물
    const AUCTION_RATIO = 0.02;     // 2% 경매

    let transactionCount = 0;
    let listingCount = 0;
    let auctionCount = 0;

    const enrichedParcels = parcels.map((parcel: any) => {
        const result = { ...parcel };

        // 면적 기반 기본 가격 (만원/㎡)
        const basePrice = randomInt(100, 500); // 100~500만원/㎡
        const area = parcel.area || randomInt(100, 1000);
        result.area = area;

        // 실거래 데이터 (30% 확률)
        if (Math.random() < TRANSACTION_RATIO) {
            const price = Math.round(basePrice * area * (0.8 + Math.random() * 0.4));
            result.transactionPrice = price;
            result.transactionDate = randomDate();

            // 거래 내역 (1~3건)
            result.transactions = [];
            const txCount = randomInt(1, 3);
            let prevPrice = price;
            for (let i = 0; i < txCount; i++) {
                const txPrice = Math.round(prevPrice * (0.85 + Math.random() * 0.3));
                result.transactions.push({
                    date: randomDate(),
                    price: txPrice,
                    type: Math.random() > 0.3 ? '토지' : '토지+건물',
                });
                prevPrice = txPrice;
            }
            result.transactions.sort((a: any, b: any) => b.date.localeCompare(a.date));
            transactionCount++;
        }

        // 매물 데이터 (10% 확률)
        if (Math.random() < LISTING_RATIO) {
            const price = Math.round(basePrice * area * (1.0 + Math.random() * 0.3));
            result.listingPrice = price;

            result.listings = [{
                id: `listing-${parcel.id || parcel.PNU}`,
                price,
                dealType: Math.random() > 0.7 ? '전세' : '매매',
                source: ['네이버', '직방', '다방'][randomInt(0, 2)],
            }];
            listingCount++;
        }

        // 경매 데이터 (2% 확률)
        if (Math.random() < AUCTION_RATIO) {
            const appraisedPrice = Math.round(basePrice * area);
            const minPrice = Math.round(appraisedPrice * (0.5 + Math.random() * 0.3));
            result.auctionPrice = minPrice;

            result.auctions = [{
                id: `auction-${parcel.id || parcel.PNU}`,
                minPrice,
                appraisedPrice,
                failCount: randomInt(0, 3),
                date: randomDate(),
                court: '인천지방법원',
            }];
            auctionCount++;
        }

        // type 비트 플래그 계산 (1=실거래, 2=매물, 4=경매)
        let type = 0;
        if (result.transactionPrice) type |= 1;
        if (result.listingPrice) type |= 2;
        if (result.auctionPrice) type |= 4;
        result.type = type;

        return result;
    });

    // 저장
    fs.writeFileSync(outputPath, JSON.stringify(enrichedParcels, null, 2));

    console.log(`  ✅ 샘플 데이터 생성 완료:`);
    console.log(`     - 실거래: ${transactionCount}개 (${(transactionCount / parcels.length * 100).toFixed(1)}%)`);
    console.log(`     - 매물: ${listingCount}개 (${(listingCount / parcels.length * 100).toFixed(1)}%)`);
    console.log(`     - 경매: ${auctionCount}개 (${(auctionCount / parcels.length * 100).toFixed(1)}%)`);
}

// 행정구역 집계 데이터 생성
async function generateDistrictAggregations(): Promise<void> {
    console.log('\n📊 행정구역 집계 데이터 생성...');

    // 필지 데이터 로드
    const parcelsPath = path.join(process.cwd(), 'public/data/properties/parcels.json');
    if (!fs.existsSync(parcelsPath)) {
        console.warn('  ⚠️  parcels.json 없음');
        return;
    }
    const parcels = JSON.parse(fs.readFileSync(parcelsPath, 'utf-8'));

    // 시군구별 집계
    const sigAgg: Record<string, any> = {};
    const emdAgg: Record<string, any> = {};

    for (const parcel of parcels) {
        const sigCode = parcel.sigCode || (parcel.PNU ? parcel.PNU.substring(0, 5) : null);
        const emdCode = parcel.emdCode || (parcel.PNU ? parcel.PNU.substring(0, 10) : null);

        if (sigCode) {
            if (!sigAgg[sigCode]) {
                sigAgg[sigCode] = { parcelCount: 0, listingCount: 0, auctionCount: 0, totalPrice: 0, priceCount: 0 };
            }
            sigAgg[sigCode].parcelCount++;
            if (parcel.listingPrice) sigAgg[sigCode].listingCount++;
            if (parcel.auctionPrice) sigAgg[sigCode].auctionCount++;
            if (parcel.transactionPrice) {
                sigAgg[sigCode].totalPrice += parcel.transactionPrice;
                sigAgg[sigCode].priceCount++;
            }
        }

        if (emdCode) {
            if (!emdAgg[emdCode]) {
                emdAgg[emdCode] = { parcelCount: 0, listingCount: 0, auctionCount: 0, totalPrice: 0, priceCount: 0 };
            }
            emdAgg[emdCode].parcelCount++;
            if (parcel.listingPrice) emdAgg[emdCode].listingCount++;
            if (parcel.auctionPrice) emdAgg[emdCode].auctionCount++;
            if (parcel.transactionPrice) {
                emdAgg[emdCode].totalPrice += parcel.transactionPrice;
                emdAgg[emdCode].priceCount++;
            }
        }
    }

    // 시군구 JSON 업데이트
    const sigPath = path.join(process.cwd(), 'public/data/properties/districts-sig.json');
    if (fs.existsSync(sigPath)) {
        const sigDistricts = JSON.parse(fs.readFileSync(sigPath, 'utf-8'));
        const updatedSig = sigDistricts.map((d: any) => {
            const agg = sigAgg[d.code] || { parcelCount: 0, listingCount: 0, auctionCount: 0, totalPrice: 0, priceCount: 0 };
            return {
                ...d,
                id: d.code,
                level: 'sig',
                parcelCount: agg.parcelCount,
                listingCount: agg.listingCount,
                auctionCount: agg.auctionCount,
                avgPrice: agg.priceCount > 0 ? Math.round(agg.totalPrice / agg.priceCount) : 0,
            };
        });
        fs.writeFileSync(sigPath, JSON.stringify(updatedSig, null, 2));
        console.log(`  ✅ 시군구 집계: ${updatedSig.length}개`);
    }

    // 읍면동 JSON 업데이트
    const emdPath = path.join(process.cwd(), 'public/data/properties/districts-emd.json');
    if (fs.existsSync(emdPath)) {
        const emdDistricts = JSON.parse(fs.readFileSync(emdPath, 'utf-8'));
        const updatedEmd = emdDistricts.map((d: any) => {
            const agg = emdAgg[d.code] || { parcelCount: 0, listingCount: 0, auctionCount: 0, totalPrice: 0, priceCount: 0 };
            return {
                ...d,
                id: d.code,
                level: 'emd',
                parcelCount: agg.parcelCount,
                listingCount: agg.listingCount,
                auctionCount: agg.auctionCount,
                avgPrice: agg.priceCount > 0 ? Math.round(agg.totalPrice / agg.priceCount) : 0,
            };
        });
        fs.writeFileSync(emdPath, JSON.stringify(updatedEmd, null, 2));
        console.log(`  ✅ 읍면동 집계: ${updatedEmd.length}개`);
    }
}

// 마커 데이터 재생성
async function regenerateMarkerData(): Promise<void> {
    console.log('\n📍 마커 데이터 재생성...');

    const parcelsPath = path.join(process.cwd(), 'public/data/properties/parcels.json');
    const outputPath = path.join(process.cwd(), 'public/data/properties/parcel-markers.json');

    if (!fs.existsSync(parcelsPath)) {
        console.warn('  ⚠️  parcels.json 없음');
        return;
    }

    const parcels = JSON.parse(fs.readFileSync(parcelsPath, 'utf-8'));

    // 마커 데이터 포맷
    const markers = parcels.map((p: any) => ({
        id: p.id || p.PNU,
        coord: p.coord,
        type: p.type || 0,
        area: p.area || 0,
        transactionPrice: p.transactionPrice,
        listingPrice: p.listingPrice,
        auctionPrice: p.auctionPrice,
        jibun: p.jibun,
        sigCode: p.sigCode,
        emdCode: p.emdCode,
    }));

    fs.writeFileSync(outputPath, JSON.stringify(markers));
    const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
    console.log(`  ✅ 마커 데이터 저장: ${outputPath} (${sizeMB}MB)`);
}

// 메인 함수
async function main(): Promise<void> {
    console.log('🎲 샘플 데이터 생성 시작...\n');

    await generateParcelSampleData();
    await generateDistrictAggregations();
    await regenerateMarkerData();

    console.log('\n✨ 샘플 데이터 생성 완료!');
}

main().catch(console.error);
