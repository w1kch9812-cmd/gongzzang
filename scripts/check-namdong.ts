// scripts/check-namdong.ts
import * as fs from 'fs';
import polylabel from 'polylabel';

// complexes.json에서 남동 도시첨단 (328020) 찾기
const complexes = JSON.parse(fs.readFileSync('public/data/properties/complexes.json', 'utf-8'));
const target = complexes.find((c: any) => c.id === '328020');
console.log('=== 남동도시첨단산업단지 (328020) ===');
console.log('JSON coord:', target?.coord);

// GeoJSON에서 찾기
const geojson = JSON.parse(fs.readFileSync('temp/complex.geojson', 'utf-8'));
const feature = geojson.features.find((f: any) => f.properties.DAN_ID === '328020');

if (feature) {
    console.log('GeoJSON 피처 발견!');
    console.log('geometry type:', feature.geometry.type);

    let result: number[];

    if (feature.geometry.type === 'Polygon') {
        result = polylabel(feature.geometry.coordinates, 0.001);
    } else if (feature.geometry.type === 'MultiPolygon') {
        // 가장 큰 폴리곤 선택
        let largest = feature.geometry.coordinates[0];
        let maxArea = 0;
        for (const poly of feature.geometry.coordinates) {
            let area = 0;
            const ring = poly[0];
            for (let i = 0; i < ring.length; i++) {
                const j = (i + 1) % ring.length;
                area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
            }
            area = Math.abs(area / 2);
            if (area > maxArea) {
                maxArea = area;
                largest = poly;
            }
        }
        result = polylabel(largest, 0.001);
    } else {
        console.log('지원하지 않는 geometry type');
        process.exit(1);
    }

    console.log('polylabel 계산:', [result[0], result[1]]);

    if (target?.coord) {
        const diff = Math.sqrt(
            Math.pow(target.coord[0] - result[0], 2) +
            Math.pow(target.coord[1] - result[1], 2)
        ) * 111000;
        console.log('차이:', diff.toFixed(2), 'm');
    }
} else {
    console.log('GeoJSON에서 찾을 수 없음');
}
