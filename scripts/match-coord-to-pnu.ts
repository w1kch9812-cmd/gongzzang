// scripts/match-coord-to-pnu.ts
// 좌표 기반 PNU 매칭
// 전략: 역지오코딩으로 읍면동 코드 획득 → parcels.json에서 거리 기반 가장 가까운 필지 찾기

import * as fs from 'fs';
import * as path from 'path';

// 네이버 클라우드 플랫폼 API 키
const NAVER_CLIENT_ID = 's636cp22wi';
const NAVER_CLIENT_SECRET = 'hSGnpROTAE9w5PSwMUeeCDoHofkox1CkIk80fg1r';

// API 호출 제한
const API_DELAY_MS = 100;
const BATCH_SIZE = 100;

interface MatchResult {
    success: boolean;
    pnu?: string;
    distance?: number;
    emdCode?: string;
    error?: string;
}

// 체크포인트 파일
const CHECKPOINT_FILE = 'match_coord_checkpoint.json';

// Haversine 거리 계산 (미터)
function calcDistance(lon1: number, lat1: number, lon2: number, lat2: number): number {
    const R = 6371000; // 지구 반경 (미터)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 역지오코딩으로 읍면동 코드 획득
async function getEmdCode(lon: number, lat: number): Promise<string | null> {
    try {
        const coords = `${lon},${lat}`;
        const url = `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${coords}&output=json&orders=legalcode`;

        const response = await fetch(url, {
            headers: {
                'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
                'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
            },
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const code = data.results[0].code;
            if (code && code.id) {
                return code.id; // 2820010100 형식의 10자리 코드
            }
        }

        return null;
    } catch (error) {
        console.error(`역지오코딩 에러: ${error}`);
        return null;
    }
}

// parcels.json 로드 및 인덱싱
let parcelsByEmd: Map<string, any[]> | null = null;

function loadParcels(): Map<string, any[]> {
    if (parcelsByEmd) return parcelsByEmd;

    console.log('📦 parcels.json 로딩...');
    const parcelsPath = path.join(process.cwd(), 'public/data/properties/parcels.json');

    if (!fs.existsSync(parcelsPath)) {
        throw new Error('parcels.json 파일이 없습니다.');
    }

    const parcels = JSON.parse(fs.readFileSync(parcelsPath, 'utf-8'));

    // 읍면동 코드별로 그룹화
    parcelsByEmd = new Map();
    for (const parcel of parcels) {
        if (!parcel.PNU || !parcel.coord) continue;

        const emdCode = parcel.PNU.substring(0, 10); // 읍면동까지의 10자리
        if (!parcelsByEmd.has(emdCode)) {
            parcelsByEmd.set(emdCode, []);
        }
        parcelsByEmd.get(emdCode)!.push(parcel);
    }

    console.log(`   ✅ ${parcels.length}개 필지, ${parcelsByEmd.size}개 읍면동`);
    return parcelsByEmd;
}

// 좌표 → PNU 매칭
async function matchCoordToPNU(lon: number, lat: number): Promise<MatchResult> {
    // 1. 역지오코딩으로 읍면동 코드 획득
    const emdCode = await getEmdCode(lon, lat);
    if (!emdCode) {
        return { success: false, error: '역지오코딩 실패' };
    }

    // 2. 해당 읍면동의 필지들 중 가장 가까운 것 찾기
    const parcelsMap = loadParcels();
    const candidateParcels = parcelsMap.get(emdCode);

    if (!candidateParcels || candidateParcels.length === 0) {
        return { success: false, emdCode, error: `읍면동 ${emdCode}에 필지 없음` };
    }

    let closestParcel: any = null;
    let minDistance = Infinity;

    for (const parcel of candidateParcels) {
        const [pLon, pLat] = parcel.coord;
        const distance = calcDistance(lon, lat, pLon, pLat);

        if (distance < minDistance) {
            minDistance = distance;
            closestParcel = parcel;
        }
    }

    if (!closestParcel) {
        return { success: false, emdCode, error: '가장 가까운 필지 찾기 실패' };
    }

    return {
        success: true,
        pnu: closestParcel.PNU,
        distance: minDistance,
        emdCode,
    };
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

// 지식산업센터 처리
async function processKnowledgeCenters(): Promise<void> {
    console.log('\n🏢 지식산업센터 PNU 매칭...');

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
        const result = await matchCoordToPNU(lon, lat);

        if (result.success && result.pnu) {
            center.pnu = result.pnu;
            center.matchDistance = result.distance;
            center.emdCode = result.emdCode;
            successCount++;
            console.log(`  ✅ [${i + 1}/${centers.length}] ${center.name}: ${result.pnu} (거리: ${result.distance?.toFixed(1)}m)`);
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

    console.log(`\n  ✅ 지식산업센터 PNU 매칭 완료`);
    console.log(`     - 성공: ${successCount}`);
    console.log(`     - 실패: ${failCount}`);
    console.log(`     - 스킵 (이미 PNU 있음): ${skipCount}`);
}

// 공장 처리
async function processFactories(): Promise<void> {
    console.log('\n🏭 공장 PNU 매칭...');

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
        const result = await matchCoordToPNU(lon, lat);

        if (result.success && result.pnu) {
            factory.pnu = result.pnu;
            factory.matchDistance = result.distance;
            factory.emdCode = result.emdCode;
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

    console.log(`\n  ✅ 공장 PNU 매칭 완료`);
    console.log(`     - 성공: ${successCount}`);
    console.log(`     - 실패: ${failCount}`);
    console.log(`     - 스킵 (이미 PNU 있음): ${skipCount}`);
}

// 메인 함수
async function main(): Promise<void> {
    console.log('🔄 좌표 → PNU 매칭 시작 (역지오코딩 + 거리 기반)...\n');

    // parcels.json 로드
    loadParcels();

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

    console.log('\n✨ PNU 매칭 완료!');
}

main().catch(console.error);
