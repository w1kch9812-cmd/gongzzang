// scripts/shp-to-geojson.ts
// SHP 파일을 GeoJSON으로 변환

import * as shapefile from 'shapefile';
import * as fs from 'fs';
import * as path from 'path';
import iconv from 'iconv-lite';
import proj4 from 'proj4';
import { DATA_SOURCES, DataSourceConfig, OUTPUT_DIRS } from './data.config';

// 한국 좌표계 정의
proj4.defs('EPSG:5174', '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43');
proj4.defs('EPSG:5179', '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:5186', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:5187', '+proj=tmerc +lat_0=38 +lon_0=129 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:2097', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43');

// PRJ 파일에서 좌표계 감지
function detectCRS(prjContent: string): string {
    if (prjContent.includes('Korea_2000') || prjContent.includes('Korean_2000')) {
        if (prjContent.includes('Central_Belt') || prjContent.includes('127.0')) {
            return 'EPSG:5186';
        }
        if (prjContent.includes('East_Belt') || prjContent.includes('129')) {
            return 'EPSG:5187';
        }
        return 'EPSG:5179';
    }
    if (prjContent.includes('Bessel')) {
        if (prjContent.includes('127.00')) {
            return 'EPSG:5174';
        }
        return 'EPSG:2097';
    }
    // 기본값
    return 'EPSG:5186';
}

// 좌표 변환
function transformCoords(coords: number[], fromCRS: string): number[] {
    try {
        return proj4(fromCRS, 'EPSG:4326', coords);
    } catch (e) {
        console.warn('좌표 변환 실패:', coords, e);
        return coords;
    }
}

// Geometry 변환 (재귀)
function transformGeometry(geometry: any, fromCRS: string): any {
    if (!geometry) return geometry;

    switch (geometry.type) {
        case 'Point':
            return {
                type: 'Point',
                coordinates: transformCoords(geometry.coordinates, fromCRS),
            };
        case 'LineString':
        case 'MultiPoint':
            return {
                type: geometry.type,
                coordinates: geometry.coordinates.map((c: number[]) => transformCoords(c, fromCRS)),
            };
        case 'Polygon':
        case 'MultiLineString':
            return {
                type: geometry.type,
                coordinates: geometry.coordinates.map((ring: number[][]) =>
                    ring.map((c: number[]) => transformCoords(c, fromCRS))
                ),
            };
        case 'MultiPolygon':
            return {
                type: 'MultiPolygon',
                coordinates: geometry.coordinates.map((polygon: number[][][]) =>
                    polygon.map((ring: number[][]) =>
                        ring.map((c: number[]) => transformCoords(c, fromCRS))
                    )
                ),
            };
        default:
            return geometry;
    }
}

// DBF 속성값 디코딩
function decodeProperties(props: Record<string, any>, encoding: string): Record<string, any> {
    const decoded: Record<string, any> = {};
    for (const [key, value] of Object.entries(props)) {
        if (Buffer.isBuffer(value)) {
            decoded[key] = iconv.decode(value, encoding);
        } else if (value instanceof ArrayBuffer) {
            decoded[key] = iconv.decode(Buffer.from(new Uint8Array(value)), encoding);
        } else if (typeof value === 'string') {
            // 이미 문자열인 경우 그대로 사용
            decoded[key] = value;
        } else {
            decoded[key] = value;
        }
    }
    return decoded;
}

// 필터링 함수
let debugLogCount = 0;
function shouldInclude(props: Record<string, any>, config: DataSourceConfig): boolean {
    const filter = config.transform?.filterRegion;
    if (!filter) return true;

    // 디버그: 처음 2개 레코드의 속성 출력
    if (debugLogCount < 2) {
        console.log(`  [DEBUG] 속성 샘플: ${JSON.stringify(Object.keys(props))}`);
        console.log(`  [DEBUG] 값 샘플: ${JSON.stringify(props)}`);
        debugLogCount++;
    }

    // 모든 문자열 속성에서 지역 코드 검색
    for (const [key, value] of Object.entries(props)) {
        if (value && typeof value === 'string') {
            // 코드 형태 (숫자로 시작하는 경우)
            if (value.startsWith(filter)) {
                return true;
            }
            // 주소에 '인천' 포함
            if (value.includes('인천')) {
                return true;
            }
        } else if (value && typeof value === 'number') {
            // 숫자 코드
            if (String(value).startsWith(filter)) {
                return true;
            }
        }
    }

    return false;
}

// 속성 변환
function transformProperties(
    props: Record<string, any>,
    config: DataSourceConfig
): Record<string, any> {
    const transform = config.transform;
    if (!transform) return props;

    let result: Record<string, any> = {};

    // 필요한 속성만 추출
    if (transform.properties) {
        for (const prop of transform.properties) {
            if (props[prop] !== undefined) {
                result[prop] = props[prop];
            }
        }
    } else {
        result = { ...props };
    }

    // 속성명 변경
    if (transform.rename) {
        for (const [from, to] of Object.entries(transform.rename)) {
            if (result[from] !== undefined) {
                result[to] = result[from];
                delete result[from];
            }
        }
    }

    // 계산된 속성 추가
    if (transform.computed) {
        for (const [name, expr] of Object.entries(transform.computed)) {
            try {
                // 간단한 표현식 평가 (substring 등)
                if (expr.includes('.substring')) {
                    const match = expr.match(/(\w+)\.substring\((\d+),\s*(\d+)\)/);
                    if (match) {
                        const [, propName, start, end] = match;
                        const value = props[propName] || result[propName];
                        if (value) {
                            result[name] = String(value).substring(parseInt(start), parseInt(end));
                        }
                    }
                }
            } catch (e) {
                console.warn(`계산된 속성 오류 (${name}):`, e);
            }
        }
    }

    return result;
}

