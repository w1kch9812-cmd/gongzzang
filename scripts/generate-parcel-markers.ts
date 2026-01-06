// scripts/generate-parcel-markers.ts
// parcels.geojson에서 마커용 경량 데이터 추출 (polylabel 좌표 사용)

import * as fs from 'fs';
import * as path from 'path';
import polylabel from 'polylabel';

// GeoJSON에서 polylabel 계산을 위한 입력 (폴리곤 데이터 필요)
const GEOJSON_PATH = path.join(process.cwd(), 'temp/parcels.geojson');
// 기존 parcels.json (폴백용)
const LEGACY_INPUT_PATH = path.join(process.cwd(), 'public/data/properties/parcels.json');
const OUTPUT_PATH = path.join(process.cwd(), 'public/data/properties/parcel-markers.json');

interface Transaction {
    date: string;
    price: number;
    type?: string;
}

// GeoJSON Feature 타입
interface GeoJSONFeature {
    type: 'Feature';
    properties: {
        PNU: string;
        jibun: string;
        BCHK: string;
        sigCode: string;
        emdCode: string;
        coord: [number, number]; // centroid (폴백용)
        area?: number;
        type?: number;
        transactionPrice?: number;
        listingPrice?: number;
        auctionPrice?: number;
    };
    geometry: {
        type: 'Polygon' | 'MultiPolygon';
        coordinates: number[][][] | number[][][][];
    };
}

interface GeoJSONCollection {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
}

interface ParcelProperty {
    PNU: string;
    id?: string;
    jibun: string;
    BCHK: string;
    sigCode: string;
    emdCode: string;
    coord: [number, number];
    area?: number;
    type?: number;
    transactionPrice?: number;
    listingPrice?: number;
    auctionPrice?: number;
    transactions?: Transaction[];
}

/**
 * 폴리곤에서 polylabel 좌표 계산
 * polylabel: 폴리곤 내부의 시각적 중심점 (가장 큰 내접원의 중심)
 */
function calculatePolylabel(geometry: GeoJSONFeature['geometry']): [number, number] | null {
    try {
        if (geometry.type === 'Polygon') {
            const coords = geometry.coordinates as number[][][];
            if (coords.length > 0 && coords[0].length >= 3) {
                const result = polylabel(coords, 0.000001); // precision ~11cm
                return [result[0], result[1]];
            }
        } else if (geometry.type === 'MultiPolygon') {
            // MultiPolygon: 가장 큰 폴리곤에서 polylabel 계산
            const polygons = geometry.coordinates as number[][][][];
            let maxArea = 0;
            let maxPolygon: number[][][] | null = null;

            for (const polygon of polygons) {
                if (polygon.length > 0 && polygon[0].length >= 3) {
                    // 간단한 면적 계산 (shoelace formula)
                    const ring = polygon[0];
                    let area = 0;
                    for (let i = 0; i < ring.length - 1; i++) {
                        area += ring[i][0] * ring[i + 1][1];
                        area -= ring[i + 1][0] * ring[i][1];
                    }
                    area = Math.abs(area) / 2;

                    if (area > maxArea) {
                        maxArea = area;
                        maxPolygon = polygon;
                    }
                }
            }

            if (maxPolygon) {
                const result = polylabel(maxPolygon, 0.000001);
                return [result[0], result[1]];
            }
        }
    } catch (e) {
        // polylabel 계산 실패 시 null 반환
    }
    return null;
}

interface ParcelMarker {
    id: string;
    coord: [number, number];
    type: number;
    area: number;
    jibun: string;
    sigCode: string;
    emdCode: string;
    transactionPrice?: number;
    listingPrice?: number;
    auctionPrice?: number;
    // 거래 이력: [[년월, 가격], ...] 형식 (축약형)
    x?: [number, number][];
}

