// scripts/add-polylabel-to-geojson.ts
// GeoJSON 폴리곤에 polylabel(중심점) 좌표를 properties에 추가

import * as fs from 'fs';
import * as path from 'path';
import polylabel from '@mapbox/polylabel';

interface GeoJSONFeature {
    type: 'Feature';
    properties: Record<string, any>;
    geometry: {
        type: string;
        coordinates: any;
    };
}

interface GeoJSON {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
}

// 폴리곤의 polylabel(최적 라벨 위치) 계산
function calculatePolylabel(geometry: any): [number, number] | null {
    try {
        if (geometry.type === 'Polygon') {
            // Polygon: coordinates[0]이 외부 링
            return polylabel(geometry.coordinates, 1.0); // precision: 1.0m
        } else if (geometry.type === 'MultiPolygon') {
            // MultiPolygon: 가장 큰 폴리곤의 polylabel 사용
            let maxArea = 0;
            let maxPolygon: any = null;

            for (const polygon of geometry.coordinates) {
                const area = calculatePolygonArea(polygon[0]);
                if (area > maxArea) {
                    maxArea = area;
                    maxPolygon = polygon;
                }
            }

            if (maxPolygon) {
                return polylabel(maxPolygon, 1.0);
            }
        }
    } catch (e) {
        console.warn('Polylabel 계산 실패:', e);
    }
    return null;
}

// 간단한 폴리곤 면적 계산 (Shoelace formula)
function calculatePolygonArea(ring: [number, number][]): number {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    return Math.abs(area / 2);
}

// GeoJSON 파일에 polylabel 추가
async function addPolylabelToGeoJSON(inputPath: string, outputPath: string): Promise<void> {
    console.log(`\n📍 Polylabel 추가 시작...`);
    console.log(`   입력: ${inputPath}`);
    console.log(`   출력: ${outputPath}`);

    // GeoJSON 읽기
    if (!fs.existsSync(inputPath)) {
        throw new Error(`파일을 찾을 수 없습니다: ${inputPath}`);
    }

    const geojson: GeoJSON = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    console.log(`   피처 수: ${geojson.features.length}`);

    // 각 feature에 polylabel 추가
    let successCount = 0;
    let failCount = 0;

    for (const feature of geojson.features) {
        const labelCoord = calculatePolylabel(feature.geometry);

        if (labelCoord) {
            feature.properties.labelLng = labelCoord[0];
            feature.properties.labelLat = labelCoord[1];
            successCount++;
        } else {
            failCount++;
        }

        // 진행률 표시 (1000개마다)
        if ((successCount + failCount) % 1000 === 0) {
            console.log(`   진행: ${successCount + failCount}/${geojson.features.length}`);
        }
    }

    console.log(`   완료: 성공=${successCount}, 실패=${failCount}`);

    // 출력 디렉토리 생성
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // GeoJSON 저장
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2), 'utf-8');

    const stats = fs.statSync(outputPath);
    console.log(`   파일 크기: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   ✅ 저장 완료: ${outputPath}`);
}

// 메인 함수
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('📋 사용법:');
        console.log('  npx tsx scripts/add-polylabel-to-geojson.ts <input.geojson> [output.geojson]');
        console.log('');
        console.log('📝 예시:');
        console.log('  npx tsx scripts/add-polylabel-to-geojson.ts temp/parcels.geojson');
        console.log('  npx tsx scripts/add-polylabel-to-geojson.ts temp/parcels.geojson temp/parcels-with-label.geojson');
        return;
    }

    const inputPath = path.resolve(process.cwd(), args[0]);
    const outputPath = args[1]
        ? path.resolve(process.cwd(), args[1])
        : inputPath; // 입력 파일 덮어쓰기

    try {
        await addPolylabelToGeoJSON(inputPath, outputPath);
        console.log('\n✨ Polylabel 추가 완료!');
    } catch (e: any) {
        console.error('❌ 오류:', e.message);
        process.exit(1);
    }
}

main().catch(console.error);
