// app/api/geocoding/route.ts - Kakao Geocoding API 프록시

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, badRequest } from '../lib/errorHandler';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
        return badRequest('Query parameter is required');
    }

    try {
        const response = await fetch(
            `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`,
            {
                headers: {
                    'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Geocoding API error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        return handleApiError('Geocoding', error);
    }
}

// POST도 지원 (antigrabity 호환)
export async function POST(request: NextRequest) {
    try {
        const { address } = await request.json();

        if (!address) {
            return badRequest('Address is required');
        }

        const response = await fetch(
            `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
            {
                headers: {
                    Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error('Kakao API request failed');
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        return handleApiError('Geocoding', error);
    }
}
