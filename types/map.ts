// types/map.ts - 지도 관련 타입

import type { Map as MapboxMap } from 'mapbox-gl';

/** 네이버 지도 확장 타입 */
export interface NaverMapWithMapbox extends naver.maps.Map {
    _mapbox?: MapboxMap;
}

/** 뷰포트 범위 */
export interface ViewportBounds {
    minLng: number;  // west
    maxLng: number;  // east
    minLat: number;  // south
    maxLat: number;  // north
}

/** 줌 레벨 범위 */
export interface ZoomRange {
    min: number;
    max: number;
}

/** MVT 소스 설정 */
export interface MVTSourceConfig {
    id: string;
    tiles: string[];
    minzoom: number;
    maxzoom: number;
    promoteId?: string;
}

/** MVT 레이어 설정 */
export interface MVTLayerConfig {
    id: string;
    source: string;
    sourceLayer: string;
    type: 'fill' | 'line' | 'symbol';
    minzoom?: number;
    maxzoom?: number;
    paint: Record<string, any>;
}
