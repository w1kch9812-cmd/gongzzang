// lib/map/CanvasMarkerRenderer.ts
// Mapbox GL Custom Layer 기반 마커 렌더러
// html-to-image로 실제 DOM을 캡처하여 WebGL 텍스처로 렌더링 (픽셀 퍼펙트)
//
// 성능 최적화:
// - 스프라이트 아틀라스 캐싱 (마커 데이터 변경 시에만 재생성)
// - Float32Array 버퍼 재사용 (GC 방지)
// - Attribute/Uniform location 캐싱
// - 뷰포트 필터링으로 화면 밖 마커 스킵
// - 정렬 결과 캐싱 (updateMarkers 시 1회)

import { logger } from '@/lib/utils/logger';
import { ZOOM_PARCEL } from './zoomConfig';
import { toPng } from 'html-to-image';

// ========== 타입 정의 ==========

export interface MarkerData {
    id: string;
    lng: number;
    lat: number;
    // 기존 DOM 마커와 동일한 데이터
    price: string;           // 포맷된 가격 (예: "1.2억/평")
    propertyType?: string;   // factory, warehouse, land, knowledge-center
    jibun?: string;          // 지번 (지목 추출용)
    transactionDate?: string; // 거래일자 (YYYY-MM-DD)
    area?: number;           // 면적 (㎡)
    isSelected?: boolean;
}

// 유형별 라벨 및 색상 (기존 DOM 마커와 동일)
const TYPE_INFO: Record<string, { label: string; color: string }> = {
    factory: { label: '공장', color: '#8B5CF6' },
    warehouse: { label: '창고', color: '#F59E0B' },
    land: { label: '토지', color: '#10B981' },
    'knowledge-center': { label: '지산', color: '#3B82F6' },
};

// 지목 추출 함수 (기존 DOM 마커와 동일)
function getTypeLabel(propertyType?: string, jibun?: string): { label: string; color: string } {
    if (propertyType && TYPE_INFO[propertyType]) {
        return TYPE_INFO[propertyType];
    }
    // 지번에서 지목 추출
    if (jibun) {
        if (jibun.includes('공장')) return { label: '공장', color: '#8B5CF6' };
        if (jibun.includes('창고')) return { label: '창고', color: '#F59E0B' };
    }
    return { label: '토지', color: '#6B7280' };
}

interface CachedSprite {
    x: number;
    y: number;
    width: number;
    height: number;
}

const LAYER_ID = 'canvas-markers-layer';
const ATLAS_SIZE = 4096; // 선명도를 위해 크기 증가
const SPRITE_SCALE = 4; // 고해상도 스케일 (Retina 2x * 2)
const SQM_PER_PYEONG = 3.3058;

// ========== Canvas 마커 렌더러 ==========

export class CanvasMarkerRenderer {
    private mapboxGL: any;
    private markers: MarkerData[] = [];
    private sortedMarkers: MarkerData[] = []; // 정렬된 마커 캐시
    private selectedMarkerId: string | null = null;
    private onClick: ((marker: MarkerData) => void) | null = null;
    private isInitialized: boolean = false;

    // 스프라이트 아틀라스
    private atlasCanvas: HTMLCanvasElement;
    private atlasCtx: CanvasRenderingContext2D;
    private spriteCache: Map<string, CachedSprite> = new Map();
    private atlasNeedsUpdate: boolean = true;
    private atlasBuilding: boolean = false; // 비동기 빌드 중
    private textureNeedsUpload: boolean = false; // 텍스처 업로드 필요
    private atlasCursor = { x: 0, y: 0, rowHeight: 0 };

    // WebGL 리소스
    private program: WebGLProgram | null = null;
    private vertexBuffer: WebGLBuffer | null = null;
    private texture: WebGLTexture | null = null;

    // Attribute locations 캐시
    private attribLocations: {
        position: number;
        texCoord: number;
        size: number;
        offset: number;
    } | null = null;
    private uniformLocations: {
        resolution: WebGLUniformLocation | null;
        texture: WebGLUniformLocation | null;
    } | null = null;

    // 재사용 가능한 버퍼
    private vertexArray: Float32Array | null = null;
    private vertexArraySize: number = 0;

    // 클릭 감지용 바운드
    private markerBounds: Map<string, { x: number; y: number; width: number; height: number }> = new Map();

