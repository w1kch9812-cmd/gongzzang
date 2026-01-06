// lib/utils/mapboxUtils.ts - Mapbox GL 접근 유틸리티 (Single Source of Truth)

/** Mapbox GL 인스턴스 타입 (간략화) */
export interface MapboxGLInstance {
    getCanvas: () => HTMLCanvasElement;
    getCenter: () => { lng: number; lat: number };
    getBounds: () => {
        getWest: () => number;
        getEast: () => number;
        getNorth: () => number;
        getSouth: () => number;
    };
    getZoom: () => number;
    getPitch: () => number;
    getBearing: () => number;
    setPitch: (pitch: number) => void;
    setBearing: (bearing: number) => void;
    easeTo: (options: { pitch?: number; bearing?: number; duration?: number }) => void;
    getSource: (id: string) => unknown;
    getLayer: (id: string) => unknown;
    addSource: (id: string, config: unknown) => void;
    addLayer: (config: unknown) => void;
    addControl: (control: unknown, position?: string) => void;
    removeControl: (control: unknown) => void;
    setLayoutProperty: (layer: string, name: string, value: unknown) => void;
    setPaintProperty: (layer: string, name: string, value: unknown) => void;
    setFilter: (layer: string, filter: unknown) => void;
    setMaxTileCacheSize?: (size: number) => void;
    dragRotate: { enable: () => void; disable: () => void };
    touchZoomRotate: { disableRotation: () => void };
    on: (event: string, layerOrCallback: string | ((e: unknown) => void), callback?: (e: unknown) => void) => void;
    off: (event: string, callback: (e: unknown) => void) => void;
}

/**
 * 네이버 지도에서 Mapbox GL 인스턴스 추출
 * @returns Mapbox GL 인스턴스 또는 null
 */
export function getMapboxGL(naverMap: naver.maps.Map | null): MapboxGLInstance | null {
    if (!naverMap) return null;
    const mbMap = (naverMap as any)._mapbox;
    return mbMap?.getCanvas ? mbMap : null;
}

/**
 * Mapbox GL 인스턴스가 준비되고 스타일이 로드될 때까지 대기
 */
