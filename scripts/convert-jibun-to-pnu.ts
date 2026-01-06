// scripts/convert-jibun-to-pnu.ts
// 지번주소 → PNU 변환 (지식산업센터, 공장 등)

import * as fs from 'fs';
import * as path from 'path';

// ===== 행정구역 코드 매핑 생성 =====

interface AdminCode {
    sig: string;  // 시군구 코드 (5자리: 시도2 + 시군구3)
    emd: string;  // 읍면동 코드 (10자리: 시도2 + 시군구3 + 읍면동3 + 리2)
    name: string;
}

// parcels.json에서 행정구역 코드 추출
function extractAdminCodes(): Map<string, AdminCode> {
    console.log('📋 행정구역 코드 추출 중...');

    const parcelsPath = path.join(process.cwd(), 'public/data/properties/parcels.json');
    if (!fs.existsSync(parcelsPath)) {
        throw new Error('parcels.json 파일이 없습니다.');
    }

    const parcels = JSON.parse(fs.readFileSync(parcelsPath, 'utf-8'));
    const codeMap = new Map<string, AdminCode>();

    for (const parcel of parcels) {
        const pnu = parcel.PNU;
        const jibun = parcel.jibun;

        if (!pnu || pnu.length !== 19) continue;

        // PNU 파싱: [시도2][시군구3][읍면동3][리2][본번4][부번4][대산1]
        const sig = pnu.substring(0, 5);     // 28200
        const emd = pnu.substring(0, 10);    // 2820010100

        // 읍면동 이름 추출 (jibun에서 파싱)
        // 예: "1594 도" → 읍면동 이름은 parcels에 없으므로 districts 활용 필요

        const key = emd;
        if (!codeMap.has(key)) {
            codeMap.set(key, { sig, emd, name: '' });
        }
    }

    console.log(`   ✅ ${codeMap.size}개 읍면동 코드 추출됨`);
    return codeMap;
}

// ===== 지번주소 파싱 =====

interface ParsedAddress {
    sido: string;        // "인천광역시"
    sigungu: string;     // "남동구"
    eupmyeondong: string; // "구월동"
    ri?: string;         // "국화리" (읍/면만)
    bonbun: number;      // 1550
    bubun: number;       // 1
    jimok?: string;      // "대", "도", "전" 등
}

function parseJibunAddress(address: string): ParsedAddress | null {
    // 주소 정규화
    address = address
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/번지$/, '')
        .replace(/번$/, '');

    // 패턴: "인천광역시 남동구 구월동 1550-1" 또는 "인천 남동구 구월동 1550-1"
    const patterns = [
        // 도로명주소는 지번 변환 불가
        /^(.+?[시도])\s+(.+?[시군구])\s+(.+?[읍면동])\s+(\d+)(?:-(\d+))?(?:\s*([대도전답임야]))?/,
        /^(.+?[시도])\s+(.+?[시군구])\s+(.+?[읍면])\s+(.+?리)\s+(\d+)(?:-(\d+))?(?:\s*([대도전답임야]))?/,
    ];

    for (const pattern of patterns) {
        const match = address.match(pattern);
        if (match) {
            const hasRi = pattern.source.includes('리');

            if (hasRi) {
                // 읍/면 + 리
                return {
                    sido: match[1],
                    sigungu: match[2],
                    eupmyeondong: match[3],
                    ri: match[4],
                    bonbun: parseInt(match[5]),
                    bubun: match[6] ? parseInt(match[6]) : 0,
                    jimok: match[7],
                };
            } else {
                // 동
                return {
                    sido: match[1],
                    sigungu: match[2],
                    eupmyeondong: match[3],
                    bonbun: parseInt(match[4]),
                    bubun: match[5] ? parseInt(match[5]) : 0,
                    jimok: match[6],
                };
            }
        }
    }

    return null;
}

// ===== 행정구역명 → 코드 매핑 =====