    constructor(mapboxGL: any) {
        this.mapboxGL = mapboxGL;

        // 아틀라스 Canvas 생성 (고해상도)
        this.atlasCanvas = document.createElement('canvas');
        this.atlasCanvas.width = ATLAS_SIZE;
        this.atlasCanvas.height = ATLAS_SIZE;
        const ctx = this.atlasCanvas.getContext('2d', {
            alpha: true,
            desynchronized: false,
        });
        if (!ctx) throw new Error('Canvas 2D context not available');

        // 선명도 설정
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        this.atlasCtx = ctx;

        // Custom Layer 추가
        this.addCustomLayer();

        // 클릭 이벤트
        mapboxGL.on('click', this.handleMapClick);

        logger.log('🎨 [CanvasMarkerRenderer] 초기화 완료');
    }

    private addCustomLayer() {
        const self = this;

        const customLayer = {
            id: LAYER_ID,
            type: 'custom' as const,
            renderingMode: '2d' as const,
            minzoom: ZOOM_PARCEL.min, // 필지 레벨에서만 표시

            onAdd(_map: any, gl: WebGLRenderingContext) {
                // Vertex Shader - 화면 좌표 기준 빌보드
                const vertexSource = `
                    attribute vec2 a_position;
                    attribute vec2 a_texCoord;
                    attribute vec2 a_size;
                    attribute vec2 a_offset;
                    uniform vec2 u_resolution;
                    varying vec2 v_texCoord;
                    void main() {
                        vec2 pixelPos = a_position + a_offset * a_size;
                        vec2 clipSpace = (pixelPos / u_resolution) * 2.0 - 1.0;
                        clipSpace.y = -clipSpace.y;
                        gl_Position = vec4(clipSpace, 0.0, 1.0);
                        v_texCoord = a_texCoord;
                    }
                `;

                const fragmentSource = `
                    precision mediump float;
                    uniform sampler2D u_texture;
                    varying vec2 v_texCoord;
                    void main() {
                        gl_FragColor = texture2D(u_texture, v_texCoord);
                    }
                `;

                // Shader 컴파일
                const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
                gl.shaderSource(vertexShader, vertexSource);
                gl.compileShader(vertexShader);

                const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
                gl.shaderSource(fragmentShader, fragmentSource);
                gl.compileShader(fragmentShader);

                self.program = gl.createProgram()!;
                gl.attachShader(self.program, vertexShader);
                gl.attachShader(self.program, fragmentShader);
                gl.linkProgram(self.program);

                self.vertexBuffer = gl.createBuffer();

                self.texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, self.texture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                // 밉맵 사용으로 축소 시 선명도 향상
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

                // Attribute/Uniform locations 캐시
                self.attribLocations = {
                    position: gl.getAttribLocation(self.program, 'a_position'),
                    texCoord: gl.getAttribLocation(self.program, 'a_texCoord'),
                    size: gl.getAttribLocation(self.program, 'a_size'),
                    offset: gl.getAttribLocation(self.program, 'a_offset'),
                };
                self.uniformLocations = {
                    resolution: gl.getUniformLocation(self.program, 'u_resolution'),
                    texture: gl.getUniformLocation(self.program, 'u_texture'),
                };

                self.isInitialized = true;
            },

            render(gl: WebGLRenderingContext) {
                if (!self.isInitialized || !self.program || !self.attribLocations || !self.uniformLocations) return;
                if (self.sortedMarkers.length === 0) return;

                // 줌 레벨 체크 (14 미만에서는 렌더링 안함)
                const currentZoom = self.mapboxGL.getZoom();
                if (currentZoom < ZOOM_PARCEL.min) return;

                // 비동기 아틀라스 빌드 시작
                if (self.atlasNeedsUpdate && !self.atlasBuilding) {
                    self.atlasNeedsUpdate = false;
                    self.atlasBuilding = true;
                    self.buildAtlasAsync().then(() => {
                        self.atlasBuilding = false;
                        self.textureNeedsUpload = true;
                        self.mapboxGL.triggerRepaint();
                    });
                }

                // 텍스처 업로드 (빌드 완료 후)
                if (self.textureNeedsUpload) {
                    gl.bindTexture(gl.TEXTURE_2D, self.texture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, self.atlasCanvas);
                    gl.generateMipmap(gl.TEXTURE_2D);
                    self.textureNeedsUpload = false;
                }

                // 뷰포트 필터링
                const bounds = self.mapboxGL.getBounds();
                const minLng = bounds.getWest();
                const maxLng = bounds.getEast();
                const minLat = bounds.getSouth();
                const maxLat = bounds.getNorth();

                // 버퍼 크기 계산 (마커당 6 vertices * 8 floats)
                const maxVertices = self.sortedMarkers.length * 6 * 8;
                if (!self.vertexArray || self.vertexArraySize < maxVertices) {
                    self.vertexArray = new Float32Array(maxVertices);
                    self.vertexArraySize = maxVertices;
                }

                let vertexCount = 0;
                self.markerBounds.clear();

                for (const marker of self.sortedMarkers) {
                    if (marker.lng < minLng || marker.lng > maxLng ||
                        marker.lat < minLat || marker.lat > maxLat) continue;

                    const spriteKey = self.getSpriteKey(marker);
                    const sprite = self.spriteCache.get(spriteKey);
                    if (!sprite) continue;

                    const screenPoint = self.mapboxGL.project([marker.lng, marker.lat]);
                    const x = screenPoint.x;
                    const y = screenPoint.y;
                    const w = sprite.width / SPRITE_SCALE;
                    const h = sprite.height / SPRITE_SCALE;

                    const u0 = sprite.x / ATLAS_SIZE;
                    const v0 = sprite.y / ATLAS_SIZE;
                    const u1 = (sprite.x + sprite.width) / ATLAS_SIZE;
                    const v1 = (sprite.y + sprite.height) / ATLAS_SIZE;

                    // 6 vertices per quad - 직접 배열에 쓰기
                    const baseIdx = vertexCount * 8;
                    const arr = self.vertexArray!;

                    // vertex 0: [-0.5, -0.5]
                    arr[baseIdx] = x; arr[baseIdx + 1] = y;
                    arr[baseIdx + 2] = u0; arr[baseIdx + 3] = v0;
                    arr[baseIdx + 4] = w; arr[baseIdx + 5] = h;
                    arr[baseIdx + 6] = -0.5; arr[baseIdx + 7] = -0.5;

                    // vertex 1: [0.5, -0.5]
                    arr[baseIdx + 8] = x; arr[baseIdx + 9] = y;
                    arr[baseIdx + 10] = u1; arr[baseIdx + 11] = v0;
                    arr[baseIdx + 12] = w; arr[baseIdx + 13] = h;
                    arr[baseIdx + 14] = 0.5; arr[baseIdx + 15] = -0.5;

                    // vertex 2: [-0.5, 0.5]
                    arr[baseIdx + 16] = x; arr[baseIdx + 17] = y;
                    arr[baseIdx + 18] = u0; arr[baseIdx + 19] = v1;
                    arr[baseIdx + 20] = w; arr[baseIdx + 21] = h;
                    arr[baseIdx + 22] = -0.5; arr[baseIdx + 23] = 0.5;

                    // vertex 3: [0.5, -0.5]
                    arr[baseIdx + 24] = x; arr[baseIdx + 25] = y;
                    arr[baseIdx + 26] = u1; arr[baseIdx + 27] = v0;
                    arr[baseIdx + 28] = w; arr[baseIdx + 29] = h;
                    arr[baseIdx + 30] = 0.5; arr[baseIdx + 31] = -0.5;

                    // vertex 4: [0.5, 0.5]
                    arr[baseIdx + 32] = x; arr[baseIdx + 33] = y;
                    arr[baseIdx + 34] = u1; arr[baseIdx + 35] = v1;
                    arr[baseIdx + 36] = w; arr[baseIdx + 37] = h;
                    arr[baseIdx + 38] = 0.5; arr[baseIdx + 39] = 0.5;

                    // vertex 5: [-0.5, 0.5]
                    arr[baseIdx + 40] = x; arr[baseIdx + 41] = y;
                    arr[baseIdx + 42] = u0; arr[baseIdx + 43] = v1;
                    arr[baseIdx + 44] = w; arr[baseIdx + 45] = h;
                    arr[baseIdx + 46] = -0.5; arr[baseIdx + 47] = 0.5;

                    vertexCount += 6;
                    self.markerBounds.set(marker.id, { x: x - w / 2, y: y - h / 2, width: w, height: h });
                }

                if (vertexCount === 0) return;

                const canvas = self.mapboxGL.getCanvas();
                const locs = self.attribLocations;
                const unis = self.uniformLocations;

                gl.useProgram(self.program);
                gl.bindBuffer(gl.ARRAY_BUFFER, self.vertexBuffer);
                // 필요한 부분만 업로드
                gl.bufferData(gl.ARRAY_BUFFER, self.vertexArray!.subarray(0, vertexCount * 8), gl.DYNAMIC_DRAW);

                const STRIDE = 8 * 4;
                gl.enableVertexAttribArray(locs.position);
                gl.vertexAttribPointer(locs.position, 2, gl.FLOAT, false, STRIDE, 0);

                gl.enableVertexAttribArray(locs.texCoord);
                gl.vertexAttribPointer(locs.texCoord, 2, gl.FLOAT, false, STRIDE, 8);

                gl.enableVertexAttribArray(locs.size);
                gl.vertexAttribPointer(locs.size, 2, gl.FLOAT, false, STRIDE, 16);

                gl.enableVertexAttribArray(locs.offset);
                gl.vertexAttribPointer(locs.offset, 2, gl.FLOAT, false, STRIDE, 24);

                gl.uniform2fv(unis.resolution, [canvas.width, canvas.height]);
                gl.uniform1i(unis.texture, 0);

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, self.texture);
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
            },
        };

