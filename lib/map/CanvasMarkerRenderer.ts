// lib/map/CanvasMarkerRenderer.ts
// Canvas Source 기반 고성능 마커 렌더링 (Mapbox GL 지도 내부 통합)

import type { Map as MapboxMap } from 'mapbox-gl';

export interface CanvasMarker {
    id: string;
    lng: number;
    lat: number;
    type: 'transaction' | 'listing' | 'auction' | 'region' | 'kc' | 'ic' | 'cluster';

    // 표시 내용 (다중 텍스트 지원)
    text: string;
    subtext?: string;
    subtext2?: string;
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
    private sourceId = 'canvas-markers-source';
    private layerId = 'canvas-markers-layer';
    private needsRedraw = true;

    // 히트맵 (클릭 감지용)
    private hitMap: Map<string, string> = new Map(); // "x,y" → markerId

    // 지도 영역 (Canvas 매핑용)
    private bounds: { west: number; east: number; north: number; south: number } | null = null;

    // 이벤트 핸들러
    private onMarkerClick?: (markerId: string, marker: CanvasMarker) => void;
    private onMarkerHover?: (markerId: string | null) => void;
    private hoveredMarkerId: string | null = null;

    constructor(debug = false) {
        // Canvas 생성 (크기는 고정, 해상도 중요)
        this.canvas = document.createElement('canvas');
        this.canvas.width = 2048;
        this.canvas.height = 2048;

        this.ctx = this.canvas.getContext('2d', {
            alpha: true,
            desynchronized: true
        })!;

        console.log('[CanvasSource] Canvas 생성:', this.canvas.width, 'x', this.canvas.height);

        // 디버깅: Canvas를 화면에 표시
        if (debug) {
            this.canvas.style.position = 'fixed';
            this.canvas.style.top = '10px';
            this.canvas.style.right = '10px';
            this.canvas.style.width = '400px';
            this.canvas.style.height = '400px';
            this.canvas.style.border = '2px solid red';
            this.canvas.style.zIndex = '9999';
            this.canvas.style.background = 'white';
            document.body.appendChild(this.canvas);
            console.log('[CanvasSource] 디버그 모드: Canvas를 화면에 표시');
        }
    }

    /** 지도에 Canvas Source 추가 */
    addToMap(map: MapboxMap) {
        this.map = map;

        // 현재 지도 영역 저장
        this.updateBounds();
        console.log('[CanvasSource] Bounds:', this.bounds);

        // Canvas Source 등록
        if (!map.getSource(this.sourceId)) {
            const coords = this.getCoordinates();
            console.log('[CanvasSource] Coordinates:', coords);

            map.addSource(this.sourceId, {
                type: 'canvas',
                canvas: this.canvas,
                coordinates: coords,
                animate: true // Canvas 변경 시 자동 업데이트
            });
            console.log('[CanvasSource] Source 추가됨');
        }

        // Raster 레이어 추가 (WebGL로 렌더링됨!)
        if (!map.getLayer(this.layerId)) {
            map.addLayer({
                id: this.layerId,
                type: 'raster',
                source: this.sourceId,
                paint: {
                    'raster-opacity': 1
                }
            });
            console.log('[CanvasSource] Layer 추가됨');
        }

        // 지도 이벤트 리스너
        this.setupMapListeners();

        // 초기 렌더링 트리거
        console.log('[CanvasSource] 초기 마커 개수:', this.markers.size);
        if (this.markers.size > 0) {
            this.redraw();
        }
    }

