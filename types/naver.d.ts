// types/naver.d.ts
// 네이버 지도 API 타입 선언

declare namespace naver {
    namespace maps {
        class Map {
            constructor(element: HTMLElement | string, options?: MapOptions);
            getCenter(): LatLng;
            setCenter(latlng: LatLng | LatLngLiteral): void;
            getZoom(): number;
            setZoom(zoom: number): void;
            getBounds(): LatLngBounds;
            panTo(latlng: LatLng | LatLngLiteral): void;
            fitBounds(bounds: LatLngBounds | LatLngBoundsLiteral): void;
            destroy(): void;
            setOptions(options: MapOptions): void;
            getProjection(): MapSystemProjection;
            getPanes(): MapPanes;
            addListener(eventName: string, handler: (...args: unknown[]) => void): MapEventListener;
            removeListener(listeners: MapEventListener | MapEventListener[]): void;
            morph(latlng: LatLng | LatLngLiteral, zoom: number, options?: { duration?: number }): void;
        }

        class LatLng {
            constructor(lat: number, lng: number);
            lat(): number;
            lng(): number;
            x: number;
            y: number;
        }

        class LatLngBounds {
            constructor(sw: LatLng, ne: LatLng);
            getSW(): LatLng;
            getNE(): LatLng;
            getMin(): LatLng;
            getMax(): LatLng;
            extend(latlng: LatLng): LatLngBounds;
            minX(): number;
            minY(): number;
            maxX(): number;
            maxY(): number;
        }

        class Point {
            constructor(x: number, y: number);
            x: number;
            y: number;
        }

        class Size {
            constructor(width: number, height: number);
            width: number;
            height: number;
        }

        class Marker {
            constructor(options: MarkerOptions);
            setMap(map: Map | null): void;
            getMap(): Map | null;
            setPosition(position: LatLng | LatLngLiteral): void;
            getPosition(): LatLng;
            setIcon(icon: string | ImageIcon | HtmlIcon | SymbolIcon): void;
            setVisible(visible: boolean): void;
            setZIndex(zIndex: number): void;
            addListener(eventName: string, handler: (...args: unknown[]) => void): MapEventListener;
        }

        class OverlayView {
            constructor();
            setMap(map: Map | null): void;
            getMap(): Map | null;
            getPanes(): MapPanes;
            getProjection(): MapSystemProjection;
            draw(): void;
            onAdd(): void;
            onRemove(): void;
        }

        class Polyline {
            constructor(options: PolylineOptions);
            setMap(map: Map | null): void;
            setPath(path: LatLng[] | LatLngLiteral[]): void;
            getPath(): LatLng[];
        }

        class Polygon {
            constructor(options: PolygonOptions);
            setMap(map: Map | null): void;
            setPaths(paths: LatLng[][] | LatLngLiteral[][]): void;
            getPaths(): LatLng[][];
        }

        class InfoWindow {
            constructor(options: InfoWindowOptions);
            open(map: Map, anchor?: Marker | LatLng): void;
            close(): void;
            setContent(content: string | HTMLElement): void;
            setPosition(position: LatLng | LatLngLiteral): void;
        }

        class CustomOverlay extends OverlayView {
            constructor(options: CustomOverlayOptions);
            setPosition(position: LatLng | LatLngLiteral): void;
            getPosition(): LatLng;
            setVisible(visible: boolean): void;
        }

        interface CustomOverlayOptions {
            content?: string | HTMLElement;
            position?: LatLng | LatLngLiteral;
            map?: Map;
            zIndex?: number;
            anchor?: Point;
        }

        type Bounds = LatLngBounds;

        interface MapOptions {
            center?: LatLng | LatLngLiteral;
            zoom?: number;
            minZoom?: number;
            maxZoom?: number;
            gl?: boolean;  // GL 벡터 맵 활성화
            draggable?: boolean;
            pinchZoom?: boolean;
            scrollWheel?: boolean;
            keyboardShortcuts?: boolean;
            disableDoubleClickZoom?: boolean;
            disableDoubleTapZoom?: boolean;
            disableTwoFingerTapZoom?: boolean;
            tileTransition?: boolean;
            mapTypes?: MapTypeRegistry;
            mapTypeId?: string;
            mapDataControl?: boolean;
            logoControl?: boolean;
            logoControlOptions?: LogoControlOptions;
            scaleControl?: boolean;
            scaleControlOptions?: ScaleControlOptions;
            zoomControl?: boolean;
            zoomControlOptions?: ZoomControlOptions;
        }