        this.mapboxGL.addLayer(customLayer);
    }

    private getSpriteKey(marker: MarkerData): string {
        const isSelected = marker.id === this.selectedMarkerId;
        const typeInfo = getTypeLabel(marker.propertyType, marker.jibun);

        // 거래일자 (YY.MM)
        let dateStr = '';
        if (marker.transactionDate) {
            const d = new Date(marker.transactionDate);
            dateStr = `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}`;
        }

        // 면적 (평)
        const areaPyeong = marker.area && marker.area > 0
            ? Math.round(marker.area / SQM_PER_PYEONG).toString()
            : '';

        // 최근 거래 여부
        let isRecent = false;
        if (marker.transactionDate) {
            const txDate = new Date(marker.transactionDate);
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            isRecent = txDate >= threeMonthsAgo;
        }

        return `${isSelected ? 'sel' : 'def'}:${typeInfo.label}:${typeInfo.color}:${marker.price}:${dateStr}:${areaPyeong}:${isRecent ? 'N' : ''}`;
    }

    private async buildAtlasAsync(): Promise<void> {
        const ctx = this.atlasCtx;
        const neededKeys = new Set<string>();

        for (const marker of this.markers) {
            neededKeys.add(this.getSpriteKey(marker));
        }

        // 아틀라스 초기화 (새로운 마커 세트)
        ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
        this.spriteCache.clear();
        this.atlasCursor = { x: 0, y: 0, rowHeight: 0 };

        // 순차 처리 (atlasCursor 충돌 방지) - DOM 캡처는 순서대로!
        const keysArray = Array.from(neededKeys);

        for (const key of keysArray) {
            const parts = key.split(':');
            const isSelected = parts[0] === 'sel';
            const typeLabel = parts[1];
            const typeColor = parts[2];
            const price = parts[3];
            const dateStr = parts[4];
            const areaPyeong = parts[5];
            const isRecent = parts[6] === 'N';

            // DOM 캡처로 픽셀 퍼펙트 마커 생성
            const sprite = await this.drawMarkerSpriteFromDOM(ctx, {
                isSelected,
                typeLabel,
                typeColor,
                price,
                dateStr,
                areaPyeong,
                isRecent,
            });

            if (sprite) {
                this.spriteCache.set(key, sprite);
            }
        }

        logger.log(`🎨 [CanvasMarkerRenderer] 아틀라스 빌드 완료: ${this.spriteCache.size}개 스프라이트`);
    }

    // html-to-image로 실제 DOM을 캡처하여 Canvas에 그리기
    private async drawMarkerSpriteFromDOM(
        ctx: CanvasRenderingContext2D,
        data: {
            isSelected: boolean;
            typeLabel: string;
            typeColor: string;
            price: string;
            dateStr: string;
            areaPyeong: string;
            isRecent: boolean;
        }
    ): Promise<CachedSprite | null> {
        const scale = SPRITE_SCALE;

        // DOM 마커 생성 (UnifiedMarkerLayer와 동일한 HTML)
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            left: -9999px;
            top: -9999px;
            z-index: -1;
        `;

        // N 뱃지
        const newBadgeHTML = data.isRecent && !data.isSelected ? `
            <span style="
                position: absolute;
                top: -6px;
                right: -6px;
                background: #EF4444;
                color: #fff;
                font-size: 9px;
                font-weight: 700;
                padding: 2px 4px;
                border-radius: 3px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                border: 1.5px solid #fff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">N</span>
        ` : '';

        // 2줄 (날짜, 평수)
        const secondLineHTML = (data.dateStr || data.areaPyeong) ? `
            <div style="
                font-size: 9px;
                color: #9CA3AF;
                margin-top: 1px;
                display: flex;
                gap: 4px;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                ${data.dateStr ? `<span>${data.dateStr}</span>` : ''}
                ${data.areaPyeong ? `<span>${data.areaPyeong}평</span>` : ''}
            </div>
        ` : '';

        const typeLabelHTML = `<span style="
            font-size: 10px;
            color: ${data.typeColor};
            font-weight: 500;
            margin-right: 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">${data.typeLabel}</span>`;

        const markerStyle = data.isSelected ? `
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            padding: 8px 10px;
            background: #ffffff;
            border-radius: 6px;
            border: 2px solid #3B82F6;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            position: relative;
            line-height: 1.2;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ` : `
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            padding: 4px 10px;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 100px;
            border: 1px solid rgba(200, 200, 200, 0.8);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
            position: relative;
            line-height: 1.2;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const priceStyle = data.isSelected
            ? `font-weight: 600; font-size: 15px; color: #1F2937; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`
            : `font-weight: 500; font-size: 12px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`;

        container.innerHTML = `
            <div style="${markerStyle}">
                ${newBadgeHTML}
                <div style="display: flex; align-items: center; white-space: nowrap;">
                    ${typeLabelHTML}
                    <span style="${priceStyle}">${data.price}</span>
                </div>
                ${secondLineHTML}
            </div>
        `;

        document.body.appendChild(container);

        try {
            const markerEl = container.firstElementChild as HTMLElement;

            // html-to-image로 캡처
            const dataUrl = await toPng(markerEl, {
                pixelRatio: scale,
                backgroundColor: undefined, // 투명 배경
                style: {
                    // 캡처 시 추가 스타일 (필요한 경우)
                },
            });

            // 이미지 로드
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = dataUrl;
            });

            // 여유 공간 (그림자, 뱃지용)
            const padding = 8 * scale;
            const width = img.width + padding * 2;
            const height = img.height + padding * 2;

            // 아틀라스 공간 체크
            if (this.atlasCursor.x + width > ATLAS_SIZE) {
                this.atlasCursor.x = 0;
                this.atlasCursor.y += this.atlasCursor.rowHeight + 4;
                this.atlasCursor.rowHeight = 0;
            }

            if (this.atlasCursor.y + height > ATLAS_SIZE) {
                document.body.removeChild(container);
                logger.warn('[CanvasMarkerRenderer] 아틀라스 공간 부족');
                return null;
            }

            const spriteX = this.atlasCursor.x;
            const spriteY = this.atlasCursor.y;

            // Canvas에 그리기
            ctx.drawImage(img, spriteX + padding, spriteY + padding);

            // 커서 업데이트
            this.atlasCursor.x += width + 4;
            this.atlasCursor.rowHeight = Math.max(this.atlasCursor.rowHeight, height);

            document.body.removeChild(container);
            return { x: spriteX, y: spriteY, width, height };
        } catch (error) {
            document.body.removeChild(container);
            logger.error('[CanvasMarkerRenderer] DOM 캡처 실패:', error);
            throw error; // 폴백 없이 실패 전파
        }
    }

    private handleMapClick = (e: any) => {
        if (!this.onClick) return;

        const { x, y } = e.point;

        for (const marker of this.markers) {
            const bounds = this.markerBounds.get(marker.id);
            if (!bounds) continue;

            if (x >= bounds.x && x <= bounds.x + bounds.width &&
                y >= bounds.y && y <= bounds.y + bounds.height) {
                this.onClick(marker);
                return;
            }
        }
    };

    // ========== 외부 API ==========

    updateMarkers(markers: MarkerData[]) {
        this.markers = markers;
        // 정렬을 여기서 한 번만 수행 (남쪽 마커가 위에 오도록)
        this.sortedMarkers = [...markers].sort((a, b) => b.lat - a.lat);
        this.atlasNeedsUpdate = true;
        this.mapboxGL.triggerRepaint();
    }

    setSelectedMarkerId(markerId: string | null) {
        if (this.selectedMarkerId !== markerId) {
            this.selectedMarkerId = markerId;
            this.atlasNeedsUpdate = true;
            this.mapboxGL.triggerRepaint();
        }
    }

    setOnClick(callback: (marker: MarkerData) => void) {
        this.onClick = callback;
    }

    destroy() {
        this.mapboxGL.off('click', this.handleMapClick);

        if (this.mapboxGL.getLayer(LAYER_ID)) {
            this.mapboxGL.removeLayer(LAYER_ID);
        }

        this.markerBounds.clear();
        this.spriteCache.clear();
        this.vertexArray = null;

        logger.log('🎨 [CanvasMarkerRenderer] 정리 완료');
    }
}
