// 공장 분포 밀도 그리드 생성 스크립트
// 실행: npx tsx scripts/generate-factory-distribution.ts

import * as fs from 'fs';
import * as path from 'path';
import { polygon } from '@turf/helpers';
import type { Feature, Polygon, FeatureCollection } from 'geojson';

const INPUT_FILE = path.join(__dirname, '../public/data/properties/factories-index.json');
const OUTPUT_FILE = path.join(__dirname, '../public/data/properties/factory-distribution.json');

// 그리드 설정
const GRID_SIZE_KM = 0.5; // 500m x 500m 그리드
const MIN_FACTORIES_TO_SHOW = 1; // 최소 1개 이상인 셀만 표시

// 인천 영역 (대략적 범위)
const BOUNDS = {
    minLng: 126.35,
    maxLng: 126.85,
    minLat: 37.25,
    maxLat: 37.75,
};

interface FactoryIndex {
    id: string;
    name: string;
    coord: [number, number] | null;
    businessType?: string;
}

interface GridCell {
    row: number;
    col: number;
    count: number;
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
}

// 위도에 따른 경도 1도의 거리 (km)
function lngDegreeToKm(lat: number): number {
    return 111.32 * Math.cos(lat * Math.PI / 180);
}

// 위도 1도의 거리 (km) - 약 111km로 고정
const LAT_DEGREE_KM = 111;

async function main() {
    console.log('🏭 공장 분포 밀도 그리드 생성 시작...');
    const startTime = performance.now();

    // 1. 공장 데이터 로드
    console.log('📂 공장 데이터 로드 중...');
    const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
    const factories: FactoryIndex[] = JSON.parse(rawData);

    const validFactories = factories.filter(
        (f) => f.coord && f.coord[0] !== 0 && f.coord[1] !== 0
    );
    console.log(`   총 ${factories.length}개 중 ${validFactories.length}개 유효`);

    // 2. 그리드 크기 계산
    const centerLat = (BOUNDS.minLat + BOUNDS.maxLat) / 2;
    const lngStep = GRID_SIZE_KM / lngDegreeToKm(centerLat);
    const latStep = GRID_SIZE_KM / LAT_DEGREE_KM;

    const cols = Math.ceil((BOUNDS.maxLng - BOUNDS.minLng) / lngStep);
    const rows = Math.ceil((BOUNDS.maxLat - BOUNDS.minLat) / latStep);

    console.log(`📐 그리드 설정: ${rows} x ${cols} = ${rows * cols}개 셀`);
    console.log(`   셀 크기: ${GRID_SIZE_KM}km x ${GRID_SIZE_KM}km`);

    // 3. 그리드 카운트 초기화
    const grid: Map<string, GridCell> = new Map();

    // 4. 공장 카운트
    console.log('🔢 공장 분포 계산 중...');
    let counted = 0;

    for (const factory of validFactories) {
        if (!factory.coord) continue;

        const [lng, lat] = factory.coord;

        // 범위 체크
        if (lng < BOUNDS.minLng || lng > BOUNDS.maxLng ||
            lat < BOUNDS.minLat || lat > BOUNDS.maxLat) {
            continue;
        }

        // 그리드 셀 찾기
        const col = Math.floor((lng - BOUNDS.minLng) / lngStep);
        const row = Math.floor((lat - BOUNDS.minLat) / latStep);
        const key = `${row}-${col}`;

        if (!grid.has(key)) {
            grid.set(key, {
                row,
                col,
                count: 0,
                minLng: BOUNDS.minLng + col * lngStep,
                maxLng: BOUNDS.minLng + (col + 1) * lngStep,
                minLat: BOUNDS.minLat + row * latStep,
                maxLat: BOUNDS.minLat + (row + 1) * latStep,
            });
        }

        grid.get(key)!.count++;
        counted++;
    }

    console.log(`   ${counted}개 공장 카운트 완료`);

    // 5. 최대 밀도 계산
    let maxCount = 0;
    for (const cell of grid.values()) {
        if (cell.count > maxCount) maxCount = cell.count;
    }
    console.log(`   최대 밀도: ${maxCount}개/셀`);

    // 6. GeoJSON 생성
    console.log('🗺️ GeoJSON 생성 중...');
    const features: Feature<Polygon>[] = [];

    for (const cell of grid.values()) {
        if (cell.count < MIN_FACTORIES_TO_SHOW) continue;

        // 정규화된 밀도 (0-1) - 제곱근 스케일로 저밀도 영역 가시성 향상
        const rawDensity = cell.count / maxCount;
        const density = Math.sqrt(rawDensity); // sqrt로 저밀도 부스트

        const poly = polygon([[
            [cell.minLng, cell.minLat],
            [cell.maxLng, cell.minLat],
            [cell.maxLng, cell.maxLat],
            [cell.minLng, cell.maxLat],
            [cell.minLng, cell.minLat],
        ]], {
            count: cell.count,
            density: density,
        });

        features.push(poly);
    }

    console.log(`   ${features.length}개 셀 생성 (공장 있는 셀만)`);

    // 7. 결과 저장
    console.log('💾 결과 저장 중...');
    const output: FeatureCollection<Polygon> & { metadata: any } = {
        type: 'FeatureCollection',
        features,
        metadata: {
            generatedAt: new Date().toISOString(),
            factoryCount: validFactories.length,
            gridSizeKm: GRID_SIZE_KM,
            maxDensity: maxCount,
            cellCount: features.length,
        },
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    const fileSize = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1);

    console.log('');
    console.log('✅ 완료!');
    console.log(`   소요 시간: ${elapsed}초`);
    console.log(`   파일 크기: ${fileSize}KB`);
    console.log(`   저장 위치: ${OUTPUT_FILE}`);
}

main().catch(console.error);
