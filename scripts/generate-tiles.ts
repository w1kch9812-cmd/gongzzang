// scripts/generate-tiles.ts
// GeoJSON에서 MVT 타일 또는 PMTiles 생성

import * as fs from 'fs';
import * as path from 'path';
import geojsonVt from 'geojson-vt';
import { DATA_SOURCES, OUTPUT_DIRS } from './data.config';

// Protobuf 인코딩 (간단한 버전)
function encodeGeometry(geometry: number[], type: number): Buffer {
    const pbf: number[] = [];

    // geometry type (1=point, 2=line, 3=polygon)
    pbf.push(0x08, type);

    // command + count
    let cmd = 1; // MoveTo
    let count = geometry.length / 2;

    for (let i = 0; i < geometry.length; i += 2) {
        if (i === 0) {
            // MoveTo
            pbf.push((1 << 3) | 2); // tag 1, wire type 2 (length-delimited)
            const encoded = encodeVarint(geometry[i]) + encodeVarint(geometry[i + 1]);
            pbf.push(encoded.length, ...encoded.split('').map(c => c.charCodeAt(0)));
        }
    }

    return Buffer.from(pbf);
}

function encodeVarint(value: number): string {
    let result = '';
    value = (value << 1) ^ (value >> 31); // zigzag encoding
    while (value > 0x7f) {
        result += String.fromCharCode((value & 0x7f) | 0x80);
        value >>>= 7;
    }
    result += String.fromCharCode(value);
    return result;
}

// GeoJSON-VT 옵션
interface TileOptions {
    minZoom: number;
    maxZoom: number;
    tolerance: number;
    buffer: number;
    indexMaxZoom: number;
}

