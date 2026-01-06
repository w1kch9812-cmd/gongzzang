// scripts/geocode-addresses.ts
// 네이버 지오코딩 API를 사용한 주소 → 좌표 변환

import * as fs from 'fs';
import * as path from 'path';

// 네이버 클라우드 플랫폼 API 키
const NAVER_CLIENT_ID = 's636cp22wi';
const NAVER_CLIENT_SECRET = 'hSGnpROTAE9w5PSwMUeeCDoHofkox1CkIk80fg1r';

// API 호출 제한
const API_DELAY_MS = 100;
const BATCH_SIZE = 100;

interface GeocodingResult {
    success: boolean;
    coord: [number, number] | null;
    address?: string;
    error?: string;
}

// 체크포인트 파일
const CHECKPOINT_FILE = 'geocoding_checkpoint.json';

// 지오코딩 API 호출 (네이버)
async function geocodeAddress(address: string): Promise<GeocodingResult> {
    try {
        const url = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`;

        const response = await fetch(url, {
            headers: {
                'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
                'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, coord: null, error: `HTTP ${response.status}: ${errorText.substring(0, 100)}` };
        }

        const data = await response.json();

        if (data.addresses && data.addresses.length > 0) {
            const result = data.addresses[0];
            return {
                success: true,
                coord: [parseFloat(result.x), parseFloat(result.y)],
                address: result.roadAddress || result.jibunAddress,
            };
        }

        return { success: false, coord: null, error: '결과 없음' };
    } catch (error) {
        return { success: false, coord: null, error: String(error) };
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

// 공장 지오코딩
async function geocodeFactories(): Promise<void> {
    console.log('\n🏭 공장 지오코딩...');

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

    for (let i = startIndex; i < factories.length; i++) {
        const factory = factories[i];

        // 이미 좌표가 있으면 스킵
        if (factory.coord) {
            successCount++;
            continue;
        }

        // 주소로 지오코딩
        if (factory.address) {
            const result = await geocodeAddress(factory.address);

            if (result.success && result.coord) {
                factory.coord = result.coord;
                successCount++;
            } else {
                failCount++;
            }

            await delay(API_DELAY_MS);
        } else {
            failCount++;
        }

        // 진행 상황 출력
        if ((i + 1) % 100 === 0 || i === factories.length - 1) {
            console.log(`  진행: ${i + 1}/${factories.length} (성공: ${successCount}, 실패: ${failCount})`);
        }

        // 체크포인트 저장
        if ((i + 1) % BATCH_SIZE === 0) {
            saveCheckpoint('factories', i + 1, factories);
        }
    }

    // 최종 저장
    const outputPath = path.join(process.cwd(), 'public/data/properties/factories.json');
    fs.writeFileSync(outputPath, JSON.stringify(factories, null, 2));

    console.log(`  ✅ 공장 지오코딩 완료: 성공 ${successCount}, 실패 ${failCount}`);
}

// 지식산업센터 지오코딩
async function geocodeKnowledgeCenters(): Promise<void> {
    console.log('\n🏢 지식산업센터 지오코딩...');

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

    for (let i = startIndex; i < centers.length; i++) {
        const center = centers[i];

        // 이미 좌표가 있으면 스킵
        if (center.coord) {
            successCount++;
            continue;
        }

        // 도로명주소 → 지번주소 순서로 시도
        const addresses = [center.roadAddress, center.jibunAddress].filter(Boolean);

        for (const address of addresses) {
            const result = await geocodeAddress(address);

            if (result.success && result.coord) {
                center.coord = result.coord;
                successCount++;
                break;
            }

            await delay(API_DELAY_MS);
        }

        if (!center.coord) {
            failCount++;
        }

        // 진행 상황 출력
        if ((i + 1) % 10 === 0 || i === centers.length - 1) {
            console.log(`  진행: ${i + 1}/${centers.length} (성공: ${successCount}, 실패: ${failCount})`);
        }

        // 체크포인트 저장
        if ((i + 1) % BATCH_SIZE === 0) {
            saveCheckpoint('knowledge-centers', i + 1, centers);
        }
    }

    // 최종 저장
    const outputPath = path.join(process.cwd(), 'public/data/properties/knowledge-centers.json');
    fs.writeFileSync(outputPath, JSON.stringify(centers, null, 2));

    console.log(`  ✅ 지식산업센터 지오코딩 완료: 성공 ${successCount}, 실패 ${failCount}`);
}

// 메인 함수
async function main(): Promise<void> {
    console.log('🌍 주소 지오코딩 시작 (네이버 API)...\n');

    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('knowledge-centers')) {
        await geocodeKnowledgeCenters();
    }

    if (args.length === 0 || args.includes('factories')) {
        await geocodeFactories();
    }

    // 체크포인트 파일 삭제
    if (fs.existsSync(CHECKPOINT_FILE)) {
        fs.unlinkSync(CHECKPOINT_FILE);
    }

    console.log('\n✨ 지오코딩 완료!');
}

main().catch(console.error);
