// scripts/types.d.ts
// 외부 모듈 타입 선언

declare module 'shapefile' {
    interface ShapefileSource {
        read(): Promise<{ done: boolean; value: any }>;
    }

    function open(
        shpPath: string,
        dbfPath?: string | undefined,
        options?: { encoding?: string }
    ): Promise<ShapefileSource>;

    export { open };
}

declare module 'geojson-vt' {
    interface GeoJSONVTOptions {
        maxZoom?: number;
        tolerance?: number;
        buffer?: number;
        indexMaxZoom?: number;
        indexMaxPoints?: number;
        extent?: number;
        lineMetrics?: boolean;
        promoteId?: string;
        generateId?: boolean;
        debug?: number;
    }

    interface TileFeature {
        type: number;
        geometry: number[];
        tags: Record<string, any>;
    }

    interface Tile {
        features: TileFeature[];
        numPoints: number;
        numSimplified: number;
        numFeatures: number;
        source: any;
        x: number;
        y: number;
        z: number;
        transformed: boolean;
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    }

    interface GeoJSONVT {
        getTile(z: number, x: number, y: number): Tile | null;
        options: GeoJSONVTOptions;
        splitTile: (features: any[], z: number, x: number, y: number) => void;
    }

    function geojsonVt(data: any, options?: GeoJSONVTOptions): GeoJSONVT;
    export default geojsonVt;
}
