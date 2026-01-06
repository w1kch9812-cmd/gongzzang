// scripts/debug-marker-coords.ts
// 마커와 폴리곤 좌표 비교 디버깅

import * as fs from 'fs';
import * as path from 'path';

async function main() {
    console.log('🔍 마커 좌표 디버깅...\n');

    // 마커 데이터
    const markersPath = path.join(process.cwd(), 'public/data/properties/parcel-markers.json');
    const markers = JSON.parse(fs.readFileSync(markersPath, 'utf-8'));
    console.log(`✅ 마커 데이터: ${markers.length}개`);
    console.log(`샘플 마커:`, JSON.stringify(markers[0], null, 2));

    // GeoJSON 데이터
    const geojsonPath = path.join(process.cwd(), 'temp/parcels.geojson');
    const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
    console.log(`\n✅ GeoJSON 피처: ${geojson.features.length}개`);

    // 첫 번째 피처 상세 비교
    const feature0 = geojson.features[0];
    const marker0 = markers[0];

    console.log(`\n📍 첫 번째 필지 비교:`);
    console.log(`  PNU: ${feature0.properties.PNU}`);
    console.log(`  Marker coord: [${marker0.coord[0]}, ${marker0.coord[1]}]`);
    console.log(`  Feature coord: [${feature0.properties.coord[0]}, ${feature0.properties.coord[1]}]`);
    console.log(`  Geometry type: ${feature0.geometry.type}`);

    // 폴리곤 경계 계산
    const coords = feature0.geometry.coordinates[0];
    const lngs = coords.map((c: number[]) => c[0]);
    const lats = coords.map((c: number[]) => c[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    console.log(`  Polygon bounds:`);
    console.log(`    lng: ${minLng} ~ ${maxLng}`);
    console.log(`    lat: ${minLat} ~ ${maxLat}`);
    console.log(`  Marker within bounds?`);
    console.log(`    lng: ${marker0.coord[0] >= minLng && marker0.coord[0] <= maxLng}`);
    console.log(`    lat: ${marker0.coord[1] >= minLat && marker0.coord[1] <= maxLat}`);

    // 좌표 순서 확인
    console.log(`\n🔄 좌표 순서 확인:`);
    console.log(`  Marker coord: [경도=${marker0.coord[0]}, 위도=${marker0.coord[1]}]`);
    console.log(`  Expected: [longitude, latitude] (GeoJSON 표준)`);

    // 통계
    let inBoundsCount = 0;
    let outOfBoundsCount = 0;

    for (let i = 0; i < Math.min(100, markers.length); i++) {
        const marker = markers[i];
        const feature = geojson.features.find((f: any) =>
            f.properties.PNU === marker.id || f.properties.id === marker.id
        );

        if (feature && feature.geometry.type === 'Polygon') {
            const coords = feature.geometry.coordinates[0];
            const lngs = coords.map((c: number[]) => c[0]);
            const lats = coords.map((c: number[]) => c[1]);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);

            if (marker.coord[0] >= minLng && marker.coord[0] <= maxLng &&
                marker.coord[1] >= minLat && marker.coord[1] <= maxLat) {
                inBoundsCount++;
            } else {
                outOfBoundsCount++;
                if (outOfBoundsCount <= 3) {
                    console.log(`\n⚠️ 범위 밖 마커 발견 (${i}번째):`);
                    console.log(`  PNU: ${marker.id}`);
                    console.log(`  Marker: [${marker.coord[0]}, ${marker.coord[1]}]`);
                    console.log(`  Bounds: lng=[${minLng}, ${maxLng}], lat=[${minLat}, ${maxLat}]`);
                }
            }
        }
    }

    console.log(`\n📊 통계 (처음 100개):`);
    console.log(`  범위 내: ${inBoundsCount}개`);
    console.log(`  범위 밖: ${outOfBoundsCount}개`);
}

main().catch(console.error);
