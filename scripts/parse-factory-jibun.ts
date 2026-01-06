// scripts/parse-factory-jibun.ts
// 공장 지번주소 → PNU 변환 (Excel 원본 데이터 사용)

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

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

// 인천 남동구 읍면동 코드
const NAMDONG_EMD_CODES: Record<string, string> = {
    '논현동': '101', '논현1동': '101', '논현2동': '102',
    '간석1동': '103', '간석2동': '104', '간석3동': '105', '간석4동': '106',
    '만수1동': '107', '만수2동': '108', '만수3동': '109', '만수4동': '110',
    '만수5동': '111', '만수6동': '112',
    '장수동': '113',
    '구월1동': '114', '구월2동': '115', '구월3동': '116', '구월4동': '117',
    '서창1동': '118', '서창2동': '119',
    '운연동': '120',
    '남촌도림동': '121',
    '고잔동': '122',
};

// 지번주소 파싱
interface ParsedJibun {
    sido: string;
    sigungu: string;
    dong: string;
    bonbun: string;
    bubun: string;
    isSan: boolean;
}

function parseJibunAddress(address: string): ParsedJibun | null {
    // "인천광역시 남동구 논현동 123-45번지" 형식
    // "인천광역시 남동구 논현동 123번지" 형식

    // 정규화
    address = address.trim()
        .replace(/번지$/, '')
        .replace(/\s+/g, ' ');

    // 패턴 매칭
    const pattern = /^(.+?[시도])\s+(.+?[시군구])\s+(.+?동)\s+(\d+)(?:-(\d+))?/;
    const match = address.match(pattern);

    if (!match) {
        return null;
    }

    return {
        sido: match[1],
        sigungu: match[2],
        dong: match[3],
        bonbun: match[4],
        bubun: match[5] || '0',
        isSan: address.includes('산'),
    };
}

// PNU 생성
function generatePNU(parsed: ParsedJibun): string | null {
    // 시도 코드
    const sidoCode = SIDO_CODES[parsed.sido];
    if (!sidoCode) return null;

    // 인천만 지원
    if (sidoCode !== '28') return null;

    // 시군구 코드
    const sigCode = INCHEON_SIG_CODES[parsed.sigungu];
    if (!sigCode) return null;

    // 남동구만 지원 (parcels.json에 남동구만 있음)
    if (sigCode !== '140') return null;

    // 읍면동 코드
    const emdCode = NAMDONG_EMD_CODES[parsed.dong];
    if (!emdCode) {
        console.warn(`   ⚠️ 알 수 없는 동: ${parsed.dong}`);
        return null;
    }

    // 리 코드 (동 지역은 00)
    const riCode = '00';

    // 본번/부번 (4자리)
    const bonbun = parsed.bonbun.padStart(4, '0');
    const bubun = parsed.bubun.padStart(4, '0');

    // 대산 코드
    const daesanCode = parsed.isSan ? '2' : '1';

    // PNU 조합
    const pnu = sidoCode + sigCode + emdCode + riCode + bonbun + bubun + daesanCode;

    if (pnu.length !== 19) {
        console.error(`   ❌ PNU 길이 오류: ${pnu}`);
        return null;
    }

    return pnu;
}

async function main() {
    console.log('🏭 공장 PNU 변환 (Excel 원본 → 지번주소 파싱)\n');

    // 1. Excel 원본 로드
    const excelPath = path.join(process.cwd(), 'rawdata/전국공장등록현황.xlsx');
    const wb = XLSX.readFile(excelPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData: any[] = XLSX.utils.sheet_to_json(ws);

    console.log(`📦 Excel 로드: ${rawData.length}개 공장`);

    // 인천 필터
    const incheonData = rawData.filter(row => row['시도명'] === '인천광역시');
    console.log(`   인천: ${incheonData.length}개\n`);

    // 2. 기존 factories.json 로드
    const factoriesPath = path.join(process.cwd(), 'public/data/properties/factories.json');
    const factories = JSON.parse(fs.readFileSync(factoriesPath, 'utf-8'));

    console.log(`📝 기존 factories.json: ${factories.length}개\n`);

    // 3. 회사명 기준으로 매칭하여 PNU 추가
    let matchCount = 0;
    let pnuSuccessCount = 0;
    let pnuFailCount = 0;

    for (const factory of factories) {
        // Excel에서 동일 회사명 찾기
        const rawFactory = incheonData.find(r => r['회사명'] === factory.name);

        if (!rawFactory) {
            continue;
        }

        matchCount++;

        // 이미 PNU가 있으면 스킵
        if (factory.pnu && factory.pnu.length === 19) {
            pnuSuccessCount++;
            continue;
        }

        // 지번주소 파싱
        const jibunAddr = rawFactory['공장주소_지번'];
        if (!jibunAddr) {
            pnuFailCount++;
            continue;
        }

        const parsed = parseJibunAddress(jibunAddr);
        if (!parsed) {
            pnuFailCount++;
            continue;
        }

        const pnu = generatePNU(parsed);
        if (pnu) {
            factory.pnu = pnu;
            factory.jibunAddress = jibunAddr;
            pnuSuccessCount++;
        } else {
            pnuFailCount++;
        }

        // 진행 상황 (매 100개)
        if (matchCount % 100 === 0) {
            console.log(`   진행: ${matchCount}/${incheonData.length} (PNU 성공: ${pnuSuccessCount}, 실패: ${pnuFailCount})`);
        }
    }

    // 4. 저장
    fs.writeFileSync(factoriesPath, JSON.stringify(factories, null, 2));

    console.log(`\n✅ 공장 PNU 변환 완료`);
    console.log(`   - Excel 매칭: ${matchCount}/${factories.length}`);
    console.log(`   - PNU 성공: ${pnuSuccessCount}`);
    console.log(`   - PNU 실패: ${pnuFailCount}`);

    // 5. 통계
    const withPNU = factories.filter((f: any) => f.pnu && f.pnu.length === 19).length;
    console.log(`\n📊 최종 통계`);
    console.log(`   - PNU 있음: ${withPNU}/${factories.length} (${(withPNU/factories.length*100).toFixed(1)}%)`);
}

main().catch(console.error);