    /** 현재 지도 영역 업데이트 */
    private updateBounds() {
        if (!this.map) return;

        const bounds = this.map.getBounds();
        this.bounds = {
            west: bounds.getWest(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
            south: bounds.getSouth()
        };
    }

    /** Canvas가 매핑될 지도 좌표 (4개 코너) */
    private getCoordinates(): [[number, number], [number, number], [number, number], [number, number]] {
        if (!this.bounds) {
            return [[0, 0], [0, 0], [0, 0], [0, 0]];
        }

        const { west, east, north, south } = this.bounds;
        return [
            [west, north],  // 북서
            [east, north],  // 북동
            [east, south],  // 남동
            [west, south],  // 남서
        ];
    }

    /** 지도 이벤트 리스너 설정 */
    private setupMapListeners() {
        if (!this.map) return;

        // 지도 이동/줌 시 Canvas 영역 업데이트
        this.map.on('move', () => {
            this.updateBounds();
            this.updateSourceCoordinates();
            this.redraw();
        });

        // 클릭 이벤트 (지도 레이어에서)
        this.map.on('click', this.layerId, (e) => {
            const markerId = this.getMarkerAtMapPoint(e.lngLat.lng, e.lngLat.lat);
            if (markerId) {
                const marker = this.markers.get(markerId);
                if (marker?.onClick) {
                    marker.onClick();
                }
                if (this.onMarkerClick && marker) {
                    this.onMarkerClick(markerId, marker);
                }
            }
        });

        // 호버 이벤트
        this.map.on('mousemove', this.layerId, (e) => {
            const markerId = this.getMarkerAtMapPoint(e.lngLat.lng, e.lngLat.lat);
            if (markerId !== this.hoveredMarkerId) {
                this.hoveredMarkerId = markerId;
                this.map!.getCanvas().style.cursor = markerId ? 'pointer' : '';
                if (this.onMarkerHover) {
                    this.onMarkerHover(markerId);
                }
            }
        });

        this.map.on('mouseleave', this.layerId, () => {
            if (this.hoveredMarkerId) {
                this.hoveredMarkerId = null;
                this.map!.getCanvas().style.cursor = '';
                if (this.onMarkerHover) {
                    this.onMarkerHover(null);
                }
            }
        });
    }

    /** Source의 coordinates 업데이트 */
    private updateSourceCoordinates() {
        if (!this.map) return;

        const source = this.map.getSource(this.sourceId) as any;
        if (source && source.setCoordinates) {
            source.setCoordinates(this.getCoordinates());
        }
    }

    /** 위경도 → Canvas 픽셀 좌표 변환 */
    private lngLatToCanvasXY(lng: number, lat: number): { x: number; y: number } {
        if (!this.bounds) return { x: 0, y: 0 };

        const { west, east, north, south } = this.bounds;
        const x = ((lng - west) / (east - west)) * this.canvas.width;
        const y = ((north - lat) / (north - south)) * this.canvas.height;

        return { x, y };
    }

    /** Canvas 픽셀 좌표 → 위경도 변환 (클릭 감지용) */
    private canvasXYToLngLat(x: number, y: number): { lng: number; lat: number } {
        if (!this.bounds) return { lng: 0, lat: 0 };

        const { west, east, north, south } = this.bounds;
        const lng = west + (x / this.canvas.width) * (east - west);
        const lat = north - (y / this.canvas.height) * (north - south);

        return { lng, lat };
    }

    /** 지도 좌표에서 마커 찾기 */
    private getMarkerAtMapPoint(lng: number, lat: number): string | null {
        // Canvas 좌표로 변환
        const { x, y } = this.lngLatToCanvasXY(lng, lat);
        const key = `${Math.round(x)},${Math.round(y)}`;
        return this.hitMap.get(key) || null;
    }

    /** Canvas 재렌더링 */
    private redraw() {
        if (!this.ctx || !this.bounds) {
            console.warn('[CanvasSource] redraw 실패: ctx 또는 bounds가 없음');
            return;
        }

        const perfStart = performance.now();

        // 지우기
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.hitMap.clear();

        // 모든 마커 렌더링
        let rendered = 0;
        let skipped = 0;
        this.markers.forEach(marker => {
            const { x, y } = this.lngLatToCanvasXY(marker.lng, marker.lat);

            // 화면 밖 마커는 스킵
            if (x < -100 || x > this.canvas.width + 100 || y < -100 || y > this.canvas.height + 100) {
                skipped++;
                return;
            }

            this.drawMarker(marker, x, y);
            rendered++;
        });

        const perfEnd = performance.now();
        console.log(`⚡ [CanvasSource] 렌더링: ${(perfEnd - perfStart).toFixed(1)}ms | 마커: ${rendered}개 (스킵: ${skipped}개)`);

        // Canvas Source 업데이트 트리거
        if (this.map) {
            const source = this.map.getSource(this.sourceId) as any;
            if (source && source.play) {
                source.play();
            }
            // 지도 다시 그리기 강제
            this.map.triggerRepaint();
        }
    }

    /** 마커 그리기 (Canvas 좌표) */
    private drawMarker(marker: CanvasMarker, x: number, y: number) {
        const width = marker.size?.width || 80;
        const height = marker.size?.height || 32;
        const borderRadius = marker.borderRadius || 6;

        const ctx = this.ctx;
        ctx.save();

        // 그림자
        if (marker.shadow) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
        }

        // 배경
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

        // 텍스트
        ctx.textAlign = marker.textAlign || 'center';
        ctx.textBaseline = 'middle';

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
            ctx.globalAlpha = 0.7;
            ctx.fillText(marker.subtext!, x, currentY);
            ctx.globalAlpha = 1.0;
            currentY += lineHeight;
        }

