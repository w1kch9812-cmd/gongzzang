// scripts/extract-properties.ts
// GeoJSON에서 Properties JSON 추출 (geometry 제외)

import * as fs from 'fs';
import * as path from 'path';
import polylabel from 'polylabel';
import { DATA_SOURCES, OUTPUT_DIRS } from './data.config';

interface Feature {
    type: 'Feature';
    properties: Record<string, any>;
    geometry?: any;
}

interface FeatureCollection {
    type: 'FeatureCollection';
    features: Feature[];
}

// GeoJSON에서 properties만 추출
function extractProperties(sourceName: string): void {
    const config = DATA_SOURCES[sourceName];
    if (!config) {
        throw new Error(`알 수 없는 데이터 소스: ${sourceName}`);
    }

    if (!config.outputGeoJSON || !config.outputProperties) {
        console.log(`  ⏭️  [${sourceName}] Properties 추출 스킵 (설정 없음)`);
        return;
    }

    console.log(`\n📋 [${config.name}] Properties 추출 시작...`);

    const inputPath = path.join(process.cwd(), config.outputGeoJSON);
    const outputPath = path.join(process.cwd(), config.outputProperties);

    // GeoJSON 파일 확인
    if (!fs.existsSync(inputPath)) {
        console.warn(`  ⚠️  GeoJSON 파일 없음: ${inputPath}`);
        return;
    }

    // 출력 디렉토리 생성
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // GeoJSON 읽기
    const geojson: FeatureCollection = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

    // Properties만 추출
    const properties = geojson.features.map((feature) => {
        const props = { ...feature.properties };

        // ID 속성 설정
        const idProp = config.tileOptions?.idProperty;
        if (idProp && props[idProp]) {
            props.id = props[idProp];
        }

        // coord를 geometry에서 **강제로** 재계산 (polylabel 사용)
        // 기존 coord 무시하고 polylabel로 정확한 시각적 중심 계산
        if (feature.geometry) {
            const center = calculateVisualCenter(feature.geometry);
            if (center) {
                props.coord = center;
            }
        }

        return props;
    });

    // JSON 저장
    fs.writeFileSync(outputPath, JSON.stringify(properties, null, 2));

    const inputSize = (fs.statSync(inputPath).size / 1024 / 1024).toFixed(2);
    const outputSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
    const reduction = ((1 - fs.statSync(outputPath).size / fs.statSync(inputPath).size) * 100).toFixed(1);

    console.log(`  GeoJSON: ${inputSize}MB → Properties: ${outputSize}MB (${reduction}% 감소)`);
    console.log(`  ✅ 저장 완료: ${outputPath} (${properties.length}개 항목)`);
}

// 폴리곤의 시각적 중심점 계산 (polylabel 사용)
// polylabel은 폴리곤 내부에서 가장 멀리 떨어진 점을 찾음 (L자형 등에서도 정확)
function calculateVisualCenter(geometry: any): [number, number] | null {
    if (!geometry) return null;

    try {
        switch (geometry.type) {
            case 'Point':
                return geometry.coordinates as [number, number];

            case 'Polygon': {
                // polylabel은 [rings] 형태를 받음
                const result = polylabel(geometry.coordinates, 0.001);
                return [result[0], result[1]];
            }

            case 'MultiPolygon': {
                // 가장 큰 폴리곤 선택
                let largestArea = 0;
                let largestPolygon = geometry.coordinates[0];

                for (const polygon of geometry.coordinates) {
                    const area = calculatePolygonArea(polygon[0]);
                    if (area > largestArea) {
                        largestArea = area;
                        largestPolygon = polygon;
                    }
                }

                const result = polylabel(largestPolygon, 0.001);
                return [result[0], result[1]];
            }

            default:
                return null;
        }
    } catch {
        return null;
    }
}

// 폴리곤 면적 계산 (Shoelace formula)
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

