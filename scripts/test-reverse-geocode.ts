// scripts/test-reverse-geocode.ts
// 역지오코딩 API 테스트

const NAVER_CLIENT_ID = 's636cp22wi';
const NAVER_CLIENT_SECRET = 'hSGnpROTAE9w5PSwMUeeCDoHofkox1CkIk80fg1r';

async function testReverseGeocode() {
    // 인천 남동구 구월동 좌표 (구월테크노밸리)
    const lon = 126.709637320098;
    const lat = 37.4401987788729;

    const coords = `${lon},${lat}`;
    // 새로운 엔드포인트 (maps.apigw.ntruss.com)
    const url = `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${coords}&output=json&orders=legalcode`;

    console.log('🔍 역지오코딩 테스트...\n');
    console.log(`좌표: (${lon}, ${lat})`);
    console.log(`URL: ${url}\n`);

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
        console.log(`region: ${JSON.stringify(result.region, null, 2)}`);
        console.log(`land: ${JSON.stringify(result.land, null, 2)}`);
        console.log(`code (PNU): ${result.code?.id || 'N/A'}`);
    }
}

testReverseGeocode().catch(console.error);
