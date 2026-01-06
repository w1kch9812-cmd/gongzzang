// scripts/update-complex-coords.ts
// 산업단지 마커 좌표를 polylabel로 재계산

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
                let largestArea = 0;
                let largestPolygon = geometry.coordinates[0];

                for (const polygon of geometry.coordinates) {
                    let area = 0;
                    const ring = polygon[0];
                    for (let i = 0; i < ring.length; i++) {
                        const j = (i + 1) % ring.length;
                        area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
                    }
                    area = Math.abs(area / 2);

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
    } catch (e) {
        return null;
    }
}

async function main() {
    console.log('🔧 산업단지 coord 업데이트 시작...\n');

    // GeoJSON 로드
    const geojsonPath = path.join(process.cwd(), 'temp/complex.geojson');
    if (!fs.existsSync(geojsonPath)) {
        console.error('❌ temp/complex.geojson 파일이 없습니다.');
        process.exit(1);
    }

    console.log('📖 GeoJSON 읽기...');
    const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
    console.log(`   총 ${geojson.features.length}개 피처`);

    // ID → polylabel 맵 생성
    const coordMap = new Map<string, [number, number]>();

    console.log('\n🔄 polylabel 계산 중...');
    let calculated = 0;
    let failed = 0;

    for (const feature of geojson.features) {
        const id = feature.properties.DAN_ID || feature.properties.id;
        if (!id) continue;

        const center = calculateVisualCenter(feature.geometry);
        if (center) {
            coordMap.set(String(id), center);
            calculated++;
        } else {
            failed++;
        }
    }

    console.log(`   ✅ 계산됨: ${calculated}개`);
    if (failed > 0) {
        console.log(`   ⚠️  실패: ${failed}개`);
    }

    // complexes.json 업데이트
    const complexesPath = path.join(process.cwd(), 'public/data/properties/complexes.json');
    const complexes = JSON.parse(fs.readFileSync(complexesPath, 'utf-8'));

    console.log(`\n📝 complexes.json 업데이트 중... (${complexes.length}개)`);
    let updated = 0;
    let notFound = 0;

    for (const complex of complexes) {
        const id = complex.id || complex.DAN_ID;
        const newCoord = coordMap.get(String(id));

        if (newCoord) {
            const oldCoord = complex.coord;
            complex.coord = newCoord;
            updated++;

            // 샘플 출력 (처음 3개만)
            if (updated <= 3) {
                console.log(`   [${id}] ${complex.name}`);
                console.log(`     이전: ${oldCoord ? `[${oldCoord[0].toFixed(6)}, ${oldCoord[1].toFixed(6)}]` : 'null'}`);
                console.log(`     이후: [${newCoord[0].toFixed(6)}, ${newCoord[1].toFixed(6)}]`);
            }
        } else {
            notFound++;
        }
    }

    console.log(`\n   ✅ 업데이트: ${updated}개`);
    if (notFound > 0) {
        console.log(`   ⚠️  GeoJSON에 없음: ${notFound}개`);
    }

    // 저장
    fs.writeFileSync(complexesPath, JSON.stringify(complexes, null, 2));
    console.log(`\n💾 저장 완료: ${complexesPath}`);

    // GeoJSON의 properties.coord도 업데이트
    console.log('\n📝 GeoJSON properties.coord 업데이트 중...');
    for (const feature of geojson.features) {
        const id = feature.properties.DAN_ID || feature.properties.id;
        if (id) {
            const newCoord = coordMap.get(String(id));
            if (newCoord) {
                feature.properties.coord = newCoord;
            }
        }
    }

    fs.writeFileSync(geojsonPath, JSON.stringify(geojson));
    console.log(`💾 저장 완료: ${geojsonPath}`);

    console.log('\n✨ 산업단지 coord 업데이트 완료!');
}

main().catch(console.error);
