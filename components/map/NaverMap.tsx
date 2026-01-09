// 네이버 지도 메인 컴포넌트
// Deck.gl WebGL 레이어 + 마커 클러스터링 통합

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useMapStore } from '@/lib/stores/map-store';
import { useDataStore } from '@/lib/stores/data-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { loadAllData } from '@/lib/data/loadData';
import { logger } from '@/lib/utils/logger';
import { setupRoadFocusHelpers } from '@/lib/utils/naverRoadFocus';

// 동적 임포트로 코드 스플리팅 (초기 번들 크기 감소)
const UnifiedPolygonGLLayer = dynamic(() => import('./naver/UnifiedPolygonGLLayer').then(mod => ({ default: mod.UnifiedPolygonGLLayer })), { ssr: false });
const UnifiedMarkerLayer = dynamic(() => import('./naver/UnifiedMarkerLayer').then(mod => ({ default: mod.UnifiedMarkerLayer })), { ssr: false });
const TransactionDotsLayer = dynamic(() => import('./naver/TransactionDotsLayer'), { ssr: false });
const FactoryDistributionLayer = dynamic(() => import('./naver/FactoryDistributionLayer'), { ssr: false });
const OffscreenMarkerLayer = dynamic(() => import('../markers/OffscreenMarkerLayer').then(mod => ({ default: mod.OffscreenMarkerLayer })), { ssr: false });
// ComplexMarkerLayer 제거됨 - UnifiedMarkerLayer에 통합
const FocusModeOverlay = dynamic(() => import('./FocusModeOverlay').then(mod => ({ default: mod.FocusModeOverlay })), { ssr: false });
const PerformanceMonitor = dynamic(() => import('../debug/PerformanceMonitor').then(mod => ({ default: mod.PerformanceMonitor })), { ssr: false });
const MarkerDebugPanel = dynamic(() => import('../debug/MarkerDebugPanel').then(mod => ({ default: mod.MarkerDebugPanel })), { ssr: false });

