// scripts/geocode-and-match-pnu.ts
// 공장/지식산업센터 주소 → 지오코딩 → PNU 매칭 → 좌표 업데이트

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// .env.local 로드
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// 환경변수에서 API 키 읽기
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.error('❌ 환경변수 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 필요');
    console.log('.env.local 파일에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 설정 필요');
    process.exit(1);
}

console.log(`🔑 API 키 로드 완료: ${NAVER_CLIENT_ID.substring(0, 4)}...`);

const API_DELAY_MS = 100;
const BATCH_SIZE = 50;

interface Parcel {
    PNU: string;
    coord: [number, number];
    emdCode: string;
    jibun?: string;
}

interface Factory {
    id: string;
    name: string;
    address: string;
    coord: [number, number] | null;
    pnu?: string;
    [key: string]: any;
}

interface KnowledgeCenter {
    id: string;
    name: string;
    roadAddress: string;
    jibunAddress?: string;
    coord: [number, number] | null;
    pnu?: string;
    [key: string]: any;
}

// 필지 PNU → 좌표 맵 생성
function loadParcelMap(): Map<string, [number, number]> {
    const parcelsPath = path.join(process.cwd(), 'public/data/properties/parcels.json');
    const parcels: Parcel[] = JSON.parse(fs.readFileSync(parcelsPath, 'utf-8'));

    const map = new Map<string, [number, number]>();
    for (const p of parcels) {
        if (p.PNU && p.coord) {
            map.set(p.PNU, p.coord);
        }
    }

    console.log(`📦 필지 PNU 맵 생성: ${map.size}개`);
    return map;
}

// 읍면동 이름 → 코드 맵 생성
function loadEmdMap(): Map<string, string> {
    const parcelsPath = path.join(process.cwd(), 'public/data/properties/parcels.json');
    const parcels: Parcel[] = JSON.parse(fs.readFileSync(parcelsPath, 'utf-8'));

    // 각 emdCode에서 첫 번째 필지의 jibun에서 동 이름 추출
    const emdCodes = new Map<string, Set<string>>();

    for (const p of parcels) {
        if (p.emdCode && p.jibun) {
            if (!emdCodes.has(p.emdCode)) {
                emdCodes.set(p.emdCode, new Set());
            }
        }
    }

    // 행정구역 정보 로드
    const districtsPath = path.join(process.cwd(), 'public/data/properties/districts.json');
    if (fs.existsSync(districtsPath)) {
        const districts = JSON.parse(fs.readFileSync(districtsPath, 'utf-8'));
        const map = new Map<string, string>();

        for (const d of districts) {
            if (d.level === 'emd' && d.code) {
                // "논현동" → "2817110300"
                map.set(d.name, d.code);
            }
        }

        console.log(`📦 읍면동 맵 생성: ${map.size}개`);
        return map;
    }

    return new Map();
}

