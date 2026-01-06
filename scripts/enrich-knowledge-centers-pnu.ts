#!/usr/bin/env tsx
// scripts/enrich-knowledge-centers-pnu.ts
// 지식산업센터에 PNU 추가 (좌표 → PNU 변환)

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 환경변수 로드
dotenv.config({ path: '.env.local' });

interface KnowledgeCenter {
    id: string;
    name: string;
    coord: [number, number] | null;
    pnu?: string;
    jibunAddress?: string;
    [key: string]: any;
}

/**
 * 좌표 → PNU 변환 (네이버 역지오코딩 API)
 */
async function coordToPNU(lng: number, lat: number): Promise<string | null> {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error('❌ NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 환경변수가 필요합니다.');
        return null;
    }

    try {
        // 네이버 역지오코딩 API
        const url = `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&orders=legalcode,addr&output=json`;

        const response = await fetch(url, {
            headers: {
                'X-NCP-APIGW-API-KEY-ID': clientId,
                'X-NCP-APIGW-API-KEY': clientSecret,
            }
        });

        const data = await response.json();

        if (data.status.code !== 0 || !data.results || data.results.length === 0) {
            console.warn(`⚠️  좌표 [${lng}, ${lat}] → PNU 변환 실패:`, data.status.message);
            return null;
        }

        const result = data.results[0];
        const region = result.region;
        const land = result.land;

        if (!region || !land) {
            console.warn(`⚠️  좌표 [${lng}, ${lat}] → 행정구역 정보 없음`);
            return null;
        }

        // PNU 조합
        const pnu = [
            region.area1.code.substring(0, 2),    // 시도
            region.area2.code.substring(2, 5),    // 시군구
            region.area3.code.substring(5, 8),    // 읍면동
            '00',                                 // 리 (동 지역은 00)
            land.number1.padStart(4, '0'),        // 본번
            (land.number2 || '0').padStart(4, '0'), // 부번
            land.type === '1' ? '1' : '2'         // 대/산
        ].join('');

        return pnu;
    } catch (error) {
        console.error(`❌ 좌표 [${lng}, ${lat}] → PNU 변환 오류:`, error);
        return null;
    }
}

/**
 * 메인 함수
 */
async function main() {
    console.log('🏢 지식산업센터 PNU 보완 시작...\n');

    // 1. 데이터 로드
    const dataPath = path.join(process.cwd(), 'public/data/properties/knowledge-centers.json');

    if (!fs.existsSync(dataPath)) {
        console.error('❌ public/data/properties/knowledge-centers.json 파일이 없습니다.');
        process.exit(1);
    }

    const centers: KnowledgeCenter[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    console.log(`📦 총 ${centers.length}개 지식산업센터 로드`);

    // 2. PNU 보완 필요한 항목 확인
    const needsPNU = centers.filter(c => !c.pnu && c.coord);
    const alreadyHasPNU = centers.filter(c => c.pnu);
    const noCoord = centers.filter(c => !c.coord);

    console.log(`✅ PNU 있음: ${alreadyHasPNU.length}개`);
    console.log(`🔄 PNU 보완 필요 (좌표 있음): ${needsPNU.length}개`);
    console.log(`❌ 좌표 없음 (수동 처리 필요): ${noCoord.length}개\n`);

    if (needsPNU.length === 0) {
        console.log('🎉 모든 지식산업센터에 PNU가 있습니다!');
        return;
    }

    // 3. PNU 변환 (API 호출 제한을 위해 100ms 간격)
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < needsPNU.length; i++) {
        const center = needsPNU[i];
        const [lng, lat] = center.coord!;

        console.log(`[${i + 1}/${needsPNU.length}] ${center.name} (${center.id})`);
        console.log(`   좌표: [${lng}, ${lat}]`);

        const pnu = await coordToPNU(lng, lat);

        if (pnu) {
            center.pnu = pnu;
            console.log(`   ✅ PNU: ${pnu}\n`);
            successCount++;
        } else {
            console.log(`   ❌ 변환 실패\n`);
            failCount++;
        }

        // API 호출 제한 (100ms 대기)
        if (i < needsPNU.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    console.log('\n========================================');
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failCount}개`);
    console.log(`⏭️  좌표 없음: ${noCoord.length}개`);
    console.log('========================================\n');

    // 4. 결과 저장
    fs.writeFileSync(dataPath, JSON.stringify(centers, null, 2));
    console.log(`💾 저장 완료: ${dataPath}`);

    // 5. 좌표 없는 항목 출력 (수동 처리용)
    if (noCoord.length > 0) {
        console.log('\n📝 좌표 없는 지식산업센터 (수동 처리 필요):');
        for (const center of noCoord) {
            console.log(`  - ${center.name} (${center.id})`);
            if (center.jibunAddress) {
                console.log(`    지번주소: ${center.jibunAddress}`);
            }
        }
    }

    console.log('\n🎉 완료!');
}

main().catch(console.error);
