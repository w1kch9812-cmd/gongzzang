// scripts/generate-pmtiles-node.ts
// Node.js로 GeoJSON → PMTiles 변환 (tippecanoe 없이)

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';
import { DATA_SOURCES, DataSourceConfig } from './data.config';

// PMTiles 헤더 상수
const PMTILES_MAGIC = 0x4d50; // "PM"
const PMTILES_VERSION = 3;

interface TileData {
    z: number;
    x: number;
    y: number;
    data: Buffer;
}

interface TileIndex {
    [key: string]: { offset: number; length: number };
}

// 타일 ID 생성 (z/x/y → 단일 숫자)
function tileId(z: number, x: number, y: number): string {
    return `${z}/${x}/${y}`;
}

// GeoJSON을 PMTiles로 변환
async function convertGeoJsonToPMTiles(
    geojsonPath: string,
    pmtilesPath: string,
    config: DataSourceConfig
): Promise<void> {
    const { tileOptions } = config;
    if (!tileOptions) {
        throw new Error('tileOptions가 필요합니다');
    }

    console.log(`\n📦 [${config.name}] PMTiles 생성 시작...`);
    console.log(`   입력: ${geojsonPath}`);
    console.log(`   출력: ${pmtilesPath}`);
    console.log(`   줌 레벨: ${tileOptions.minZoom} - ${tileOptions.maxZoom}`);

    // GeoJSON 읽기
    if (!fs.existsSync(geojsonPath)) {
        throw new Error(`GeoJSON 파일을 찾을 수 없습니다: ${geojsonPath}`);
    }

    const geojsonData = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
    console.log(`   피처 수: ${geojsonData.features?.length || 0}`);

    if (!geojsonData.features || geojsonData.features.length === 0) {
        console.log(`   ⚠️ 피처가 없습니다. 건너뜁니다.`);
        return;
    }

    // geojson-vt로 타일 인덱스 생성
    console.log('   타일 인덱스 생성 중...');
    const tileIndex = geojsonvt(geojsonData, {
        maxZoom: tileOptions.maxZoom,
        indexMaxZoom: tileOptions.maxZoom,
        indexMaxPoints: 0, // 모든 포인트 인덱싱
        tolerance: 3, // 단순화 tolerance
        extent: 4096, // 타일 extent
        buffer: 64, // 타일 버퍼
        lineMetrics: false,
        promoteId: tileOptions.idProperty || undefined,
        generateId: !tileOptions.idProperty,
    });

    // 모든 줌 레벨에서 타일 생성
    const tiles: TileData[] = [];
    let totalTiles = 0;

    for (let z = tileOptions.minZoom; z <= tileOptions.maxZoom; z++) {
        const maxTile = Math.pow(2, z);
        let tilesAtZoom = 0;

        for (let x = 0; x < maxTile; x++) {
            for (let y = 0; y < maxTile; y++) {
                const tile = tileIndex.getTile(z, x, y);
                if (tile && tile.features && tile.features.length > 0) {
                    // vt-pbf로 protobuf 인코딩
                    const pbf = vtpbf.fromGeojsonVt(
                        { [tileOptions.layerName]: tile },
                        { version: 2 }
                    );

                    // gzip 압축
                    const compressed = zlib.gzipSync(Buffer.from(pbf));

                    tiles.push({
                        z,
                        x,
                        y,
                        data: compressed,
                    });
                    tilesAtZoom++;
                }
            }
        }

        if (tilesAtZoom > 0) {
            console.log(`   줌 ${z}: ${tilesAtZoom}개 타일`);
            totalTiles += tilesAtZoom;
        }
    }

    console.log(`   총 ${totalTiles}개 타일 생성`);

    if (totalTiles === 0) {
        console.log(`   ⚠️ 생성된 타일이 없습니다.`);
        return;
    }

    // PMTiles 파일 생성
    console.log('   PMTiles 파일 생성 중...');
    await writePMTiles(pmtilesPath, tiles, config);

    const stats = fs.statSync(pmtilesPath);
    console.log(`   ✅ 완료: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}

// PMTiles v3 형식으로 저장
async function writePMTiles(
    outputPath: string,
    tiles: TileData[],
    config: DataSourceConfig
): Promise<void> {
    // 출력 디렉토리 생성
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 간단한 PMTiles v3 구현
    // 헤더(127바이트) + 메타데이터 + 루트 디렉토리 + 타일 데이터

    const tileOptions = config.tileOptions!;

    // 메타데이터 JSON
    const metadata = {
        name: config.name,
        description: config.description,
        version: '1.0.0',
        type: 'overlay',
        format: 'pbf',
        minzoom: tileOptions.minZoom,
        maxzoom: tileOptions.maxZoom,
        generator: 'gongzzang-pmtiles-generator',
        vector_layers: [
            {
                id: tileOptions.layerName,
                description: config.description,
                minzoom: tileOptions.minZoom,
                maxzoom: tileOptions.maxZoom,
            },
        ],
    };

    const metadataJson = JSON.stringify(metadata);
    const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
    const metadataCompressed = zlib.gzipSync(metadataBuffer);

    // 디렉토리 엔트리 생성
    // PMTiles v3 디렉토리 형식: [tileId, runLength, offset, length]
    const entries: Array<{ tileId: bigint; offset: bigint; length: number; runLength: number }> = [];

    // 타일을 Z-order (Hilbert curve) 순서로 정렬
    tiles.sort((a, b) => {
        const idA = zxyToTileId(a.z, a.x, a.y);
        const idB = zxyToTileId(b.z, b.x, b.y);
        return idA < idB ? -1 : idA > idB ? 1 : 0;
    });

    // 타일 데이터 오프셋 계산
    let currentOffset = BigInt(0);
    for (const tile of tiles) {
        const id = zxyToTileId(tile.z, tile.x, tile.y);
        entries.push({
            tileId: id,
            offset: currentOffset,
            length: tile.data.length,
            runLength: 1,
        });
        currentOffset += BigInt(tile.data.length);
    }

    // 디렉토리 직렬화
    const directoryBuffer = serializeDirectory(entries);
    const directoryCompressed = zlib.gzipSync(directoryBuffer);

    // 파일 구성
    // [헤더 127바이트] [루트 디렉토리] [메타데이터] [타일 데이터...]

    const HEADER_SIZE = 127;
    const rootDirOffset = HEADER_SIZE;
    const rootDirLength = directoryCompressed.length;
    const metadataOffset = rootDirOffset + rootDirLength;
    const metadataLength = metadataCompressed.length;
    const tileDataOffset = metadataOffset + metadataLength;

    // 헤더 생성
    const header = Buffer.alloc(HEADER_SIZE);
    let pos = 0;

    // Magic "PMTiles" (7바이트)
    header.write('PMTiles', pos);
    pos += 7;

    // Version (1바이트)
    header.writeUInt8(3, pos);
    pos += 1;

    // Root directory offset (8바이트)
    header.writeBigUInt64LE(BigInt(rootDirOffset), pos);
    pos += 8;

    // Root directory length (8바이트)
    header.writeBigUInt64LE(BigInt(rootDirLength), pos);
    pos += 8;

    // JSON metadata offset (8바이트)
    header.writeBigUInt64LE(BigInt(metadataOffset), pos);
    pos += 8;

    // JSON metadata length (8바이트)
    header.writeBigUInt64LE(BigInt(metadataLength), pos);
    pos += 8;

    // Leaf directories offset (8바이트) - 없음
    header.writeBigUInt64LE(BigInt(0), pos);
    pos += 8;

    // Leaf directories length (8바이트) - 없음
    header.writeBigUInt64LE(BigInt(0), pos);
    pos += 8;

    // Tile data offset (8바이트)
    header.writeBigUInt64LE(BigInt(tileDataOffset), pos);
    pos += 8;

    // Tile data length (8바이트)
    header.writeBigUInt64LE(currentOffset, pos);
    pos += 8;

    // Number of addressed tiles (8바이트)
    header.writeBigUInt64LE(BigInt(tiles.length), pos);
    pos += 8;

    // Number of tile entries (8바이트)
    header.writeBigUInt64LE(BigInt(entries.length), pos);
    pos += 8;

    // Number of tile contents (8바이트)
    header.writeBigUInt64LE(BigInt(tiles.length), pos);
    pos += 8;

    // Clustered flag (1바이트)
    header.writeUInt8(1, pos);
    pos += 1;

    // Internal compression (1바이트) - gzip = 2
    header.writeUInt8(2, pos);
    pos += 1;

    // Tile compression (1바이트) - gzip = 2
    header.writeUInt8(2, pos);
    pos += 1;

    // Tile type (1바이트) - MVT = 1
    header.writeUInt8(1, pos);
    pos += 1;

    // Min zoom (1바이트)
    header.writeUInt8(tileOptions.minZoom, pos);
    pos += 1;

    // Max zoom (1바이트)
    header.writeUInt8(tileOptions.maxZoom, pos);
    pos += 1;

    // Bounds: min_lon, min_lat, max_lon, max_lat (각 4바이트 = 16바이트)
    // 인천 기준 대략적인 bounds
    header.writeInt32LE(Math.round(126.3 * 10000000), pos); pos += 4;
    header.writeInt32LE(Math.round(37.2 * 10000000), pos); pos += 4;
    header.writeInt32LE(Math.round(126.9 * 10000000), pos); pos += 4;
    header.writeInt32LE(Math.round(37.7 * 10000000), pos); pos += 4;

    // Center: lon, lat, zoom (4 + 4 + 1 = 9바이트)
    header.writeInt32LE(Math.round(126.7 * 10000000), pos); pos += 4;
    header.writeInt32LE(Math.round(37.45 * 10000000), pos); pos += 4;
    header.writeUInt8(10, pos); pos += 1;

    // 파일 쓰기
    const fd = fs.openSync(outputPath, 'w');

    // 헤더 쓰기
    fs.writeSync(fd, header, 0, HEADER_SIZE, 0);

    // 루트 디렉토리 쓰기
    fs.writeSync(fd, directoryCompressed, 0, directoryCompressed.length, rootDirOffset);

    // 메타데이터 쓰기
    fs.writeSync(fd, metadataCompressed, 0, metadataCompressed.length, metadataOffset);

    // 타일 데이터 쓰기
    let tileOffset = tileDataOffset;
    for (const tile of tiles) {
        fs.writeSync(fd, tile.data, 0, tile.data.length, tileOffset);
        tileOffset += tile.data.length;
    }

    fs.closeSync(fd);
}

// Z/X/Y를 PMTiles tile ID로 변환 (Hilbert curve 기반)
function zxyToTileId(z: number, x: number, y: number): bigint {
    if (z === 0) return BigInt(0);

    let acc = BigInt(0);
    let tz = z;
    let tx = x;
    let ty = y;

    // 이전 줌 레벨의 타일 수 합계
    for (let i = 0; i < z; i++) {
        acc += BigInt(1) << BigInt(2 * i);
    }

    // Hilbert curve 변환 (간단한 Z-order 사용)
    let d = BigInt(0);
    let s = 1 << (z - 1);

    while (s > 0) {
        const rx = (tx & s) > 0 ? 1 : 0;
        const ry = (ty & s) > 0 ? 1 : 0;
        d += BigInt(s * s * ((3 * rx) ^ ry));

        // 회전
        if (ry === 0) {
            if (rx === 1) {
                tx = s - 1 - tx;
                ty = s - 1 - ty;
            }
            [tx, ty] = [ty, tx];
        }

        s = s >> 1;
    }

    return acc + d;
}

// 디렉토리 엔트리 직렬화
function serializeDirectory(
    entries: Array<{ tileId: bigint; offset: bigint; length: number; runLength: number }>
): Buffer {
    // 간단한 varint 인코딩
    const chunks: Buffer[] = [];

    // 엔트리 수
    chunks.push(encodeVarint(entries.length));

    // 각 엔트리
    let lastId = BigInt(0);
    for (const entry of entries) {
        // tile_id delta
        chunks.push(encodeVarint(Number(entry.tileId - lastId)));
        lastId = entry.tileId;

        // run_length
        chunks.push(encodeVarint(entry.runLength));

        // length
        chunks.push(encodeVarint(entry.length));

        // offset (첫 번째 엔트리만 절대값, 나머지는 0)
        chunks.push(encodeVarint(Number(entry.offset)));
    }

    return Buffer.concat(chunks);
}

// Varint 인코딩
function encodeVarint(value: number): Buffer {
    const bytes: number[] = [];
    let v = value;

    while (v >= 0x80) {
        bytes.push((v & 0x7f) | 0x80);
        v = v >>> 7;
    }
    bytes.push(v);

    return Buffer.from(bytes);
}

// 메인 함수
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    console.log('🚀 PMTiles 생성 시작 (Node.js)\n');

    const sourcesToProcess = args.length > 0
        ? args.filter(name => DATA_SOURCES[name])
        : Object.keys(DATA_SOURCES);

    for (const sourceName of sourcesToProcess) {
        const config = DATA_SOURCES[sourceName];
        if (!config.outputGeoJSON || !config.outputPMTiles) {
            console.log(`⏭️ [${sourceName}] GeoJSON/PMTiles 출력 설정 없음, 건너뜀`);
            continue;
        }

        const geojsonPath = path.join(process.cwd(), config.outputGeoJSON);
        const pmtilesPath = path.join(process.cwd(), config.outputPMTiles);

        try {
            await convertGeoJsonToPMTiles(geojsonPath, pmtilesPath, config);
        } catch (e: any) {
            console.error(`❌ [${sourceName}] 오류:`, e.message);
        }
    }

    console.log('\n✨ PMTiles 생성 완료!');
}

main().catch(console.error);
