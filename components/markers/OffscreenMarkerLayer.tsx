'use client';

import React, { useMemo, useCallback, memo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMapStore } from '@/lib/stores/map-store';
import { useDataStore } from '@/lib/stores/data-store';
import { OffscreenIndicator, OffscreenTargetType } from './OffscreenIndicator';
import { calculateDistance, calculateBearing, hasValidCoordinate } from '@/lib/utils/geoHelpers';
import { MAX_OFFSCREEN_MARKERS } from '@/lib/constants';

interface OffscreenMarkerLayerProps {
    map: naver.maps.Map | null;
}

interface OffscreenTarget {
    id: string;
    name: string;
    type: OffscreenTargetType;
    coord: [number, number];
    subInfo?: string;
    thumbnailUrl?: string;
    phoneNumber?: string;
}

interface OffscreenItem extends OffscreenTarget {
    edge: 'top' | 'right' | 'bottom' | 'left';
    position: number;  // 0~100% (CSS용)
    distance: number;
    distanceRatio: number;
    angle: number;  // CSS rotate용 각도 (0=위쪽)
}

// 화면 좌표 기반 오프스크린 위치 계산
// 화면 중심에서 타겟까지의 화면 좌표 방향을 사용
function calculateOffscreenFromScreenCoords(
    targetScreenX: number,    // 타겟의 화면 X 좌표 (화면 밖일 수 있음)
    targetScreenY: number,    // 타겟의 화면 Y 좌표
    screenWidth: number,
    screenHeight: number
): { edge: 'top' | 'right' | 'bottom' | 'left'; position: number; angle: number } {
    // 화면 중심
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;

    // 중심에서 타겟까지의 방향 벡터
    const dx = targetScreenX - centerX;
    const dy = targetScreenY - centerY;

    // 화면 좌표계에서의 각도 계산 (0=위, 90=오른쪽, 180=아래, 270=왼쪽)
    // atan2(x, -y)를 사용하여 CSS 회전과 맞춤
    const angle = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;

    // 화면 경계와의 교차점 계산
    // 레이 캐스팅: 중심에서 타겟 방향으로 쏴서 어느 변과 먼저 만나는지
    const halfW = screenWidth / 2;
    const halfH = screenHeight / 2;

    let edge: 'top' | 'right' | 'bottom' | 'left';
    let position: number;

    // dx, dy가 0인 경우 처리
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
        return { edge: 'top', position: 50, angle: 0 };
    }

    // 각 변까지의 거리(t) 계산
    const tTop = dy < 0 ? -halfH / dy : Infinity;
    const tBottom = dy > 0 ? halfH / dy : Infinity;
    const tLeft = dx < 0 ? -halfW / dx : Infinity;
    const tRight = dx > 0 ? halfW / dx : Infinity;

    // 가장 먼저 만나는 변 찾기 (가장 작은 양수 t)
    const tMin = Math.min(
        tTop > 0 ? tTop : Infinity,
        tBottom > 0 ? tBottom : Infinity,
        tLeft > 0 ? tLeft : Infinity,
        tRight > 0 ? tRight : Infinity
    );

    if (tMin === tTop) {
        edge = 'top';
        const intersectX = centerX + dx * tTop;
        position = (intersectX / screenWidth) * 100;
    } else if (tMin === tBottom) {
        edge = 'bottom';
        const intersectX = centerX + dx * tBottom;
        position = (intersectX / screenWidth) * 100;
    } else if (tMin === tLeft) {
        edge = 'left';
        const intersectY = centerY + dy * tLeft;
        position = (intersectY / screenHeight) * 100;
    } else {
        edge = 'right';
        const intersectY = centerY + dy * tRight;
        position = (intersectY / screenHeight) * 100;
    }

    // 위치 범위 제한 (5% ~ 95%)
    position = Math.max(5, Math.min(95, position));

    return { edge, position, angle };
}

