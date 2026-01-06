// app/api/naver-directions/route.ts - 네이버 Directions API 프록시

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, badRequest } from '../lib/errorHandler';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start'); // "lng,lat"
    const goal = searchParams.get('goal');   // "lng,lat"
    const option = searchParams.get('option') || 'trafast';

    if (!start || !goal) {
        return badRequest('start and goal parameters are required');
    }

    try {
        const response = await fetch(
            `https://naveropenapi.apigw.ntruss.com/map-direction/v1/driving?start=${start}&goal=${goal}&option=${option}`,
            {
                headers: {
                    'X-NCP-APIGW-API-KEY-ID': process.env.NAVER_CLIENT_ID!,
                    'X-NCP-APIGW-API-KEY': process.env.NAVER_CLIENT_SECRET!,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Directions API error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        return handleApiError('Directions', error);
    }
}