        // 서브텍스트 2
        if (hasSubtext2) {
            const sub2Size = marker.fontSize?.sub2 || 10;
            ctx.font = `400 ${sub2Size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
            ctx.globalAlpha = 0.6;
            ctx.fillText(marker.subtext2!, x, currentY);
            ctx.globalAlpha = 1.0;
        }

        ctx.restore();

        // 히트맵 등록
        this.registerHitArea(marker.id, x - width/2, y - height/2, width, height);
    }

    /** 둥근 사각형 */
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

    /** 히트 영역 등록 */
    private registerHitArea(markerId: string, x: number, y: number, width: number, height: number) {
        for (let px = Math.floor(x); px < x + width; px += 5) {
            for (let py = Math.floor(y); py < y + height; py += 5) {
                const key = `${Math.round(px)},${Math.round(py)}`;
                this.hitMap.set(key, markerId);
            }
        }
    }

    /** 마커 추가/업데이트 */
    setMarker(marker: CanvasMarker) {
        this.markers.set(marker.id, marker);
        this.needsRedraw = true;
    }

    /** 마커 제거 */
    removeMarker(markerId: string) {
        this.markers.delete(markerId);
        this.needsRedraw = true;
    }

    /** 모든 마커 제거 */
    clearMarkers() {
        this.markers.clear();
        this.needsRedraw = true;
    }

    /** 마커 일괄 설정 */
    setMarkers(markers: CanvasMarker[]) {
        this.markers.clear();
        markers.forEach(m => this.markers.set(m.id, m));
        console.log('[CanvasSource] setMarkers 호출됨:', markers.length, '개');

        // 지도가 아직 연결되지 않았으면 나중에 렌더링
        if (!this.map || !this.bounds) {
            console.warn('[CanvasSource] 지도가 아직 준비되지 않음, 렌더링 지연');
            return;
        }

        this.redraw();
    }

    /** 이벤트 핸들러 */
    onClick(handler: (markerId: string, marker: CanvasMarker) => void) {
        this.onMarkerClick = handler;
    }

    onHover(handler: (markerId: string | null) => void) {
        this.onMarkerHover = handler;
    }

    /** 정리 */
    cleanup() {
        if (this.map) {
            if (this.map.getLayer(this.layerId)) {
                this.map.removeLayer(this.layerId);
            }
            if (this.map.getSource(this.sourceId)) {
                this.map.removeSource(this.sourceId);
            }
        }
        this.markers.clear();
        this.hitMap.clear();
        this.map = null;
    }
}