// 지오코딩 (주소 → 좌표)
async function geocodeAddress(address: string): Promise<{ coord: [number, number]; roadAddress?: string; jibunAddress?: string } | null> {
    try {
        const encodedAddress = encodeURIComponent(address);
        const url = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodedAddress}`;

        const response = await fetch(url, {
            headers: {
                'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
                'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
            },
        });

        if (!response.ok) return null;

        const data = await response.json();

        if (data.addresses && data.addresses.length > 0) {
            const addr = data.addresses[0];
            return {
                coord: [parseFloat(addr.x), parseFloat(addr.y)],
                roadAddress: addr.roadAddress,
                jibunAddress: addr.jibunAddress,
            };
        }

        return null;
    } catch (error) {
        return null;
    }
}

// 역지오코딩 (좌표 → 법정동 코드)
async function reverseGeocodeToEmdCode(lon: number, lat: number): Promise<string | null> {
    try {
        const coords = `${lon},${lat}`;
        const url = `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${coords}&output=json&orders=legalcode`;

        const response = await fetch(url, {
            headers: {
                'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
                'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
            },
        });

        if (!response.ok) return null;

        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const code = data.results[0].code;
            if (code && code.id) {
                return code.id; // 10자리 법정동 코드
            }
        }

        return null;
    } catch (error) {
        return null;
    }
}

// 지번 주소에서 본번/부번 추출
function parseJibun(jibunAddress: string): { bonbun: string; bubun: string; isSan: boolean } | null {
    const isSan = jibunAddress.includes(' 산 ') || / 산\d/.test(jibunAddress);

    // 다양한 지번 패턴
    // "123-45번지", "123번지", "123-45", "산 123-45번지"
    const patterns = [
        /(\d+)(?:-(\d+))?번지/,           // 123-45번지, 123번지
        /(\d+)-(\d+)(?!\d)/,               // 123-45 (뒤에 숫자 없음)
        /\s(\d+)(?:\s|$)/,                 // 공백 123 공백 또는 끝
    ];

    for (const pattern of patterns) {
        const match = jibunAddress.match(pattern);
        if (match) {
            const bonbun = match[1];
            const bubun = match[2] || '0';
            return { bonbun, bubun, isSan };
        }
    }

    return null;
}

// PNU 생성
function generatePNU(emdCode: string, bonbun: string, bubun: string, isSan: boolean): string | null {
    if (!emdCode || emdCode.length !== 10) return null;

    const bonbunPadded = bonbun.padStart(4, '0');
    const bubunPadded = bubun.padStart(4, '0');
    const daesanCode = isSan ? '2' : '1';

    const pnu = emdCode + daesanCode + bonbunPadded + bubunPadded;

    return pnu.length === 19 ? pnu : null;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 공장 처리
async function processFactories(parcelMap: Map<string, [number, number]>): Promise<void> {
    console.log('\n🏭 공장 지오코딩 시작...\n');

    const factoriesPath = path.join(process.cwd(), 'public/data/properties/factories.json');
    const factories: Factory[] = JSON.parse(fs.readFileSync(factoriesPath, 'utf-8'));

    const indexPath = path.join(process.cwd(), 'public/data/properties/factories-index.json');

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (let i = 0; i < factories.length; i++) {
        const factory = factories[i];

        // 이미 좌표가 있으면 스킵
        if (factory.coord && factory.coord[0] && factory.coord[1]) {
            skipCount++;
            continue;
        }

        if (!factory.address) {
            failCount++;
            continue;
        }

        // 1. 지오코딩으로 좌표 획득
        const geocodeResult = await geocodeAddress(factory.address);

        if (!geocodeResult) {
            failCount++;
            await delay(API_DELAY_MS);
            continue;
        }

        factory.coord = geocodeResult.coord;

        // 2. 역지오코딩으로 법정동 코드 획득
        const emdCode = await reverseGeocodeToEmdCode(geocodeResult.coord[0], geocodeResult.coord[1]);

        if (emdCode) {
            // 3. 지번 파싱
            const jibunAddr = geocodeResult.jibunAddress || factory.address;
            const parsed = parseJibun(jibunAddr);

            if (parsed) {
                // 4. PNU 생성
                const pnu = generatePNU(emdCode, parsed.bonbun, parsed.bubun, parsed.isSan);

                if (pnu) {
                    factory.pnu = pnu;

                    // 5. 필지 좌표로 보정 (더 정확한 좌표)
                    const parcelCoord = parcelMap.get(pnu);
                    if (parcelCoord) {
                        factory.coord = parcelCoord;
                    }
                }
            }
        }

        successCount++;
        await delay(API_DELAY_MS);

        // 진행 상황 출력
        if ((i + 1) % 100 === 0 || i === factories.length - 1) {
            console.log(`  진행: ${i + 1}/${factories.length} (성공: ${successCount}, 실패: ${failCount}, 스킵: ${skipCount})`);
        }

        // 중간 저장
        if ((i + 1) % BATCH_SIZE === 0) {
            fs.writeFileSync(factoriesPath, JSON.stringify(factories, null, 2));

            // 인덱스 파일 업데이트
            const index = factories.map(f => ({
                id: f.id,
                name: f.name,
                coord: f.coord,
                businessType: f.businessType,
            }));
            fs.writeFileSync(indexPath, JSON.stringify(index));

            console.log(`  💾 중간 저장 완료`);
        }
    }

    // 최종 저장
    fs.writeFileSync(factoriesPath, JSON.stringify(factories, null, 2));

    const index = factories.map(f => ({
        id: f.id,
        name: f.name,
        coord: f.coord,
        businessType: f.businessType,
    }));
    fs.writeFileSync(indexPath, JSON.stringify(index));

    console.log(`\n✅ 공장 지오코딩 완료`);
    console.log(`   - 성공: ${successCount}`);
    console.log(`   - 실패: ${failCount}`);
    console.log(`   - 스킵: ${skipCount}`);

    const withCoord = factories.filter(f => f.coord && f.coord[0]).length;
    console.log(`   - 좌표 보유: ${withCoord}/${factories.length} (${(withCoord/factories.length*100).toFixed(1)}%)`);
}

// 지식산업센터 처리
async function processKnowledgeCenters(parcelMap: Map<string, [number, number]>): Promise<void> {
    console.log('\n🏢 지식산업센터 지오코딩 시작...\n');

    const kcPath = path.join(process.cwd(), 'public/data/properties/knowledge-centers.json');
    const centers: KnowledgeCenter[] = JSON.parse(fs.readFileSync(kcPath, 'utf-8'));

    const indexPath = path.join(process.cwd(), 'public/data/properties/knowledge-centers-index.json');

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (let i = 0; i < centers.length; i++) {
        const kc = centers[i];

        // 이미 좌표가 있으면 스킵
        if (kc.coord && kc.coord[0] && kc.coord[1]) {
            skipCount++;
            continue;
        }

        // roadAddress 사용 (jibunAddress는 잘못된 데이터가 많음)
        const address = kc.roadAddress;
        if (!address) {
            failCount++;
            continue;
        }

        // 1. 지오코딩으로 좌표 획득
        const geocodeResult = await geocodeAddress(address);

        if (!geocodeResult) {
            // 이름으로 재시도
            const nameResult = await geocodeAddress(`인천 ${kc.name}`);
            if (!nameResult) {
                failCount++;
                console.log(`   ❌ 실패: ${kc.name}`);
                await delay(API_DELAY_MS);
                continue;
            }
            kc.coord = nameResult.coord;
        } else {
            kc.coord = geocodeResult.coord;
        }

        // 2. 역지오코딩으로 법정동 코드 획득
        const emdCode = await reverseGeocodeToEmdCode(kc.coord[0], kc.coord[1]);

        if (emdCode) {
            // 3. 지번 파싱
            const jibunAddr = geocodeResult?.jibunAddress || address;
            const parsed = parseJibun(jibunAddr);

            if (parsed) {
                // 4. PNU 생성
                const pnu = generatePNU(emdCode, parsed.bonbun, parsed.bubun, parsed.isSan);

                if (pnu) {
                    kc.pnu = pnu;

                    // 5. 필지 좌표로 보정
                    const parcelCoord = parcelMap.get(pnu);
                    if (parcelCoord) {
                        kc.coord = parcelCoord;
                    }
                }
            }
        }

        successCount++;
        console.log(`   ✅ ${kc.name}: [${kc.coord[0].toFixed(5)}, ${kc.coord[1].toFixed(5)}]`);
        await delay(API_DELAY_MS);
    }

    // 최종 저장
    fs.writeFileSync(kcPath, JSON.stringify(centers, null, 2));

    const index = centers.map(c => ({
        id: c.id,
        name: c.name,
        coord: c.coord,
        status: c.status,
    }));
    fs.writeFileSync(indexPath, JSON.stringify(index));

    console.log(`\n✅ 지식산업센터 지오코딩 완료`);
    console.log(`   - 성공: ${successCount}`);
    console.log(`   - 실패: ${failCount}`);
    console.log(`   - 스킵: ${skipCount}`);

    const withCoord = centers.filter(c => c.coord && c.coord[0]).length;
    console.log(`   - 좌표 보유: ${withCoord}/${centers.length} (${(withCoord/centers.length*100).toFixed(1)}%)`);
}

async function main(): Promise<void> {
    console.log('🔄 지오코딩 + PNU 매칭 시작...\n');

    // 필지 맵 로드
    const parcelMap = loadParcelMap();

    // 지식산업센터 처리 (적은 양이라 먼저)
    await processKnowledgeCenters(parcelMap);

    // 공장 처리
    await processFactories(parcelMap);

    console.log('\n✨ 완료!');
}

main().catch(console.error);
