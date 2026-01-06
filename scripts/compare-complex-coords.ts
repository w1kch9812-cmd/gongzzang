// scripts/compare-complex-coords.ts
// 산업단지 마커 좌표와 폴리곤 중심 비교

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
    console.log('🔍 산업단지 마커 vs 폴리곤 좌표 비교\n');

    // 마커 데이터 (complexes.json)
    const complexesPath = path.join(process.cwd(), 'public/data/properties/complexes.json');
    const complexes = JSON.parse(fs.readFileSync(complexesPath, 'utf-8'));
    console.log(`✅ 산업단지 JSON: ${complexes.length}개`);

    // GeoJSON 데이터 (temp/complex.geojson)
    const geojsonPath = path.join(process.cwd(), 'temp/complex.geojson');
    if (!fs.existsSync(geojsonPath)) {
        console.log('❌ temp/complex.geojson 파일이 없습니다.');
        return;
    }

    const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
    console.log(`✅ 산업단지 GeoJSON: ${geojson.features.length}개\n`);

    // 인천 산업단지만 필터링 (코드 28로 시작)
    const incheonComplexes = complexes.filter((c: any) => {
        const code = c.sigCode || c.SIG_CD || '';
        return code.startsWith('28');
    });
    console.log(`📍 인천 산업단지: ${incheonComplexes.length}개\n`);

    // 처음 5개 비교
    for (let i = 0; i < Math.min(5, incheonComplexes.length); i++) {
        const complex = incheonComplexes[i];
        const id = complex.id || complex.DAN_ID;
        const name = complex.name || complex.DAN_NAME;

        // GeoJSON에서 찾기
        const feature = geojson.features.find((f: any) =>
            f.properties.DAN_ID === id || f.properties.id === id
        );

        console.log(`📍 [${i}] ${name}`);
        console.log(`  ID: ${id}`);
        console.log(`  JSON coord: ${complex.coord ? `[${complex.coord[0]?.toFixed(6)}, ${complex.coord[1]?.toFixed(6)}]` : 'null'}`);

        if (feature) {
            const polylabelCoord = calculateVisualCenter(feature.geometry);
            console.log(`  polylabel: ${polylabelCoord ? `[${polylabelCoord[0].toFixed(6)}, ${polylabelCoord[1].toFixed(6)}]` : 'null'}`);

            if (complex.coord && polylabelCoord) {
                const diffX = Math.abs(complex.coord[0] - polylabelCoord[0]);
                const diffY = Math.abs(complex.coord[1] - polylabelCoord[1]);
                const diffMeters = Math.sqrt(diffX ** 2 + diffY ** 2) * 111000;
                console.log(`  차이: ${diffMeters.toFixed(2)}m`);
            }
        } else {
            console.log(`  ⚠️ GeoJSON에서 찾을 수 없음`);
        }
        console.log('');
    }
}

main().catch(console.error);
