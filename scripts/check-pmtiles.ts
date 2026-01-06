// scripts/check-pmtiles.ts
// PMTiles 파일 검증 스크립트

import { PMTiles } from 'pmtiles';
import * as fs from 'fs';
import * as path from 'path';

async function checkPMTiles(name: string) {
    const filePath = path.join(process.cwd(), 'public', 'tiles', `${name}.pmtiles`);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ ${name}: 파일 없음 (${filePath})`);
        return;
    }

    const stats = fs.statSync(filePath);
    console.log(`\n📦 ${name}.pmtiles (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    try {
        const buffer = fs.readFileSync(filePath);
        const pmtiles = new PMTiles(new Uint8Array(buffer).buffer as any);
        const header = await pmtiles.getHeader();
        const metadata = await pmtiles.getMetadata();

        console.log(`   줌 레벨: ${header.minZoom} - ${header.maxZoom}`);
        console.log(`   압축: ${['none', 'unknown', 'gzip', 'brotli', 'zstd'][header.tileCompression] || header.tileCompression}`);
        console.log(`   타일 타입: ${['unknown', 'mvt', 'png', 'jpeg', 'webp', 'avif'][header.tileType] || header.tileType}`);

        // vector_layers 확인
        const vectorLayers = (metadata as any).vector_layers;
        if (vectorLayers && vectorLayers.length > 0) {
            console.log(`   레이어: ${vectorLayers.map((l: any) => l.id).join(', ')}`);

            // 첫 번째 레이어의 필드 정보
            const firstLayer = vectorLayers[0];
            if (firstLayer.fields) {
                const fields = Object.keys(firstLayer.fields);
                console.log(`   필드 (${firstLayer.id}): ${fields.slice(0, 5).join(', ')}${fields.length > 5 ? '...' : ''}`);
            }
        } else {
            console.log(`   ⚠️ vector_layers 메타데이터 없음`);
        }

        // 중간 줌 레벨에서 타일 테스트
        const testZoom = Math.floor((header.minZoom + header.maxZoom) / 2);

        // 인천 좌표 (126.7, 37.45) 기준 타일 좌표 계산
        const lon = 126.7;
        const lat = 37.45;
        const n = Math.pow(2, testZoom);
        const testX = Math.floor((lon + 180) / 360 * n);
        const testY = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);

        const tile = await pmtiles.getZxy(testZoom, testX, testY);
        if (tile && tile.data.byteLength > 0) {
            console.log(`   ✅ 테스트 타일 (z${testZoom}/${testX}/${testY}): ${tile.data.byteLength} bytes`);
        } else {
            console.log(`   ⚠️ 테스트 타일 (z${testZoom}/${testX}/${testY}): 비어있음`);
        }

    } catch (e) {
        console.log(`   ❌ 파싱 오류: ${e}`);
    }
}

async function main() {
    console.log('🔍 PMTiles 검증 시작...\n');
    console.log('경로:', path.join(process.cwd(), 'public', 'tiles'));

    const files = ['sido', 'sig', 'emd', 'li', 'parcels', 'complex', 'lots', 'industries'];

    for (const name of files) {
        await checkPMTiles(name);
    }

    console.log('\n✅ 검증 완료');
}

main().catch(console.error);
