// app/api/tiles/[...path]/route.ts
// PMTiles에서 개별 타일을 서빙하는 API Route
// 참고: R2 CDN 사용 시 이 API는 사용되지 않음 (클라이언트에서 직접 R2 접근)

import { NextRequest, NextResponse } from 'next/server';

// R2 CDN 사용 시 이 API는 비활성화
const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_URL || '';

// PMTiles 모듈 로드
const pmtilesModule = require('pmtiles');
const PMTiles = pmtilesModule.PMTiles;
const FetchSource = pmtilesModule.FetchSource;

// 로컬 전용 모듈 (R2 미사용 시)
let existsSync: any, readFileSync: any, join: any;
if (!R2_BASE_URL) {
    const path = require('path');
    join = path.join;
    const fs = require('fs');
    existsSync = fs.existsSync;
    readFileSync = fs.readFileSync;
}

// 압축 해제 모듈
const zlib = require('zlib');
const gunzipSync = zlib.gunzipSync;
const brotliDecompressSync = zlib.brotliDecompressSync;

// pmtiles 타입 (빌드 에러 방지)
interface Source {
    getBytes(offset: number, length: number): Promise<RangeResponse>;
    getKey(): string;
}
interface RangeResponse {
    data: ArrayBuffer;
    etag?: string;
    expires?: string;
    cacheControl?: string;
}

// ArrayBuffer 기반 PMTiles 소스 (안정적인 메모리 캐싱)
class BufferSource implements Source {
    private buffer: ArrayBuffer;
    private key: string;

    constructor(buffer: ArrayBuffer, key: string) {
        this.buffer = buffer;
        this.key = key;
    }

    async getBytes(offset: number, length: number): Promise<RangeResponse> {
        const data = this.buffer.slice(offset, offset + length);
        return {
            data,
            etag: undefined,
            expires: undefined,
            cacheControl: undefined,
        };
    }

    getKey(): string {
        return this.key;
    }
}

// PMTiles 인스턴스 캐시 (LRU 정책 + 메모리 최적화)
interface CacheEntry {
    pmtiles: any;  // PMTiles 인스턴스 (동적 로드로 인해 any 사용)
    compression: number;
    lastAccess: number;
    size: number;  // 파일 크기 (MB)
}

let pmtilesCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE_MB = 30;  // 최대 캐시 크기: 30MB (lots.pmtiles 40MB 제외)
const CACHE_TTL = 10 * 60 * 1000;  // 10분 후 자동 해제

// LRU 캐시 정리 (메모리 절약)
function evictLRUCache() {
    const now = Date.now();
    let totalSize = 0;

    // 크기 계산 및 TTL 체크
    const entries = Array.from(pmtilesCache.entries());
    const validEntries = entries.filter(([name, entry]) => {
        // TTL 초과 시 제거
        if (now - entry.lastAccess > CACHE_TTL) {
            console.log(`🗑️ PMTiles 캐시 만료: ${name} (${(entry.size).toFixed(1)}MB)`);
            return false;
        }
        totalSize += entry.size;
        return true;
    });

    // 캐시 크기 초과 시 LRU 정책으로 제거
    if (totalSize > MAX_CACHE_SIZE_MB) {
        // lastAccess 기준 정렬 (오래된 것부터)
        validEntries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);

        let currentSize = totalSize;
        const toKeep: typeof validEntries = [];

        // 뒤에서부터 (최근 것부터) MAX_CACHE_SIZE_MB까지만 유지
        for (let i = validEntries.length - 1; i >= 0; i--) {
            const [name, entry] = validEntries[i];
            if (currentSize - entry.size >= 0 && (currentSize - entry.size <= MAX_CACHE_SIZE_MB || toKeep.length === 0)) {
                toKeep.unshift([name, entry]);
                currentSize -= entry.size;
            } else {
                console.log(`🗑️ PMTiles LRU 제거: ${name} (${(entry.size).toFixed(1)}MB)`);
            }
        }

        pmtilesCache = new Map(toKeep);
    } else {
        pmtilesCache = new Map(validEntries);
    }
}