// 마커 데이터 포맷으로 변환 (parcels 전용)
function extractParcelMarkerData(): void {
    console.log('\n📍 필지 마커 데이터 추출...');

    const inputPath = path.join(process.cwd(), 'temp/parcels.geojson');
    const outputPath = path.join(process.cwd(), 'public/data/properties/parcel-markers.json');

    if (!fs.existsSync(inputPath)) {
        console.warn('  ⚠️  필지 GeoJSON 파일 없음');
        return;
    }

    const geojson: FeatureCollection = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

    // 마커 데이터 포맷 (polylabel로 시각적 중심점 계산)
    const markers = geojson.features.map((feature) => {
        const props = feature.properties;
        const coord = props.coord || calculateVisualCenter(feature.geometry);

        return {
            id: props.PNU || props.id,
            coord: coord as [number, number],
            type: 0,  // 비트 플래그: 1=실거래, 2=매물, 4=경매 (추후 데이터 조인 필요)
            area: props.AREA || 0,
            jibun: props.jibun || props.JIBUN,
            sigCode: props.sigCode || (props.PNU ? props.PNU.substring(0, 5) : undefined),
            emdCode: props.emdCode || (props.PNU ? props.PNU.substring(0, 10) : undefined),
        };
    });

    fs.writeFileSync(outputPath, JSON.stringify(markers));
    const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
    console.log(`  ✅ 마커 데이터 저장: ${outputPath} (${sizeMB}MB, ${markers.length}개)`);
}

// 행정구역 집계 데이터 생성
function generateDistrictAggregations(): void {
    console.log('\n📊 행정구역 집계 데이터 생성...');

    // 시군구 집계
    const sigPath = path.join(process.cwd(), 'public/data/properties/districts-sig.json');
    if (fs.existsSync(sigPath)) {
        const districts = JSON.parse(fs.readFileSync(sigPath, 'utf-8'));
        const aggregated = districts.map((d: any) => ({
            ...d,
            parcelCount: 0,
            listingCount: 0,
            auctionCount: 0,
            avgPrice: 0,
            level: 'sig',
        }));
        fs.writeFileSync(sigPath, JSON.stringify(aggregated, null, 2));
        console.log(`  ✅ 시군구 집계: ${aggregated.length}개`);
    }

    // 읍면동 집계
    const emdPath = path.join(process.cwd(), 'public/data/properties/districts-emd.json');
    if (fs.existsSync(emdPath)) {
        const districts = JSON.parse(fs.readFileSync(emdPath, 'utf-8'));
        const aggregated = districts.map((d: any) => ({
            ...d,
            parcelCount: 0,
            listingCount: 0,
            auctionCount: 0,
            avgPrice: 0,
            level: 'emd',
        }));
        fs.writeFileSync(emdPath, JSON.stringify(aggregated, null, 2));
        console.log(`  ✅ 읍면동 집계: ${aggregated.length}개`);
    }
}

// 메인 함수
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    // 출력 디렉토리 생성
    const propsDir = path.join(process.cwd(), OUTPUT_DIRS.properties);
    if (!fs.existsSync(propsDir)) {
        fs.mkdirSync(propsDir, { recursive: true });
    }

    if (args.length === 0) {
        // 모든 소스 처리
        console.log('🚀 모든 Properties 추출 시작...\n');
        for (const sourceName of Object.keys(DATA_SOURCES)) {
            try {
                extractProperties(sourceName);
            } catch (e) {
                console.error(`❌ [${sourceName}] 추출 실패:`, e);
            }
        }

        // 추가 처리
        extractParcelMarkerData();
        generateDistrictAggregations();
    } else {
        // 지정된 소스만 처리
        for (const sourceName of args) {
            try {
                extractProperties(sourceName);
            } catch (e) {
                console.error(`❌ [${sourceName}] 추출 실패:`, e);
            }
        }
    }

    console.log('\n✨ Properties 추출 완료!');
}

main().catch(console.error);
