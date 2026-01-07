// components/map/naver/UnifiedPolygonGLLayer.tsx
// MVT 폴리곤 렌더링 (PMTiles Protocol - R2 CDN 또는 로컬 API)

'use client';

import { useEffect, useRef, useCallback, useState, memo, useMemo } from 'react';
import { useMapStore } from '@/lib/stores/map-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { useDataStore } from '@/lib/stores/data-store';
import { useSelectionStore } from '@/lib/stores/selection-store';
import { ZOOM_SIDO, ZOOM_SIG, ZOOM_EMD, ZOOM_PARCEL } from '@/lib/map/zoomConfig';
import { usePriceColorExpression } from '@/lib/hooks/usePriceColorExpression';
import { usePriceChangeFeatureState } from '@/lib/hooks/usePriceChangeFeatureState';
import {
    waitForMapboxGL,
    setLayerVisibility,
    addSourceSafely,
    addLayerSafely,
} from '@/lib/utils/mapboxUtils';
import { logger } from '@/lib/utils/logger';
import type { LayerType } from '@/types/data';
import { Protocol } from 'pmtiles';

// R2 CDN URL (환경변수, 없으면 로컬 API 사용)
const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_URL || '';

// 가격 → 색상 변환 (저가=파랑 → 고가=빨강)
function priceToColor(avgPrice: number, minPrice: number, maxPrice: number): string {
    if (!avgPrice || avgPrice <= 0) return 'rgba(200, 200, 200, 0.3)';  // 데이터 없음

    const t = Math.min(1, Math.max(0, (avgPrice - minPrice) / (maxPrice - minPrice || 1)));

    // 파랑(저가) → 노랑(중간) → 빨강(고가)
    if (t < 0.5) {
        const tt = t * 2;
        const r = Math.round(59 + (255 - 59) * tt);
        const g = Math.round(130 + (220 - 130) * tt);
        const b = Math.round(246 - 246 * tt);
        return `rgba(${r}, ${g}, ${b}, 0.5)`;
    } else {
        const tt = (t - 0.5) * 2;
        const r = Math.round(255 - (255 - 239) * tt);
        const g = Math.round(220 - (220 - 68) * tt);
        const b = Math.round(0 + 68 * tt);
        return `rgba(${r}, ${g}, ${b}, 0.5)`;
    }
}

// 증감률 → 색상 변환 (상승=빨강, 하락=파랑, 중립=회색)
function changeRateToColor(rate: number | undefined): string {
    if (rate === undefined) return 'rgba(200, 200, 200, 0.3)';

    // 상승: 빨강, 하락: 파랑, 중립: 회색
    const threshold = 0.02;

    if (Math.abs(rate) < threshold) {
        return 'rgba(156, 163, 175, 0.3)';  // 중립 - 회색
    }

    if (rate > 0) {
        // 상승: 빨강 (rate가 클수록 진한 빨강)
        const intensity = Math.min(0.7, 0.25 + Math.abs(rate) * 0.9);
        return `rgba(239, 68, 68, ${intensity})`;
    } else {
        // 하락: 파랑 (rate가 작을수록 진한 파랑)
        const intensity = Math.min(0.7, 0.25 + Math.abs(rate) * 0.9);
        return `rgba(59, 130, 246, ${intensity})`;
    }
}

interface Props {
    map: naver.maps.Map | null;
}

// 레이어-가시성 키 매핑 테이블
const LAYER_VISIBILITY_MAP: Array<{ layers: string[]; key: LayerType }> = [
    { layers: ['vt-parcels-fill', 'vt-parcels-line'], key: 'parcel' },
    { layers: ['vt-complex-fill', 'vt-complex-line', 'vt-complex-label', 'vt-complex-glow-outer', 'vt-complex-glow-mid', 'vt-complex-glow-inner'], key: 'industrial-complex' },
    { layers: ['vt-lots-fill', 'vt-lots-line'], key: 'industrial-lot' },
    { layers: ['vt-industries-fill', 'vt-industries-line'], key: 'industry-type' },
    { layers: ['factory-points', 'factory-labels'], key: 'factory' },
];

// 클릭 판정 임계값 (드래그와 구분)
const CLICK_DISTANCE_THRESHOLD = 5; // 픽셀
const CLICK_TIME_THRESHOLD = 300;   // 밀리초