async function getPMTiles(name: string): Promise<{ pmtiles: any; compression: number } | null> {
    // LRU 캐시 정리
    evictLRUCache();

    // 캐시 히트 (lastAccess 업데이트)
    const cached = pmtilesCache.get(name);
    if (cached) {
        cached.lastAccess = Date.now();
        return { pmtiles: cached.pmtiles, compression: cached.compression };
    }

    try {
        let pmtiles: any;
        let fileSizeMB = 0;

        if (R2_BASE_URL) {
            // R2에서 PMTiles 로드 (FetchSource 사용) - 새 경로: /data/geometry/
            const url = `${R2_BASE_URL}/data/geometry/${name}.pmtiles`;
            console.log(`📡 R2에서 PMTiles 로드: ${url}`);

            const source = new FetchSource(url);
            pmtiles = new PMTiles(source);
            // R2의 경우 파일 크기를 정확히 알 수 없으므로 추정값 사용
            fileSizeMB = 10; // 평균 크기로 가정
        } else {
            // 로컬 파일에서 PMTiles 로드 - 새 경로: /data/geometry/
            const filePath = join(process.cwd(), 'public', 'data', 'geometry', `${name}.pmtiles`);

            if (!existsSync(filePath)) {
                console.error(`❌ PMTiles 파일 없음: ${filePath}`);
                return null;
            }

            const fileBuffer = readFileSync(filePath);
            fileSizeMB = fileBuffer.length / 1024 / 1024;

            const arrayBuffer = fileBuffer.buffer.slice(
                fileBuffer.byteOffset,
                fileBuffer.byteOffset + fileBuffer.byteLength
            );

            const source = new BufferSource(arrayBuffer, filePath);
            pmtiles = new PMTiles(source);
        }

        const header = await pmtiles.getHeader();

        // 캐시에 추가 (LRU 정보 포함)
        const entry: CacheEntry = {
            pmtiles,
            compression: header.tileCompression,
            lastAccess: Date.now(),
            size: fileSizeMB,
        };
        pmtilesCache.set(name, entry);

        console.log(`📦 PMTiles 로드 완료: ${name}, minzoom: ${header.minZoom}, maxzoom: ${header.maxZoom}`);

        return { pmtiles, compression: header.tileCompression };
    } catch (e) {
        console.error(`PMTiles 로드 실패 (${name}):`, e);
        return null;
    }
}

// CORS 헤더
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;

    // URL 패턴: /api/tiles/{name}/{z}/{x}/{y}.pbf
    if (path.length !== 4) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400, headers: corsHeaders });
    }

    const [name, zStr, xStr, yFile] = path;
    const z = parseInt(zStr, 10);
    const x = parseInt(xStr, 10);
    const y = parseInt(yFile.replace('.pbf', ''), 10);

    if (isNaN(z) || isNaN(x) || isNaN(y)) {
        return NextResponse.json({ error: 'Invalid tile coordinates' }, { status: 400, headers: corsHeaders });
    }

    const cached = await getPMTiles(name);
    if (!cached) {
        console.error(`❌ PMTiles 없음: ${name}`);
        return NextResponse.json({ error: 'PMTiles not found' }, { status: 404, headers: corsHeaders });
    }

    try {
        const tile = await cached.pmtiles.getZxy(z, x, y);

        if (!tile || !tile.data || tile.data.byteLength === 0) {
            // 빈 타일은 정상 (해당 영역에 데이터 없음)
            return new NextResponse(null, { status: 204, headers: corsHeaders });
        }

        const rawData = Buffer.from(tile.data);
        const { compression } = cached;

        // 서버에서 압축 해제 후 전송 (Mapbox GL이 protobuf 직접 파싱)
        // compression: 0=none, 1=unknown, 2=gzip, 3=brotli, 4=zstd
        let data: Buffer;
        try {
            if (compression === 2) {
                data = gunzipSync(rawData);
            } else if (compression === 3) {
                data = brotliDecompressSync(rawData);
            } else {
                data = rawData;
            }
        } catch {
            // 압축 해제 실패 시 원본 전송
            data = rawData;
        }

        const headers: Record<string, string> = {
            ...corsHeaders,
            'Content-Type': 'application/x-protobuf',
            'Cache-Control': 'public, max-age=86400, immutable',
        };

        return new NextResponse(new Uint8Array(data), { status: 200, headers });
    } catch (e) {
        console.error(`❌ 타일 조회 실패 (${name}/${z}/${x}/${y}):`, e);
        return new NextResponse(null, { status: 204, headers: corsHeaders });
    }
}