function OffscreenMarkerLayerInner({ map }: OffscreenMarkerLayerProps) {
    // Store 데이터
    const currentBounds = useMapStore((state) => state.currentBounds);
    const knowledgeCenters = useDataStore((state) => state.knowledgeCenters);
    const industrialComplexes = useDataStore((state) => state.industrialComplexes);

    // Mapbox GL 인스턴스 참조
    const mapboxGLRef = useRef<any>(null);

    // 화면 크기 및 지도 상태 추적 (리렌더링 트리거용)
    const [mapState, setMapState] = useState({
        screenWidth: 0,
        screenHeight: 0,
        updateCounter: 0  // move/rotate/zoom 시 증가
    });

    useEffect(() => {
        if (!map) return;

        const mapboxGL = (map as any)._mapbox;
        if (!mapboxGL) return;

        mapboxGLRef.current = mapboxGL;

        const updateMapState = () => {
            const container = mapboxGL.getContainer();
            setMapState(prev => ({
                screenWidth: container?.clientWidth || window.innerWidth,
                screenHeight: container?.clientHeight || window.innerHeight,
                updateCounter: prev.updateCounter + 1
            }));
        };

        // 초기 상태 설정
        updateMapState();

        // 모든 지도 변경 이벤트에 대응
        mapboxGL.on('move', updateMapState);
        mapboxGL.on('moveend', updateMapState);

        return () => {
            mapboxGL.off('move', updateMapState);
            mapboxGL.off('moveend', updateMapState);
        };
    }, [map]);

    // 광고 활성화된 대상만 필터 (isAd=true) - 레이어 가시성과 무관하게 항상 표시
    const targets = useMemo((): OffscreenTarget[] => {
        const result: OffscreenTarget[] = [];

        // 산업단지 광고
        industrialComplexes
            .filter(ic => ic.isAd && hasValidCoordinate(ic.coord))
            .forEach(ic => {
                result.push({
                    id: `ic-${ic.id}`,
                    name: ic.name,
                    type: 'industrial-complex',
                    coord: ic.coord as [number, number],
                    subInfo: ic.status === '조성완료' ? undefined : `${ic.status} ${ic.completionRate}%`,
                    thumbnailUrl: ic.thumbnailUrl,
                    phoneNumber: ic.phoneNumber,
                });
            });

        // 지식산업센터 광고
        knowledgeCenters
            .filter(kc => kc.isAd && hasValidCoordinate(kc.coord))
            .forEach(kc => {
                result.push({
                    id: `kc-${kc.id}`,
                    name: kc.name,
                    type: 'knowledge-center',
                    coord: kc.coord as [number, number],
                    subInfo: kc.status === '완료신고' ? undefined : `${kc.status}`,
                    thumbnailUrl: kc.thumbnailUrl,
                    phoneNumber: kc.phoneNumber,
                });
            });

        return result;
    }, [industrialComplexes, knowledgeCenters]);

    // 오프스크린 항목 계산 (화면 좌표 기반 - 3D 모드 완벽 지원)
    const offscreenItems = useMemo((): OffscreenItem[] => {
        const mapboxGL = mapboxGLRef.current;
        if (!mapboxGL || targets.length === 0) return [];
        if (mapState.screenWidth === 0) return [];

        const { screenWidth, screenHeight } = mapState;

        // 카메라 정보
        const center = mapboxGL.getCenter();
        const centerLat = center.lat;
        const centerLng = center.lng;

        // 화면 대각선 거리 (투명도 계산용)
        const topLeft = mapboxGL.unproject([0, 0]);
        const bottomRight = mapboxGL.unproject([screenWidth, screenHeight]);
        const diagonalDistance = calculateDistance(
            topLeft.lat, topLeft.lng,
            bottomRight.lat, bottomRight.lng
        );

        const icItems: OffscreenItem[] = []; // 산업단지
        const kcItems: OffscreenItem[] = []; // 지식산업센터

        for (const target of targets) {
            const [lng, lat] = target.coord;

            // 1. 타겟을 화면 좌표로 변환 (project 사용)
            const screenPoint = mapboxGL.project([lng, lat]);

            // 2. 화면 안에 있는지 확인
            const isOnScreen =
                screenPoint.x >= 0 &&
                screenPoint.x <= screenWidth &&
                screenPoint.y >= 0 &&
                screenPoint.y <= screenHeight;

            if (isOnScreen) continue;  // 화면 안에 있으면 스킵

            // 3. 화면 좌표 유효성 검사
            // project()가 카메라 뒤쪽의 점을 처리할 때 극단적인 값이 나올 수 있음
            const maxCoord = Math.max(screenWidth, screenHeight) * 10;
            const isValidScreenCoord =
                Math.abs(screenPoint.x) < maxCoord &&
                Math.abs(screenPoint.y) < maxCoord &&
                isFinite(screenPoint.x) &&
                isFinite(screenPoint.y);

            let result;
            if (isValidScreenCoord) {
                // 화면 좌표가 유효하면 화면 좌표 기반 계산 (더 정확)
                result = calculateOffscreenFromScreenCoords(
                    screenPoint.x,
                    screenPoint.y,
                    screenWidth,
                    screenHeight
                );
            } else {
                // 화면 좌표가 유효하지 않으면 지리적 방위각 기반 계산
                const cameraBearing = mapboxGL.getBearing() || 0;
                const targetBearing = calculateBearing(centerLat, centerLng, lat, lng);
                const screenDirection = (targetBearing - cameraBearing + 360) % 360;

                // 간단한 edge/position 계산
                let edge: 'top' | 'right' | 'bottom' | 'left';
                let position = 50;

                if (screenDirection >= 315 || screenDirection < 45) {
                    edge = 'top';
                } else if (screenDirection >= 45 && screenDirection < 135) {
                    edge = 'right';
                } else if (screenDirection >= 135 && screenDirection < 225) {
                    edge = 'bottom';
                } else {
                    edge = 'left';
                }

                result = { edge, position, angle: screenDirection };
            }

            // 4. 거리 계산
            const distance = calculateDistance(centerLat, centerLng, lat, lng);
            const distanceRatio = distance / diagonalDistance;

            const item: OffscreenItem = {
                ...target,
                edge: result.edge,
                position: result.position,
                distance,
                distanceRatio,
                angle: result.angle,  // 화면 기준 각도 (CSS rotate용, 0=위쪽)
            };

            if (target.type === 'industrial-complex') {
                icItems.push(item);
            } else {
                kcItems.push(item);
            }
        }

        // 거리 순으로 정렬 (가까운 것이 앞에)
        icItems.sort((a, b) => a.distance - b.distance);
        kcItems.sort((a, b) => a.distance - b.distance);

        // 산업단지/지식산업센터 최대 개수 제한
        return [
            ...icItems.slice(0, MAX_OFFSCREEN_MARKERS.ic),
            ...kcItems.slice(0, MAX_OFFSCREEN_MARKERS.kc)
        ];
    }, [targets, mapState]);

    // 클릭 핸들러 - 해당 위치로 이동
    const handleClick = useCallback((coord: [number, number]) => {
        if (!map) return;
        const [lng, lat] = coord;
        (map as any).panTo(new window.naver.maps.LatLng(lat, lng));
    }, [map]);

    // 지도 컨테이너 참조
    const mapContainer = mapboxGLRef.current?.getContainer();
    const { screenWidth, screenHeight } = mapState;

    // 렌더링할 항목이 없거나 컨테이너가 없으면 null
    if (offscreenItems.length === 0 || !mapContainer || screenWidth === 0) {
        return null;
    }

    // Portal을 지도 컨테이너에 직접 렌더링 (픽셀 단위로 크기 지정)
    // position: relative로 자식 요소의 positioning context 설정
    return createPortal(
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: screenWidth,
                height: screenHeight,
                pointerEvents: 'none',
                zIndex: 100,
            }}
        >
            {/* 내부 컨테이너: position relative + overflow hidden으로 마커 영역 제한 */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                }}
            >
            {offscreenItems.map((item) => (
                <div
                    key={item.id}
                    style={{ pointerEvents: 'auto' }}
                >
                    <OffscreenIndicator
                        name={item.name}
                        type={item.type}
                        edge={item.edge}
                        position={item.position}
                        distance={item.distance}
                        distanceRatio={item.distanceRatio}
                        angle={item.angle}
                        subInfo={item.subInfo}
                        thumbnailUrl={item.thumbnailUrl}
                        phoneNumber={item.phoneNumber}
                        onClick={() => handleClick(item.coord)}
                    />
                </div>
            ))}
            </div>
        </div>,
        mapContainer
    );
}

export const OffscreenMarkerLayer = memo(OffscreenMarkerLayerInner);

export default OffscreenMarkerLayer;