// 시도 코드
const SIDO_CODES: Record<string, string> = {
    '서울': '11', '서울특별시': '11', '서울시': '11',
    '부산': '26', '부산광역시': '26', '부산시': '26',
    '대구': '27', '대구광역시': '27', '대구시': '27',
    '인천': '28', '인천광역시': '28', '인천시': '28',
    '광주': '29', '광주광역시': '29', '광주시': '29',
    '대전': '30', '대전광역시': '30', '대전시': '30',
    '울산': '31', '울산광역시': '31', '울산시': '31',
    '세종': '36', '세종특별자치시': '36', '세종시': '36',
    '경기': '41', '경기도': '41',
    '강원': '42', '강원도': '42', '강원특별자치도': '42',
    '충북': '43', '충청북도': '43',
    '충남': '44', '충청남도': '44',
    '전북': '45', '전라북도': '45', '전북특별자치도': '45',
    '전남': '46', '전라남도': '46',
    '경북': '47', '경상북도': '47',
    '경남': '48', '경상남도': '48',
    '제주': '50', '제주특별자치도': '50', '제주도': '50',
};

// 인천 시군구 코드
const INCHEON_SIG_CODES: Record<string, string> = {
    '중구': '110',
    '동구': '260',
    '미추홀구': '237',
    '연수구': '150',
    '남동구': '140',
    '부평구': '245',
    '계양구': '185',
    '서구': '170',
    '강화군': '200',
    '옹진군': '210',
};

// ===== PNU 생성 =====

function generatePNU(
    parsed: ParsedAddress,
    adminCodes: Map<string, AdminCode>
): string | null {
    // 1. 시도 코드
    const sidoCode = SIDO_CODES[parsed.sido];
    if (!sidoCode) {
        console.warn(`   ⚠️ 알 수 없는 시도: ${parsed.sido}`);
        return null;
    }

    // 2. 시군구 코드 (인천만 지원)
    if (sidoCode !== '28') {
        console.warn(`   ⚠️ 인천 외 지역은 미지원: ${parsed.sido}`);
        return null;
    }

    const sigCode = INCHEON_SIG_CODES[parsed.sigungu];
    if (!sigCode) {
        console.warn(`   ⚠️ 알 수 없는 시군구: ${parsed.sigungu}`);
        return null;
    }

    // 3. 읍면동 코드 (adminCodes에서 검색)
    // 읍면동명으로 emdCode 찾기는 어려우므로, 좌표 기반 매칭이 필요
    // 임시: 남동구만 하드코딩
    const emdCodeMap: Record<string, string> = {
        '논현동': '101',
        '간석1동': '102', '간석2동': '103', '간석3동': '104', '간석4동': '105',
        '구월1동': '106', '구월2동': '107', '구월동': '106', // 구월동 → 구월1동으로 처리
        '만수1동': '108', '만수2동': '109', '만수3동': '110', '만수4동': '111',
        '만수5동': '112', '만수6동': '113', '만수동': '108', // 만수동 → 만수1동
        '장수동': '114', '서창1동': '115', '서창2동': '116',
        '운연동': '117', '남촌도림동': '118',
    };

    const emdCode = emdCodeMap[parsed.eupmyeondong];
    if (!emdCode) {
        console.warn(`   ⚠️ 알 수 없는 읍면동: ${parsed.eupmyeondong} (${parsed.sigungu})`);
        return null;
    }

    // 4. 리 코드 (동 지역은 00)
    const riCode = parsed.ri ? '01' : '00'; // 실제로는 리 순서에 따라 다름

    // 5. 본번/부번 (4자리 제로패딩)
    const bonbun = String(parsed.bonbun).padStart(4, '0');
    const bubun = String(parsed.bubun).padStart(4, '0');

    // 6. 대산 코드 (1: 대지, 2: 산)
    let daesanCode = '1'; // 기본값: 대지
    if (parsed.jimok === '산') {
        daesanCode = '2';
    }

    // PNU 조합
    const pnu = sidoCode + sigCode + emdCode + riCode + bonbun + bubun + daesanCode;

    if (pnu.length !== 19) {
        console.error(`   ❌ PNU 길이 오류: ${pnu} (${pnu.length}자)`);
        return null;
    }

    return pnu;
}

