// scripts/test-failed-geocode.ts
// 실패한 케이스의 역지오코딩 테스트

import * as fs from 'fs';

const NAVER_CLIENT_ID = 's636cp22wi';
const NAVER_CLIENT_SECRET = 'hSGnpROTAE9w5PSwMUeeCDoHofkox1CkIk80fg1r';

async function testFailedCase() {
    // factories.json에서 실패한 케이스 하나 가져오기
    const factories = JSON.parse(fs.readFileSync('public/data/properties/factories.json', 'utf-8'));

    const failed = factories.find((f: any) =>
        (!f.pnu || f.pnu.length !== 19) &&
        f.coord &&
        f.coord[0] &&
        f.coord[1] &&
        !f.emdCode
    );

    if (!failed) {
        console.log('실패 케이스를 찾을 수 없습니다.');
        return;
    }

    console.log('🔍 실패 케이스 테스트\n');
    console.log(`공장명: ${failed.name}`);
    console.log(`좌표: [${failed.coord[0]}, ${failed.coord[1]}]`);
    console.log(`주소: ${failed.address || '없음'}\n`);

    const [lon, lat] = failed.coord;
    const coords = `${lon},${lat}`;
    const url = `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${coords}&output=json&orders=legalcode`;

    console.log(`URL: ${url}\n`);

    try {
        const response = await fetch(url, {
            headers: {
                'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
                'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
            },
        });

        console.log(`Status: ${response.status}\n`);

        const data = await response.json();
        console.log('응답:');
        console.log(JSON.stringify(data, null, 2));

        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            console.log('\n📍 파싱 결과:');
            console.log(`code.id: ${result.code?.id || 'N/A'}`);
            console.log(`region: ${JSON.stringify(result.region, null, 2)}`);
        }
    } catch (error) {
        console.error('에러:', error);
    }
}

testFailedCase().catch(console.error);
