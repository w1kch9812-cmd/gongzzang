// 공장 밀집지역 폴리곤 생성 (DBSCAN + concave hull)
// 실행: npx tsx scripts/generate-factory-contours.ts

import * as fs from 'fs';
import * as path from 'path';
import { point, featureCollection } from '@turf/helpers';
import concave from '@turf/concave';
import clustersDbscan from '@turf/clusters-dbscan';
import type { Feature, Polygon, MultiPolygon, FeatureCollection, Point } from 'geojson';

const INPUT_FILE = path.join(__dirname, '../public/data/properties/factories-index.json');
const OUTPUT_FILE = path.join(__dirname, '../public/data/properties/factory-contours.json');

// DBSCAN 설정 (더 촘촘한 클러스터링)
const CLUSTER_SETTINGS = {
    maxDistance: 0.35,  // 350m 내 이웃으로 판단
    minPoints: 8,       // 최소 8개 이상이면 클러스터
};

// Concave hull 설정 (클수록 부드러운 형태)
const CONCAVE_MAX_EDGE = 0.8;  // km - 부드러운 외곽선

interface FactoryIndex {
    id: string;
    name: string;
    coord: [number, number] | null;
    businessType?: string;
}

async function main() {
    console.log('🏭 공장 밀집지역 폴리곤 생성 시작...');
    const startTime = performance.now();

    // 1. 공장 데이터 로드
    console.log('📂 공장 데이터 로드 중...');
    const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
    const factories: FactoryIndex[] = JSON.parse(rawData);

    const validFactories = factories.filter(
        (f) => f.coord && f.coord[0] !== 0 && f.coord[1] !== 0
    );
    console.log(`   총 ${factories.length}개 중 ${validFactories.length}개 유효`);

    // 2. 포인트 컬렉션 생성
    const points = validFactories.map((f) =>
        point(f.coord!, { id: f.id })
    );
    const pointCollection = featureCollection(points);

    // 3. DBSCAN 클러스터링
    console.log(`\n📊 DBSCAN 클러스터링 중...`);
    console.log(`   설정: ${CLUSTER_SETTINGS.maxDistance}km 내 ${CLUSTER_SETTINGS.minPoints}개 이상`);

    const clustered = clustersDbscan(pointCollection, CLUSTER_SETTINGS.maxDistance, {
        minPoints: CLUSTER_SETTINGS.minPoints,
        units: 'kilometers',
    });

    // 클러스터별로 그룹화
    const clusters = new Map<number, Feature<Point>[]>();
    for (const feature of clustered.features) {
        const clusterId = feature.properties?.cluster;
        if (clusterId !== undefined && clusterId !== -1) {
            if (!clusters.has(clusterId)) {
                clusters.set(clusterId, []);
            }
            clusters.get(clusterId)!.push(feature as Feature<Point>);
        }
    }

    console.log(`   ${clusters.size}개 클러스터 발견`);

    // 최대 포인트 수 계산 (밀도 정규화용)
    let maxPoints = 0;
    for (const clusterPoints of clusters.values()) {
        if (clusterPoints.length > maxPoints) {
            maxPoints = clusterPoints.length;
        }
    }

    // 4. 각 클러스터에서 concave hull 생성
    console.log(`\n🔶 폴리곤 생성 중...`);
    const contourFeatures: Feature<Polygon | MultiPolygon>[] = [];
    let polygonCount = 0;

    for (const [clusterId, clusterPoints] of clusters) {
        if (clusterPoints.length < 3) continue; // 최소 3점 필요

        try {
            const clusterCollection = featureCollection(clusterPoints);
            const hull = concave(clusterCollection, {
                maxEdge: CONCAVE_MAX_EDGE,
                units: 'kilometers',
            });

            if (hull) {
                // 밀도 계산 (0-1, 제곱근으로 저밀도 부스트)
                const rawDensity = clusterPoints.length / maxPoints;
                const density = Math.sqrt(rawDensity);

                hull.properties = {
                    clusterId,
                    pointCount: clusterPoints.length,
                    density, // 0-1 범위의 밀도
                };
                contourFeatures.push(hull);
                polygonCount++;
            }
        } catch (e) {
            // concave hull 실패 시 스킵
        }
    }

    console.log(`   ${polygonCount}개 폴리곤 생성`);

    // 4. 결과 저장
    console.log('\n💾 결과 저장 중...');
    const output: FeatureCollection & { metadata: any } = {
        type: 'FeatureCollection',
        features: contourFeatures,
        metadata: {
            generatedAt: new Date().toISOString(),
            factoryCount: validFactories.length,
            clusterSettings: CLUSTER_SETTINGS,
            polygonCount: contourFeatures.length,
        },
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    const fileSize = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1);

    console.log('');
    console.log('✅ 완료!');
    console.log(`   소요 시간: ${elapsed}초`);
    console.log(`   파일 크기: ${fileSize}KB`);
    console.log(`   폴리곤 개수: ${contourFeatures.length}개`);
    console.log(`   저장 위치: ${OUTPUT_FILE}`);
}

main().catch(console.error);
