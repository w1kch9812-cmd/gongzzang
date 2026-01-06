// scripts/generate-pnu-labels.ts
// PNU → polylabel 좌표 매핑 파일 생성

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

interface PNULabelMap {
    [pnu: string]: [number, number]; // [lng, lat]
}

// 폴리곤의 polylabel(최적 라벨 위치) 계산
function calculatePolylabel(geometry: any): [number, number] | null {
    try {
        if (geometry.type === 'Polygon') {
            return polylabel(geometry.coordinates, 1.0);
        } else if (geometry.type === 'MultiPolygon') {
            // 가장 큰 폴리곤의 polylabel 사용
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
        // 무시
    }
    return null;
}

// 간단한 폴리곤 면적 계산
function calculatePolygonArea(ring: [number, number][]): number {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    return Math.abs(area / 2);
}

// PNU 매핑 파일 생성
async function generatePNULabels(geojsonPath: string, outputPath: string): Promise<void> {
    console.log(`\n🗺️ PNU → Polylabel 매핑 생성...`);
    console.log(`   입력: ${geojsonPath}`);
    console.log(`   출력: ${outputPath}`);

    // GeoJSON 읽기
    if (!fs.existsSync(geojsonPath)) {
        throw new Error(`파일을 찾을 수 없습니다: ${geojsonPath}`);
    }

    const geojson: GeoJSON = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
    console.log(`   피처 수: ${geojson.features.length}`);

    // PNU → [lng, lat] 매핑 생성
    const pnuLabels: PNULabelMap = {};
    let successCount = 0;
    let failCount = 0;

    for (const feature of geojson.features) {
        const pnu = feature.properties.PNU;
        if (!pnu) {
            failCount++;
            continue;
        }

        const labelCoord = calculatePolylabel(feature.geometry);
        if (labelCoord) {
            pnuLabels[pnu] = labelCoord;
            successCount++;
        } else {
            failCount++;
        }

        // 진행률 표시
        if ((successCount + failCount) % 5000 === 0) {
            console.log(`   진행: ${successCount + failCount}/${geojson.features.length}`);
        }
    }

    console.log(`   완료: 성공=${successCount}, 실패=${failCount}`);

    // 출력 디렉토리 생성
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // JSON 저장
    fs.writeFileSync(outputPath, JSON.stringify(pnuLabels, null, 2), 'utf-8');

    const stats = fs.statSync(outputPath);
    console.log(`   파일 크기: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`   ✅ 저장 완료: ${outputPath}`);
}

// 메인 함수
async function main(): Promise<void> {
    const geojsonPath = path.resolve(process.cwd(), 'temp/parcels.geojson');
    const outputPath = path.resolve(process.cwd(), 'public/data/properties/pnu-labels.json');

    try {
        await generatePNULabels(geojsonPath, outputPath);
        console.log('\n✨ PNU 라벨 매핑 생성 완료!');
    } catch (e: any) {
        console.error('❌ 오류:', e.message);
        process.exit(1);
    }
}

main().catch(console.error);