        interface LatLngLiteral {
            lat: number;
            lng: number;
        }

        interface LatLngBoundsLiteral {
            south: number;
            west: number;
            north: number;
            east: number;
        }

        interface MarkerOptions {
            position: LatLng | LatLngLiteral;
            map?: Map;
            icon?: string | ImageIcon | HtmlIcon | SymbolIcon;
            title?: string;
            clickable?: boolean;
            draggable?: boolean;
            visible?: boolean;
            zIndex?: number;
        }

        interface ImageIcon {
            url: string;
            size?: Size;
            origin?: Point;
            anchor?: Point;
            scaledSize?: Size;
        }

        interface HtmlIcon {
            content: string | HTMLElement;
            size?: Size;
            anchor?: Point;
        }

        interface SymbolIcon {
            path: SymbolPath | string;
            style?: string;
            radius?: number;
            fillColor?: string;
            fillOpacity?: number;
            strokeColor?: string;
            strokeWeight?: number;
            strokeOpacity?: number;
            anchor?: Point;
        }

        interface PolylineOptions {
            map?: Map;
            path: LatLng[] | LatLngLiteral[];
            strokeColor?: string;
            strokeWeight?: number;
            strokeOpacity?: number;
            strokeStyle?: string;
            strokeLineCap?: string;
            strokeLineJoin?: string;
            clickable?: boolean;
            visible?: boolean;
            zIndex?: number;
        }

        interface PolygonOptions {
            map?: Map;
            paths: LatLng[][] | LatLngLiteral[][];
            fillColor?: string;
            fillOpacity?: number;
            strokeColor?: string;
            strokeWeight?: number;
            strokeOpacity?: number;
            strokeStyle?: string;
            clickable?: boolean;
            visible?: boolean;
            zIndex?: number;
        }

        interface InfoWindowOptions {
            content?: string | HTMLElement;
            position?: LatLng | LatLngLiteral;
            maxWidth?: number;
            backgroundColor?: string;
            borderColor?: string;
            borderWidth?: number;
            anchorSize?: Size;
            anchorColor?: string;
            pixelOffset?: Point;
            disableAnchor?: boolean;
            disableAutoPan?: boolean;
        }

        interface MapPanes {
            overlayLayer: HTMLElement;
            overlayImage: HTMLElement;
            floatPane: HTMLElement;
        }

        interface MapSystemProjection {
            fromCoordToOffset(coord: LatLng): Point;
            fromOffsetToCoord(offset: Point): LatLng;
            fromCoordToPoint(coord: LatLng): Point;
            fromPointToCoord(point: Point): LatLng;
        }

        interface MapEventListener {
            eventName: string;
            listener: (...args: unknown[]) => void;
            target: unknown;
        }

        interface LogoControlOptions {
            position: Position;
        }

        interface ScaleControlOptions {
            position: Position;
        }

        interface ZoomControlOptions {
            position: Position;
            style?: ZoomControlStyle;
        }

        type MapTypeRegistry = unknown;
        type SymbolPath = unknown;
        type ZoomControlStyle = unknown;

        // MapTypeId 열거형
        const MapTypeId: {
            NORMAL: string;
            TERRAIN: string;
            SATELLITE: string;
            HYBRID: string;
        };

        // Position 열거형
        const Position: {
            CENTER: number;
            TOP: number;
            TOP_LEFT: number;
            TOP_RIGHT: number;
            LEFT: number;
            RIGHT: number;
            BOTTOM: number;
            BOTTOM_LEFT: number;
            BOTTOM_RIGHT: number;
        };

        namespace Event {
            function addListener(
                target: Map | Marker | Polyline | Polygon | OverlayView,
                eventName: string,
                handler: (...args: unknown[]) => void
            ): MapEventListener;
            function removeListener(listener: MapEventListener): void;
            function trigger(target: unknown, eventName: string, ...args: unknown[]): void;
            function clearInstanceListeners(target: Map | Marker | Polyline | Polygon | OverlayView): void;
        }
    }
}

// 전역 변수 선언
declare const naver: typeof naver;
