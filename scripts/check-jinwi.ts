// scripts/check-jinwi.ts
// 진위산업단지 폴리라벨 검증

import * as fs from 'fs';
import * as path from 'path';
import polylabel from 'polylabel';

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

function getBoundingBox(ring: number[][]): { minLng: number; maxLng: number; minLat: number; maxLat: number } {
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    for (const [lng, lat] of ring) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
    }

    return { minLng, maxLng, minLat, maxLat };
}

async function main() {
    console.log('🔍 진위산업단지 폴리라벨 검증\n');

    const geojsonPath = path.join(process.cwd(), 'temp/complex.geojson');
    const complexesPath = path.join(process.cwd(), 'public/data/properties/complexes.json');

    const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
    const complexes = JSON.parse(fs.readFileSync(complexesPath, 'utf-8'));

    // 진위 관련 산업단지 찾기
    const jinwiComplexes = complexes.filter((c: any) => c.name && c.name.includes('진위'));

    for (const complex of jinwiComplexes) {
        console.log(`\n📍 [${complex.id}] ${complex.name}`);
        console.log(`   JSON coord: [${complex.coord[0].toFixed(6)}, ${complex.coord[1].toFixed(6)}]`);

        // GeoJSON에서 찾기
        const feature = geojson.features.find((f: any) =>
            f.properties.DAN_ID === complex.id || f.properties.id === complex.id
        );

        if (!feature) {
            console.log('   ⚠️ GeoJSON에서 찾을 수 없음');
            continue;
        }

        const geometry = feature.geometry;
        console.log(`   Geometry type: ${geometry.type}`);

        if (geometry.type === 'Polygon') {
            const ring = geometry.coordinates[0];
            const bbox = getBoundingBox(ring);
            const area = calculatePolygonArea(ring);

            console.log(`   Bounding box:`);
            console.log(`     Lng: ${bbox.minLng.toFixed(6)} ~ ${bbox.maxLng.toFixed(6)}`);
            console.log(`     Lat: ${bbox.minLat.toFixed(6)} ~ ${bbox.maxLat.toFixed(6)}`);
            console.log(`   Area: ${area.toFixed(8)}`);

            const pl = polylabel(geometry.coordinates, 0.0001);
            console.log(`   Polylabel: [${pl[0].toFixed(6)}, ${pl[1].toFixed(6)}]`);

            // 중심점 계산
            const centerLng = (bbox.minLng + bbox.maxLng) / 2;
            const centerLat = (bbox.minLat + bbox.maxLat) / 2;
            console.log(`   BBox center: [${centerLng.toFixed(6)}, ${centerLat.toFixed(6)}]`);

        } else if (geometry.type === 'MultiPolygon') {
            console.log(`   총 ${geometry.coordinates.length}개 폴리곤`);

            let largestArea = 0;
            let largestIdx = 0;

            for (let i = 0; i < geometry.coordinates.length; i++) {
                const polygon = geometry.coordinates[i];
                const ring = polygon[0];
                const area = calculatePolygonArea(ring);
                const bbox = getBoundingBox(ring);

                console.log(`\n   [폴리곤 ${i}]`);
                console.log(`     Area: ${area.toFixed(8)}`);
                console.log(`     Lng: ${bbox.minLng.toFixed(6)} ~ ${bbox.maxLng.toFixed(6)}`);
                console.log(`     Lat: ${bbox.minLat.toFixed(6)} ~ ${bbox.maxLat.toFixed(6)}`);

                if (area > largestArea) {
                    largestArea = area;
                    largestIdx = i;
                }
            }

            console.log(`\n   ✅ 가장 큰 폴리곤: ${largestIdx} (area: ${largestArea.toFixed(8)})`);

            const largestPolygon = geometry.coordinates[largestIdx];
            const pl = polylabel(largestPolygon, 0.0001);
            console.log(`   Polylabel (largest): [${pl[0].toFixed(6)}, ${pl[1].toFixed(6)}]`);
        }
    }
}

main().catch(console.error);