export default function NaverMap() {
    const mapRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<naver.maps.Map | null>(null);
    const [is3DMode, setIs3DMode] = useState(false);
    const [tilt, setTilt] = useState(0);
    const [bearing, setBearing] = useState(0);
    const [markersEnabled, setMarkersEnabled] = useState(true);
    const [polygonsEnabled, setPolygonsEnabled] = useState(true);
    const [showDebug, setShowDebug] = useState(process.env.NODE_ENV === 'development');
    const [fps, setFps] = useState(0);
    const [memoryInfo, setMemoryInfo] = useState<{ used: number; total: number } | null>(null);
    const glReady = map !== null;

    // ✅ 3D 드래그 상태 (useRef로 관리 - 이벤트 핸들러 클로저 문제 방지)
    const isDraggingRef = useRef(false);
    const lastMousePosRef = useRef({ x: 0, y: 0 });

    // ✅ Debounce 타이머 (useRef로 관리 - 메모리 누수 방지)
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Store에서 줌 레벨 가져오기 (중복 상태 제거)
    const currentZoom = useMapStore((state) => state.currentZoom);
    const setCurrentZoom = useMapStore((state) => state.setCurrentZoom);
    const setCurrentBounds = useMapStore((state) => state.setCurrentBounds);

    // FPS 모니터 (디버그 모드일 때만 실행)
    useEffect(() => {
        if (!showDebug) return;

        let frameCount = 0;
        let lastTime = performance.now();
        let animationId: number;

        const measureFps = () => {
            frameCount++;
            const now = performance.now();
            const elapsed = now - lastTime;

            if (elapsed >= 1000) {
                setFps(Math.round((frameCount * 1000) / elapsed));
                frameCount = 0;
                lastTime = now;
            }
            animationId = requestAnimationFrame(measureFps);
        };

        animationId = requestAnimationFrame(measureFps);
        return () => cancelAnimationFrame(animationId);
    }, [showDebug]);

    // 메모리 모니터 (디버그 모드일 때만)
    useEffect(() => {
        if (!showDebug) return;

        const updateMemory = () => {
            const perf = (performance as any);
            if (perf.memory) {
                setMemoryInfo({
                    used: Math.round(perf.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(perf.memory.totalJSHeapSize / 1024 / 1024),
                });
            }
        };

        updateMemory();
        const intervalId = setInterval(updateMemory, 2000);
        return () => clearInterval(intervalId);
    }, [showDebug]);

    // 3D 모드 토글 + Ctrl+드래그 컨트롤 (antigrabity 방식: Mapbox GL 네이티브 API 사용)
    useEffect(() => {
        if (!map) return;

        let cleanup: (() => void) | null = null;
        let retryTimer: NodeJS.Timeout | null = null;
        let isUnmounted = false; // 메모리 누수 방지: 언마운트 플래그

        const setupTiltControl = () => {
            // 언마운트된 경우 더 이상 실행하지 않음
            if (isUnmounted) return;

            const mapboxGL = (map as any)._mapbox;
            if (!mapboxGL || !mapboxGL.getCanvas) {
                // Mapbox GL 인스턴스 준비 대기 (최대 10회 재시도)
                retryTimer = setTimeout(setupTiltControl, 100);
                return;
            }

            // 기본적으로 드래그 회전 비활성화 (Ctrl 키로만 조작)
            mapboxGL.dragRotate.disable();
            mapboxGL.touchZoomRotate.disableRotation();

            if (!is3DMode) {
                // 3D 모드 비활성화: 틸트/회전 모두 0으로 초기화
                mapboxGL.easeTo({
                    pitch: 0,
                    bearing: 0,
                    duration: 500,
                });
                setTilt(0);
                setBearing(0);
                logger.log('🎥 3D 뷰 비활성화: pitch=0°, bearing=0°');
                return;
            }

            // 3D 모드 활성화
            mapboxGL.easeTo({
                pitch: 45,
                duration: 500,
            });
            setTilt(45);
            logger.log('🎥 3D 뷰 활성화: pitch=45°, Ctrl+드래그로 회전/틸트 조절');

            // ✅ Ctrl + 마우스 드래그로 틸트/회전 조절 (useRef 사용)
            const handleMouseDown = (e: MouseEvent) => {
                if (e.ctrlKey && e.button === 0) { // Ctrl + 좌클릭
                    isDraggingRef.current = true;
                    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
                    e.preventDefault();
                    e.stopPropagation();

                    // 커서 변경
                    mapboxGL.getCanvas().style.cursor = 'grab';
                }
            };

            const handleMouseMove = (e: MouseEvent) => {
                if (!isDraggingRef.current) return;

                const deltaX = e.clientX - lastMousePosRef.current.x;
                const deltaY = e.clientY - lastMousePosRef.current.y;
                lastMousePosRef.current = { x: e.clientX, y: e.clientY };

                // 현재 값 가져오기
                const currentBearing = mapboxGL.getBearing();
                const currentPitch = mapboxGL.getPitch();

                // 새 값 계산 (감도 조절)
                const newBearing = currentBearing + deltaX * 0.5;
                const newPitch = Math.max(0, Math.min(60, currentPitch - deltaY * 0.5));

                // 즉시 적용 (애니메이션 없이)
                mapboxGL.setBearing(newBearing);
                mapboxGL.setPitch(newPitch);

                // React 상태 업데이트 (UI 표시용)
                setBearing(newBearing);
                setTilt(newPitch);

                e.preventDefault();
                e.stopPropagation();
            };

            const handleMouseUp = () => {
                if (isDraggingRef.current) {
                    isDraggingRef.current = false;
                    mapboxGL.getCanvas().style.cursor = '';
                }
            };

            const handleContextMenu = (e: MouseEvent) => {
                if (e.ctrlKey) {
                    e.preventDefault(); // Ctrl+우클릭 메뉴 방지
                }
            };

            // 지도 캔버스에 이벤트 리스너 추가
            const canvas = mapboxGL.getCanvas();
            canvas.addEventListener('mousedown', handleMouseDown, { capture: true });
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            canvas.addEventListener('contextmenu', handleContextMenu);

            cleanup = () => {
                canvas.removeEventListener('mousedown', handleMouseDown, { capture: true });
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
                canvas.removeEventListener('contextmenu', handleContextMenu);
                // ✅ 커서 복원 (드래그 중 언마운트 시)
                if (isDraggingRef.current) {
                    canvas.style.cursor = '';
                    isDraggingRef.current = false;
                }
            };
        };

        setupTiltControl();

        return () => {
            isUnmounted = true; // 언마운트 플래그 설정
            if (retryTimer) {
                clearTimeout(retryTimer);
                retryTimer = null;
            }
            if (cleanup) {
                cleanup();
                cleanup = null;
            }
        };
    }, [map, is3DMode]);

    // 3D 모드 토글 함수
    const toggle3DMode = useCallback(() => {
        setIs3DMode(prev => !prev);
    }, []);

    // MapStore - 지도 상태
    const {
        setMapReady,
        setMapInstance,
        setCurrentLocation,
    } = useMapStore();

    // UIStore - UI 상태
    const rightSidebarWidth = useUIStore((state) => state.rightSidebarWidth);

    // DataStore - 데이터 설정
    const {
        setParcels,
        setDistricts,
        setIndustrialComplexes,
        setKnowledgeCenters,
        setFactories,
        computeRegionAggregations,
    } = useDataStore();

    // 네이버 지도 초기화 (단일화된 준비 로직)
    useEffect(() => {
        if (!mapRef.current) return;

        let cleanupFunctions: Array<() => void> = [];
        let isMapReady = false;

        /**
         * 지도 준비 상태 확인 (중앙 집중식)
         * @returns true if map is ready, false otherwise
         */
        const checkMapReady = (naverMap: naver.maps.Map): boolean => {
            if (isMapReady) return true;

            try {
                const projection = naverMap.getProjection();
                const bounds = naverMap.getBounds();

                if (projection && bounds) {
                    // Projection 테스트
                    const testCoord = new window.naver.maps.LatLng(37.5, 127.0);
                    projection.fromCoordToOffset(testCoord);

                    logger.log('✅ 지도 Projection & Bounds 준비 완료');
                    isMapReady = true;
                    setMap(naverMap);
                    setMapReady(true);
                    setMapInstance(naverMap);  // Store map instance for controls

                    // 디버그용: window에 맵 인스턴스 노출
                    if (typeof window !== 'undefined') {
                        window.__naverMap = naverMap;
                        window.__mapboxGL = (naverMap as any)._mapbox;
                        logger.log('🔧 디버그: window.__naverMap, window.__mapboxGL 사용 가능');
                    }
                    return true;
                }
            } catch {
                // 아직 준비 안됨
            }
            return false;
        };

        /**
         * 지도 초기화 및 준비 대기 (통합)
         */
        const initializeMap = () => {
            if (!mapRef.current || !window.naver) return;

            const naverMap = new window.naver.maps.Map(mapRef.current, {
                center: new window.naver.maps.LatLng(37.4474, 126.7314),
                zoom: 12,
                minZoom: 7,
                maxZoom: 21,
                gl: true,
                zoomControl: false,  // 레이어 패널로 이동
                mapTypeControl: false,  // 레이어 패널로 이동
                customStyleId: 'cdeeedd6-4ca4-41b5-ada8-6cba6e2046bd',  // 커스텀 스타일 적용
            });

            logger.log('✅ 네이버 지도 객체 생성 완료');

            // 이벤트 리스너 등록 (통합)
            const events = ['init_stylemap', 'tilesloaded', 'idle'] as const;
            const listeners = events.map(eventName =>
                window.naver.maps.Event.addListener(naverMap, eventName, () => {
                    logger.log(`🔄 지도 이벤트: ${eventName}`);
                    if (checkMapReady(naverMap)) {
                        cleanup(); // 준비 완료 시 이벤트 리스너 제거
                    }
                })
            );

            // 폴링 (fallback)
            let retryCount = 0;
            const intervalId = setInterval(() => {
                if (checkMapReady(naverMap) || retryCount >= 30) {
                    clearInterval(intervalId);
                    cleanup();

                    // 30번 재시도 실패 시 강제 진행
                    if (!isMapReady && retryCount >= 30) {
                        logger.error('❌ Projection 준비 실패, 강제 진행');
                        isMapReady = true;
                        setMap(naverMap);
                        setMapReady(true);
                        setMapInstance(naverMap);  // Store map instance for controls
                    }
                    return;
                }

                retryCount++;
                logger.log(`⏳ Projection 대기 중... (${retryCount}/30)`);
            }, 100);

            // Cleanup 함수 등록
            const cleanup = () => {
                listeners.forEach(listener => window.naver.maps.Event.removeListener(listener));
                clearInterval(intervalId);
            };

            cleanupFunctions.push(cleanup);
        };

        /**
         * window.naver.maps 대기 후 초기화
         */
        const waitAndInit = () => {
            if (window.naver?.maps) {
                initializeMap();
            } else {
                const timeoutId = setTimeout(waitAndInit, 100);
                cleanupFunctions.push(() => clearTimeout(timeoutId));
            }
        };

        waitAndInit();

        return () => {
            cleanupFunctions.forEach(fn => fn());
        };
    }, [setMapReady]);

    // 디버그용: window에 지도 참조 저장 (map이 설정된 후)
    useEffect(() => {
        if (!map) return;

        const mapboxGL = (map as any)._mapbox;
        window.__NAVER_MAP__ = map;
        window.__MAPBOX_GL__ = mapboxGL;

        if (mapboxGL) {
            logger.log('🔧 디버그: window.__NAVER_MAP__, window.__MAPBOX_GL__ 사용 가능');

            // 도로 포커스 헬퍼 초기화
            setupRoadFocusHelpers();
        }

        return () => {
            delete window.__NAVER_MAP__;
            delete window.__MAPBOX_GL__;
        };
    }, [map]);

    // 줌/바운즈 실시간 추적 + 위치 감지 (bounds_changed 이벤트 사용)
    useEffect(() => {
        if (!map) return;

        // ⚡ 성능: throttle 타이머 (줌 렉 방지)
        let throttleTimer: NodeJS.Timeout | null = null;
        let lastUpdateTime = 0;
        const THROTTLE_MS = 100; // 100ms throttle (줌 시 렉 방지)

        const updateMapState = () => {
            const now = Date.now();

            // ⚡ Throttle 적용: 100ms 이내 중복 호출 무시
            if (throttleTimer || (now - lastUpdateTime < THROTTLE_MS)) {
                return;
            }

            throttleTimer = setTimeout(() => {
                throttleTimer = null;
                lastUpdateTime = Date.now();

                const zoom = map.getZoom();
                const bounds = map.getBounds() as any;

                // 줌 업데이트
                const roundedZoom = Math.round(zoom * 10) / 10;
                const currentRounded = Math.round(currentZoom * 10) / 10;
                if (roundedZoom !== currentRounded) {
                    setCurrentZoom(zoom);
                }

                // 바운즈 업데이트 (가격 색상 보간용)
                if (bounds) {
                    setCurrentBounds({
                        minLng: bounds.getMin().lng(),
                        maxLng: bounds.getMax().lng(),
                        minLat: bounds.getMin().lat(),
                        maxLat: bounds.getMax().lat(),
                    });
                }

                // ✅ 위치 감지 (디바운스 적용 - useRef 사용)
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = setTimeout(() => {
                    detectCurrentLocation();
                }, 300);
            }, THROTTLE_MS);
        };

        const detectCurrentLocation = () => {
            try {
                const mapboxGL = (map as any)._mapbox;
                if (!mapboxGL || !mapboxGL.queryRenderedFeatures) return;

                const center = map.getCenter();
                const point = mapboxGL.project([center.lng(), center.lat()]);

                // PMTiles 레이어에서 읍면동 정보 쿼리
                const features = mapboxGL.queryRenderedFeatures(point, {
                    layers: ['vt-emd-fill'],
                });

                if (features && features.length > 0) {
                    const props = features[0].properties;
                    const code = props.code || props.id;

                    if (code && code.length >= 8) {
                        // 코드 파싱: 시도(2) + 시군구(3) + 읍면동(3)
                        const sidoCode = code.substring(0, 2);
                        const sigCode = code.substring(0, 5);
                        const emdCode = code.substring(0, 8);

                        // 행정구역 이름 조회 (districts 데이터 사용)
                        const districts = useDataStore.getState().districts;
                        const sidoName = districts.find(d => d.level === 'sido' && (d.code?.startsWith(sidoCode) || d.id?.startsWith(sidoCode)))?.name || '인천광역시';
                        const sigName = districts.find(d => d.level === 'sig' && (d.code?.startsWith(sigCode) || d.id?.startsWith(sigCode)))?.name || '';
                        const emdName = districts.find(d => d.level === 'emd' && (d.code?.startsWith(emdCode) || d.id?.startsWith(emdCode)))?.name || props.name || '';

                        setCurrentLocation({
                            sido: sidoName,
                            sig: sigName,
                            emd: emdName,
                        });
                    }
                }
            } catch (error) {
                logger.error('위치 감지 실패:', error);
            }
        };

        updateMapState();

        // bounds_changed: 이동/줌 중에도 실시간 발생
        const boundsListener = window.naver.maps.Event.addListener(map, 'bounds_changed', updateMapState);

        return () => {
            window.naver.maps.Event.removeListener(boundsListener);
            // ✅ Throttle 타이머 정리
            if (throttleTimer) {
                clearTimeout(throttleTimer);
                throttleTimer = null;
            }
            // ✅ Debounce 타이머 정리
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
        };
    }, [map, currentZoom, setCurrentZoom, setCurrentBounds, setCurrentLocation]);

    // 데이터 로딩
    // 데이터 로딩
    const loadedRef = useRef(false);

    useEffect(() => {
        if (!map || loadedRef.current) return;
        loadedRef.current = true;

        loadAllData().then((data) => {
            logger.log('📦 [NaverMap] 데이터 로드 완료:');
            logger.log(`   - 필지: ${data.parcels.length}개`);
            logger.log(`   - 산업단지: ${data.industrialComplexes.length}개`);
            logger.log(`   - 지식산업센터: ${data.knowledgeCenters.length}개 (좌표있음: ${data.knowledgeCenters.filter(k => k.coord && k.coord[0] !== 0).length})`);
            logger.log(`   - 공장: ${data.factories.length}개 (좌표있음: ${data.factories.filter(f => f.coord && f.coord[0] !== 0).length})`);

            setParcels(data.parcels);
            setDistricts(data.districts);
            setIndustrialComplexes(data.industrialComplexes);
            setKnowledgeCenters(data.knowledgeCenters);
            setFactories(data.factories);
            // 행정구역별 집계 계산 (데이터 로드 후 1회)
            computeRegionAggregations();
        });
    }, [map, setParcels, setDistricts, setIndustrialComplexes, setKnowledgeCenters, setFactories, computeRegionAggregations]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            {/* 네이버 지도 */}
            <div
                id="naver-map"
                ref={mapRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#e5e3df',
                }}
            />

            {/* 통합 폴리곤 레이어 */}
            {glReady && polygonsEnabled && (
                <UnifiedPolygonGLLayer map={map} />
            )}

            {/* 통합 마커 레이어 - 모든 마커 (실거래가 클러스터링 포함) */}
            {/* 밀집 지역: Deck.gl 점 마커, 분산 지역: DOM 마커 */}
            {/* Canvas 레이어로 실거래 마커 렌더링하므로 DOM 마커 비활성화 */}
            {glReady && markersEnabled && <UnifiedMarkerLayer map={map} />}
            {glReady && markersEnabled && <TransactionDotsLayer map={map} />}
            {/* 공장 분포 밀도 그리드 레이어 (저줌에서 표시) */}
            {glReady && <FactoryDistributionLayer map={map} />}

            {/* 오프스크린 마커 레이어 - 화면 밖 산업단지/지식산업센터 표시 */}
            {glReady && <OffscreenMarkerLayer map={map} />}

            {/* 산업단지 마커 레이어 - UnifiedMarkerLayer에 통합됨 */}

            {/* 포커스 모드 오버레이 */}
            <FocusModeOverlay />

            {/* 성능 모니터 (개발 환경에서만) */}
            {process.env.NODE_ENV === 'development' && showDebug && <PerformanceMonitor />}

            {/* 마커 디버그 패널 (개발 환경에서만) */}
            {process.env.NODE_ENV === 'development' && <MarkerDebugPanel />}

            {/* 줌 레벨 표시 */}
            <div style={{
                position: 'fixed',
                top: '80px',
                right: `${rightSidebarWidth + 16}px`,
                backgroundColor: 'white',
                color: '#212529',
                padding: '6px 10px',
                borderRadius: '8px',
                fontFamily: 'sans-serif',
                fontSize: '12px',
                fontWeight: '600',
                zIndex: 1000,
                pointerEvents: 'none',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                transition: 'right 0.3s ease',
            }}>
                줌 {currentZoom.toFixed(1)}
            </div>

            {/* 3D 모드 토글 버튼 */}
            <button
                onClick={toggle3DMode}
                style={{
                    position: 'fixed',
                    top: '120px',
                    right: `${rightSidebarWidth + 16}px`,
                    backgroundColor: is3DMode ? '#228be6' : 'white',
                    color: is3DMode ? 'white' : '#495057',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontFamily: 'sans-serif',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    zIndex: 1000,
                    transition: 'all 0.3s ease',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                }}
            >
                {is3DMode ? '2D 모드' : '3D 모드'}
            </button>

            {/* 3D 모드 정보 표시 */}
            {is3DMode && (
                <div style={{
                    position: 'fixed',
                    top: '164px',
                    right: `${rightSidebarWidth + 16}px`,
                    backgroundColor: 'white',
                    color: '#495057',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontFamily: 'sans-serif',
                    fontSize: '11px',
                    zIndex: 1000,
                    pointerEvents: 'none',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    lineHeight: '1.4',
                    transition: 'right 0.3s ease',
                }}>
                    <div><b>기울기</b> {tilt.toFixed(0)}° / <b>회전</b> {bearing.toFixed(0)}°</div>
                    <div style={{ marginTop: '4px', fontSize: '10px', color: '#868e96' }}>
                        Ctrl+드래그로 조작
                    </div>
                </div>
            )}

            {/* 디버그 토글 버튼 */}
            {process.env.NODE_ENV === 'development' && (
                <>
                    <button
                        onClick={() => setShowDebug(!showDebug)}
                        style={{
                            position: 'fixed',
                            bottom: '16px',
                            left: '16px',
                            backgroundColor: 'white',
                            color: '#495057',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            cursor: 'pointer',
                            fontFamily: 'sans-serif',
                            fontSize: '11px',
                            fontWeight: '600',
                            zIndex: 1000,
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        }}
                    >
                        🔧 디버그 {showDebug ? '▼' : '▶'}
                    </button>

                    {/* 디버그 패널 (조건부 렌더링) */}
                    {showDebug && (
                        <div style={{
                            position: 'fixed',
                            bottom: '52px',
                            left: '16px',
                            backgroundColor: 'white',
                            color: '#495057',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            fontFamily: 'sans-serif',
                            fontSize: '11px',
                            zIndex: 1000,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', paddingBottom: '4px', borderBottom: '1px solid #dee2e6' }}>
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    color: fps >= 50 ? '#51cf66' : fps >= 30 ? '#ffd43b' : '#ff6b6b',
                                }}>
                                    {fps} FPS
                                </span>
                                {memoryInfo && (
                                    <span style={{
                                        fontSize: '11px',
                                        color: memoryInfo.used > 500 ? '#ff6b6b' : memoryInfo.used > 300 ? '#ffd43b' : '#51cf66',
                                    }}>
                                        {memoryInfo.used}MB
                                    </span>
                                )}
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px' }}>
                                <input
                                    type="checkbox"
                                    checked={markersEnabled}
                                    onChange={(e) => setMarkersEnabled(e.target.checked)}
                                />
                                마커 (실거래+지목 포함)
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px' }}>
                                <input
                                    type="checkbox"
                                    checked={polygonsEnabled}
                                    onChange={(e) => setPolygonsEnabled(e.target.checked)}
                                />
                                폴리곤
                            </label>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
