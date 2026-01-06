// scripts/verify-complex-position.ts
// 산업단지 마커가 폴리곤 내부에 있는지 검증

import * as fs from 'fs';
import * as path from 'path';
import polylabel from 'polylabel';

// Point in polygon 검사 (ray casting)
function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];

        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }

    return inside;
}

// MultiPolygon에서 포인트 포함 여부 확인
function pointInMultiPolygon(point: [number, number], geometry: any): boolean {
    if (geometry.type === 'Polygon') {
        return pointInPolygon(point, geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
        for (const polygon of geometry.coordinates) {
            if (pointInPolygon(point, polygon[0])) {
                return true;
            }
        }
    }
    return false;
}

// 폴리곤 면적 계산
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

// Polylabel 계산
function calculateVisualCenter(geometry: any): [number, number] | null {
    if (!geometry) return null;

    try {
        switch (geometry.type) {
            case 'Point':
                return geometry.coordinates as [number, number];

            case 'Polygon': {
                const result = polylabel(geometry.coordinates, 0.0001);
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

                const result = polylabel(largestPolygon, 0.0001);
                return [result[0], result[1]];
            }

            default:
                return null;
        }
    } catch {
        return null;
    }
}

async function main() {
    console.log('🔍 산업단지 마커 위치 검증\n');

    // 데이터 로드
    const geojsonPath = path.join(process.cwd(), 'temp/complex.geojson');
    const complexesPath = path.join(process.cwd(), 'public/data/properties/complexes.json');

    const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
    const complexes = JSON.parse(fs.readFileSync(complexesPath, 'utf-8'));

    console.log(`📊 GeoJSON: ${geojson.features.length}개`);
    console.log(`📊 complexes.json: ${complexes.length}개\n`);

    // ID로 빠른 조회를 위한 맵
    const featureMap = new Map<string, any>();
    for (const feature of geojson.features) {
        const id = feature.properties.DAN_ID || feature.properties.id;
        if (id) featureMap.set(String(id), feature);
    }

    // 검증 결과
    let inside = 0;
    let outside = 0;
    let notFound = 0;
    const outsideList: any[] = [];

    for (const complex of complexes) {
        const id = complex.id || complex.DAN_ID;
        const coord = complex.coord;

        if (!coord) continue;

        const feature = featureMap.get(String(id));
        if (!feature) {
            notFound++;
            continue;
        }

        const isInside = pointInMultiPolygon(coord as [number, number], feature.geometry);

        if (isInside) {
            inside++;
        } else {
            outside++;
            // polylabel 재계산
            const polylabelCoord = calculateVisualCenter(feature.geometry);
            outsideList.push({
                id,
                name: complex.name,
                jsonCoord: coord,
                polylabelCoord,
                isPolylabelInside: polylabelCoord ? pointInMultiPolygon(polylabelCoord, feature.geometry) : null,
            });
        }
    }

    console.log('📍 결과:');
    console.log(`   ✅ 폴리곤 내부: ${inside}개`);
    console.log(`   ❌ 폴리곤 외부: ${outside}개`);
    console.log(`   ⚠️  GeoJSON 없음: ${notFound}개\n`);

    if (outsideList.length > 0) {
        console.log('❌ 폴리곤 외부에 있는 마커 (처음 10개):');
        for (const item of outsideList.slice(0, 10)) {
            console.log(`\n   [${item.id}] ${item.name}`);
            console.log(`     JSON coord: [${item.jsonCoord[0].toFixed(6)}, ${item.jsonCoord[1].toFixed(6)}]`);
            if (item.polylabelCoord) {
                console.log(`     polylabel:  [${item.polylabelCoord[0].toFixed(6)}, ${item.polylabelCoord[1].toFixed(6)}]`);
                console.log(`     polylabel inside: ${item.isPolylabelInside ? '✅' : '❌'}`);
            }
        }
    }
}

main().catch(console.error);