// ===== 메인 처리 =====

async function convertKnowledgeCenters(adminCodes: Map<string, AdminCode>): Promise<void> {
    console.log('\n🏢 지식산업센터 PNU 변환...');

    const inputPath = path.join(process.cwd(), 'public/data/properties/knowledge-centers.json');
    if (!fs.existsSync(inputPath)) {
        console.warn('   ⚠️ knowledge-centers.json 없음');
        return;
    }

    const centers = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    console.log(`   총 ${centers.length}개 처리`);

    let successCount = 0;
    let failCount = 0;

    for (const center of centers) {
        // 이미 PNU가 있으면 스킵
        if (center.pnu) {
            successCount++;
            continue;
        }

        // 지번주소로 변환 (도로명주소는 지번으로 변환 필요)
        const address = center.jibunAddress || center.roadAddress;
        if (!address) {
            failCount++;
            continue;
        }

        const parsed = parseJibunAddress(address);
        if (!parsed) {
            console.warn(`   ⚠️ 파싱 실패: ${address}`);
            failCount++;
            continue;
        }

        const pnu = generatePNU(parsed, adminCodes);
        if (pnu) {
            center.pnu = pnu;
            successCount++;
        } else {
            failCount++;
        }
    }

    // 저장
    const outputPath = path.join(process.cwd(), 'public/data/properties/knowledge-centers.json');
    fs.writeFileSync(outputPath, JSON.stringify(centers, null, 2));

    console.log(`   ✅ 지식산업센터 PNU 변환 완료: 성공 ${successCount}, 실패 ${failCount}`);
}

async function convertFactories(adminCodes: Map<string, AdminCode>): Promise<void> {
    console.log('\n🏭 공장 PNU 변환...');

    const inputPath = path.join(process.cwd(), 'public/data/properties/factories.json');
    if (!fs.existsSync(inputPath)) {
        console.warn('   ⚠️ factories.json 없음');
        return;
    }

    const factories = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    console.log(`   총 ${factories.length}개 처리`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < factories.length; i++) {
        const factory = factories[i];

        // 이미 PNU가 있으면 스킵
        if (factory.pnu) {
            successCount++;
            continue;
        }

        const address = factory.address;
        if (!address) {
            failCount++;
            continue;
        }

        const parsed = parseJibunAddress(address);
        if (!parsed) {
            failCount++;
            continue;
        }

        const pnu = generatePNU(parsed, adminCodes);
        if (pnu) {
            factory.pnu = pnu;
            successCount++;
        } else {
            failCount++;
        }

        // 진행 상황 출력
        if ((i + 1) % 1000 === 0) {
            console.log(`   진행: ${i + 1}/${factories.length} (성공: ${successCount}, 실패: ${failCount})`);
        }
    }

    // 저장
    const outputPath = path.join(process.cwd(), 'public/data/properties/factories.json');
    fs.writeFileSync(outputPath, JSON.stringify(factories, null, 2));

    console.log(`   ✅ 공장 PNU 변환 완료: 성공 ${successCount}, 실패 ${failCount}`);
}

// ===== 메인 함수 =====

async function main(): Promise<void> {
    console.log('🔄 지번주소 → PNU 변환 시작...\n');

    // 1. 행정구역 코드 추출
    const adminCodes = extractAdminCodes();

    // 2. 변환 작업
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('knowledge-centers')) {
        await convertKnowledgeCenters(adminCodes);
    }

    if (args.length === 0 || args.includes('factories')) {
        await convertFactories(adminCodes);
    }

    console.log('\n✨ PNU 변환 완료!');
}

main().catch(console.error);
