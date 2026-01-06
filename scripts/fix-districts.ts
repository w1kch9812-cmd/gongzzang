// scripts/fix-districts.ts
// districts JSON 파일의 id, name 필드 복구

import * as fs from 'fs';
import * as path from 'path';
import polylabel from 'polylabel';

interface Feature {
    type: string;
    properties: Record<string, any>;
    geometry: any;
}

interface FeatureCollection {
    type: string;
    features: Feature[];
}

// 폴리곤의 시각적 중심점 계산
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
                // 가장 큰 폴리곤 찾기
                let maxArea = 0;
                let largestPolygon: number[][][] = geometry.coordinates[0];

                for (const polygon of geometry.coordinates) {
                    const ring = polygon[0];
                    let area = 0;
                    for (let i = 0; i < ring.length - 1; i++) {
                        area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
                    }
                    area = Math.abs(area / 2);
                    if (area > maxArea) {
                        maxArea = area;
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
        console.warn('중심점 계산 실패:', e);
        return null;
    }
}

// 시도 GeoJSON에서 districts 생성
function processSido(): void {
    console.log('\n📍 시도 districts 생성...');

    const geojsonPath = path.join(process.cwd(), 'temp/sido.geojson');
    const outputPath = path.join(process.cwd(), 'public/data/properties/districts-sido.json');

    if (!fs.existsSync(geojsonPath)) {
        console.warn('  ⚠️  GeoJSON 파일 없음:', geojsonPath);
        return;
    }

    const geojson: FeatureCollection = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));

    const districts = geojson.features.map(f => {
        const props = f.properties;
        const coord = calculateVisualCenter(f.geometry) || props.coord;

        return {
            id: props.code || props.id,
            code: props.code,
            name: props.name,
            coord: coord,
            level: 'sido' as const,
            parcelCount: 0,
            listingCount: 0,
            auctionCount: 0,
            avgPrice: 0,
        };
    }).filter(d => d.id && d.name);

    fs.writeFileSync(outputPath, JSON.stringify(districts, null, 2));
    console.log(`  ✅ 저장 완료: ${outputPath} (${districts.length}개)`);
}

// 시군구 GeoJSON에서 districts 생성
function processSig(): void {
    console.log('\n📍 시군구 districts 생성...');

    const geojsonPath = path.join(process.cwd(), 'temp/sig.geojson');
    const outputPath = path.join(process.cwd(), 'public/data/properties/districts-sig.json');

    if (!fs.existsSync(geojsonPath)) {
        console.warn('  ⚠️  GeoJSON 파일 없음:', geojsonPath);
        return;
    }

    const geojson: FeatureCollection = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));

    const districts = geojson.features.map(f => {
        const props = f.properties;
        const coord = calculateVisualCenter(f.geometry) || props.coord;

        return {
            id: props.code || props.id,
            code: props.code,
            name: props.name,
            coord: coord,
            level: 'sig' as const,
            parcelCount: 0,
            listingCount: 0,
            auctionCount: 0,
            avgPrice: 0,
        };
    }).filter(d => d.id && d.name);

    fs.writeFileSync(outputPath, JSON.stringify(districts, null, 2));
    console.log(`  ✅ 저장 완료: ${outputPath} (${districts.length}개)`);
}

// 읍면동 GeoJSON에서 districts 생성
function processEmd(): void {
    console.log('\n📍 읍면동 districts 생성...');

    const geojsonPath = path.join(process.cwd(), 'temp/emd.geojson');
    const outputPath = path.join(process.cwd(), 'public/data/properties/districts-emd.json');

    if (!fs.existsSync(geojsonPath)) {
        console.warn('  ⚠️  GeoJSON 파일 없음:', geojsonPath);
        return;
    }

    const geojson: FeatureCollection = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));

    const districts = geojson.features.map(f => {
        const props = f.properties;
        const coord = calculateVisualCenter(f.geometry) || props.coord;

        return {
            id: props.code || props.id,
            code: props.code,
            name: props.name,
            sigCode: props.sigCode,
            coord: coord,
            level: 'emd' as const,
            parcelCount: 0,
            listingCount: 0,
            auctionCount: 0,
            avgPrice: 0,
        };
    }).filter(d => d.id && d.name);

    fs.writeFileSync(outputPath, JSON.stringify(districts, null, 2));
    console.log(`  ✅ 저장 완료: ${outputPath} (${districts.length}개)`);
}

// 메인
async function main(): Promise<void> {
    console.log('🔧 Districts 데이터 복구 시작...');

    processSido();
    processSig();
    processEmd();

    console.log('\n✨ Districts 데이터 복구 완료!');
}

main().catch(console.error);
