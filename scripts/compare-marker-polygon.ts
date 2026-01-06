// scripts/compare-marker-polygon.ts
// 마커 좌표와 폴리곤 중심 비교

import * as fs from 'fs';
import * as path from 'path';
import polylabel from 'polylabel';

async function main() {
    console.log('🔍 마커 vs 폴리곤 좌표 비교\n');

    // 마커 데이터
    const markersPath = path.join(process.cwd(), 'public/data/properties/parcel-markers.json');
    const markers = JSON.parse(fs.readFileSync(markersPath, 'utf-8'));

    // GeoJSON 데이터
    const geojsonPath = path.join(process.cwd(), 'temp/parcels.geojson');
    const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));

    console.log(`마커: ${markers.length}개`);
    console.log(`폴리곤: ${geojson.features.length}개\n`);

    // 처음 5개 비교
    for (let i = 0; i < Math.min(5, markers.length); i++) {
        const marker = markers[i];
        const feature = geojson.features.find((f: any) => f.properties.PNU === marker.id);

        if (!feature) {
            console.log(`⚠️  [${i}] PNU ${marker.id}: GeoJSON에서 찾을 수 없음`);
            continue;
        }

        // 폴리곤에서 polylabel 재계산
        const geometry = feature.geometry;
        let calculatedCenter: [number, number] | null = null;

        if (geometry.type === 'Polygon') {
            try {
                const result = polylabel(geometry.coordinates, 0.001);
                calculatedCenter = [result[0], result[1]];
            } catch (e) {
                console.log(`❌ polylabel 계산 실패: ${e}`);
            }
        }

        console.log(`📍 [${i}] ${marker.jibun}`);
        console.log(`  PNU: ${marker.id}`);
        console.log(`  마커 좌표:     [${marker.coord[0].toFixed(8)}, ${marker.coord[1].toFixed(8)}]`);
        console.log(`  피처 coord:    [${feature.properties.coord[0].toFixed(8)}, ${feature.properties.coord[1].toFixed(8)}]`);
        if (calculatedCenter) {
            console.log(`  polylabel 재계산: [${calculatedCenter[0].toFixed(8)}, ${calculatedCenter[1].toFixed(8)}]`);
        }

        // 차이 계산
        const diffX = Math.abs(marker.coord[0] - feature.properties.coord[0]);
        const diffY = Math.abs(marker.coord[1] - feature.properties.coord[1]);
        const diffMeters = Math.sqrt(diffX ** 2 + diffY ** 2) * 111000; // 대략적인 미터 변환

        console.log(`  차이: ${diffMeters.toFixed(2)}m`);
        console.log('');
    }

    // 통계
    let totalDiff = 0;
    let maxDiff = 0;
    let count = 0;

    for (const marker of markers.slice(0, 100)) {
        const feature = geojson.features.find((f: any) => f.properties.PNU === marker.id);
        if (feature && feature.properties.coord) {
            const diffX = Math.abs(marker.coord[0] - feature.properties.coord[0]);
            const diffY = Math.abs(marker.coord[1] - feature.properties.coord[1]);
            const diffMeters = Math.sqrt(diffX ** 2 + diffY ** 2) * 111000;
            totalDiff += diffMeters;
            maxDiff = Math.max(maxDiff, diffMeters);
            count++;
        }
    }

    console.log('📊 통계 (처음 100개):');
    console.log(`  평균 차이: ${(totalDiff / count).toFixed(2)}m`);
    console.log(`  최대 차이: ${maxDiff.toFixed(2)}m`);

    if (totalDiff / count > 50) {
        console.log('\n⚠️  경고: 평균 차이가 50m 이상입니다! 좌표가 정확하지 않을 수 있습니다.');
    } else if (totalDiff / count > 10) {
        console.log('\n⚠️  주의: 평균 차이가 10m 이상입니다.');
    } else {
        console.log('\n✅ 좌표 일치도가 양호합니다 (평균 오차 10m 이하).');
    }
}

main().catch(console.error);
