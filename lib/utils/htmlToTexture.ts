// lib/utils/htmlToTexture.ts
// HTML/CSS를 WebGL 텍스처로 변환하는 유틸리티
// html2canvas 사용 (foreignObject보다 안정적)

import html2canvas from 'html2canvas';

/**
 * DOM 요소를 Canvas로 변환 (html2canvas 사용)
 */
export async function domToCanvas(
    element: HTMLElement,
    scale: number = 2
): Promise<HTMLCanvasElement> {
    // 임시로 DOM에 추가하여 크기 측정
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;';
    container.appendChild(element);
    document.body.appendChild(container);

    // 잠시 대기하여 스타일 적용
    await new Promise(resolve => setTimeout(resolve, 10));

    try {
        const canvas = await html2canvas(element, {
            scale,
            backgroundColor: null, // 투명 배경
            logging: false,
            useCORS: true,
            allowTaint: true,
        });

        return canvas;
    } finally {
        // DOM에서 제거
        document.body.removeChild(container);
    }
}

/**
 * Canvas를 WebGL 텍스처로 변환
 */
export function canvasToTexture(
    gl: WebGLRenderingContext,
    canvas: HTMLCanvasElement
): WebGLTexture {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
}

/**
 * DOM 요소를 직접 WebGL 텍스처로 변환 (통합 함수)
 */
export async function domToTexture(
    gl: WebGLRenderingContext,
    element: HTMLElement,
    scale: number = 2
): Promise<{ texture: WebGLTexture; width: number; height: number; actualWidth: number; actualHeight: number }> {
    const canvas = await domToCanvas(element, scale);
    const texture = canvasToTexture(gl, canvas);
    return {
        texture,
        width: canvas.width,
        height: canvas.height,
        actualWidth: canvas.width / scale,
        actualHeight: canvas.height / scale,
    };
}

/**
 * 텍스처 캐시 관리자
 */
export class TextureCache {
    private cache: Map<string, { texture: WebGLTexture; width: number; height: number }> = new Map();
    private gl: WebGLRenderingContext;

    constructor(gl: WebGLRenderingContext) {
        this.gl = gl;
    }

    async getOrCreate(
        key: string,
        createFn: () => HTMLElement,
        scale: number = 2
    ): Promise<{ texture: WebGLTexture; width: number; height: number }> {
        if (this.cache.has(key)) {
            return this.cache.get(key)!;
        }

        const element = createFn();
        const result = await domToTexture(this.gl, element, scale);
        const cached = {
            texture: result.texture,
            width: result.actualWidth,
            height: result.actualHeight,
        };
        this.cache.set(key, cached);
        return cached;
    }

    has(key: string): boolean {
        return this.cache.has(key);
    }

    get(key: string): { texture: WebGLTexture; width: number; height: number } | undefined {
        return this.cache.get(key);
    }

    delete(key: string): void {
        const cached = this.cache.get(key);
        if (cached) {
            this.gl.deleteTexture(cached.texture);
            this.cache.delete(key);
        }
    }

    clear(): void {
        this.cache.forEach(({ texture }) => {
            this.gl.deleteTexture(texture);
        });
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }
}