function UnifiedPolygonGLLayerInner({ map }: Props) {
    const mapboxGLRef = useRef<any>(null);
    const [mapboxGLReady, setMapboxGLReady] = useState(false);
    const clickStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    // 비동기 요청 취소를 위한 ref (race condition 방지)
    const pendingRequestRef = useRef<string | null>(null);

    // UIStore - UI 상태
    const visibleLayers = useUIStore((state) => state.visibleLayers);
    const dataVisualizationEnabled = useUIStore((state) => state.dataVisualizationEnabled);
    const parcelColorMode = useUIStore((state) => state.parcelColorMode);
    const hoveredRegionCode = useUIStore((state) => state.hoveredRegionCode);
    const hoveredRegionLevel = useUIStore((state) => state.hoveredRegionLevel);

    // DataStore - 데이터
    const regionAggregations = useDataStore((state) => state.regionAggregations);
    const factories = useDataStore((state) => state.factories);

    // SelectionStore - 선택 및 포커스 모드 상태
    const selection = useSelectionStore((state) => state.selection);
    const focusMode = useSelectionStore((state) => state.focusMode);
    const focusedComplex = useSelectionStore((state) => state.focusedComplex);
    const focusModeShowLots = useSelectionStore((state) => state.focusModeShowLots);
    const focusModeShowIndustries = useSelectionStore((state) => state.focusModeShowIndustries);
    const focusModeHighlightRoads = useSelectionStore((state) => state.focusModeHighlightRoads);

    // selection에서 selectedParcel 파생 (getter 우회)
    const selectedParcel = selection?.type === 'parcel' ? selection.data : null;

    // 가격 기반 색상 표현식
    const priceColorExpression = usePriceColorExpression();

    // Feature State 기반 증감률 색상 적용
    usePriceChangeFeatureState({
        mapboxGL: mapboxGLRef.current,
        ready: mapboxGLReady,
    });

    // 행정구역별 색상 표현식 생성 (가격 또는 증감률 기반)
    const regionColorExpressions = useMemo(() => {
        if (regionAggregations.size === 0) return null;

        // 가격 기반 색상 표현식 생성
        const createPriceExpression = (level: 'sido' | 'sig' | 'emd') => {
            const prices: number[] = [];
            regionAggregations.forEach((agg, key) => {
                if (key.startsWith(`${level}-`) && agg.avgTxPrice && agg.avgTxPrice > 0) {
                    prices.push(agg.avgTxPrice);
                }
            });

            if (prices.length === 0) return null;

            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);

            const matchExpr: any[] = ['match', ['get', 'code']];

            regionAggregations.forEach((agg, key) => {
                if (!key.startsWith(`${level}-`)) return;
                if (!agg.avgTxPrice || agg.avgTxPrice <= 0) return;

                const code = agg.regionCode;
                const color = priceToColor(agg.avgTxPrice, minPrice, maxPrice);

                matchExpr.push(code, color);

                if (level === 'sido' && code.length === 2) {
                    matchExpr.push(code + '00000000', color);
                }
            });

            matchExpr.push('rgba(200, 200, 200, 0.3)');
            return matchExpr;
        };

        // 증감률 기반 색상 표현식 생성
        const createChangeRateExpression = (level: 'sido' | 'sig' | 'emd') => {
            const matchExpr: any[] = ['match', ['get', 'code']];
            let hasData = false;
            let withChangeRate = 0;
            let withoutChangeRate = 0;

            regionAggregations.forEach((agg, key) => {
                if (!key.startsWith(`${level}-`)) return;

                const code = agg.regionCode;
                const color = changeRateToColor(agg.avgChangeRate);

                if (agg.avgChangeRate !== undefined) {
                    withChangeRate++;
                } else {
                    withoutChangeRate++;
                }

                matchExpr.push(code, color);
                hasData = true;

                if (level === 'sido' && code.length === 2) {
                    matchExpr.push(code + '00000000', color);
                }
            });

            logger.log(`📊 [Polygon] ${level} 증감률 데이터: 있음=${withChangeRate}, 없음=${withoutChangeRate}`);

            if (!hasData) return null;

            matchExpr.push('rgba(200, 200, 200, 0.3)');
            return matchExpr;
        };

        // parcelColorMode에 따라 다른 표현식 생성
        const createExpression = parcelColorMode === 'price-change'
            ? createChangeRateExpression
            : createPriceExpression;

        return {
            sido: createExpression('sido'),
            sig: createExpression('sig'),
            emd: createExpression('emd'),
        };
    }, [regionAggregations, parcelColorMode]);

    // ===== 공장 GeoJSON (클러스터링용) =====
    const factoryGeoJSON = useMemo(() => {
        const features = factories
            .filter(f => f.coord && f.coord[0] && f.coord[1])
            .map(f => ({
                type: 'Feature' as const,
                properties: {
                    id: f.id,
                    name: f.name,
                    businessType: f.businessType || '',
                },
                geometry: {
                    type: 'Point' as const,
                    coordinates: f.coord as [number, number],
                },
            }));

        return {
            type: 'FeatureCollection' as const,
            features,
        };
    }, [factories]);

    // ===== 이벤트 핸들러 (드래그와 클릭 구분) - useEffect보다 먼저 정의 =====
    const handleParcelMouseDown = useCallback((e: any) => {
        clickStartRef.current = { x: e.point.x, y: e.point.y, time: Date.now() };
        logger.log('🖱️ [Parcel] mousedown 이벤트 발생');
    }, []);

    // 커서 변경 핸들러 (메모리 누수 방지를 위해 useCallback 사용)
    const handleMouseEnter = useCallback(() => {
        mapboxGLRef.current?.getCanvas()?.style && (mapboxGLRef.current.getCanvas().style.cursor = 'pointer');
    }, []);

    const handleMouseLeave = useCallback(() => {
        mapboxGLRef.current?.getCanvas()?.style && (mapboxGLRef.current.getCanvas().style.cursor = '');
    }, []);

    // ===== 산업단지 클릭 핸들러 (포커스 모드 진입) =====
    const handleComplexClick = useCallback((e: any) => {
        const feature = e.features?.[0];
        if (!feature) return;

        const complexId = feature.properties?.id;
        if (!complexId) return;

        logger.log(`🏭 [Complex 클릭] ID: ${complexId}`);

        // 산업단지 상세 로드 및 포커스 모드 진입
        import('@/lib/data/loadData').then(async ({ loadIndustrialComplexDetail }) => {
            const detail = await loadIndustrialComplexDetail(complexId);
            if (detail) {
                useSelectionStore.getState().enterFocusMode(detail);

                // 산업단지로 줌인 (현재 맵 인스턴스 사용)
                const mbMap = mapboxGLRef.current;
                if (mbMap && detail.coord) {
                    try {
                        (mbMap as any).flyTo({
                            center: detail.coord,
                            zoom: 14,
                            duration: 1000,
                        });
                    } catch {
                        // flyTo 실패 시 무시
                    }
                }

                logger.log(`✅ 포커스 모드 진입: ${detail.name}`);
            }
        });
    }, []);

    const handleParcelMouseUp = useCallback((e: any) => {
        logger.log('🖱️ [Parcel] mouseup 이벤트 발생', {
            hasClickStart: !!clickStartRef.current,
            markerClicking: window.__markerClicking,
            features: e.features?.length
        });

        if (!clickStartRef.current) return;

        // 마커 클릭 중인 경우 폴리곤 클릭 무시 (마커와 폴리곤 이벤트 충돌 방지)
        if (window.__markerClicking) {
            logger.log('⏭️ [Parcel] 마커 클릭 중 - 폴리곤 클릭 무시');
            clickStartRef.current = null;
            return;
        }

        const dx = e.point.x - clickStartRef.current.x;
        const dy = e.point.y - clickStartRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const duration = Date.now() - clickStartRef.current.time;

        logger.log('📏 [Parcel] 클릭 판정', { distance, duration, threshold_dist: CLICK_DISTANCE_THRESHOLD, threshold_time: CLICK_TIME_THRESHOLD });

        // 드래그가 아닌 진짜 클릭인지 확인
        if (distance < CLICK_DISTANCE_THRESHOLD && duration < CLICK_TIME_THRESHOLD) {
            const feature = e.features?.[0];
            if (!feature) {
                logger.warn('⚠️ [Parcel] feature 없음');
                return;
            }

            const pnu = feature.properties?.PNU;
            if (!pnu) {
                logger.warn('⚠️ [Parcel] PNU 없음', feature.properties);
                return;
            }

            logger.log(`🖱️ [Polygon 클릭] PNU: ${pnu}`);

            // 이전 요청 취소 (race condition 방지)
            pendingRequestRef.current = pnu;

            // parcel-markers 데이터에서 좌표 가져오기 (polylabel 좌표 사용)
            const dataState = useDataStore.getState();
            const markerData = dataState.getParcelById(pnu);

            // PMTiles 기본 정보로 즉시 패널 열기
            const basicParcelInfo: Partial<import('@/types/data').ParcelDetail> = {
                id: pnu,
                pnu: pnu,
                jibun: feature.properties?.jibun || feature.properties?.JIBUN || '',
                address: feature.properties?.jibun || feature.properties?.JIBUN || '',
                area: feature.properties?.AREA || feature.properties?.area || 0,
                transactionPrice: feature.properties?.price || feature.properties?.PRICE || 0,
                coord: markerData?.coord,
            };

            // 즉시 선택 및 패널 열기 (setSelectedParcel이 패널도 열어줌)
            const selectionActions = useSelectionStore.getState();
            selectionActions.setSelectedParcel(basicParcelInfo as any);
            logger.log(`✅ [Polygon] 패널 열기: ${pnu}`);

            // API로 상세 정보 로드 (백그라운드)
            const requestPnu = pnu; // 클로저 캡처
            Promise.all([
                fetch(`/api/parcel/${pnu}`).then(res => res.ok ? res.json() : null),
                import('@/lib/data/loadData')
            ]).then(async ([apiData, { loadFactoryDetail, loadKnowledgeCenterDetail }]) => {
                // 요청 취소 확인: 다른 필지가 이미 선택되었으면 무시
                if (pendingRequestRef.current !== requestPnu) {
                    logger.log(`⏭️ [API] 요청 취소: ${requestPnu} (현재: ${pendingRequestRef.current})`);
                    return;
                }

                const dataState = useDataStore.getState();

                // 공장/지식산업센터 필터링 및 상세 로드
                const matchingFactories = dataState.factories.filter(f => f.pnu === requestPnu);
                const matchingKCs = dataState.knowledgeCenters.filter(kc => kc.pnu === requestPnu);

                const [factoryDetails, kcDetails] = await Promise.all([
                    Promise.all(matchingFactories.map(f => loadFactoryDetail(f.id))),
                    Promise.all(matchingKCs.map(kc => loadKnowledgeCenterDetail(kc.id))),
                ]);

                // 요청 취소 확인 (상세 로드 후 다시 체크)
                if (pendingRequestRef.current !== requestPnu) {
                    logger.log(`⏭️ [API] 상세 로드 후 취소: ${requestPnu}`);
                    return;
                }

                const validFactories = factoryDetails.filter((f): f is NonNullable<typeof f> => f !== null);
                const validKCs = kcDetails.filter((kc): kc is NonNullable<typeof kc> => kc !== null);

                // 상세 정보로 업데이트 (coord는 항상 polylabel 사용)
                const enrichedDetail = apiData
                    ? { ...apiData, coord: markerData?.coord, factories: validFactories, knowledgeIndustryCenters: validKCs }
                    : { ...basicParcelInfo, factories: validFactories, knowledgeIndustryCenters: validKCs };

                selectionActions.setSelectedParcel(enrichedDetail as any);
                logger.log(`🔄 [API] 상세 로드 완료: ${requestPnu}, 공장 ${validFactories.length}개, 지산 ${validKCs.length}개`);
            }).catch(err => {
                if (pendingRequestRef.current === requestPnu) {
                    logger.error('❌ 상세 로드 실패:', err);
                }
            });
        }

        clickStartRef.current = null;
    }, []);

    // ===== Mapbox GL 인스턴스 가져오기 (단순화된 재시도 로직) =====
    useEffect(() => {
        if (!map) {
            logger.log('🔄 [Polygon] map이 null - 대기 중');
            setMapboxGLReady(false);
            return;
        }

        let cancelled = false;
        logger.log('🔄 [Polygon] waitForMapboxGL 시작...');

        waitForMapboxGL(map)
            .then((mbMap) => {
                if (cancelled) return;
                logger.log('✅ [Polygon] Mapbox GL 준비 완료, isStyleLoaded:', (mbMap as any).isStyleLoaded?.());
                mapboxGLRef.current = mbMap;
                setMapboxGLReady(true);

                // 타일 캐시 설정 (메모리 절약: 50개로 제한)
                try {
                    mbMap.setMaxTileCacheSize?.(50);
                    logger.log('💾 [Polygon] 타일 캐시 크기: 50개로 제한');
                } catch { /* 무시 */ }
            })
            .catch((err) => {
                if (cancelled) return;
                logger.error('❌ [Polygon] Mapbox GL 초기화 실패:', err);
                setMapboxGLReady(false);
            });

        return () => { cancelled = true; };
    }, [map]);

    // ===== 소스 및 레이어 초기화 (API Route를 통한 MVT 타일 서빙) =====
    useEffect(() => {
        logger.log('🔄 [Polygon] 초기화 Effect 실행, mapboxGLReady:', mapboxGLReady, 'ref:', !!mapboxGLRef.current);
        if (!mapboxGLReady || !mapboxGLRef.current) return;

        const mbMap = mapboxGLRef.current;

        // 레이어 초기화 함수 (style.load 시에도 호출됨)
        const initializeLayers = () => {
            // 이미 초기화되어 있으면 스킵
            if (mbMap.getSource('vt-parcels')) {
                logger.log('📦 [Polygon] 소스 이미 존재 - 초기화 스킵');
                return;
            }

            // R2 URL 설정 시 PMTiles Protocol 사용, 아니면 로컬 API
            let tiles: (name: string) => string[];
            if (R2_BASE_URL) {
                // PMTiles Protocol 등록 (pmtiles:// 스킴)
                // 네이버 맵 내부의 mapboxgl 객체 접근
                const mapboxgl = (window as any).mapboxgl || mbMap.constructor;
                if (mapboxgl && mapboxgl.addProtocol) {
                    const protocol = new Protocol();
                    mapboxgl.addProtocol('pmtiles', protocol.tile);
                    logger.log('🌐 [Polygon] PMTiles Protocol 등록 (R2 CDN):', R2_BASE_URL);

                    // pmtiles:// URL 생성 (새 경로: /data/geometry/)
                    tiles = (name: string) => [`pmtiles://${R2_BASE_URL}/data/geometry/${name}.pmtiles/{z}/{x}/{y}`];
                } else {
                    // Protocol 등록 실패 시 로컬 API 폴백
                    logger.warn('[Polygon] mapboxgl.addProtocol 없음, 로컬 API 사용');
                    const origin = window.location.origin;
                    tiles = (name: string) => [`${origin}/api/tiles/${name}/{z}/{x}/{y}.pbf`];
                }
            } else {
                // 로컬 API 사용
                const origin = window.location.origin;
                logger.log('🎯 [Polygon] 타일 서버 origin (로컬):', origin);
                tiles = (name: string) => [`${origin}/api/tiles/${name}/{z}/{x}/{y}.pbf`];
            }

            logger.log('🎨 MVT 레이어 초기화 시작...');

            // ===== 시도 (SIDO) =====
            // 줌 0-8: 시/도 경계 표시 - 미니멀 스타일
            addSourceSafely(mbMap, 'vt-sido', { type: 'vector', tiles: tiles('sido'), maxzoom: 8 });
            addLayerSafely(mbMap, {
                id: 'vt-sido-fill', type: 'fill', source: 'vt-sido', 'source-layer': 'sido',
                minzoom: ZOOM_SIDO.min, maxzoom: ZOOM_SIG.min,
                paint: { 'fill-color': '#F8FAFC', 'fill-opacity': 0.3 },
            });
            addLayerSafely(mbMap, {
                id: 'vt-sido-line', type: 'line', source: 'vt-sido', 'source-layer': 'sido',
                minzoom: ZOOM_SIDO.min, maxzoom: ZOOM_SIG.min,
                paint: { 'line-color': '#94A3B8', 'line-width': 2 },
            });

            // ===== 시군구 (SIG) =====
            // 소스 maxzoom: PMTiles 생성 줌 레벨 (overzoom은 레이어에서 처리) - 미니멀 스타일
            addSourceSafely(mbMap, 'vt-sig', { type: 'vector', tiles: tiles('sig'), maxzoom: 12 });
            addLayerSafely(mbMap, {
                id: 'vt-sig-fill', type: 'fill', source: 'vt-sig', 'source-layer': 'sig',
                minzoom: ZOOM_SIG.min, maxzoom: ZOOM_EMD.min,
                paint: { 'fill-color': '#F8FAFC', 'fill-opacity': 0.25 },
            });
            addLayerSafely(mbMap, {
                id: 'vt-sig-line', type: 'line', source: 'vt-sig', 'source-layer': 'sig',
                minzoom: ZOOM_SIG.min, maxzoom: ZOOM_EMD.min,
                paint: { 'line-color': '#CBD5E1', 'line-width': 1.5 },
            });

            // ===== 읍면동 (EMD) =====
            addSourceSafely(mbMap, 'vt-emd', { type: 'vector', tiles: tiles('emd'), maxzoom: 14 });
            addLayerSafely(mbMap, {
                id: 'vt-emd-fill', type: 'fill', source: 'vt-emd', 'source-layer': 'emd',
                minzoom: ZOOM_EMD.min, maxzoom: ZOOM_PARCEL.min,
                paint: { 'fill-color': '#F8FAFC', 'fill-opacity': 0.2 },
            });
            addLayerSafely(mbMap, {
                id: 'vt-emd-line', type: 'line', source: 'vt-emd', 'source-layer': 'emd',
                minzoom: ZOOM_EMD.min, maxzoom: ZOOM_PARCEL.min,
                paint: { 'line-color': '#E2E8F0', 'line-width': 1 },
            });

            // ===== 지역 마커 호버 하이라이트 레이어 =====
            // 시군구 하이라이트 (호버 시)
            addLayerSafely(mbMap, {
                id: 'vt-sig-hover-fill', type: 'fill', source: 'vt-sig', 'source-layer': 'sig',
                minzoom: ZOOM_SIG.min, maxzoom: ZOOM_EMD.min,
                filter: ['==', ['get', 'code'], ''],  // 초기: 아무것도 안 보임
                paint: { 'fill-color': 'rgba(239, 68, 68, 0.15)', 'fill-opacity': 1 },
            });
            addLayerSafely(mbMap, {
                id: 'vt-sig-hover-line', type: 'line', source: 'vt-sig', 'source-layer': 'sig',
                minzoom: ZOOM_SIG.min, maxzoom: ZOOM_EMD.min,
                filter: ['==', ['get', 'code'], ''],  // 초기: 아무것도 안 보임
                paint: {
                    'line-color': 'rgba(239, 68, 68, 0.7)',
                    'line-width': 1,
                    'line-dasharray': [4, 3],  // 점선
                },
            });
            // 읍면동 하이라이트 (호버 시)
            addLayerSafely(mbMap, {
                id: 'vt-emd-hover-fill', type: 'fill', source: 'vt-emd', 'source-layer': 'emd',
                minzoom: ZOOM_EMD.min, maxzoom: ZOOM_PARCEL.min,
                filter: ['==', ['get', 'code'], ''],  // 초기: 아무것도 안 보임
                paint: { 'fill-color': 'rgba(239, 68, 68, 0.15)', 'fill-opacity': 1 },
            });
            addLayerSafely(mbMap, {
                id: 'vt-emd-hover-line', type: 'line', source: 'vt-emd', 'source-layer': 'emd',
                minzoom: ZOOM_EMD.min, maxzoom: ZOOM_PARCEL.min,
                filter: ['==', ['get', 'code'], ''],  // 초기: 아무것도 안 보임
                paint: {
                    'line-color': 'rgba(239, 68, 68, 0.7)',
                    'line-width': 1,
                    'line-dasharray': [4, 3],  // 점선
                },
            });

            // ===== 필지 (Parcels) - 미니멀 스타일 =====
            // 실거래가 기반 색상 스펙트럼 (저가=파랑 → 고가=빨강)
            // 초기값은 연한 회색, useEffect에서 가격 스펙트럼으로 업데이트
            addSourceSafely(mbMap, 'vt-parcels', { type: 'vector', tiles: tiles('parcels'), maxzoom: 17, promoteId: 'PNU' });

            addLayerSafely(mbMap, {
                id: 'vt-parcels-fill', type: 'fill', source: 'vt-parcels', 'source-layer': 'parcels',
                minzoom: ZOOM_PARCEL.min,
                paint: {
                    // 초기값: 연한 회색 (useEffect에서 가격 스펙트럼으로 업데이트)
                    'fill-color': '#E2E8F0',
                    'fill-opacity': 0.4,  // 적당한 불투명도
                },
            });
            // 필지 테두리 없음 (깔끔한 스타일)

            // ===== 포커스 모드 딤 오버레이 (배경 위, 산업단지 아래) =====
            addSourceSafely(mbMap, 'focus-overlay', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]],
                    },
                    properties: {},
                },
            });
            addLayerSafely(mbMap, {
                id: 'focus-overlay-fill',
                type: 'fill',
                source: 'focus-overlay',
                paint: {
                    'fill-color': '#000000',
                    'fill-opacity': 0,  // 초기값: 투명 (포커스 모드에서 활성화)
                },
            });

            // ===== 산업단지 소스 & Fill (투명 - glow만 표시) =====
            addSourceSafely(mbMap, 'vt-complex', { type: 'vector', tiles: tiles('complex'), maxzoom: 16, promoteId: 'id' });
            const complexFillAdded = addLayerSafely(mbMap, {
                id: 'vt-complex-fill', type: 'fill', source: 'vt-complex', 'source-layer': 'complex',
                paint: {
                    'fill-color': '#FEF3C7',
                    'fill-opacity': 0,  // 투명 (glow만 표시)
                },
            });
            logger.log(`🏭 [Polygon] 산업단지 fill 레이어 추가: ${complexFillAdded}`);

            // ===== 산업단지 Inner Glow (폴리곤 안쪽으로 빛나는 효과) =====
            // line-join: 'round'로 모서리 부드럽게, 줌 기반 크기 조절
            // 1. 가장 안쪽 glow (가장 연하고 넓음)
            addLayerSafely(mbMap, {
                id: 'vt-complex-glow-outer', type: 'line', source: 'vt-complex', 'source-layer': 'complex',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#FCD34D',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 15, 12, 25, 16, 40, 20, 60],
                    'line-opacity': 0.1,
                    'line-blur': ['interpolate', ['linear'], ['zoom'], 8, 8, 12, 12, 16, 20, 20, 30],
                    'line-offset': ['interpolate', ['linear'], ['zoom'], 8, 8, 12, 12, 16, 20, 20, 30],
                },
            });
            // 2. 중간 glow
            addLayerSafely(mbMap, {
                id: 'vt-complex-glow-mid', type: 'line', source: 'vt-complex', 'source-layer': 'complex',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#FBBF24',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 8, 12, 14, 16, 22, 20, 35],
                    'line-opacity': 0.18,
                    'line-blur': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 7, 16, 12, 20, 18],
                    'line-offset': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 7, 16, 12, 20, 18],
                },
            });
            // 3. 외곽선 근처 glow (가장 진함)
            addLayerSafely(mbMap, {
                id: 'vt-complex-glow-inner', type: 'line', source: 'vt-complex', 'source-layer': 'complex',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#F59E0B',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 5, 16, 8, 20, 12],
                    'line-opacity': 0.3,
                    'line-blur': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 12, 2.5, 16, 4, 20, 6],
                    'line-offset': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 12, 2.5, 16, 4, 20, 6],
                },
            });
            logger.log(`🏭 [Polygon] 산업단지 inner glow 레이어 추가`);

            // ===== 용지 (모든 줌레벨에서 표시) - 미니멀 스타일 =====
            addSourceSafely(mbMap, 'vt-lots', { type: 'vector', tiles: tiles('lots'), maxzoom: 17 });
            addLayerSafely(mbMap, {
                id: 'vt-lots-fill', type: 'fill', source: 'vt-lots', 'source-layer': 'lots',
                paint: { 'fill-color': '#EFF6FF', 'fill-opacity': 0.4 },
            });
            addLayerSafely(mbMap, {
                id: 'vt-lots-line', type: 'line', source: 'vt-lots', 'source-layer': 'lots',
                paint: { 'line-color': '#93C5FD', 'line-width': 1 },
            });

            // ===== 유치업종 (모든 줌레벨에서 표시) - 미니멀 스타일 =====
            addSourceSafely(mbMap, 'vt-industries', { type: 'vector', tiles: tiles('industries'), maxzoom: 17 });
            addLayerSafely(mbMap, {
                id: 'vt-industries-fill', type: 'fill', source: 'vt-industries', 'source-layer': 'industries',
                paint: { 'fill-color': '#ECFDF5', 'fill-opacity': 0.4 },
            });
            addLayerSafely(mbMap, {
                id: 'vt-industries-line', type: 'line', source: 'vt-industries', 'source-layer': 'industries',
                paint: { 'line-color': '#86EFAC', 'line-width': 1 },
            });

            // ===== 산업단지 Line (용지/유치업종/공장 위에 - 가장 위) - 미니멀 스타일 =====
            const complexLineAdded = addLayerSafely(mbMap, {
                id: 'vt-complex-line', type: 'line', source: 'vt-complex', 'source-layer': 'complex',
                paint: { 'line-color': '#D97706', 'line-width': 1 },
            });
            logger.log(`🏭 [Polygon] 산업단지 line 레이어 추가 (최상단): ${complexLineAdded}`);

            // ===== 산업단지 라벨 (폴리곤 외곽선을 따라 표시) =====
            // 3D 모드에서 지면에 누워있는 것처럼 보이도록 text-pitch-alignment: 'map' 사용
            const complexLabelAdded = addLayerSafely(mbMap, {
                id: 'vt-complex-label',
                type: 'symbol',
                source: 'vt-complex',
                'source-layer': 'complex',
                minzoom: 17,  // 17줌 레벨부터 표시
                layout: {
                    'symbol-placement': 'line',  // 폴리곤 외곽선을 따라 배치
                    'text-field': [
                        'concat',
                        ['get', 'name'],
                        [
                            'match',
                            ['get', 'type'],
                            '1', '국가산업단지',
                            '2', '일반산업단지',
                            '3', '도시첨단산업단지',
                            '4', '농공단지',
                            '산업단지'
                        ]
                    ],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': ['interpolate', ['linear'], ['zoom'], 17, 13, 19, 15, 22, 18],
                    'text-rotation-alignment': 'map',  // 지도 회전에 따라 텍스트도 회전
                    'text-pitch-alignment': 'map',     // 3D 모드에서 지면에 눕혀서 표시
                    'text-max-angle': 30,              // 곡선 구간 최대 꺾임 각도
                    'symbol-spacing': 400,             // 반복 간격 (픽셀)
                    'text-allow-overlap': false,
                    'text-ignore-placement': false,
                },
                paint: {
                    'text-color': '#FFFFFF',       // 흰색 텍스트 (가독성)
                    'text-halo-color': '#D97706',  // 산업단지 외곽선 색상과 동일
                    'text-halo-width': 2.5,
                    'text-halo-blur': 0,
                },
            });
            logger.log(`🏭 [Polygon] 산업단지 라벨 레이어 추가: ${complexLabelAdded}`);

            // ===== 공장 레이어 (GeoJSON + 클러스터링) =====
            // 공장 소스는 별도 useEffect에서 데이터 업데이트

            // ===== 선택된 필지 강조 (가장 위에 배치) - 미니멀 스타일 =====
            // fill (반투명 파란색) + line (깔끔한 파란색 테두리)
            const fillAdded = addLayerSafely(mbMap, {
                id: 'vt-parcels-selected-fill', type: 'fill', source: 'vt-parcels', 'source-layer': 'parcels',
                minzoom: ZOOM_PARCEL.min,
                paint: { 'fill-color': '#3B82F6', 'fill-opacity': 0.35 },
                filter: ['==', ['get', 'PNU'], ''],  // 초기엔 아무것도 안 보임
            });
            const lineAdded = addLayerSafely(mbMap, {
                id: 'vt-parcels-selected-line', type: 'line', source: 'vt-parcels', 'source-layer': 'parcels',
                minzoom: ZOOM_PARCEL.min,
                paint: { 'line-color': '#2563EB', 'line-width': 2.5 },
                filter: ['==', ['get', 'PNU'], ''],  // 초기엔 아무것도 안 보임
            });
            logger.log(`🔵 [Polygon] 선택 필지 레이어 추가: fill=${fillAdded}, line=${lineAdded}`);

            // 추가 확인: 레이어 순서
            const allLayers = (mbMap as any).getStyle?.()?.layers?.map((l: any) => l.id) || [];
            logger.log(`📋 [Polygon] 전체 레이어 순서:`, allLayers.slice(-10).join(' → '));

            // 클릭 이벤트 (mousedown + mouseup으로 드래그와 구분)
            try {
                // 레이어 존재 확인
                const parcelFillLayer = mbMap.getLayer('vt-parcels-fill');
                const complexFillLayer = mbMap.getLayer('vt-complex-fill');
                logger.log(`🎯 [Event] 레이어 존재: parcels=${!!parcelFillLayer}, complex=${!!complexFillLayer}`);

                if (parcelFillLayer) {
                    mbMap.on('mousedown', 'vt-parcels-fill', handleParcelMouseDown);
                    mbMap.on('mouseup', 'vt-parcels-fill', handleParcelMouseUp);
                    mbMap.on('mouseenter', 'vt-parcels-fill', handleMouseEnter);
                    mbMap.on('mouseleave', 'vt-parcels-fill', handleMouseLeave);
                    logger.log('✅ [Event] 필지 클릭 이벤트 등록 완료');
                } else {
                    logger.error('❌ [Event] vt-parcels-fill 레이어 없음!');
                }

                if (complexFillLayer) {
                    // 산업단지 클릭 이벤트 (ComplexMarkerLayer로 대체됨)
                    // mbMap.on('click', 'vt-complex-fill', handleComplexClick);
                    mbMap.on('mouseenter', 'vt-complex-fill', handleMouseEnter);
                    mbMap.on('mouseleave', 'vt-complex-fill', handleMouseLeave);
                }
            } catch (err) {
                logger.error('❌ [Event] 이벤트 등록 실패:', err);
            }

            // 소스 및 레이어 상태 로그
            const sources = ['vt-sido', 'vt-sig', 'vt-emd', 'vt-parcels', 'vt-complex', 'vt-lots', 'vt-industries'];
            const layers = ['vt-sido-fill', 'vt-sig-fill', 'vt-emd-fill', 'vt-parcels-fill', 'vt-complex-fill', 'vt-lots-fill', 'vt-industries-fill'];
            logger.log('📦 [Polygon] 소스:', sources.map(s => `${s.replace('vt-','')}:${mbMap.getSource(s) ? '✅' : '❌'}`).join(' '));
            logger.log('🎨 [Polygon] 레이어:', layers.map(l => `${l.replace('vt-','').replace('-fill','').replace('-circle','')}:${mbMap.getLayer(l) ? '✅' : '❌'}`).join(' '));

            // 초기화 후 바로 가시성 적용
            const currentVisibleLayers = useUIStore.getState().visibleLayers;
            for (const { layers: layerIds, key } of LAYER_VISIBILITY_MAP) {
                setLayerVisibility(mbMap, layerIds, currentVisibleLayers.has(key));
            }
            logger.log('👁️ [Polygon] 초기 가시성 적용:', Array.from(currentVisibleLayers).join(', '));

            logger.log('✅ [Polygon] MVT 초기화 완료');
        };

        // 초기 레이어 초기화
        initializeLayers();

        // 지도 유형 변경 시 레이어 재초기화 (스타일 리로드 시 레이어가 사라지는 문제 해결)
        mbMap.on('style.load', initializeLayers);

        // 클린업: 이벤트 리스너 제거 (메모리 누수 방지)
        return () => {
            try {
                mbMap.off('mousedown', 'vt-parcels-fill', handleParcelMouseDown);
                mbMap.off('mouseup', 'vt-parcels-fill', handleParcelMouseUp);
                mbMap.off('mouseenter', 'vt-parcels-fill', handleMouseEnter);
                mbMap.off('mouseleave', 'vt-parcels-fill', handleMouseLeave);
                // mbMap.off('click', 'vt-complex-fill', handleComplexClick);
                mbMap.off('mouseenter', 'vt-complex-fill', handleMouseEnter);
                mbMap.off('mouseleave', 'vt-complex-fill', handleMouseLeave);
                mbMap.off('style.load', initializeLayers);  // 스타일 로드 리스너 제거
            } catch { /* 무시 */ }
        };
    }, [mapboxGLReady, handleParcelMouseDown, handleParcelMouseUp, handleMouseEnter, handleMouseLeave, handleComplexClick]);

    // ===== parcel-markers 데이터를 Feature State로 매핑 (단일 소스) =====
    useEffect(() => {
        if (!mapboxGLReady || !mapboxGLRef.current) return;
        const mapboxGL = mapboxGLRef.current;

        const dataState = useDataStore.getState();
        const parcels = dataState.parcels;

        if (parcels.length === 0) return;

        logger.log(`🔗 [Feature State] parcel-markers 매핑 시작: ${parcels.length}개`);

        try {
            // 모든 필지의 type/price 정보를 Feature State로 설정
            let successCount = 0;
            parcels.forEach(parcel => {
                try {
                    const pnu = parcel.pnu || parcel.id;  // 새 필드명 우선 사용
                    mapboxGL.setFeatureState(
                        { source: 'vt-parcels', sourceLayer: 'parcels', id: pnu },
                        {
                            type: parcel.type,
                            hasTransaction: (parcel.type & 1) !== 0,
                            hasListing: (parcel.type & 2) !== 0,
                            hasAuction: (parcel.type & 4) !== 0,
                            transactionPrice: parcel.transactionPrice,
                            listingPrice: parcel.listingPrice,
                            auctionPrice: parcel.auctionPrice,
                        }
                    );
                    successCount++;
                } catch (e) {
                    // 개별 실패는 무시 (해당 PNU가 PMTiles에 없을 수 있음)
                }
            });
            logger.log(`✅ [Feature State] 매핑 완료: ${successCount}/${parcels.length}개`);
        } catch (e) {
            logger.error('❌ [Feature State] 매핑 실패:', e);
        }
    }, [mapboxGLReady]);

    // ===== 실거래가/증감률 기반 색상 스펙트럼 적용 =====
    useEffect(() => {
        if (!mapboxGLReady || !mapboxGLRef.current) return;
        const mapboxGL = mapboxGLRef.current;

        try {
            if (!mapboxGL.getLayer('vt-parcels-fill')) return;

            // 데이터 시각화 비활성화 시 투명하게 (필지 경계만 보임)
            if (!dataVisualizationEnabled) {
                mapboxGL.setPaintProperty('vt-parcels-fill', 'fill-color', '#E2E8F0');
                mapboxGL.setPaintProperty('vt-parcels-fill', 'fill-opacity', 0);  // 완전 투명
                logger.log(`🎨 [Polygon] 필지 색상: 투명 (시각화 OFF)`);
                return;
            }

            logger.log(`🎨 [Polygon] parcelColorMode:`, parcelColorMode);

            // 증감률 모드: Feature State 기반 색상
            if (parcelColorMode === 'price-change') {
                // Feature State에서 priceChangeRate 읽어서 색상 적용
                const priceChangeColorExpr = [
                    'case',
                    // Feature State가 없으면 투명
                    ['==', ['feature-state', 'priceChangeRate'], null],
                    'rgba(0, 0, 0, 0)',
                    // 상승 (> 0.02): 빨강
                    ['>', ['feature-state', 'priceChangeRate'], 0.02],
                    [
                        'rgba',
                        239, 68, 68,
                        ['min', 0.7, ['+', 0.25, ['*', 0.9, ['min', 1, ['abs', ['feature-state', 'priceChangeRate']]]]]]
                    ],
                    // 하락 (< -0.02): 파랑
                    ['<', ['feature-state', 'priceChangeRate'], -0.02],
                    [
                        'rgba',
                        59, 130, 246,
                        ['min', 0.7, ['+', 0.25, ['*', 0.9, ['min', 1, ['abs', ['feature-state', 'priceChangeRate']]]]]]
                    ],
                    // 중립 (-0.02 ~ 0.02): 회색
                    'rgba(156, 163, 175, 0.15)'
                ];

                mapboxGL.setPaintProperty('vt-parcels-fill', 'fill-color', priceChangeColorExpr);
                mapboxGL.setPaintProperty('vt-parcels-fill', 'fill-opacity', 1);  // opacity는 색상 표현식에서 처리
                mapboxGL.setPaintProperty('vt-parcels-fill', 'fill-opacity-transition', { duration: 300 });
                logger.log(`🎨 [Polygon] 증감률 Feature State 색상 적용`);
                return;
            }

            // 실거래가 모드: 기존 priceColorExpression 사용
            if (priceColorExpression) {
                mapboxGL.setPaintProperty('vt-parcels-fill', 'fill-color', priceColorExpression);
                mapboxGL.setPaintProperty('vt-parcels-fill', 'fill-opacity', 0.35);
                // 표현식의 min/max 값 추출해서 로깅 (디버그용)
                if (Array.isArray(priceColorExpression) && priceColorExpression[0] === 'case') {
                    const interpolateExpr = priceColorExpression[2];
                    if (Array.isArray(interpolateExpr) && interpolateExpr[0] === 'interpolate') {
                        const min = interpolateExpr[3];
                        const max = interpolateExpr[7];
                        logger.log(`🎨 [Polygon] 가격 스펙트럼 적용: ${min?.toLocaleString()}~${max?.toLocaleString()}만원`);
                    }
                }
            }
        } catch (e) {
            logger.warn('색상 업데이트 실패:', e);
        }
    }, [mapboxGLReady, priceColorExpression, dataVisualizationEnabled, parcelColorMode]);

    // ===== 행정구역 평균 실거래가 기반 색상 적용 =====
    useEffect(() => {
        if (!mapboxGLReady || !mapboxGLRef.current) return;
        const mapboxGL = mapboxGLRef.current;

        try {
            // 기본 색상 (시각화 비활성화 또는 데이터 없음)
            const defaultColor = '#F8FAFC';
            const defaultOpacity = 0.3;

            // 데이터 시각화 비활성화 시 기본 색상으로 복원
            if (!dataVisualizationEnabled) {
                if (mapboxGL.getLayer('vt-sido-fill')) {
                    mapboxGL.setPaintProperty('vt-sido-fill', 'fill-color', defaultColor);
                    mapboxGL.setPaintProperty('vt-sido-fill', 'fill-opacity', defaultOpacity);
                }
                if (mapboxGL.getLayer('vt-sig-fill')) {
                    mapboxGL.setPaintProperty('vt-sig-fill', 'fill-color', defaultColor);
                    mapboxGL.setPaintProperty('vt-sig-fill', 'fill-opacity', 0.25);
                }
                if (mapboxGL.getLayer('vt-emd-fill')) {
                    mapboxGL.setPaintProperty('vt-emd-fill', 'fill-color', defaultColor);
                    mapboxGL.setPaintProperty('vt-emd-fill', 'fill-opacity', 0.2);
                }
                logger.log(`🎨 [Polygon] 행정구역 색상: 기본값 (시각화 OFF)`);
                return;
            }

            // 데이터 시각화 활성화 + 색상 표현식 있음
            if (regionColorExpressions) {
                const colorType = parcelColorMode === 'price-change' ? '증감률' : '가격';

                // 시도 레이어
                if (mapboxGL.getLayer('vt-sido-fill') && regionColorExpressions.sido) {
                    mapboxGL.setPaintProperty('vt-sido-fill', 'fill-color', regionColorExpressions.sido);
                    mapboxGL.setPaintProperty('vt-sido-fill', 'fill-opacity', 0.6);
                    logger.log(`🎨 [Polygon] 시도 ${colorType} 색상 적용`);
                }

                // 시군구 레이어
                if (mapboxGL.getLayer('vt-sig-fill') && regionColorExpressions.sig) {
                    mapboxGL.setPaintProperty('vt-sig-fill', 'fill-color', regionColorExpressions.sig);
                    mapboxGL.setPaintProperty('vt-sig-fill', 'fill-opacity', 0.6);
                    logger.log(`🎨 [Polygon] 시군구 ${colorType} 색상 적용`);
                }

                // 읍면동 레이어
                if (mapboxGL.getLayer('vt-emd-fill') && regionColorExpressions.emd) {
                    mapboxGL.setPaintProperty('vt-emd-fill', 'fill-color', regionColorExpressions.emd);
                    mapboxGL.setPaintProperty('vt-emd-fill', 'fill-opacity', 0.6);
                    logger.log(`🎨 [Polygon] 읍면동 ${colorType} 색상 적용`);
                }
            }
        } catch (e) {
            logger.warn('행정구역 색상 업데이트 실패:', e);
        }
    }, [mapboxGLReady, regionColorExpressions, dataVisualizationEnabled, parcelColorMode]);

    // ===== 지역 마커 호버 하이라이트 =====
    useEffect(() => {
        if (!mapboxGLReady || !mapboxGLRef.current) return;
        const mapboxGL = mapboxGLRef.current;

        try {
            // 시군구 호버 레이어 필터 업데이트
            if (mapboxGL.getLayer('vt-sig-hover-fill') && mapboxGL.getLayer('vt-sig-hover-line')) {
                if (hoveredRegionLevel === 'sig' && hoveredRegionCode) {
                    mapboxGL.setFilter('vt-sig-hover-fill', ['==', ['get', 'code'], hoveredRegionCode]);
                    mapboxGL.setFilter('vt-sig-hover-line', ['==', ['get', 'code'], hoveredRegionCode]);
                } else {
                    mapboxGL.setFilter('vt-sig-hover-fill', ['==', ['get', 'code'], '']);
                    mapboxGL.setFilter('vt-sig-hover-line', ['==', ['get', 'code'], '']);
                }
            }

            // 읍면동 호버 레이어 필터 업데이트
            if (mapboxGL.getLayer('vt-emd-hover-fill') && mapboxGL.getLayer('vt-emd-hover-line')) {
                if (hoveredRegionLevel === 'emd' && hoveredRegionCode) {
                    mapboxGL.setFilter('vt-emd-hover-fill', ['==', ['get', 'code'], hoveredRegionCode]);
                    mapboxGL.setFilter('vt-emd-hover-line', ['==', ['get', 'code'], hoveredRegionCode]);
                } else {
                    mapboxGL.setFilter('vt-emd-hover-fill', ['==', ['get', 'code'], '']);
                    mapboxGL.setFilter('vt-emd-hover-line', ['==', ['get', 'code'], '']);
                }
            }
        } catch (e) {
            logger.warn('호버 하이라이트 업데이트 실패:', e);
        }
    }, [mapboxGLReady, hoveredRegionCode, hoveredRegionLevel]);

    // ===== 공장 GeoJSON 소스 및 레이어 (클러스터링 없이 단순 점) =====
    // 이벤트 핸들러 ref (cleanup용)
    const factoryClickHandlerRef = useRef<((e: any) => void) | null>(null);
    const factoryMouseEnterRef = useRef<(() => void) | null>(null);
    const factoryMouseLeaveRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!mapboxGLReady || !mapboxGLRef.current) return;
        const mbMap = mapboxGLRef.current;

        // 공장 데이터가 없으면 스킵
        if (factoryGeoJSON.features.length === 0) return;

        try {
            // 소스 추가 또는 업데이트
            const existingSource = mbMap.getSource('factories') as any;
            if (existingSource) {
                // 이미 존재하면 데이터만 업데이트
                existingSource.setData(factoryGeoJSON);
            } else {
                // 새로 추가 (클러스터링 없음 - kepler.gl 스타일)
                mbMap.addSource('factories', {
                    type: 'geojson',
                    data: factoryGeoJSON,
                });

                // 공장 점 - 줌 12부터 서서히 나타남 (그리드와 교차 전환)
                mbMap.addLayer({
                    id: 'factory-points',
                    type: 'circle',
                    source: 'factories',
                    minzoom: ZOOM_EMD.min,  // 줌 12부터 시작
                    paint: {
                        'circle-color': '#0D9488',  // teal - 그리드 분포와 동일 색상
                        'circle-radius': [
                            'interpolate', ['linear'], ['zoom'],
                            ZOOM_EMD.min, 1,         // 줌 12: 1px
                            ZOOM_PARCEL.min, 3,      // 줌 14: 3px
                            17, 5,
                            20, 7,
                        ],
                        'circle-opacity': [
                            'interpolate', ['linear'], ['zoom'],
                            ZOOM_EMD.min, 0,           // 줌 12: 투명
                            ZOOM_PARCEL.min, 0.7,      // 줌 14: 70%
                        ],
                        'circle-stroke-width': 0,
                    },
                });

                // 공장 라벨 (줌 17+) - teal 색상
                mbMap.addLayer({
                    id: 'factory-labels',
                    type: 'symbol',
                    source: 'factories',
                    minzoom: 17,
                    layout: {
                        'text-field': ['get', 'name'],
                        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                        'text-size': 9,
                        'text-offset': [0, 0.8],
                        'text-anchor': 'top',
                        'text-max-width': 8,
                        'text-allow-overlap': false,
                        'text-optional': true,
                    },
                    paint: {
                        'text-color': '#0D9488',  // teal - 공장 점과 동일
                        'text-halo-color': '#ffffff',
                        'text-halo-width': 1,
                    },
                });

                // 공장 점 클릭 시 상세 정보 표시 (핸들러 저장)
                factoryClickHandlerRef.current = (e: any) => {
                    const features = mbMap.queryRenderedFeatures(e.point, { layers: ['factory-points'] });
                    if (!features.length) return;

                    const factoryId = features[0].properties.id;
                    logger.log(`🏭 [Factory 클릭] id: ${factoryId}`);

                    // 상세 정보 로드
                    import('@/lib/data/loadData').then(({ loadFactoryDetail }) => {
                        loadFactoryDetail(factoryId).then((detail) => {
                            if (detail) {
                                useSelectionStore.getState().setSelectedFactory(detail);
                            }
                        });
                    });
                };
                mbMap.on('click', 'factory-points', factoryClickHandlerRef.current);

                // 커서 변경 (핸들러 저장)
                factoryMouseEnterRef.current = () => {
                    mbMap.getCanvas().style.cursor = 'pointer';
                };
                factoryMouseLeaveRef.current = () => {
                    mbMap.getCanvas().style.cursor = '';
                };
                mbMap.on('mouseenter', 'factory-points', factoryMouseEnterRef.current);
                mbMap.on('mouseleave', 'factory-points', factoryMouseLeaveRef.current);

                logger.log(`🏭 [Factory GL] 공장 점 레이어 추가 완료: ${factoryGeoJSON.features.length}개`);
            }

            // 가시성 적용
            const isVisible = useUIStore.getState().visibleLayers.has('factory');
            setLayerVisibility(mbMap, ['factory-points', 'factory-labels'], isVisible);
        } catch (e) {
            logger.warn('공장 레이어 업데이트 실패:', e);
        }

        // Cleanup: 이벤트 리스너 제거
        return () => {
            if (!mbMap) return;
            try {
                if (factoryClickHandlerRef.current && mbMap.getLayer('factory-points')) {
                    mbMap.off('click', 'factory-points', factoryClickHandlerRef.current);
                }
                if (factoryMouseEnterRef.current && mbMap.getLayer('factory-points')) {
                    mbMap.off('mouseenter', 'factory-points', factoryMouseEnterRef.current);
                }
                if (factoryMouseLeaveRef.current && mbMap.getLayer('factory-points')) {
                    mbMap.off('mouseleave', 'factory-points', factoryMouseLeaveRef.current);
                }
            } catch (e) {
                // 맵이 이미 해제된 경우 무시
            }
        };
    }, [mapboxGLReady, factoryGeoJSON]);

    // ===== 선택 필지 강조 (fill + line 파란색, 오버레이 효과) =====
    useEffect(() => {
        if (!mapboxGLReady || !mapboxGLRef.current) return;
        const mapboxGL = mapboxGLRef.current;

        try {
            // 디버깅: selectedParcel 전체 구조 확인
            logger.log(`🔍 [Polygon] selectedParcel:`, selectedParcel);

            const pnu = selectedParcel?.id || selectedParcel?.pnu || '';
            const filter: any = pnu ? ['==', ['get', 'PNU'], pnu] : ['==', ['get', 'PNU'], ''];

            // 레이어 존재 여부 확인
            const hasFillLayer = !!mapboxGL.getLayer('vt-parcels-selected-fill');
            const hasLineLayer = !!mapboxGL.getLayer('vt-parcels-selected-line');
            logger.log(`🔍 [Polygon] 레이어 존재: fill=${hasFillLayer}, line=${hasLineLayer}`);

            // fill 레이어 (오버레이 효과: 기존 색상 위에 반투명 파란색)
            if (hasFillLayer) {
                mapboxGL.setFilter('vt-parcels-selected-fill', filter);
                logger.log(`✅ [Polygon] fill 필터 설정: PNU=${pnu}`);
            } else {
                logger.warn(`⚠️ [Polygon] vt-parcels-selected-fill 레이어 없음!`);
            }

            // line 레이어 (테두리)
            if (hasLineLayer) {
                mapboxGL.setFilter('vt-parcels-selected-line', filter);
                logger.log(`✅ [Polygon] line 필터 설정: PNU=${pnu}`);
            } else {
                logger.warn(`⚠️ [Polygon] vt-parcels-selected-line 레이어 없음!`);
            }

            if (pnu) {
                logger.log(`🔵 [Polygon] 선택 필지 필터 적용 완료: ${pnu}`);
            }
        } catch (e) {
            logger.warn('선택 필터 업데이트 실패:', e);
        }
    }, [mapboxGLReady, selectedParcel]);

    // ===== 레이어 가시성 (테이블 기반) =====
    useEffect(() => {
        if (!mapboxGLReady || !mapboxGLRef.current) return;
        const mbMap = mapboxGLRef.current;

        for (const { layers, key } of LAYER_VISIBILITY_MAP) {
            setLayerVisibility(mbMap, layers, visibleLayers.has(key));
        }
    }, [mapboxGLReady, visibleLayers]);

    // ===== 포커스 모드: fitBounds (산업단지 coord 기반으로 먼저 이동) =====
    useEffect(() => {
        if (!mapboxGLReady || !mapboxGLRef.current) return;
        if (!focusMode || !focusedComplex) return;

        const mapboxGL = mapboxGLRef.current;
        let isUnmounted = false;
        let moveEndHandler: (() => void) | null = null;
        let timerId: NodeJS.Timeout | null = null;

        // focusedComplex.coord가 있으면 해당 위치로 먼저 이동 (줌 레벨 15로)
        // 이렇게 하면 타일이 로드되어 querySourceFeatures가 동작함
        if (focusedComplex.coord) {
            const [lng, lat] = focusedComplex.coord;
            logger.log(`🗺️ [Focus Mode] 산업단지 중심으로 이동: ${focusedComplex.name} [${lng}, ${lat}]`);

            // 먼저 중심으로 이동하고 줌
            mapboxGL.flyTo({
                center: [lng, lat],
                zoom: 14,  // 산업단지가 보일 정도의 줌
                duration: 800,
                padding: { top: 100, bottom: 100, left: 80, right: 400 },
            });

            // 이동 완료 후 폴리곤 bounds로 정확히 맞추기
            moveEndHandler = () => {
                mapboxGL.off('moveend', moveEndHandler!);
                moveEndHandler = null;

                if (isUnmounted) return;  // 언마운트 체크

                // 타일 로드 대기 후 폴리곤 쿼리
                timerId = setTimeout(() => {
                    if (isUnmounted) return;  // 언마운트 체크
                    timerId = null;

                    const complexIdStr = String(focusedComplex.id);
                    const features = mapboxGL.querySourceFeatures('vt-complex', {
                        sourceLayer: 'complex',
                        filter: ['==', ['to-string', ['get', 'id']], complexIdStr]
                    });

                    if (features.length > 0 && features[0].geometry.type === 'Polygon') {
                        const coords = features[0].geometry.coordinates;
                        const allCoords: [number, number][] = [];
                        for (const ring of coords) {
                            for (const coord of ring as [number, number][]) {
                                allCoords.push(coord);
                            }
                        }

                        if (allCoords.length > 0) {
                            let minLng = Infinity, maxLng = -Infinity;
                            let minLat = Infinity, maxLat = -Infinity;

                            for (const [cLng, cLat] of allCoords) {
                                minLng = Math.min(minLng, cLng);
                                maxLng = Math.max(maxLng, cLng);
                                minLat = Math.min(minLat, cLat);
                                maxLat = Math.max(maxLat, cLat);
                            }

                            // 정확한 폴리곤 bounds로 fitBounds
                            mapboxGL.fitBounds(
                                [[minLng, minLat], [maxLng, maxLat]],
                                {
                                    padding: { top: 100, bottom: 100, left: 80, right: 400 },
                                    duration: 500,
                                    maxZoom: 16,
                                }
                            );
                            logger.log(`🗺️ [Focus Mode] 폴리곤 fitBounds 완료: ${focusedComplex.name}`);
                        }
                    }
                }, 300);  // 타일 로드 대기
            };

            mapboxGL.on('moveend', moveEndHandler);
        }

        // Cleanup: 이벤트 리스너 & 타이머 정리
        return () => {
            isUnmounted = true;
            if (moveEndHandler) {
                mapboxGL.off('moveend', moveEndHandler);
            }
            if (timerId) {
                clearTimeout(timerId);
            }
        };
    }, [mapboxGLReady, focusMode, focusedComplex]);

    // ===== 포커스 모드: 시각화 (검은색 오버레이 + 산업단지/마커만 밝게) =====
    useEffect(() => {
        if (!mapboxGLReady || !mapboxGLRef.current) return;
        const mapboxGL = mapboxGLRef.current;

        try {
            if (focusMode && focusedComplex) {
                // ID를 문자열로 변환 (타입 불일치 방지)
                const complexIdStr = String(focusedComplex.id);

                // 1. 선택한 산업단지 geometry 조회
                const features = mapboxGL.querySourceFeatures('vt-complex', {
                    sourceLayer: 'complex',
                    filter: ['==', ['to-string', ['get', 'id']], complexIdStr]
                });

                logger.log(`🔍 [Focus Mode] 쿼리 결과: ${features.length}개 features, ID="${complexIdStr}"`);
                if (features.length > 0) {
                    logger.log(`📐 [Focus Mode] Geometry type: ${features[0].geometry.type}`);
                }

                if (features.length > 0 && features[0].geometry.type === 'Polygon') {
                    // 구멍 뚫린 폴리곤 생성 (전체 화면 - 선택한 산업단지 영역)
                    const holeCoords = features[0].geometry.coordinates;
                    logger.log(`🕳️ [Focus Mode] 구멍 좌표: ${holeCoords.length}개 링`);

                    const overlayWithHole = {
                        type: 'Feature',
                        geometry: {
                            type: 'Polygon',
                            coordinates: [
                                // 외부 링 (전체 화면)
                                [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]],
                                // 내부 링 (구멍 - 선택한 산업단지)
                                ...holeCoords
                            ]
                        },
                        properties: {}
                    };

                    // 딤 오버레이 소스 업데이트
                    const source = mapboxGL.getSource('focus-overlay') as any;
                    logger.log(`📍 [Focus Mode] 소스 존재: ${!!source}, setData 함수: ${!!(source?.setData)}`);
                    if (source && source.setData) {
                        source.setData(overlayWithHole);
                        logger.log(`✅ [Focus Mode] 오버레이 데이터 업데이트 완료`);
                    }

                    // 딤 오버레이 활성화
                    const layer = mapboxGL.getLayer('focus-overlay-fill');
                    logger.log(`📍 [Focus Mode] 레이어 존재: ${!!layer}`);
                    if (layer) {
                        mapboxGL.setPaintProperty('focus-overlay-fill', 'fill-opacity', 0.6);
                        const currentOpacity = mapboxGL.getPaintProperty('focus-overlay-fill', 'fill-opacity');
                        logger.log(`🎨 [Focus Mode] Opacity 설정 완료: ${currentOpacity}`);
                    }

                    logger.log(`🎯 [Focus Mode] 구멍 뚫린 딤 오버레이 생성: ${focusedComplex.name}`);
                }

                // 2. 선택된 산업단지 외곽선 강조 - 미니멀 스타일
                if (mapboxGL.getLayer('vt-complex-line')) {
                    mapboxGL.setPaintProperty('vt-complex-line', 'line-color', [
                        'case',
                        ['==', ['to-string', ['get', 'id']], complexIdStr],
                        '#F59E0B',  // 선택된 것: 밝은 황색 외곽선
                        '#D97706',  // 비선택: 원래 색상
                    ]);
                    mapboxGL.setPaintProperty('vt-complex-line', 'line-width', [
                        'case',
                        ['==', ['to-string', ['get', 'id']], complexIdStr],
                        2,  // 선택된 것: 약간 두꺼운 외곽선
                        1,  // 비선택: 원래 두께
                    ]);
                }

            } else {
                // 포커스 모드 종료 - 오버레이 원래대로
                const source = mapboxGL.getSource('focus-overlay') as any;
                if (source && source.setData) {
                    source.setData({
                        type: 'Feature',
                        geometry: {
                            type: 'Polygon',
                            coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]],
                        },
                        properties: {},
                    });
                }
                if (mapboxGL.getLayer('focus-overlay-fill')) {
                    mapboxGL.setPaintProperty('focus-overlay-fill', 'fill-opacity', 0);
                }
                if (mapboxGL.getLayer('vt-complex-line')) {
                    mapboxGL.setPaintProperty('vt-complex-line', 'line-color', '#D97706');
                    mapboxGL.setPaintProperty('vt-complex-line', 'line-width', 1);
                }
            }
        } catch (e) {
            logger.warn('포커스 모드 시각화 실패:', e);
        }
    }, [mapboxGLReady, focusMode, focusedComplex]);

    // ===== 포커스 모드: 용지/유치업종 레이어 필터링 =====
    useEffect(() => {
        if (!mapboxGLReady || !mapboxGLRef.current) return;
        const mapboxGL = mapboxGLRef.current;

        try {
            // 포커스 모드일 때만 용지/유치업종 레이어 표시
            if (focusMode && focusedComplex) {
                // ID를 문자열로 변환 (타입 불일치 방지)
                const complexIdStr = String(focusedComplex.id);

                // 용지 레이어: 선택한 산업단지만 필터링
                if (mapboxGL.getLayer('vt-lots-fill')) {
                    const lotsFilter = ['==', ['to-string', ['get', 'complexId']], complexIdStr];
                    mapboxGL.setFilter('vt-lots-fill', lotsFilter);
                    mapboxGL.setFilter('vt-lots-line', lotsFilter);
                    setLayerVisibility(mapboxGL, ['vt-lots-fill', 'vt-lots-line'], focusModeShowLots);
                }

                // 유치업종 레이어: 선택한 산업단지만 필터링
                if (mapboxGL.getLayer('vt-industries-fill')) {
                    const industriesFilter = ['==', ['to-string', ['get', 'complexId']], complexIdStr];
                    mapboxGL.setFilter('vt-industries-fill', industriesFilter);
                    mapboxGL.setFilter('vt-industries-line', industriesFilter);
                    setLayerVisibility(mapboxGL, ['vt-industries-fill', 'vt-industries-line'], focusModeShowIndustries);
                }

                logger.log(`🗺️ [Focus Mode] complexId="${complexIdStr}" 필터링 적용, 용지=${focusModeShowLots}, 업종=${focusModeShowIndustries}`);
            } else {
                // 포커스 모드 아닐 때는 필터 제거 + 레이어 토글 상태에 따라
                if (mapboxGL.getLayer('vt-lots-fill')) {
                    mapboxGL.setFilter('vt-lots-fill', null);
                    mapboxGL.setFilter('vt-lots-line', null);
                    const showLots = visibleLayers.has('industrial-lot');
                    setLayerVisibility(mapboxGL, ['vt-lots-fill', 'vt-lots-line'], showLots);
                }
                if (mapboxGL.getLayer('vt-industries-fill')) {
                    mapboxGL.setFilter('vt-industries-fill', null);
                    mapboxGL.setFilter('vt-industries-line', null);
                    const showIndustries = visibleLayers.has('industry-type');
                    setLayerVisibility(mapboxGL, ['vt-industries-fill', 'vt-industries-line'], showIndustries);
                }
            }
        } catch (e) {
            logger.warn('용지/업종 레이어 필터링 실패:', e);
        }
    }, [mapboxGLReady, focusMode, focusedComplex, focusModeShowLots, focusModeShowIndustries, visibleLayers]);

    // ===== 포커스 모드: 네이버 베이스맵 도로 레이어를 dim 위로 이동 =====
    // 네이버 베이스맵의 고속도로 레이어를 dim 위에 배치
    // 중요: road_line에는 도로 이름이 없음. cate2='고속(도시고속)도로'로 필터링
    const highlightLayersRef = useRef<string[]>([]);

    useEffect(() => {
        if (!mapboxGLReady || !mapboxGLRef.current) return;
        const mapboxGL = mapboxGLRef.current;

        try {
            const style = (mapboxGL as any).getStyle?.();
            if (!style?.layers) return;

            // 기존 하이라이트 레이어 및 소스 제거
            highlightLayersRef.current.forEach(layerId => {
                try {
                    if ((mapboxGL as any).getLayer(layerId)) {
                        (mapboxGL as any).removeLayer(layerId);
                    }
                } catch { /* 무시 */ }
            });
            highlightLayersRef.current = [];

            // GeoJSON 소스 제거
            try {
                if ((mapboxGL as any).getSource('highlight-road-source')) {
                    (mapboxGL as any).removeSource('highlight-road-source');
                }
            } catch { /* 무시 */ }

            if (focusMode && focusModeHighlightRoads.length > 0) {
                // 포커스 모드 + 도로 하이라이트 활성화

                // 네이버 베이스맵 소스 찾기 (sample 소스)
                const naverSource = style.sources?.sample ? 'sample' : null;
                if (!naverSource) {
                    logger.warn('❌ 네이버 베이스맵 소스(sample) 없음');
                    return;
                }

                logger.log('🔍 [DEBUG] 도로 필터 키워드:', focusModeHighlightRoads);

                // std_code 패턴 분석 (디버그용)
                try {
                    // road_line과 label_path 모두에서 고속도로 std_code 수집
                    const roadFeatures = (mapboxGL as any).querySourceFeatures('sample', {
                        sourceLayer: 'road_line',
                    });
                    const labelFeatures = (mapboxGL as any).querySourceFeatures('sample', {
                        sourceLayer: 'label_path',
                    });

                    // 고속도로만 필터링
                    const highwayRoads = roadFeatures.filter((f: any) =>
                        f.properties?.cate2?.includes('고속')
                    );
                    const highwayLabels = labelFeatures.filter((f: any) =>
                        f.properties?.dp_name?.includes('고속도로')
                    );

                    logger.log('🔍 [std_code 패턴 분석]');
                    logger.log('📊 road_line 고속도로:', highwayRoads.length, '개');
                    logger.log('📊 label_path 고속도로:', highwayLabels.length, '개');

                    // road_line std_code 수집 (중복 제거)
                    const roadStdCodes = new Set<string>();
                    highwayRoads.forEach((f: any) => {
                        if (f.properties?.std_code) {
                            roadStdCodes.add(f.properties.std_code);
                        }
                    });

                    // label_path std_code와 dp_name 매핑
                    const labelStdCodeMap = new Map<string, string>();
                    highwayLabels.forEach((f: any) => {
                        if (f.properties?.std_code && f.properties?.dp_name) {
                            labelStdCodeMap.set(f.properties.std_code, f.properties.dp_name);
                        }
                    });

                    logger.log('🛣️ road_line std_codes:', Array.from(roadStdCodes).slice(0, 10));
                    logger.log('🏷️ label_path std_codes:', Array.from(labelStdCodeMap.entries()).slice(0, 10));

                    // 패턴 분석: 뒤 8자리가 같은지 확인
                    logger.log('🔗 [뒤 8자리 매칭 시도]');
                    roadStdCodes.forEach(roadCode => {
                        const suffix = roadCode.slice(-8); // 뒤 8자리
                        labelStdCodeMap.forEach((name, labelCode) => {
                            if (labelCode.slice(-8) === suffix) {
                                logger.log(`  ✅ 매칭: road=${roadCode} ↔ label=${labelCode} (${name})`);
                            }
                        });
                    });

                    // 패턴 분석: 뒤 6자리가 같은지 확인
                    logger.log('🔗 [뒤 6자리 매칭 시도]');
                    roadStdCodes.forEach(roadCode => {
                        const suffix = roadCode.slice(-6); // 뒤 6자리
                        labelStdCodeMap.forEach((name, labelCode) => {
                            if (labelCode.slice(-6) === suffix) {
                                logger.log(`  ✅ 매칭: road=${roadCode} ↔ label=${labelCode} (${name})`);
                            }
                        });
                    });

                } catch (e) {
                    logger.warn('std_code 분석 실패:', e);
                }

                // 방법: 네이버 베이스맵의 label_path source-layer를 직접 사용
                // label_path는 도로를 따라가는 LineString geometry + dp_name 속성을 가짐
                // queryRenderedFeatures 대신 레이어 필터로 접근하면 모든 줌 레벨에서 작동

                // 필터 조건: dp_name 또는 dp_name:ko에 키워드 포함
                const labelFilter: any[] = ['any'];
                for (const keyword of focusModeHighlightRoads) {
                    // 'in' 연산자로 substring 검색: ['in', needle, haystack]
                    labelFilter.push(['in', keyword, ['coalesce', ['get', 'dp_name'], '']]);
                    labelFilter.push(['in', keyword, ['coalesce', ['get', 'dp_name:ko'], '']]);
                }

                // 배경선 (금색, 두껍게) - label_path의 LineString을 line으로 렌더링
                try {
                    (mapboxGL as any).addLayer({
                        id: 'highlight-highway-bg',
                        type: 'line',
                        source: naverSource,
                        'source-layer': 'label_path',
                        filter: labelFilter,
                        minzoom: 7,  // 낮은 줌에서도 표시
                        paint: {
                            'line-color': '#FFD700',
                            'line-width': [
                                'interpolate', ['linear'], ['zoom'],
                                7, 4,
                                10, 8,
                                14, 14,
                                18, 20,
                            ],
                            'line-opacity': 0.9,
                            'line-blur': 2,
                        },
                    }, 'vt-complex-fill');

                    highlightLayersRef.current.push('highlight-highway-bg');
                    logger.log('✅ [DEBUG] 하이라이트 배경선 추가 (label_path 직접 사용)');
                } catch (e) {
                    logger.warn('❌ [DEBUG] 하이라이트 배경선 추가 실패:', e);
                }

                // 전경선 (흰색, 얇게)
                try {
                    (mapboxGL as any).addLayer({
                        id: 'highlight-highway-fg',
                        type: 'line',
                        source: naverSource,
                        'source-layer': 'label_path',
                        filter: labelFilter,
                        minzoom: 7,
                        paint: {
                            'line-color': '#FFFFFF',
                            'line-width': [
                                'interpolate', ['linear'], ['zoom'],
                                7, 1.5,
                                10, 3,
                                14, 5,
                                18, 8,
                            ],
                            'line-opacity': 1,
                        },
                    }, 'vt-complex-fill');

                    highlightLayersRef.current.push('highlight-highway-fg');
                    logger.log('✅ [DEBUG] 하이라이트 전경선 추가');
                } catch (e) {
                    logger.warn('❌ [DEBUG] 하이라이트 전경선 추가 실패:', e);
                }

                // 도로 이름 라벨
                try {
                    (mapboxGL as any).addLayer({
                        id: 'highlight-highway-label',
                        type: 'symbol',
                        source: naverSource,
                        'source-layer': 'label_path',
                        filter: labelFilter,
                        minzoom: 9,  // 라벨은 조금 더 가까이서
                        layout: {
                            'symbol-placement': 'line',
                            'text-field': ['coalesce', ['get', 'dp_name'], ['get', 'dp_name:ko'], ''],
                            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                            'text-size': [
                                'interpolate', ['linear'], ['zoom'],
                                9, 10,
                                12, 13,
                                16, 16,
                            ],
                            'text-max-angle': 30,
                            'text-allow-overlap': false,
                            'symbol-spacing': 300,
                        },
                        paint: {
                            'text-color': '#1a1a1a',
                            'text-halo-color': '#FFD700',
                            'text-halo-width': 2.5,
                        },
                    }, 'vt-complex-fill');

                    highlightLayersRef.current.push('highlight-highway-label');
                    logger.log('✅ [DEBUG] 하이라이트 라벨 추가');
                } catch (e) {
                    logger.warn('❌ [DEBUG] 하이라이트 라벨 추가 실패:', e);
                }

                logger.log(`🛣️ [Focus Mode] 도로 하이라이트 레이어 ${highlightLayersRef.current.length}개 생성 (키워드: ${focusModeHighlightRoads.join(', ')})`);
            }
            // 포커스 모드 종료 시 레이어는 이미 위에서 제거됨
        } catch (e) {
            logger.warn('도로 하이라이트 실패:', e);
        }
    }, [mapboxGLReady, focusMode, focusModeHighlightRoads]);

    return null;
}

// React.memo로 불필요한 리렌더링 방지
export const UnifiedPolygonGLLayer = memo(UnifiedPolygonGLLayerInner);
export default UnifiedPolygonGLLayer;
