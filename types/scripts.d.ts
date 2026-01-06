// types/scripts.d.ts - 스크립트 전용 타입 선언

// @mapbox/polylabel 타입 선언
declare module '@mapbox/polylabel' {
    function polylabel(polygon: number[][][], precision?: number): [number, number];
    export = polylabel;
}

// vt-pbf 타입 선언
declare module 'vt-pbf' {
    function vtPbf(data: any): Uint8Array;
    namespace vtPbf {
        function fromGeojsonVt(layers: Record<string, any>, options?: { version?: number }): Uint8Array;
    }
    export = vtPbf;
}

// jsdom 타입 선언 (이미 @types/jsdom이 있으면 무시됨)
declare module 'jsdom' {
    export class JSDOM {
        constructor(html: string, options?: any);
        window: Window;
    }
}
