// scripts/test-failed-geocode-samples.ts
// 여러 실패 케이스의 역지오코딩 테스트

import * as fs from 'fs';
import * as XLSX from 'xlsx';

const NAVER_CLIENT_ID = 's636cp22wi';
const NAVER_CLIENT_SECRET = 'hSGnpROTAE9w5PSwMUeeCDoHofkox1CkIk80fg1r';

async function testMultipleFailures() {
    // 1. factories.json 로드
    const factories = JSON.parse(fs.readFileSync('public/data/properties/factories.json', 'utf-8'));

    // 2. Excel 로드
    const wb = XLSX.readFile('rawdata/전국공장등록현황.xlsx');
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData: any[] = XLSX.utils.sheet_to_json(ws);
    const incheonRaw = rawData.filter(row => row['시도명'] === '인천광역시');

    // 3. "기타" 실패 케이스 찾기
    const otherFailures: any[] = [];

    for (const factory of factories) {
        if (factory.pnu && factory.pnu.length === 19) continue;
        if (!factory.coord || !factory.coord[0] || !factory.coord[1]) continue;

        const rawFactory = incheonRaw.find((r: any) => r['회사명'] === factory.name);
        if (!rawFactory) continue;
        if (!rawFactory['공장주소_지번']) continue;

        otherFailures.push({
            name: factory.name,
            coord: factory.coord,
            sigungu: rawFactory['시군구명'],
            jibunAddress: rawFactory['공장주소_지번']
        });
    }

    console.log(`🔍 "기타" 실패 케이스 역지오코딩 테스트\n`);
    console.log(`총 ${otherFailures.length}개 중 5개 샘플 테스트\n`);

    // 서구, 미추홀구, 남동구, 동구, 연수구에서 각 1개씩
    const samples = [
        otherFailures.find(f => f.sigungu === '서구'),
        otherFailures.find(f => f.sigungu === '미추홀구'),
        otherFailures.find(f => f.sigungu === '남동구'),
        otherFailures.find(f => f.sigungu === '동구'),
        otherFailures.find(f => f.sigungu === '연수구'),
    ].filter(Boolean);

    for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        console.log(`\n[${ i + 1}/${samples.length}] ${sample.name} (${sample.sigungu})`);
        console.log(`   좌표: [${sample.coord[0]}, ${sample.coord[1]}]`);
        console.log(`   Excel 지번: ${sample.jibunAddress}`);

        const [lon, lat] = sample.coord;
        const coords = `${lon},${lat}`;
        const url = `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${coords}&output=json&orders=legalcode`;

        try {
            const response = await fetch(url, {
                headers: {
                    'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
                    'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
                },
            });

            if (response.status === 200) {
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    const code = data.results[0].code;
                    console.log(`   ✅ 성공: code.id = ${code?.id || 'N/A'}`);
                } else {
                    console.log(`   ❌ 결과 없음`);
                }
            } else {
                console.log(`   ❌ HTTP ${response.status}`);
            }
        } catch (error) {
            console.log(`   ❌ 에러: ${error}`);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

testMultipleFailures().catch(console.error);