async function main() {
    console.log('📦 필지 마커 데이터 생성 시작 (polylabel 좌표 사용)...');

    // GeoJSON 파일 확인 (폴리곤 데이터 필요)
    const useGeoJSON = fs.existsSync(GEOJSON_PATH);

    if (!useGeoJSON && !fs.existsSync(LEGACY_INPUT_PATH)) {
        console.error('❌ parcels.geojson 또는 parcels.json 파일이 없습니다.');
        console.log('   먼저 npm run data:shp 및 npm run data:props 를 실행하세요.');
        process.exit(1);
    }

    // 데이터 로드
    let parcels: ParcelProperty[] = [];
    let polylabelCoords: Map<string, [number, number]> = new Map();

    if (useGeoJSON) {
        console.log('   📍 GeoJSON에서 폴리곤 로드 및 polylabel 계산 중...');
        const geojson: GeoJSONCollection = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf-8'));
        console.log(`   총 ${geojson.features.length}개 피처 로드됨`);

        let polylabelCount = 0;
        let fallbackCount = 0;

        for (const feature of geojson.features) {
            const props = feature.properties;
            const pnu = props.PNU;

            // polylabel 계산
            const polylabelCoord = calculatePolylabel(feature.geometry);

            if (polylabelCoord) {
                polylabelCoords.set(pnu, polylabelCoord);
                polylabelCount++;
            } else if (props.coord) {
                // 폴백: 기존 centroid 사용
                polylabelCoords.set(pnu, props.coord);
                fallbackCount++;
            }

            // ParcelProperty 형식으로 변환
            parcels.push({
                PNU: pnu,
                jibun: props.jibun,
                BCHK: props.BCHK,
                sigCode: props.sigCode,
                emdCode: props.emdCode,
                coord: polylabelCoord || props.coord,
                area: props.area,
                type: props.type,
                transactionPrice: props.transactionPrice,
                listingPrice: props.listingPrice,
                auctionPrice: props.auctionPrice,
            });
        }

        console.log(`   ✅ polylabel 계산: ${polylabelCount}개`);
        if (fallbackCount > 0) {
            console.log(`   ⚠️ centroid 폴백: ${fallbackCount}개`);
        }
    } else {
        console.log('   ⚠️ GeoJSON 없음 - 기존 parcels.json 사용 (centroid 좌표)');
        parcels = JSON.parse(fs.readFileSync(LEGACY_INPUT_PATH, 'utf-8'));
        console.log(`   총 ${parcels.length}개 필지 로드됨`);
    }

    // 실거래가/매물/경매 데이터 로드 (있으면)
    let transactionPrices: Record<string, number> = {};
    let listingPrices: Record<string, number> = {};
    let auctionPrices: Record<string, number> = {};

    const transactionsPath = path.join(process.cwd(), 'public/data/properties/transactions.json');
    const listingsPath = path.join(process.cwd(), 'public/data/properties/listings.json');
    const auctionsPath = path.join(process.cwd(), 'public/data/properties/auctions.json');

    if (fs.existsSync(transactionsPath)) {
        try {
            const transactions = JSON.parse(fs.readFileSync(transactionsPath, 'utf-8'));
            for (const t of transactions) {
                if (t.pnu && t.price) {
                    transactionPrices[t.pnu] = t.price;
                }
            }
            console.log(`   실거래가 ${Object.keys(transactionPrices).length}건 로드됨`);
        } catch (e) {
            console.log('   ⚠️ 실거래가 데이터 로드 실패');
        }
    }

    if (fs.existsSync(listingsPath)) {
        try {
            const listings = JSON.parse(fs.readFileSync(listingsPath, 'utf-8'));
            for (const l of listings) {
                if (l.pnu && l.price) {
                    listingPrices[l.pnu] = l.price;
                }
            }
            console.log(`   매물 ${Object.keys(listingPrices).length}건 로드됨`);
        } catch (e) {
            console.log('   ⚠️ 매물 데이터 로드 실패');
        }
    }

    if (fs.existsSync(auctionsPath)) {
        try {
            const auctions = JSON.parse(fs.readFileSync(auctionsPath, 'utf-8'));
            for (const a of auctions) {
                if (a.pnu && a.minPrice) {
                    auctionPrices[a.pnu] = a.minPrice;
                }
            }
            console.log(`   경매 ${Object.keys(auctionPrices).length}건 로드됨`);
        } catch (e) {
            console.log('   ⚠️ 경매 데이터 로드 실패');
        }
    }

    // 마커 데이터 생성
    // 우선순위: parcels.json 내부 가격 > 별도 파일 가격
    const markers: ParcelMarker[] = parcels
        .filter(p => p.coord && p.coord[0] && p.coord[1]) // 좌표 있는 것만
        .map(p => {
            const pnu = p.PNU || p.id || '';

            // parcels.json 내부 가격 우선, 없으면 별도 파일에서
            const transactionPrice = p.transactionPrice || transactionPrices[pnu];
            const listingPrice = p.listingPrice || listingPrices[pnu];
            const auctionPrice = p.auctionPrice || auctionPrices[pnu];

            // 타입 플래그 계산: 1=실거래, 2=매물, 4=경매
            // parcels.json에 이미 type이 있으면 사용
            let type = p.type || 0;
            if (type === 0) {
                if (transactionPrice) type |= 1;
                if (listingPrice) type |= 2;
                if (auctionPrice) type |= 4;
            }

            const marker: ParcelMarker = {
                id: pnu,
                coord: p.coord,
                type,
                area: p.area || 0,
                jibun: p.jibun,
                sigCode: p.sigCode,
                emdCode: p.emdCode,
            };

            if (transactionPrice) marker.transactionPrice = transactionPrice;
            if (listingPrice) marker.listingPrice = listingPrice;
            if (auctionPrice) marker.auctionPrice = auctionPrice;

            // 거래 이력 추가 (축약형: [[년월, 가격], ...])
            if (p.transactions && p.transactions.length > 0) {
                marker.x = p.transactions
                    .filter(t => t.date && t.price)
                    .map(t => {
                        const [year, month] = t.date.split('-').map(Number);
                        const yearMonth = year * 100 + month; // 202401 형식
                        return [yearMonth, t.price] as [number, number];
                    })
                    .sort((a, b) => b[0] - a[0]); // 최신순 정렬
            }

            return marker;
        });

    // 저장
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(markers));

    // 통계
    const withTransaction = markers.filter(m => m.type & 1).length;
    const withListing = markers.filter(m => m.type & 2).length;
    const withAuction = markers.filter(m => m.type & 4).length;
    const withHistory = markers.filter(m => m.x && m.x.length > 0).length;
    const withMultipleHistory = markers.filter(m => m.x && m.x.length >= 2).length;

    console.log('');
    console.log(`✅ 마커 데이터 생성 완료: ${markers.length}개`);
    console.log(`   - 실거래가 있음: ${withTransaction}개`);
    console.log(`   - 매물 있음: ${withListing}개`);
    console.log(`   - 경매 있음: ${withAuction}개`);
    console.log(`   - 거래 이력 있음: ${withHistory}개`);
    console.log(`   - 2건 이상 이력: ${withMultipleHistory}개 (증감률 계산 가능)`);
    console.log(`   - 출력: ${OUTPUT_PATH}`);

    const size = (fs.statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(2);
    console.log(`   - 파일 크기: ${size} MB`);
}

main().catch(console.error);
