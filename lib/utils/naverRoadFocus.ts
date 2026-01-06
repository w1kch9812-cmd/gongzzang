// lib/utils/naverRoadFocus.ts
// 도로 포커스 헬퍼 유틸리티

import { logger } from './logger';

/**
 * 도로 레이어 스타일 조정을 위한 헬퍼 초기화
 * 네이버 지도 GL 모드에서 도로 강조 기능 제공
 */
export function setupRoadFocusHelpers(): void {
    const mapboxGL = window.__MAPBOX_GL__;
    if (!mapboxGL) {
        logger.warn('[RoadFocus] Mapbox GL instance not found');
        return;
    }

    // 도로 포커스 토글 함수
    window.__toggleRoadFocus__ = (enabled: boolean) => {
        try {
            const style = mapboxGL.getStyle();
            if (!style || !style.layers) return;

            // 도로 관련 레이어 찾기
            const roadLayers = style.layers.filter((layer: any) =>
                layer.id.includes('road') ||
                layer.id.includes('bridge') ||
                layer.id.includes('tunnel')
            );

            roadLayers.forEach((layer: any) => {
                if (layer.type === 'line') {
                    // 도로 강조 시 선 두께 증가
                    const currentWidth = mapboxGL.getPaintProperty(layer.id, 'line-width');
                    if (enabled) {
                        mapboxGL.setPaintProperty(layer.id, 'line-width',
                            typeof currentWidth === 'number' ? currentWidth * 1.5 : currentWidth
                        );
                    }
                }
            });

            logger.log(`[RoadFocus] ${enabled ? 'Enabled' : 'Disabled'} road focus`);
        } catch (e) {
            logger.error('[RoadFocus] Error toggling road focus:', e);
        }
    };

    // 특정 도로 하이라이트 함수
    window.__highlightRoad__ = (roadName: string) => {
        logger.log(`[RoadFocus] Highlighting road: ${roadName}`);
        // 구현은 필요에 따라 확장
    };

    logger.log('[RoadFocus] Road focus helpers initialized');
}

/**
 * 도로 포커스 헬퍼 정리
 */
export function cleanupRoadFocusHelpers(): void {
    delete window.__toggleRoadFocus__;
    delete window.__highlightRoad__;
}
