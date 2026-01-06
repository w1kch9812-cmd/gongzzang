// scripts/regenerate-factory-pnu.ts
// 공장 지번주소에서 PNU 재생성

import * as fs from 'fs';
import * as path from 'path';

interface Factory {
    id: string;
    name: string;
    pnu?: string;
    jibunAddress?: string;
    [key: string]: any;
}

interface EmdFeature {
    properties: {
        name: string;
        code: string;
        sigCode: string;
    };
}

// 시군구 매핑 (인천)
const SIG_CODES: Record<string, string> = {
    '중구': '28110',
    '동구': '28260',
    '미추홀구': '28237',
    '연수구': '28150',
    '남동구': '28200',
    '부평구': '28245',
    '계양구': '28185',
    '서구': '28170',
    '강화군': '28710',
    '옹진군': '28720',
};

async function main() {
    console.log('🏭 공장 PNU 재생성 (지번주소 → PNU)\n');

    // 1. 읍면동 매핑 생성
    console.log('📋 읍면동 코드 매핑 생성...');
    const emdPath = path.join(process.cwd(), 'temp/emd.geojson');
    const emdData = JSON.parse(fs.readFileSync(emdPath, 'utf-8'));

    const emdNameToCode: Record<string, string> = {};
    for (const feature of emdData.features as EmdFeature[]) {
        const { name, code, sigCode } = feature.properties;
        if (name && code && sigCode) {
            const code10 = code + '00';  // 8자리 → 10자리
            const key = `${sigCode}:${name}`;
            emdNameToCode[key] = code10;
        }
    }
    console.log(`   ✅ ${Object.keys(emdNameToCode).length}개 읍면동 매핑 완료`);

    // 2. 공장 데이터 로드
    const factoriesPath = path.join(process.cwd(), 'public/data/properties/factories.json');
    const factories: Factory[] = JSON.parse(fs.readFileSync(factoriesPath, 'utf-8'));
    console.log(`📦 공장 데이터: ${factories.length}개\n`);

    // 3. PNU 생성
    let success = 0;
    let fail = 0;
    let noJibun = 0;
    let parseError = 0;
    let sigError = 0;
    let emdError = 0;

    const failedSamples: string[] = [];

    for (const factory of factories) {
        const jibun = factory.jibunAddress;

        if (!jibun) {
            noJibun++;
            continue;
        }

        // 지번주소 파싱
        // "인천광역시 남동구 남촌동 618-9번지"
        // "인천광역시 중구 항동7가 85-6 2층1호"
        const pattern = /인천광역시\s+(.+?[구군])\s+(.+?[동면리가])\s+(\d+)(?:-(\d+))?/;
        const match = jibun.match(pattern);

        if (!match) {
            parseError++;
            if (failedSamples.length < 5) {
                failedSamples.push(`파싱실패: ${jibun}`);
            }
            continue;
        }

        const [, sigungu, dong, bonbunStr, bubunStr] = match;

        // 시군구 코드
        const sigCode = SIG_CODES[sigungu];
        if (!sigCode) {
            sigError++;
            if (failedSamples.length < 5) {
                failedSamples.push(`시군구없음: ${sigungu}`);
            }
            continue;
        }

        // 읍면동 코드
        const emdKey = `${sigCode}:${dong}`;
        const emdCode = emdNameToCode[emdKey];
        if (!emdCode) {
            emdError++;
            if (failedSamples.length < 10) {
                failedSamples.push(`읍면동없음: ${emdKey}`);
            }
            continue;
        }

        // PNU 생성
        const bonbun = bonbunStr.padStart(4, '0');
        const bubun = (bubunStr || '0').padStart(4, '0');
        const daesan = jibun.includes('산') ? '2' : '1';

        const newPnu = emdCode + daesan + bonbun + bubun;

        if (newPnu.length !== 19) {
            fail++;
            continue;
        }

        factory.pnu = newPnu;
        success++;
    }

    // 4. 저장
    fs.writeFileSync(factoriesPath, JSON.stringify(factories, null, 2));

    // 5. 결과 출력
    console.log('=== 결과 ===');
    console.log(`✅ 성공: ${success}`);
    console.log(`❌ 실패 합계: ${noJibun + parseError + sigError + emdError + fail}`);
    console.log(`   - 지번주소 없음: ${noJibun}`);
    console.log(`   - 파싱 실패: ${parseError}`);
    console.log(`   - 시군구 미지원: ${sigError}`);
    console.log(`   - 읍면동 매핑 없음: ${emdError}`);
    console.log(`   - PNU 길이 오류: ${fail}`);

    if (failedSamples.length > 0) {
        console.log('\n=== 실패 샘플 ===');
        failedSamples.forEach(s => console.log(`   ${s}`));
    }

    // 6. 매칭률 확인
    console.log('\n=== 필지 매칭률 확인 ===');
    const parcelsPath = path.join(process.cwd(), 'public/data/properties/parcels.json');
    const parcels = JSON.parse(fs.readFileSync(parcelsPath, 'utf-8'));
    const parcelPNUs = new Set(parcels.map((p: any) => p.PNU));

    let matched = 0;
    for (const f of factories) {
        if (f.pnu && parcelPNUs.has(f.pnu)) {
            matched++;
        }
    }
    console.log(`필지 매칭: ${matched}/${factories.length} (${(matched/factories.length*100).toFixed(2)}%)`);
}

main().catch(console.error);
