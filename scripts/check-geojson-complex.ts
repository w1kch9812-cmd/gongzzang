// scripts/check-geojson-complex.ts
import * as fs from 'fs';
import polylabel from 'polylabel';

const geojson = JSON.parse(fs.readFileSync('temp/complex.geojson', 'utf-8'));
console.log('총 피처 수:', geojson.features.length);

// 첫 피처의 properties 확인
const sample = geojson.features[0];
console.log('\n샘플 피처 properties:');
console.log(Object.keys(sample.properties));

// 인천 좌표 범위의 피처만 필터링
const incheon = geojson.features.filter((f: any) => {
    if (!f.geometry || !f.geometry.coordinates) return false;

    // 폴리곤의 첫 좌표 확인
    let coords: number[];
    if (f.geometry.type === 'Polygon') {
        coords = f.geometry.coordinates[0][0];
    } else if (f.geometry.type === 'MultiPolygon') {
        coords = f.geometry.coordinates[0][0][0];
    } else {
        return false;
    }

    const [lng, lat] = coords;
    return lng >= 126.3 && lng <= 127.0 && lat >= 37.3 && lat <= 37.7;
});

console.log('\n인천 지역 피처:', incheon.length, '개');

// 남동 관련 찾기
const namdong = geojson.features.filter((f: any) => {
    const name = f.properties.DAN_NAME || f.properties.name || '';
    return name.includes('남동');
});
console.log('\n남동 관련 피처:', namdong.length, '개');
for (const f of namdong) {
    console.log('  -', f.properties.DAN_ID, f.properties.DAN_NAME);
}

// 인천 중 도시첨단(type 3) 찾기
const urbanHiTech = incheon.filter((f: any) => {
    const type = f.properties.DANJI_TYPE || f.properties.type;
    return type === '3' || type === 3;
});
console.log('\n인천 도시첨단(type 3):', urbanHiTech.length, '개');
for (const f of urbanHiTech) {
    const id = f.properties.DAN_ID || f.properties.id;
    const name = f.properties.DAN_NAME || f.properties.name;

    // polylabel 계산
    let center: number[];
    if (f.geometry.type === 'Polygon') {
        center = polylabel(f.geometry.coordinates, 0.001);
    } else if (f.geometry.type === 'MultiPolygon') {
        let largest = f.geometry.coordinates[0];
        let maxArea = 0;
        for (const poly of f.geometry.coordinates) {
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
        center = polylabel(largest, 0.001);
    } else {
        continue;
    }

    console.log('  -', id, name, 'polylabel:', `[${center[0].toFixed(6)}, ${center[1].toFixed(6)}]`);
}
