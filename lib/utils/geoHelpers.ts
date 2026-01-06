// lib/utils/geoHelpers.ts
// 지리 계산 유틸리티 (Single Source of Truth)

import type { Coordinate } from '@/types/data';

// ===== 좌표 유효성 검사 =====

/** 좌표가 유효한지 확인 (null이 아니고 0이 아닌지) */
export function hasValidCoordinate(coord: Coordinate | null | undefined): coord is Coordinate {
    return (
        coord !== null &&
        coord !== undefined &&
        Array.isArray(coord) &&
        coord.length >= 2 &&
        coord[0] !== 0 &&
        coord[1] !== 0 &&
        isFinite(coord[0]) &&
        isFinite(coord[1])
    );
}

/** 좌표가 한국 영역 내에 있는지 확인 */
export function isInKoreaBounds(coord: Coordinate): boolean {
    const [lng, lat] = coord;
    // 한국 대략적 범위: 위도 33-43, 경도 124-132
    return lat >= 33 && lat <= 43 && lng >= 124 && lng <= 132;
}

// ===== 거리 계산 =====

/**
 * Haversine 공식을 사용한 두 좌표 간 거리 계산
 * @returns 거리 (km)
 */
export function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371; // 지구 반지름 (km)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * 좌표 배열을 사용한 거리 계산 (편의 함수)
 * @param from [lng, lat]
 * @param to [lng, lat]
 * @returns 거리 (km)
 */
export function calculateDistanceFromCoords(from: Coordinate, to: Coordinate): number {
    return calculateDistance(from[1], from[0], to[1], to[0]);
}

// ===== 방위각 계산 =====

/**
 * 두 좌표 간 방위각(bearing) 계산
 * @returns 방위각 (도, 0=북, 시계방향)
 */
export function calculateBearing(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
): number {
    const dLng = ((toLng - fromLng) * Math.PI) / 180;
    const lat1 = (fromLat * Math.PI) / 180;
    const lat2 = (toLat * Math.PI) / 180;

    const x = Math.sin(dLng) * Math.cos(lat2);
    const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    let bearing = (Math.atan2(x, y) * 180) / Math.PI;
    return (bearing + 360) % 360;
}

/**
 * 좌표 배열을 사용한 방위각 계산 (편의 함수)
 * @param from [lng, lat]
 * @param to [lng, lat]
 * @returns 방위각 (도, 0=북, 시계방향)
 */
export function calculateBearingFromCoords(from: Coordinate, to: Coordinate): number {
    return calculateBearing(from[1], from[0], to[1], to[0]);
}

// ===== 거리 포맷팅 =====

/**
 * 거리를 사람이 읽기 쉬운 형식으로 포맷
 * @param distanceKm 거리 (km)
 * @returns 포맷된 문자열 (예: "500m", "1.5km")
 */
export function formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
}

// ===== 바운드 계산 =====

/** 좌표 배열의 바운딩 박스 계산 */
export function calculateBounds(coords: Coordinate[]): {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
} | null {
    if (coords.length === 0) return null;

    let minLng = Infinity, minLat = Infinity;
    let maxLng = -Infinity, maxLat = -Infinity;

    for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    }

    return { minLng, minLat, maxLng, maxLat };
}

/** 좌표가 바운드 내에 있는지 확인 */
export function isInBounds(
    coord: Coordinate,
    bounds: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
): boolean {
    const [lng, lat] = coord;
    const [minLng, minLat, maxLng, maxLat] = bounds;
    return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}
