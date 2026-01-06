// scripts/reverse-geocode-to-pnu.ts
// 좌표 → 역지오코딩 → PNU 변환

import * as fs from 'fs';
import * as path from 'path';

// 네이버 클라우드 플랫폼 API 키
const NAVER_CLIENT_ID = 's636cp22wi';
const NAVER_CLIENT_SECRET = 'hSGnpROTAE9w5PSwMUeeCDoHofkox1CkIk80fg1r';

// API 호출 제한
const API_DELAY_MS = 100;
const BATCH_SIZE = 100;

interface ReverseGeocodeResult {
    success: boolean;
    pnu?: string;
    address?: string;
    error?: string;
}

// 체크포인트 파일
const CHECKPOINT_FILE = 'reverse_geocode_checkpoint.json';

// 역지오코딩 API 호출 (네이버)
async function reverseGeocode(lon: number, lat: number): Promise<ReverseGeocodeResult> {
    try {
        const coords = `${lon},${lat}`;
        const url = `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${coords}&output=json&orders=legalcode,addr`;

        const response = await fetch(url, {
            headers: {
                'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
                'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `HTTP ${response.status}: ${errorText.substring(0, 100)}` };
        }

        const data = await response.json();

        // addr 결과에서 land 정보 추출
        if (data.results && data.results.length > 0) {
            // addr 결과 찾기 (land 정보 포함)
            const addrResult = data.results.find((r: any) => r.name === 'addr');
            if (!addrResult) {
                return { success: false, error: 'addr 결과 없음' };
            }

            const region = addrResult.region;
            const land = addrResult.land;

            if (!region) {
                return { success: false, error: 'region 정보 없음' };
            }

            if (!land) {
                return { success: false, error: 'land 정보 없음' };
            }

            // 법정동 코드 (code.id에서 추출)
            const emdCode = addrResult.code?.id || '';

            if (emdCode.length !== 10) {
                return { success: false, error: `법정동 코드 오류: ${emdCode}` };
            }

            // 지번 정보
            const bonbun = String(land.number1 || 0).padStart(4, '0');
            const bubun = String(land.number2 || 0).padStart(4, '0');

            // 대산 코드 (1: 대지, 2: 산)
            const daesanCode = land.type === '1' ? '1' : '2';

            // PNU 조합 (19자리)
            const pnu = emdCode + bonbun + bubun + daesanCode;

            if (pnu.length !== 19) {
                return { success: false, error: `PNU 길이 오류: ${pnu} (${pnu.length}자)` };
            }

            const address = `${region.area1?.name} ${region.area2?.name} ${region.area3?.name} ${land.number1}${land.number2 ? '-' + land.number2 : ''}`;

            return {
                success: true,
                pnu,
                address,
            };
        }

        return { success: false, error: '결과 없음' };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

// 딜레이 함수
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 체크포인트 저장
function saveCheckpoint(type: string, index: number, data: any[]): void {
    const checkpoint = {
        type,
        index,
        timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint));

    // 데이터도 함께 저장
    const outputPath = path.join(process.cwd(), `public/data/properties/${type}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
}

// 체크포인트 로드
function loadCheckpoint(): { type: string; index: number } | null {
    if (!fs.existsSync(CHECKPOINT_FILE)) return null;
    try {
        return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    } catch {
        return null;
    }
}

// 지식산업센터 역지오코딩
async function processKnowledgeCenters(): Promise<void> {
    console.log('\n🏢 지식산업센터 역지오코딩 → PNU...');

    const inputPath = path.join(process.cwd(), 'public/data/properties/knowledge-centers.json');
    if (!fs.existsSync(inputPath)) {
        console.warn('  ⚠️  knowledge-centers.json 없음');
        return;
    }

    const centers = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    const checkpoint = loadCheckpoint();
    const startIndex = (checkpoint?.type === 'knowledge-centers') ? checkpoint.index : 0;

    console.log(`  총 ${centers.length}개, 시작 인덱스: ${startIndex}`);

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (let i = startIndex; i < centers.length; i++) {
        const center = centers[i];

        // 이미 PNU가 있으면 스킵
        if (center.pnu && center.pnu.length === 19) {
            skipCount++;
            continue;
        }

        // 좌표가 없으면 스킵
        if (!center.coord || !center.coord[0] || !center.coord[1]) {
            console.warn(`  ⚠️ [${i}] ${center.name}: 좌표 없음`);
            failCount++;
            continue;
        }

        const [lon, lat] = center.coord;
        const result = await reverseGeocode(lon, lat);

        if (result.success && result.pnu) {
            center.pnu = result.pnu;
            if (result.address) {
                center.reverseGeocodedAddress = result.address;
            }
            successCount++;
            console.log(`  ✅ [${i + 1}/${centers.length}] ${center.name}: ${result.pnu}`);
        } else {
            failCount++;
            console.warn(`  ❌ [${i + 1}/${centers.length}] ${center.name}: ${result.error}`);
        }

        await delay(API_DELAY_MS);

        // 체크포인트 저장
        if ((i + 1) % BATCH_SIZE === 0) {
            saveCheckpoint('knowledge-centers', i + 1, centers);
            console.log(`  💾 체크포인트 저장: ${i + 1}/${centers.length}`);
        }
    }

    // 최종 저장
    const outputPath = path.join(process.cwd(), 'public/data/properties/knowledge-centers.json');
    fs.writeFileSync(outputPath, JSON.stringify(centers, null, 2));

    console.log(`\n  ✅ 지식산업센터 역지오코딩 완료`);
    console.log(`     - 성공: ${successCount}`);
    console.log(`     - 실패: ${failCount}`);
    console.log(`     - 스킵 (이미 PNU 있음): ${skipCount}`);
}

// 공장 역지오코딩
async function processFactories(): Promise<void> {
    console.log('\n🏭 공장 역지오코딩 → PNU...');

    const inputPath = path.join(process.cwd(), 'public/data/properties/factories.json');
    if (!fs.existsSync(inputPath)) {
        console.warn('  ⚠️  factories.json 없음');
        return;
    }

    const factories = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    const checkpoint = loadCheckpoint();
    const startIndex = (checkpoint?.type === 'factories') ? checkpoint.index : 0;

    console.log(`  총 ${factories.length}개, 시작 인덱스: ${startIndex}`);

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (let i = startIndex; i < factories.length; i++) {
        const factory = factories[i];

        // 이미 PNU가 있으면 스킵
        if (factory.pnu && factory.pnu.length === 19) {
            skipCount++;
            continue;
        }

        // 좌표가 없으면 스킵
        if (!factory.coord || !factory.coord[0] || !factory.coord[1]) {
            failCount++;
            continue;
        }

        const [lon, lat] = factory.coord;
        const result = await reverseGeocode(lon, lat);

        if (result.success && result.pnu) {
            factory.pnu = result.pnu;
            if (result.address) {
                factory.reverseGeocodedAddress = result.address;
            }
            successCount++;
        } else {
            failCount++;
        }

        await delay(API_DELAY_MS);

        // 진행 상황 출력
        if ((i + 1) % 100 === 0 || i === factories.length - 1) {
            console.log(`  진행: ${i + 1}/${factories.length} (성공: ${successCount}, 실패: ${failCount}, 스킵: ${skipCount})`);
        }

        // 체크포인트 저장
        if ((i + 1) % BATCH_SIZE === 0) {
            saveCheckpoint('factories', i + 1, factories);
            console.log(`  💾 체크포인트 저장: ${i + 1}/${factories.length}`);
        }
    }

    // 최종 저장
    const outputPath = path.join(process.cwd(), 'public/data/properties/factories.json');
    fs.writeFileSync(outputPath, JSON.stringify(factories, null, 2));

    console.log(`\n  ✅ 공장 역지오코딩 완료`);
    console.log(`     - 성공: ${successCount}`);
    console.log(`     - 실패: ${failCount}`);
    console.log(`     - 스킵 (이미 PNU 있음): ${skipCount}`);
}

// 메인 함수
async function main(): Promise<void> {
    console.log('🔄 역지오코딩 → PNU 변환 시작 (네이버 API)...\n');

    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('knowledge-centers')) {
        await processKnowledgeCenters();
    }

    if (args.length === 0 || args.includes('factories')) {
        await processFactories();
    }

    // 체크포인트 파일 삭제
    if (fs.existsSync(CHECKPOINT_FILE)) {
        fs.unlinkSync(CHECKPOINT_FILE);
        console.log('\n🗑️ 체크포인트 파일 삭제됨');
    }

    console.log('\n✨ 역지오코딩 완료!');
}

main().catch(console.error);
