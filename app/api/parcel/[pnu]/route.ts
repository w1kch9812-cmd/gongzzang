// app/api/parcel/[pnu]/route.ts - 필지 상세 정보 API
// Single Source of Truth: /data/entities/parcels.json

import { NextRequest, NextResponse } from 'next/server';
import type { ParcelDetail } from '@/types/data';
import { DATA_PATHS } from '@/types/data';
import { getDataUrl, isR2Configured } from '@/lib/data/dataUrl';
import { logger } from '@/lib/utils/logger';

// 서버 사이드 PNU 맵 (한 번만 로드)
let parcelMap: Map<string, any> | null = null;
let loadError: string | null = null;

// 파일 로드 및 PNU 맵 생성 (한 번만 실행)
// parcels.json을 단일 소스로 사용
async function getParcelMap(): Promise<Map<string, any>> {
    if (parcelMap) return parcelMap;
    if (loadError) throw new Error(loadError);

    try {
        let data: any[];

        if (isR2Configured()) {
            // R2에서 JSON 로드 (경로 매핑은 getDataUrl에서 처리)
            const url = getDataUrl('/data/entities/parcels.json');
            logger.log(`[API] Loading parcels from R2: ${url}`);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`R2 fetch failed: ${response.status} ${response.statusText}`);
            }

            data = await response.json();
            logger.log(`[API] R2에서 로드 완료: ${data.length}개`);
        } else {
            // 로컬 파일에서 로드 (개발 환경) - 새 경로: /data/entities/parcels.json
            const fs = await import('fs');
            const path = await import('path');

            const dataPath = path.join(process.cwd(), 'public/data/entities/parcels.json');
            logger.log(`[API] Loading parcels from local file: ${dataPath}`);

            if (!fs.existsSync(dataPath)) {
                throw new Error(`File not found: ${dataPath}`);
            }

            const fileContent = fs.readFileSync(dataPath, 'utf-8');
            data = JSON.parse(fileContent);
            logger.log(`[API] 로컬 파일 로드 완료: ${data.length}개`);
        }

        // PNU 맵 생성 (pnu 또는 PNU 필드 지원 - R2 호환)
        parcelMap = new Map();
        for (const p of data) {
            // 새 필드명(pnu) 또는 구 필드명(PNU/id) 사용
            const pnuId = p.pnu || p.PNU || p.id;
            if (pnuId) {
                parcelMap.set(pnuId, p);
            }
        }

        logger.log(`[API] 필지 맵 생성 완료: ${parcelMap.size}개`);
        return parcelMap;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        loadError = `파일 로드 실패: ${errorMsg}`;
        logger.error(`[API] ${loadError}`);
        throw new Error(loadError);
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ pnu: string }> }
) {
    const { pnu } = await params;
    logger.log(`[API] GET /api/parcel/${pnu} - Request received`);

    // 유효성 검사
    if (!pnu || pnu.length !== 19) {
        logger.log(`[API] Invalid PNU format: "${pnu}" (length: ${pnu?.length})`);
        return NextResponse.json({ error: 'Invalid PNU format' }, { status: 400 });
    }

    try {
        // PNU 맵에서 O(1) 조회
        logger.log(`[API] Loading parcel map...`);
        const pnuMap = await getParcelMap();
        logger.log(`[API] Map loaded, size: ${pnuMap.size}, searching for PNU: ${pnu}`);

        const parcel = pnuMap.get(pnu);

        if (!parcel) {
            logger.log(`[API] Parcel not found in map for PNU: ${pnu}`);
            // Sample a few keys to debug
            const sampleKeys = Array.from(pnuMap.keys()).slice(0, 5);
            logger.log(`[API] Sample keys from map:`, sampleKeys);
            return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
        }

        logger.log(`[API] Parcel found:`, { pnu, jibun: parcel.jibun });

        // 상세 정보 구성
        const detail: ParcelDetail = {
            ...parcel,
            transactions: parcel.transactions || [],
            listings: parcel.listings || [],
            auctions: parcel.auctions || [],
        };

        return NextResponse.json(detail);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error(`[API] 필지 조회 실패 (${pnu}):`, errorMessage);
        logger.error(`[API] Stack trace:`, errorStack);
        return NextResponse.json({
            error: 'Internal server error',
            details: errorMessage,
            pnu
        }, { status: 500 });
    }
}
