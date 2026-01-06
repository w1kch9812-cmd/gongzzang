// scripts/test-jibun-parsing.ts
// 지번 파싱 테스트

// 지번주소에서 본번/부번 추출
function parseJibunNumber(jibunAddress: string): { bonbun: string; bubun: string; isSan: boolean } | null {
    const isSan = jibunAddress.includes(' 산 ');

    // "123-45번지" 또는 "123번지" 패턴 찾기 (번지 앞의 숫자)
    const pattern = /(\d+)(?:-(\d+))?번지/;
    const match = jibunAddress.match(pattern);

    if (!match) return null;

    const bonbun = match[1];
    const bubun = match[2] || '0';

    return { bonbun, bubun, isSan };
}

// 테스트 케이스
const testCases = [
    "인천광역시 서구 가좌동 273-29번지 3층",
    "인천광역시 미추홀구 숭의동 128-46번지 숭의동상가",
    "인천광역시 남동구 구월동 1550-3번지 C동 504호, 505호",
    "인천광역시 동구 만석동 41-36번지 효창산업주식회사 H동",
    "인천광역시 연수구 옥련동 526-10번지 1층",
    "인천광역시 중구 항동7가 85-6번지 1층",
    "인천광역시 중구 율목동 49번지 1층",
    "인천광역시 중구 운서동 2840-13번지 (대한항공 기내식시설A)",
];

console.log('🔍 지번 파싱 테스트\n');

testCases.forEach((addr, i) => {
    const result = parseJibunNumber(addr);
    console.log(`[${i + 1}] ${addr}`);
    if (result) {
        console.log(`   ✅ 본번: ${result.bonbun}, 부번: ${result.bubun}, 산: ${result.isSan}`);
    } else {
        console.log(`   ❌ 파싱 실패`);
    }
    console.log('');
});
