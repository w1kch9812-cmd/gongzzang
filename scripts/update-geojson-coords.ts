// scripts/update-geojson-coords.ts
// GeoJSON properties.coord를 polylabel로 재계산

import * as fs from 'fs';
import * as path from 'path';
import polylabel from 'polylabel';

function calculateVisualCenter(geometry: any): [number, number] | null {
    if (!geometry) return null;

    try {
        switch (geometry.type) {
            case 'Point':
                return geometry.coordinates as [number, number];

            case 'Polygon': {
                const result = polylabel(geometry.coordinates, 0.001);
                return [result[0], result[1]];
            }

            case 'MultiPolygon': {
                // 가장 큰 폴리곤 선택
                let largestArea = 0;
                let largestPolygon = geometry.coordinates[0];

                for (const polygon of geometry.coordinates) {
                    const area = calculatePolygonArea(polygon[0]);
                    if (area > largestArea) {
                        largestArea = area;
                        largestPolygon = polygon;
                    }
                }

                const result = polylabel(largestPolygon, 0.001);
                return [result[0], result[1]];
            }

            default:
                return null;
        }
    } catch {
        return null;
    }
}

function calculatePolygonArea(ring: number[][]): number {
    let area = 0;
    const n = ring.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += ring[i][0] * ring[j][1];
        area -= ring[j][0] * ring[i][1];
    }
    return Math.abs(area / 2);
}

async function main() {
    console.log('🔧 GeoJSON coord 업데이트 시작...\n');

    const geojsonPath = path.join(process.cwd(), 'temp/parcels.geojson');

    if (!fs.existsSync(geojsonPath)) {
        console.error('❌ temp/parcels.geojson 파일이 없습니다.');
        process.exit(1);
    }

    console.log('📖 GeoJSON 읽기...');
    const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
    console.log(`   총 ${geojson.features.length}개 피처`);

    console.log('\n🔄 coord 재계산 중...');
    let updated = 0;
    let failed = 0;

    for (const feature of geojson.features) {
        if (feature.geometry) {
            const newCoord = calculateVisualCenter(feature.geometry);
            if (newCoord) {
                feature.properties.coord = newCoord;
                updated++;
            } else {
                failed++;
            }
        }
    }

    console.log(`   ✅ 성공: ${updated}개`);
    if (failed > 0) {
        console.log(`   ⚠️  실패: ${failed}개`);
    }

    console.log('\n💾 GeoJSON 저장 중...');
    fs.writeFileSync(geojsonPath, JSON.stringify(geojson));

    const sizeMB = (fs.statSync(geojsonPath).size / 1024 / 1024).toFixed(2);
    console.log(`   ✅ 저장 완료: ${geojsonPath} (${sizeMB} MB)`);
    console.log('\n✨ GeoJSON coord 업데이트 완료!');
}

main().catch(console.error);