export async function waitForMapboxGL(
    naverMap: naver.maps.Map,
    maxRetries = 100,
    delay = 100
): Promise<MapboxGLInstance> {
    // 1단계: Mapbox GL 인스턴스 찾기
    let mbMap: MapboxGLInstance | null = null;
    for (let i = 0; i < 50; i++) {
        mbMap = getMapboxGL(naverMap);
        if (mbMap) break;
        if (i % 10 === 0) {
            console.log(`⏳ [waitForMapboxGL] 인스턴스 대기 ${i}/50`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (!mbMap) {
        throw new Error('Mapbox GL 인스턴스를 찾을 수 없음');
    }

    // 2단계: 스타일 로드 완료까지 폴링 (최대 10초)
    for (let i = 0; i < 100; i++) {
        const isLoaded = (mbMap as any).isStyleLoaded?.();
        if (isLoaded === true) {
            console.log('✅ [waitForMapboxGL] 스타일 로드 완료');
            return mbMap;
        }
        if (i % 10 === 0) {
            console.log(`⏳ [waitForMapboxGL] 스타일 로드 대기 ${i}/100`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    // 10초 후에도 로드 안 되면 에러
    throw new Error('스타일 로드 타임아웃 (10초)');
}

/** 기본 뷰 상태 (인천 중심) */
const DEFAULT_VIEW_STATE = {
    longitude: 126.7052,
    latitude: 37.4563,
    zoom: 12,
    pitch: 0,
    bearing: 0,
};

/**
 * 현재 뷰 상태 가져오기
 */
export function getViewState(mbMap: MapboxGLInstance | null | undefined) {
    if (!mbMap?.getCenter) return DEFAULT_VIEW_STATE;
    try {
        const center = mbMap.getCenter();
        return {
            longitude: center.lng,
            latitude: center.lat,
            zoom: mbMap.getZoom(),
            pitch: mbMap.getPitch() || 0,
            bearing: mbMap.getBearing() || 0,
        };
    } catch {
        return DEFAULT_VIEW_STATE;
    }
}

/** 기본 바운딩 박스 (인천 영역) */
const DEFAULT_BBOX: [number, number, number, number] = [126.3, 37.2, 127.1, 37.7];

/**
 * 현재 뷰포트 바운딩 박스 가져오기
 */
export function getViewportBBox(mbMap: MapboxGLInstance | null | undefined): [number, number, number, number] {
    if (!mbMap?.getBounds) return DEFAULT_BBOX;
    try {
        const bounds = mbMap.getBounds();
        return [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth(),
        ];
    } catch {
        return DEFAULT_BBOX;
    }
}

/**
 * 레이어 가시성 일괄 설정
 */
export function setLayerVisibility(
    mbMap: MapboxGLInstance,
    layerIds: string[],
    visible: boolean
): void {
    const value = visible ? 'visible' : 'none';
    for (const layerId of layerIds) {
        try {
            if (mbMap.getLayer(layerId)) {
                mbMap.setLayoutProperty(layerId, 'visibility', value);
            }
        } catch {
            // 레이어가 없으면 무시
        }
    }
}

/**
 * 소스 안전 추가 (이미 있으면 무시)
 */
export function addSourceSafely(
    mbMap: MapboxGLInstance,
    id: string,
    config: unknown
): boolean {
    try {
        if (!mbMap.getSource(id)) {
            mbMap.addSource(id, config);
            return true;
        }
    } catch (e) {
        console.warn(`소스 추가 실패 (${id}):`, e);
    }
    return false;
}

/**
 * 레이어 안전 추가 (이미 있으면 무시)
 */
export function addLayerSafely(
    mbMap: MapboxGLInstance,
    config: { id: string; [key: string]: unknown }
): boolean {
    try {
        if (!mbMap.getLayer(config.id)) {
            mbMap.addLayer(config);
            return true;
        }
    } catch (e) {
        console.warn(`레이어 추가 실패 (${config.id}):`, e);
    }
    return false;
}

/**
 * Mapbox GL Marker 클래스 가져오기
 * 네이버 지도 GL 모드에서는 내부 mapboxgl을 추출해야 함
 */
export interface MapboxMarkerOptions {
    element?: HTMLElement;
    anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    offset?: [number, number];
}

export interface MapboxMarker {
    setLngLat: (lngLat: [number, number]) => MapboxMarker;
    addTo: (map: MapboxGLInstance) => MapboxMarker;
    remove: () => void;
    getElement: () => HTMLElement;
}

export type MapboxMarkerClass = new (options?: MapboxMarkerOptions) => MapboxMarker;

// 캐시된 Marker 클래스
let cachedMarkerClass: MapboxMarkerClass | null = null;

/**
 * Mapbox GL Marker 클래스 추출
 */
export function getMapboxMarkerClass(mbMap: MapboxGLInstance): MapboxMarkerClass | null {
    if (!mbMap) return null;

    // 캐시된 클래스 반환
    if (cachedMarkerClass) return cachedMarkerClass;

    // 방법 1: 전역 mapboxgl에서 찾기 (가장 일반적)
    if (typeof window !== 'undefined' && window.mapboxgl?.Marker) {
        cachedMarkerClass = window.mapboxgl.Marker;
        console.log('✅ [Marker] 전역 mapboxgl.Marker 사용');
        return cachedMarkerClass;
    }

    // 방법 2: 생성자에서 Marker 클래스 찾기
    const constructor = (mbMap as any).constructor;
    if (constructor?.Marker) {
        cachedMarkerClass = constructor.Marker;
        console.log('✅ [Marker] constructor.Marker 사용');
        return cachedMarkerClass;
    }

    // 방법 3: __proto__에서 찾기
    const proto = Object.getPrototypeOf(mbMap);
    if (proto?.constructor?.Marker) {
        cachedMarkerClass = proto.constructor.Marker;
        console.log('✅ [Marker] proto.constructor.Marker 사용');
        return cachedMarkerClass;
    }

    // 방법 4: _mapboxgl 내부 참조에서 찾기
    const mapboxgl = (mbMap as any)._mapboxgl || (mbMap as any).mapboxgl;
    if (mapboxgl?.Marker) {
        cachedMarkerClass = mapboxgl.Marker;
        console.log('✅ [Marker] _mapboxgl.Marker 사용');
        return cachedMarkerClass;
    }

    console.warn('⚠️ [Marker] Mapbox Marker 클래스를 찾을 수 없음, fallback 사용');
    return null;
}

/**
 * Mapbox GL Marker 생성 (fallback: 커스텀 마커)
 */
export function createMapboxMarker(
    mbMap: MapboxGLInstance,
    element: HTMLElement,
    lngLat: [number, number],
    anchor: string = 'bottom'
): MapboxMarker | null {
    const MarkerClass = getMapboxMarkerClass(mbMap);

    if (MarkerClass) {
        try {
            return new MarkerClass({ element, anchor: anchor as any })
                .setLngLat(lngLat)
                .addTo(mbMap);
        } catch (e) {
            console.warn('Mapbox Marker 생성 실패:', e);
        }
    }

    // fallback: 수동 오버레이 방식
    return createCustomMarker(mbMap, element, lngLat, anchor);
}

/**
 * 커스텀 마커 (Mapbox Marker 없을 때 fallback)
 * 주의: 성능 문제로 가급적 네이티브 Mapbox Marker 사용 권장
 */
function createCustomMarker(
    mbMap: MapboxGLInstance,
    element: HTMLElement,
    lngLat: [number, number],
    anchor: string
): MapboxMarker {
    const container = document.createElement('div');
    container.style.cssText = 'position: absolute; pointer-events: auto; z-index: 1; will-change: transform;';
    container.appendChild(element);

    // 지도 컨테이너에 추가
    const canvas = mbMap.getCanvas();
    const mapContainer = canvas.parentElement;
    mapContainer?.appendChild(container);

    let currentLngLat = lngLat;
    let rafId: number | null = null;

    // 좌표 → 픽셀 변환 함수 (transform 사용으로 리플로우 방지)
    const updatePosition = () => {
        try {
            const point = (mbMap as any).project?.(currentLngLat);
            if (point) {
                let offsetX = 0, offsetY = 0;

                // 고정 오프셋 (getBoundingClientRect 호출 제거)
                if (anchor.includes('bottom')) offsetY = -40;
                else if (anchor.includes('top')) offsetY = 0;
                else offsetY = -20;

                if (anchor.includes('left')) offsetX = 0;
                else if (anchor.includes('right')) offsetX = -60;
                else offsetX = -30;

                // transform 사용 (리플로우 방지)
                container.style.transform = `translate(${point.x + offsetX}px, ${point.y + offsetY}px)`;
            }
        } catch {
            // 무시
        }
    };

    // 스로틀된 업데이트
    const throttledUpdate = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            updatePosition();
            rafId = null;
        });
    };

    updatePosition();
    mbMap.on('move', throttledUpdate);

    const marker: MapboxMarker = {
        setLngLat: (newLngLat: [number, number]) => {
            currentLngLat = newLngLat;
            updatePosition();
            return marker;
        },
        addTo: () => marker,
        remove: () => {
            if (rafId) cancelAnimationFrame(rafId);
            mbMap.off('move', throttledUpdate);
            container.remove();
        },
        getElement: () => element,
    };

    return marker;
}
