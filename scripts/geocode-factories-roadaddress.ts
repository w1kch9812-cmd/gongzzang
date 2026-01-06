// scripts/geocode-factories-roadaddress.ts
// 좌표가 없는 공장을 도로명주소로 지오코딩 → PNU 변환

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const NAVER_CLIENT_ID = 's636cp22wi';
const NAVER_CLIENT_SECRET = 'hSGnpROTAE9w5PSwMUeeCDoHofkox1CkIk80fg1r';

const API_DELAY_MS = 100;
const BATCH_SIZE = 100;
const CHECKPOINT_FILE = 'geocode_factories_checkpoint.json';

// 지오코딩 (주소 → 좌표)
async function geocodeAddress(address: string): Promise<{ lon: number; lat: number } | null> {
    try {
        const url = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`;

        const response = await fetch(url, {
            headers: {
                'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
                'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
            },
        });

        if (!response.ok) return null;

        const data = await response.json();

        if (data.addresses && data.addresses.length > 0) {
            const result = data.addresses[0];
            return {
                lon: parseFloat(result.x),
                lat: parseFloat(result.y),
            };
        }

        return null;
    } catch (error) {
        console.error(`지오코딩 에러: ${error}`);
        return null;
    }
}

// 역지오코딩 (좌표 → 법정동 코드)
async function getEmdCodeFromCoord(lon: number, lat: number): Promise<string | null> {
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
                return code.id;
            }
        }

        return null;
    } catch (error) {
        return null;
    }
}

// 지번주소 파싱
function parseJibunNumber(jibunAddress: string): { bonbun: string; bubun: string; isSan: boolean } | null {
    const isSan = jibunAddress.includes(' 산 ');
    const pattern = /(\d+)(?:-(\d+))?번지/;
    const match = jibunAddress.match(pattern);

    if (!match) return null;

    const bonbun = match[1];
    const bubun = match[2] || '0';

    return { bonbun, bubun, isSan };
}

// PNU 생성
function generatePNU(emdCode: string, bonbun: string, bubun: string, isSan: boolean): string | null {
    if (emdCode.length !== 10) return null;

    const bonbunPadded = bonbun.padStart(4, '0');
    const bubunPadded = bubun.padStart(4, '0');
    const daesanCode = isSan ? '2' : '1';

    const pnu = emdCode + bonbunPadded + bubunPadded + daesanCode;

    if (pnu.length !== 19) return null;

    return pnu;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveCheckpoint(index: number, data: any[]): void {
    const checkpoint = { index, timestamp: new Date().toISOString() };
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint));

    const outputPath = path.join(process.cwd(), 'public/data/properties/factories.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
}

function loadCheckpoint(): { index: number } | null {
    if (!fs.existsSync(CHECKPOINT_FILE)) return null;
    try {
        return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    } catch {
        return null;
    }
}

async function main() {
    console.log('🔄 좌표 없는 공장 지오코딩 → PNU 변환\n');

    // 1. Excel 로드
    const excelPath = path.join(process.cwd(), 'rawdata/전국공장등록현황.xlsx');
    const wb = XLSX.readFile(excelPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData: any[] = XLSX.utils.sheet_to_json(ws);
    const incheonRaw = rawData.filter(row => row['시도명'] === '인천광역시');

    console.log(`📦 Excel: 인천 ${incheonRaw.length}개`);

    // 2. factories.json 로드
    const factoriesPath = path.join(process.cwd(), 'public/data/properties/factories.json');
    const factories = JSON.parse(fs.readFileSync(factoriesPath, 'utf-8'));

    console.log(`📝 factories.json: ${factories.length}개\n`);

    // 3. 좌표 없는 공장만 필터
    const noCoordFactories = factories.filter((f: any) => !f.coord || !f.coord[0] || !f.coord[1]);
    console.log(`🎯 좌표 없는 공장: ${noCoordFactories.length}개\n`);

    const checkpoint = loadCheckpoint();
    const startIndex = checkpoint ? checkpoint.index : 0;

    console.log(`시작 인덱스: ${startIndex}\n`);

    let geocodeSuccessCount = 0;
    let pnuSuccessCount = 0;
    let failCount = 0;

    for (let i = 0; i < factories.length; i++) {
        const factory = factories[i];

        // 좌표가 이미 있거나 PNU가 있으면 스킵
        if ((factory.coord && factory.coord[0] && factory.coord[1]) || (factory.pnu && factory.pnu.length === 19)) {
            continue;
        }

        // 체크포인트보다 이전이면 스킵
        if (i < startIndex) {
            continue;
        }

        // Excel에서 동일 회사 찾기
        const rawFactory = incheonRaw.find(r => r['회사명'] === factory.name);
        if (!rawFactory) {
            failCount++;
            continue;
        }

        const roadAddress = rawFactory['공장주소'];
        const jibunAddress = rawFactory['공장주소_지번'];

        if (!roadAddress && !jibunAddress) {
            failCount++;
            continue;
        }

        // 도로명주소 우선, 없으면 지번주소로 지오코딩
        const addressToGeocode = roadAddress || jibunAddress;
        const coord = await geocodeAddress(addressToGeocode);

        if (!coord) {
            failCount++;
            await delay(API_DELAY_MS);
            continue;
        }

        // 좌표 저장
        factory.coord = [coord.lon, coord.lat];
        geocodeSuccessCount++;

        // 역지오코딩으로 법정동 코드 획득
        const emdCode = await getEmdCodeFromCoord(coord.lon, coord.lat);

        if (!emdCode) {
            failCount++;
            await delay(API_DELAY_MS);
            continue;
        }

        // 지번주소가 있으면 PNU 생성
        if (jibunAddress) {
            const parsed = parseJibunNumber(jibunAddress);
            if (parsed) {
                const pnu = generatePNU(emdCode, parsed.bonbun, parsed.bubun, parsed.isSan);
                if (pnu) {
                    factory.pnu = pnu;
                    factory.emdCode = emdCode;
                    factory.jibunAddress = jibunAddress;
                    pnuSuccessCount++;
                }
            }
        }

        await delay(API_DELAY_MS);

        // 진행 상황
        if ((i + 1) % 100 === 0 || i === factories.length - 1) {
            console.log(`  진행: ${i + 1}/${factories.length} (지오코딩: ${geocodeSuccessCount}, PNU: ${pnuSuccessCount}, 실패: ${failCount})`);
        }

        // 체크포인트
        if ((i + 1) % BATCH_SIZE === 0) {
            saveCheckpoint(i + 1, factories);
            console.log(`  💾 체크포인트 저장`);
        }
    }

    // 최종 저장
    fs.writeFileSync(factoriesPath, JSON.stringify(factories, null, 2));

    console.log(`\n✅ 지오코딩 완료`);
    console.log(`   - 지오코딩 성공: ${geocodeSuccessCount}`);
    console.log(`   - PNU 생성 성공: ${pnuSuccessCount}`);
    console.log(`   - 실패: ${failCount}`);

    // 최종 통계
    const totalWithPNU = factories.filter((f: any) => f.pnu && f.pnu.length === 19).length;
    const totalWithCoord = factories.filter((f: any) => f.coord && f.coord[0] && f.coord[1]).length;

    console.log(`\n📊 최종 통계`);
    console.log(`   - 좌표 있음: ${totalWithCoord}/${factories.length} (${(totalWithCoord/factories.length*100).toFixed(1)}%)`);
    console.log(`   - PNU 있음: ${totalWithPNU}/${factories.length} (${(totalWithPNU/factories.length*100).toFixed(1)}%)`);

    // 체크포인트 삭제
    if (fs.existsSync(CHECKPOINT_FILE)) {
        fs.unlinkSync(CHECKPOINT_FILE);
        console.log('\n🗑️ 체크포인트 파일 삭제됨');
    }

    console.log('\n✨ 완료!');
}

main().catch(console.error);
