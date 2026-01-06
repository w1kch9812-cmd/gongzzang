#!/usr/bin/env tsx
// scripts/map-parcels-to-complexes.ts
// 필지를 산업단지에 매핑 (point-in-polygon)

import * as fs from 'fs';
import * as path from 'path';

// Turf.js for geospatial operations
// npm install @turf/boolean-point-in-polygon @turf/helpers
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon, multiPolygon } from '@turf/helpers';

interface Parcel {
    id: string;  // PNU
    coord: [number, number];
    [key: string]: any;
}

interface Complex {
    id: string;
    name?: string;
    geometry?: any;
    [key: string]: any;
}

async function main() {
    console.log('🗺️  필지-산업단지 매핑 시작...');

    // 1. 데이터 로드
    const parcelsPath = path.join(process.cwd(), 'temp/parcels.geojson');
    const complexesPath = path.join(process.cwd(), 'temp/complex.geojson');

    if (!fs.existsSync(parcelsPath)) {
        console.error('❌ temp/parcels.geojson 파일이 없습니다.');
        process.exit(1);
    }

    if (!fs.existsSync(complexesPath)) {
        console.error('❌ temp/complex.geojson 파일이 없습니다.');
        process.exit(1);
    }

    const parcelsGeoJSON = JSON.parse(fs.readFileSync(parcelsPath, 'utf-8'));
    const complexesGeoJSON = JSON.parse(fs.readFileSync(complexesPath, 'utf-8'));

    console.log(`📦 필지: ${parcelsGeoJSON.features.length}개`);
    console.log(`🏭 산업단지: ${complexesGeoJSON.features.length}개`);

    // 2. 필지에 산업단지 ID 매핑
    let mappedCount = 0;

    for (const parcelFeature of parcelsGeoJSON.features) {
        const parcelPoint = point(parcelFeature.geometry.coordinates);

        for (const complexFeature of complexesGeoJSON.features) {
            const complexGeometry = complexFeature.geometry;

            // Polygon 또는 MultiPolygon 처리
            let isInside = false;

            if (complexGeometry.type === 'Polygon') {
                isInside = booleanPointInPolygon(parcelPoint, polygon(complexGeometry.coordinates));
            } else if (complexGeometry.type === 'MultiPolygon') {
                isInside = booleanPointInPolygon(parcelPoint, multiPolygon(complexGeometry.coordinates));
            }

            if (isInside) {
                parcelFeature.properties.industrialComplexId = complexFeature.properties.id || complexFeature.properties.DAN_ID;
                parcelFeature.properties.industrialComplexName = complexFeature.properties.name || complexFeature.properties.DAN_NAME;
                mappedCount++;
                break;  // 하나의 산업단지에만 속함
            }
        }
    }

    console.log(`✅ ${mappedCount}개 필지가 산업단지에 매핑됨 (${((mappedCount / parcelsGeoJSON.features.length) * 100).toFixed(1)}%)`);

    // 3. 결과 저장
    const outputPath = path.join(process.cwd(), 'temp/parcels-with-complex.geojson');
    fs.writeFileSync(outputPath, JSON.stringify(parcelsGeoJSON, null, 2));
    console.log(`💾 저장 완료: ${outputPath}`);

    // 4. JSON 속성 파일 업데이트
    const propertiesPath = path.join(process.cwd(), 'public/data/properties/parcel-markers.json');
    if (fs.existsSync(propertiesPath)) {
        const parcelsJSON = JSON.parse(fs.readFileSync(propertiesPath, 'utf-8'));

        // GeoJSON 매핑 결과를 JSON에 반영
        const complexMap = new Map<string, string>();
        for (const feature of parcelsGeoJSON.features) {
            if (feature.properties.industrialComplexId) {
                complexMap.set(feature.properties.id || feature.properties.PNU, feature.properties.industrialComplexId);
            }
        }

        let updatedCount = 0;
        for (const parcel of parcelsJSON) {
            const complexId = complexMap.get(parcel.id);
            if (complexId) {
                parcel.industrialComplexId = complexId;
                updatedCount++;
            }
        }

        fs.writeFileSync(propertiesPath, JSON.stringify(parcelsJSON, null, 2));
        console.log(`💾 parcel-markers.json 업데이트: ${updatedCount}개 필지`);
    }

    console.log('🎉 완료!');
}

main().catch(console.error);