// 타일 생성
async function generateTiles(sourceName: string): Promise<void> {
    const config = DATA_SOURCES[sourceName];
    if (!config) {
        throw new Error(`알 수 없는 데이터 소스: ${sourceName}`);
    }

    if (!config.outputGeoJSON || !config.outputPMTiles) {
        console.log(`  ⏭️  [${sourceName}] 타일 생성 스킵 (설정 없음)`);
        return;
    }

    console.log(`\n🗺️  [${config.name}] 타일 생성 시작...`);

    const inputPath = path.join(process.cwd(), config.outputGeoJSON);

    if (!fs.existsSync(inputPath)) {
        console.warn(`  ⚠️  GeoJSON 파일 없음: ${inputPath}`);
        return;
    }

    // GeoJSON 로드
    console.log('  GeoJSON 로딩...');
    const geojson = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

    // 타일 옵션
    const tileOpts = config.tileOptions!;
    const options: TileOptions = {
        minZoom: tileOpts.minZoom,
        maxZoom: tileOpts.maxZoom,
        tolerance: 3,
        buffer: 64,
        indexMaxZoom: tileOpts.maxZoom,
    };

    console.log(`  줌 레벨: ${options.minZoom} - ${options.maxZoom}`);

    // GeoJSON-VT 인덱스 생성
    console.log('  타일 인덱스 생성...');
    const tileIndex = geojsonVt(geojson, {
        maxZoom: options.maxZoom,
        tolerance: options.tolerance,
        buffer: options.buffer,
        indexMaxZoom: options.indexMaxZoom,
    });

    // MVT 디렉토리 타일 생성 (PMTiles 대신)
    // PMTiles는 tippecanoe가 필요하므로 디렉토리 기반 타일로 대체
    const tilesDir = path.join(
        process.cwd(),
        'public/tiles',
        config.name
    );

    // 기존 타일 삭제
    if (fs.existsSync(tilesDir)) {
        fs.rmSync(tilesDir, { recursive: true });
    }
    fs.mkdirSync(tilesDir, { recursive: true });

    let tileCount = 0;

    // 각 줌 레벨에서 타일 생성
    for (let z = options.minZoom; z <= options.maxZoom; z++) {
        const zDir = path.join(tilesDir, String(z));
        fs.mkdirSync(zDir, { recursive: true });

        // 타일 좌표 계산
        const numTiles = Math.pow(2, z);

        // 인천 영역 대략적 범위 (타일 좌표)
        const minLng = 126.3;
        const maxLng = 126.9;
        const minLat = 37.2;
        const maxLat = 37.7;

        const minX = Math.floor((minLng + 180) / 360 * numTiles);
        const maxX = Math.ceil((maxLng + 180) / 360 * numTiles);
        const minY = Math.floor((1 - Math.log(Math.tan(maxLat * Math.PI / 180) + 1 / Math.cos(maxLat * Math.PI / 180)) / Math.PI) / 2 * numTiles);
        const maxY = Math.ceil((1 - Math.log(Math.tan(minLat * Math.PI / 180) + 1 / Math.cos(minLat * Math.PI / 180)) / Math.PI) / 2 * numTiles);

        for (let x = minX; x <= maxX; x++) {
            const xDir = path.join(zDir, String(x));

            for (let y = minY; y <= maxY; y++) {
                const tile = tileIndex.getTile(z, x, y);

                if (tile && tile.features && tile.features.length > 0) {
                    // x 디렉토리 생성 (필요 시)
                    if (!fs.existsSync(xDir)) {
                        fs.mkdirSync(xDir, { recursive: true });
                    }

                    // 타일을 JSON으로 저장 (디버그용)
                    // 실제로는 PBF 형식으로 저장해야 함
                    const tileData = {
                        name: tileOpts.layerName,
                        features: tile.features.map((f: any) => ({
                            type: f.type,
                            geometry: f.geometry,
                            properties: f.tags,
                        })),
                    };

                    const tilePath = path.join(xDir, `${y}.json`);
                    fs.writeFileSync(tilePath, JSON.stringify(tileData));
                    tileCount++;
                }
            }
        }

        console.log(`  줌 ${z}: 타일 생성 완료`);
    }

    console.log(`  ✅ 총 ${tileCount}개 타일 생성: ${tilesDir}`);

    // 메타데이터 저장
    const metadata = {
        name: config.name,
        description: config.description,
        minzoom: options.minZoom,
        maxzoom: options.maxZoom,
        bounds: [126.3, 37.2, 126.9, 37.7],
        center: [126.7, 37.45, 12],
        format: 'json', // 추후 pbf로 변경
        vector_layers: [{
            id: tileOpts.layerName,
            fields: {},
        }],
    };
    fs.writeFileSync(path.join(tilesDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
}

// PMTiles 생성 안내 (tippecanoe 필요)
function printPMTilesInstructions(): void {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    PMTiles 생성 안내                            ║
╠════════════════════════════════════════════════════════════════╣
║ PMTiles 생성을 위해 tippecanoe가 필요합니다.                     ║
║                                                                 ║
║ Docker를 사용한 변환:                                           ║
║   docker run -it -v $(pwd):/data tippecanoe:latest \\           ║
║     tippecanoe -o /data/public/tiles/parcels.pmtiles \\         ║
║     -z17 -Z14 --drop-densest-as-needed \\                       ║
║     /data/temp/parcels.geojson                                  ║
║                                                                 ║
║ WSL을 사용한 설치:                                              ║
║   sudo apt-get install tippecanoe                               ║
║                                                                 ║
║ 현재는 디렉토리 기반 JSON 타일이 생성됩니다.                      ║
╚════════════════════════════════════════════════════════════════╝
    `);
}

// 메인 함수
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    // 출력 디렉토리 생성
    const tilesDir = path.join(process.cwd(), OUTPUT_DIRS.tiles);
    if (!fs.existsSync(tilesDir)) {
        fs.mkdirSync(tilesDir, { recursive: true });
    }

    printPMTilesInstructions();

    if (args.length === 0) {
        // 모든 소스 처리
        console.log('🚀 모든 타일 생성 시작...\n');
        for (const sourceName of Object.keys(DATA_SOURCES)) {
            try {
                await generateTiles(sourceName);
            } catch (e) {
                console.error(`❌ [${sourceName}] 타일 생성 실패:`, e);
            }
        }
    } else {
        // 지정된 소스만 처리
        for (const sourceName of args) {
            try {
                await generateTiles(sourceName);
            } catch (e) {
                console.error(`❌ [${sourceName}] 타일 생성 실패:`, e);
            }
        }
    }

    console.log('\n✨ 타일 생성 완료!');
}

main().catch(console.error);