// 중심점 계산
function calculateCentroid(geometry: any): [number, number] | null {
    if (!geometry) return null;

    try {
        switch (geometry.type) {
            case 'Point':
                return geometry.coordinates as [number, number];

            case 'Polygon': {
                const ring = geometry.coordinates[0];
                let x = 0, y = 0;
                for (const coord of ring) {
                    x += coord[0];
                    y += coord[1];
                }
                return [x / ring.length, y / ring.length];
            }

            case 'MultiPolygon': {
                // 가장 큰 폴리곤의 중심점
                let maxArea = 0;
                let centroid: [number, number] = [0, 0];
                for (const polygon of geometry.coordinates) {
                    const ring = polygon[0];
                    let area = 0;
                    let cx = 0, cy = 0;
                    for (let i = 0; i < ring.length - 1; i++) {
                        const [x1, y1] = ring[i];
                        const [x2, y2] = ring[i + 1];
                        const f = x1 * y2 - x2 * y1;
                        area += f;
                        cx += (x1 + x2) * f;
                        cy += (y1 + y2) * f;
                    }
                    area = Math.abs(area / 2);
                    if (area > maxArea) {
                        maxArea = area;
                        centroid = [cx / (6 * area), cy / (6 * area)];
                    }
                }
                return centroid;
            }

            default:
                return null;
        }
    } catch (e) {
        return null;
    }
}

// SHP → GeoJSON 변환
async function convertShpToGeoJson(sourceName: string): Promise<void> {
    const config = DATA_SOURCES[sourceName];
    if (!config) {
        throw new Error(`알 수 없는 데이터 소스: ${sourceName}`);
    }

    console.log(`\n📦 [${config.name}] ${config.description} 변환 시작...`);
    debugLogCount = 0;  // 디버그 카운터 리셋

    const rawDir = path.join(process.cwd(), 'rawdata');
    const shpFile = path.join(rawDir, config.rawFiles[0]);

    // 파일 존재 확인
    if (!fs.existsSync(shpFile)) {
        throw new Error(`SHP 파일을 찾을 수 없습니다: ${shpFile}`);
    }

    // PRJ 파일에서 좌표계 감지
    const prjFile = shpFile.replace('.shp', '.prj');
    let sourceCRS = 'EPSG:5186';
    if (fs.existsSync(prjFile)) {
        const prjContent = fs.readFileSync(prjFile, 'utf-8');
        sourceCRS = detectCRS(prjContent);
        console.log(`  좌표계: ${sourceCRS}`);
    }

    // 인코딩 설정
    const encoding = config.encoding || 'utf-8';
    console.log(`  인코딩: ${encoding}`);

    // 출력 디렉토리 생성
    const outputPath = path.join(process.cwd(), config.outputGeoJSON!);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // SHP 읽기
    const source = await shapefile.open(shpFile, undefined, { encoding });

    const features: any[] = [];
    let totalCount = 0;
    let includedCount = 0;

    while (true) {
        const result = await source.read();
        if (result.done) break;

        totalCount++;

        const feature = result.value;
        if (!feature) continue;

        // 속성 디코딩
        const props = decodeProperties(feature.properties || {}, encoding);

        // 필터링
        if (!shouldInclude(props, config)) continue;

        // 좌표 변환
        const transformedGeometry = transformGeometry(feature.geometry, sourceCRS);

        // 속성 변환
        const transformedProps = transformProperties(props, config);

        // 중심점 계산 및 추가
        const centroid = calculateCentroid(transformedGeometry);
        if (centroid) {
            transformedProps.coord = centroid;
        }

        features.push({
            type: 'Feature',
            properties: transformedProps,
            geometry: transformedGeometry,
        });

        includedCount++;

        if (includedCount % 10000 === 0) {
            console.log(`  처리 중: ${includedCount}개...`);
        }
    }

    console.log(`  총 ${totalCount}개 중 ${includedCount}개 포함`);

    // GeoJSON 저장
    const geojson = {
        type: 'FeatureCollection',
        features,
    };

    fs.writeFileSync(outputPath, JSON.stringify(geojson));
    const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
    console.log(`  ✅ 저장 완료: ${outputPath} (${sizeMB}MB)`);
}

// 메인 함수
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    // temp 디렉토리 생성
    const tempDir = path.join(process.cwd(), OUTPUT_DIRS.temp);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    if (args.length === 0) {
        // 모든 소스 변환
        console.log('🚀 모든 SHP 파일 변환 시작...\n');
        for (const sourceName of Object.keys(DATA_SOURCES)) {
            try {
                await convertShpToGeoJson(sourceName);
            } catch (e) {
                console.error(`❌ [${sourceName}] 변환 실패:`, e);
            }
        }
    } else {
        // 지정된 소스만 변환
        for (const sourceName of args) {
            try {
                await convertShpToGeoJson(sourceName);
            } catch (e) {
                console.error(`❌ [${sourceName}] 변환 실패:`, e);
            }
        }
    }

    console.log('\n✨ SHP → GeoJSON 변환 완료!');
}

main().catch(console.error);
