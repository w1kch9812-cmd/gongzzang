// lib/map/CanvasMarkerRenderer.ts
// Canvas 기반 고성능 마커 렌더링 (Mapbox GL Custom Layer)

import type { Map as MapboxMap } from 'mapbox-gl';

export interface CanvasMarker {
    id: string;
    lng: number;
    lat: number;
    type: 'transaction' | 'listing' | 'auction' | 'region' | 'kc' | 'ic' | 'cluster';

    // 표시 내용 (다중 텍스트 지원)
    text: string;
    subtext?: string;
    subtext2?: string;  // 3줄 텍스트 지원
    icon?: string;

    // 스타일
    bgColor: string;
    textColor: string;
    borderColor?: string;
    size?: { width: number; height: number };

    // 고급 스타일
    fontSize?: {
        main?: number;
        sub?: number;
        sub2?: number;
    };
    textAlign?: 'left' | 'center' | 'right';
    shadow?: string;
    borderRadius?: number;
    padding?: number;

    // 데이터 (클릭 시 사용)
    data?: any;

    // 클릭/호버 핸들러
    onClick?: () => void;
    onHover?: () => void;
}

export class CanvasMarkerRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private markers: Map<string, CanvasMarker> = new Map();
    private map: MapboxMap | null = null;
    private needsRedraw = true;

    // 클릭 감지용 (픽셀 → 마커 ID 매핑)
    private hitMap: Map<string, string> = new Map(); // "x,y" → markerId

    // 이벤트 핸들러
    private onMarkerClick?: (markerId: string, marker: CanvasMarker) => void;
    private onMarkerHover?: (markerId: string | null) => void;
    private hoveredMarkerId: string | null = null;

    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', {
            alpha: true,
            desynchronized: true // 성능 향상
        })!;

        // 고해상도 디스플레이 지원
        const dpr = window.devicePixelRatio || 1;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
    }

    /** Mapbox GL Custom Layer 인터페이스 */
    getLayer(layerId: string = 'canvas-markers') {
        const self = this;

        return {
            id: layerId,
            type: 'custom' as const,
            renderingMode: '2d' as const,

            onAdd(map: MapboxMap, gl: WebGLRenderingContext) {
                self.map = map;
                self.setupEventListeners();
            },

            render(gl: WebGLRenderingContext, matrix: number[]) {
                if (!self.map || !self.needsRedraw) return;

                const perfStart = performance.now();

                // Canvas 크기 조정
                const mapCanvas = self.map.getCanvas();
                const dpr = window.devicePixelRatio || 1;

                if (self.canvas.width !== mapCanvas.width * dpr ||
                    self.canvas.height !== mapCanvas.height * dpr) {
                    self.canvas.width = mapCanvas.width * dpr;
                    self.canvas.height = mapCanvas.height * dpr;
                    self.ctx.scale(dpr, dpr);
                }

                // 지우기
                self.ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);
                self.hitMap.clear();

                // 모든 마커 렌더링
                self.markers.forEach(marker => {
                    self.drawMarker(marker);
                });

                self.needsRedraw = false;

                const perfEnd = performance.now();
                if (perfEnd - perfStart > 10) {
                    console.log(`⚡ Canvas 렌더링: ${(perfEnd - perfStart).toFixed(1)}ms | 마커: ${self.markers.size}개`);
                }
            },

            onRemove() {
                self.cleanup();
            }
        };
    }

    /** 마커 그리기 */
    private drawMarker(marker: CanvasMarker) {
        if (!this.map) return;

        // 위경도 → 화면 픽셀 좌표
        const point = this.map.project([marker.lng, marker.lat]);
        const x = point.x;
        const y = point.y;

        // 마커 크기
        const width = marker.size?.width || 80;
        const height = marker.size?.height || 32;
        const padding = marker.padding || 8;
        const borderRadius = marker.borderRadius || 6;

        const ctx = this.ctx;

        // 배경
        ctx.save();

        // 그림자 (있으면)
        if (marker.shadow) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
        }

        ctx.fillStyle = marker.bgColor;
        if (marker.borderColor) {
            ctx.strokeStyle = marker.borderColor;
            ctx.lineWidth = 2;
        }

        // 둥근 사각형
        this.roundRect(ctx, x - width/2, y - height/2, width, height, borderRadius);
        ctx.fill();
        if (marker.borderColor) {
            ctx.stroke();
        }

        // 그림자 초기화
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // 텍스트 정렬
        const textAlign = marker.textAlign || 'center';
        ctx.textAlign = textAlign;
        ctx.textBaseline = 'middle';

        // 다중 텍스트 라인 계산
        const hasSubtext = !!marker.subtext;
        const hasSubtext2 = !!marker.subtext2;
        const lineCount = 1 + (hasSubtext ? 1 : 0) + (hasSubtext2 ? 1 : 0);
        const lineHeight = 14;
        const totalHeight = lineCount * lineHeight;
        let currentY = y - totalHeight / 2 + lineHeight / 2;

        // 메인 텍스트
        ctx.fillStyle = marker.textColor;
        const mainSize = marker.fontSize?.main || 13;
        ctx.font = `600 ${mainSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillText(marker.text, x, currentY);
        currentY += lineHeight;

        // 서브텍스트 1
        if (hasSubtext) {
            const subSize = marker.fontSize?.sub || 11;
            ctx.font = `400 ${subSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
            ctx.fillStyle = marker.textColor;
            ctx.globalAlpha = 0.7;
            ctx.fillText(marker.subtext!, x, currentY);
            ctx.globalAlpha = 1.0;
            currentY += lineHeight;
        }

        // 서브텍스트 2
        if (hasSubtext2) {
            const sub2Size = marker.fontSize?.sub2 || 10;
            ctx.font = `400 ${sub2Size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
            ctx.fillStyle = marker.textColor;
            ctx.globalAlpha = 0.6;
            ctx.fillText(marker.subtext2!, x, currentY);
            ctx.globalAlpha = 1.0;
        }

        ctx.restore();

        // 히트맵 등록 (클릭 감지용)
        this.registerHitArea(marker.id, x - width/2, y - height/2, width, height);
    }

    /** 둥근 사각형 그리기 */
    private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    /** 히트 영역 등록 (클릭 감지용) */
    private registerHitArea(markerId: string, x: number, y: number, width: number, height: number) {
        // 5px 간격으로 샘플링 (성능 최적화)
        for (let px = Math.floor(x); px < x + width; px += 5) {
            for (let py = Math.floor(y); py < y + height; py += 5) {
                const key = `${Math.round(px)},${Math.round(py)}`;
                this.hitMap.set(key, markerId);
            }
        }
    }

    /** 이벤트 리스너 설정 */
    private setupEventListeners() {
        if (!this.map) return;

        const mapCanvas = this.map.getCanvas();

        // 클릭
        mapCanvas.addEventListener('click', (e) => {
            const markerId = this.getMarkerAtPoint(e.offsetX, e.offsetY);
            if (markerId) {
                const marker = this.markers.get(markerId);
                if (marker) {
                    // 마커별 개별 onClick 호출
                    if (marker.onClick) {
                        marker.onClick();
                    }
                    // 전역 onMarkerClick 호출
                    if (this.onMarkerClick) {
                        this.onMarkerClick(markerId, marker);
                    }
                }
            }
        });

        // 호버
        mapCanvas.addEventListener('mousemove', (e) => {
            const markerId = this.getMarkerAtPoint(e.offsetX, e.offsetY);

            if (markerId !== this.hoveredMarkerId) {
                this.hoveredMarkerId = markerId;

                // 커서 변경
                mapCanvas.style.cursor = markerId ? 'pointer' : '';

                if (this.onMarkerHover) {
                    this.onMarkerHover(markerId);
                }
            }
        });
    }

    /** 특정 픽셀 위치의 마커 찾기 */
    private getMarkerAtPoint(x: number, y: number): string | null {
        const key = `${Math.round(x)},${Math.round(y)}`;
        return this.hitMap.get(key) || null;
    }

    /** 마커 추가/업데이트 */
    setMarker(marker: CanvasMarker) {
        this.markers.set(marker.id, marker);
        this.needsRedraw = true;
        this.map?.triggerRepaint();
    }

    /** 마커 제거 */
    removeMarker(markerId: string) {
        this.markers.delete(markerId);
        this.needsRedraw = true;
        this.map?.triggerRepaint();
    }

    /** 모든 마커 제거 */
    clearMarkers() {
        this.markers.clear();
        this.needsRedraw = true;
        this.map?.triggerRepaint();
    }

    /** 마커 일괄 설정 */
    setMarkers(markers: CanvasMarker[]) {
        this.markers.clear();
        markers.forEach(m => this.markers.set(m.id, m));
        this.needsRedraw = true;
        this.map?.triggerRepaint();
    }

    /** 이벤트 핸들러 설정 */
    onClick(handler: (markerId: string, marker: CanvasMarker) => void) {
        this.onMarkerClick = handler;
    }

    onHover(handler: (markerId: string | null) => void) {
        this.onMarkerHover = handler;
    }

    /** 정리 */
    cleanup() {
        this.markers.clear();
        this.hitMap.clear();
        this.map = null;
    }
}
