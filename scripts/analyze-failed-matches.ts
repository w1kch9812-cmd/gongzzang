// scripts/analyze-failed-matches.ts
import * as fs from 'fs';

const centers = JSON.parse(fs.readFileSync('public/data/properties/knowledge-centers.json', 'utf-8'));

// 실패한 항목 분석
const failed = centers.filter((c: any) => c.coord && (!c.pnu || c.pnu.length !== 19));

console.log('❌ 실패한 지식산업센터 분석\n');
console.log('총 실패: ' + failed.length + '개\n');

// emd 코드별 그룹화
const byEmd: Record<string, string[]> = {};
failed.forEach((c: any) => {
  const emd = c.emdCode || '코드없음';
  if (!byEmd[emd]) byEmd[emd] = [];
  byEmd[emd].push(c.name);
});

// 코드별 출력
for (const [emd, names] of Object.entries(byEmd)) {
  // emd 코드 해석
  let region = '알 수 없음';
  if (emd.startsWith('2824')) region = '계양구';
  else if (emd.startsWith('2817')) region = '미추홀구(구 남구)';
  else if (emd.startsWith('2823')) region = '부평구';
  else if (emd.startsWith('2826')) region = '서구';
  else if (emd.startsWith('2818')) region = '연수구';
  else if (emd.startsWith('2811')) region = '중구';
  else if (emd.startsWith('2820')) region = '남동구';

  console.log(`📍 ${emd} (${region}): ${names.length}개`);
  names.slice(0, 3).forEach(name => console.log(`   - ${name}`));
  if (names.length > 3) console.log(`   ... 외 ${names.length - 3}개`);
  console.log('');
}

// parcels.json에 있는 emd 코드
const parcels = JSON.parse(fs.readFileSync('public/data/properties/parcels.json', 'utf-8'));
const parcelEmds = [...new Set(parcels.map((p: any) => p.PNU.substring(0, 10)))];
console.log('\n📦 parcels.json에 있는 읍면동 코드:');
(parcelEmds as string[]).forEach((emd: string) => {
  let region = '알 수 없음';
  if (emd.startsWith('2820')) region = '남동구';
  console.log(`   ${emd} (${region})`);
});
