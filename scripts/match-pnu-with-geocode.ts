// scripts/match-pnu-with-geocode.ts
// 역지오코딩으로 법정동 코드 획득 → 지번 파싱 → 정확한 PNU 생성

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const NAVER_CLIENT_ID = 's636cp22wi';
const NAVER_CLIENT_SECRET = 'hSGnpROTAE9w5PSwMUeeCDoHofkox1CkIk80fg1r';

const API_DELAY_MS = 100;
const BATCH_SIZE = 100;
const CHECKPOINT_FILE = 'match_pnu_geocode_checkpoint.json';

// 역지오코딩으로 법정동 코드 획득
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
                return code.id; // 2820010100 형식의 10자리 법정동 코드
            }
        }

        return null;
    } catch (error) {
        console.error(`역지오코딩 에러: ${error}`);
        return null;
    }
}

// 지번주소에서 본번/부번 추출
function parseJibunNumber(jibunAddress: string): { bonbun: string; bubun: string; isSan: boolean } | null {
    // "인천광역시 남동구 논현동 123-45번지" → bonbun: 123, bubun: 45
    // "인천광역시 남동구 논현동 산 123-45번지 3층" → bonbun: 123, bubun: 45, isSan: true

    const isSan = jibunAddress.includes(' 산 ');

    // "123-45번지" 또는 "123번지" 패턴 찾기 (번지 앞의 숫자)
    const pattern = /(\d+)(?:-(\d+))?번지/;
    const match = jibunAddress.match(pattern);

    if (!match) return null;

    const bonbun = match[1];
    const bubun = match[2] || '0';

    return { bonbun, bubun, isSan };
}

// PNU 생성 (emdCode + 지번)
function generatePNU(emdCode: string, bonbun: string, bubun: string, isSan: boolean): string | null {
    if (emdCode.length !== 10) {
        console.error(`   ❌ emdCode 길이 오류: ${emdCode}`);
        return null;
    }

    const bonbunPadded = bonbun.padStart(4, '0');
    const bubunPadded = bubun.padStart(4, '0');
    const daesanCode = isSan ? '2' : '1';

    const pnu = emdCode + bonbunPadded + bubunPadded + daesanCode;

    if (pnu.length !== 19) {
        console.error(`   ❌ PNU 길이 오류: ${pnu} (${pnu.length}자)`);
        return null;
    }

    return pnu;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveCheckpoint(type: string, index: number, data: any[]): void {
    const checkpoint = { type, index, timestamp: new Date().toISOString() };
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint));

    const outputPath = path.join(process.cwd(), `public/data/properties/${type}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
}

function loadCheckpoint(): { type: string; index: number } | null {
    if (!fs.existsSync(CHECKPOINT_FILE)) return null;
    try {
        return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    } catch {
        return null;
    }
}

// 공장 처리
async function processFactories(): Promise<void> {
    console.log('\n🏭 공장 PNU 매칭 (역지오코딩 + 지번 파싱)\n');

    // 1. Excel 원본 로드
    const excelPath = path.join(process.cwd(), 'rawdata/전국공장등록현황.xlsx');
    const wb = XLSX.readFile(excelPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData: any[] = XLSX.utils.sheet_to_json(ws);

    const incheonRaw = rawData.filter(row => row['시도명'] === '인천광역시');
    console.log(`📦 Excel: 인천 ${incheonRaw.length}개`);

    // 2. 기존 factories.json 로드
    const factoriesPath = path.join(process.cwd(), 'public/data/properties/factories.json');
    const factories = JSON.parse(fs.readFileSync(factoriesPath, 'utf-8'));
    console.log(`📝 factories.json: ${factories.length}개\n`);

    // 3. 회사명 기준 매칭
    const checkpoint = loadCheckpoint();
    const startIndex = (checkpoint?.type === 'factories') ? checkpoint.index : 0;

    console.log(`시작 인덱스: ${startIndex}\n`);

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

        // Excel에서 동일 회사 찾기
        const rawFactory = incheonRaw.find(r => r['회사명'] === factory.name);
        if (!rawFactory) {
            failCount++;
            continue;
        }

        const jibunAddress = rawFactory['공장주소_지번'];
        if (!jibunAddress) {
            failCount++;
            continue;
        }

        // 좌표 있고 지번주소 있음 - 처리 시작
        if ((i - startIndex) % 10 === 0 && i > startIndex) {
            console.log(`  [디버그] 처리 중... ${i - startIndex}개 처리됨`);
        }

        // 역지오코딩으로 법정동 코드 획득
        const [lon, lat] = factory.coord;
        const emdCode = await getEmdCodeFromCoord(lon, lat);

        if (!emdCode) {
            failCount++;
            await delay(API_DELAY_MS);
            continue;
        }

        // 지번 파싱
        const parsed = parseJibunNumber(jibunAddress);
        if (!parsed) {
            failCount++;
            await delay(API_DELAY_MS);
            continue;
        }

        // PNU 생성
        const pnu = generatePNU(emdCode, parsed.bonbun, parsed.bubun, parsed.isSan);

        if (pnu) {
            factory.pnu = pnu;
            factory.emdCode = emdCode;
            factory.jibunAddress = jibunAddress;
            successCount++;
        } else {
            failCount++;
        }

        await delay(API_DELAY_MS);

        // 진행 상황
        if ((i + 1) % 100 === 0 || i === factories.length - 1) {
            console.log(`  진행: ${i + 1}/${factories.length} (성공: ${successCount}, 실패: ${failCount}, 스킵: ${skipCount})`);
        }

        // 체크포인트
        if ((i + 1) % BATCH_SIZE === 0) {
            saveCheckpoint('factories', i + 1, factories);
            console.log(`  💾 체크포인트 저장`);
        }
    }

    // 최종 저장
    fs.writeFileSync(factoriesPath, JSON.stringify(factories, null, 2));

    console.log(`\n✅ 공장 PNU 매칭 완료`);
    console.log(`   - 성공: ${successCount}`);
    console.log(`   - 실패: ${failCount}`);
    console.log(`   - 스킵: ${skipCount}`);

    const total = factories.filter((f: any) => f.pnu && f.pnu.length === 19).length;
    console.log(`\n📊 전체 PNU 보유율: ${total}/${factories.length} (${(total/factories.length*100).toFixed(1)}%)`);
}

async function main(): Promise<void> {
    console.log('🔄 PNU 매칭 (역지오코딩 + 지번 파싱)...\n');

    await processFactories();

    // 체크포인트 삭제
    if (fs.existsSync(CHECKPOINT_FILE)) {
        fs.unlinkSync(CHECKPOINT_FILE);
        console.log('\n🗑️ 체크포인트 파일 삭제됨');
    }

    console.log('\n✨ 완료!');
}

main().catch(console.error);
