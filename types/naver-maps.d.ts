// 네이버 지도 API v3 타입 정의

declare namespace naver.maps {
    // 지도 클래스
    class Map {
        constructor(element: HTMLElement | string, options?: MapOptions);
        setCenter(center: LatLng | LatLngLiteral): void;
        getCenter(): LatLng;
        setZoom(zoom: number, effect?: boolean): void;
        getZoom(): number;
        setBounds(bounds: LatLngBounds): void;
        getBounds(): LatLngBounds;
        fitBounds(bounds: LatLngBounds, margin?: Margin): void;
        setMapTypeId(mapTypeId: MapTypeId): void;
        getMapTypeId(): MapTypeId;
        addListener(event: string, listener: Function): MapEventListener;
        removeListener(listener: MapEventListener): void;
        getPanes(): MapPanes;
        getProjection(): Projection;
        panTo(coord: LatLng | LatLngLiteral, transition?: boolean): void;
        panBy(x: number, y: number): void;
        destroy(): void;
    }

    // 좌표 클래스
    class LatLng {
        constructor(lat: number, lng: number);
        lat(): number;
        lng(): number;
        equals(other: LatLng): boolean;
        clone(): LatLng;
        x: number;
        y: number;
    }

    // 경계 클래스
    class LatLngBounds {
        constructor(sw: LatLng | LatLngLiteral, ne: LatLng | LatLngLiteral);
        getSW(): LatLng;
        getNE(): LatLng;
        extend(coord: LatLng | LatLngLiteral): LatLngBounds;
        union(other: LatLngBounds): LatLngBounds;
        equals(other: LatLngBounds): boolean;
        hasLatLng(coord: LatLng | LatLngLiteral): boolean;
        minX(): number;
        minY(): number;
        maxX(): number;
        maxY(): number;
    }

    // 마커 클래스
    class Marker {
        constructor(options: MarkerOptions);
        setMap(map: Map | null): void;
        getMap(): Map | null;
        setPosition(position: LatLng | LatLngLiteral): void;
        getPosition(): LatLng;
        setIcon(icon: ImageIcon | SymbolIcon | HtmlIcon): void;
        setVisible(visible: boolean): void;
        getVisible(): boolean;
        setZIndex(zIndex: number): void;
        getZIndex(): number;
        addListener(event: string, listener: Function): MapEventListener;
        removeListener(listener: MapEventListener): void;
    }

    // 폴리곤 클래스
    class Polygon {
        constructor(options: PolygonOptions);
        setMap(map: Map | null): void;
        getMap(): Map | null;
        setPaths(paths: ArrayOfCoords | ArrayOfArrayOfCoords): void;
        getPaths(): ArrayOfCoords[];
        setOptions(options: PolygonOptions): void;
        setVisible(visible: boolean): void;
        getVisible(): boolean;
        addListener(event: string, listener: Function): MapEventListener;
        removeListener(listener: MapEventListener): void;
    }

    // 폴리라인 클래스
    class Polyline {
        constructor(options: PolylineOptions);
        setMap(map: Map | null): void;
        getMap(): Map | null;
        setPath(path: ArrayOfCoords): void;
        getPath(): ArrayOfCoords;
        setOptions(options: PolylineOptions): void;
        setVisible(visible: boolean): void;
        getVisible(): boolean;
        addListener(event: string, listener: Function): MapEventListener;
        removeListener(listener: MapEventListener): void;
    }

    // 원 클래스
    class Circle {
        constructor(options: CircleOptions);
        setMap(map: Map | null): void;
        getMap(): Map | null;
        setCenter(center: LatLng | LatLngLiteral): void;
        getCenter(): LatLng;
        setRadius(radius: number): void;
        getRadius(): number;
        setOptions(options: CircleOptions): void;
        setVisible(visible: boolean): void;
        getVisible(): boolean;
        addListener(event: string, listener: Function): MapEventListener;
        removeListener(listener: MapEventListener): void;
    }

    // 커스텀 오버레이
    class CustomOverlay {
        constructor(options: CustomOverlayOptions);
        setMap(map: Map | null): void;
        getMap(): Map | null;
        setPosition(position: LatLng | LatLngLiteral): void;
        getPosition(): LatLng;
        draw(): void;
        onAdd(): void;
        onRemove(): void;
        getPanes(): MapPanes;
        getProjection(): Projection;
    }

    // 이벤트 리스너
    class MapEventListener {
        // 이벤트 리스너 타입
    }

    // 투영 변환
    class Projection {
        fromCoordToOffset(coord: LatLng): Point;
        fromOffsetToCoord(offset: Point): LatLng;
        fromCoordToPoint(coord: LatLng): Point;
        fromPointToCoord(point: Point): LatLng;
    }

    // 포인트
    class Point {
        constructor(x: number, y: number);
        x: number;
        y: number;
        clone(): Point;
        equals(other: Point): boolean;
    }

    // 사이즈
    class Size {
        constructor(width: number, height: number);
        width: number;
        height: number;
        clone(): Size;
        equals(other: Size): boolean;
    }

    // 이벤트 네임스페이스
    namespace Event {
        function addListener(target: any, type: string, listener: Function): MapEventListener;
        function addDOMListener(target: any, type: string, listener: Function): MapEventListener;
        function removeListener(listener: MapEventListener): void;
        function clearInstanceListeners(target: any): void;
        function trigger(target: any, type: string, eventArguments?: any): void;
        function stopEvent(event: any): void;
    }

    // 지도 옵션
    interface MapOptions {
        center?: LatLng | LatLngLiteral;
        zoom?: number;
        minZoom?: number;
        maxZoom?: number;
        zoomControl?: boolean;
        zoomControlOptions?: ZoomControlOptions;
        mapTypeControl?: boolean;
        mapTypeControlOptions?: MapTypeControlOptions;
        mapTypeId?: MapTypeId;
        scaleControl?: boolean;
        logoControl?: boolean;
        mapDataControl?: boolean;
        draggable?: boolean;
        pinchZoom?: boolean;
        scrollWheel?: boolean;
        keyboardShortcuts?: boolean;
        disableDoubleClickZoom?: boolean;
        disableDoubleTapZoom?: boolean;
        disableTwoFingerTapZoom?: boolean;
        tileTransition?: boolean;
        background?: string;
        // GL 벡터맵 옵션
        gl?: boolean;
        customStyleId?: string;
    }

    // 좌표 리터럴
    interface LatLngLiteral {
        lat: number;
        lng: number;
    }

    // 마커 옵션
    interface MarkerOptions {
        position: LatLng | LatLngLiteral;
        map?: Map | null;
        icon?: ImageIcon | SymbolIcon | HtmlIcon | string;
        title?: string;
        cursor?: string;
        clickable?: boolean;
        draggable?: boolean;
        visible?: boolean;
        zIndex?: number;
        animation?: Animation;
    }

    // 폴리곤 옵션
    interface PolygonOptions {
        map?: Map | null;
        paths?: ArrayOfCoords | ArrayOfArrayOfCoords;
        fillColor?: string;
        fillOpacity?: number;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
        strokeStyle?: StrokeStyleType;
        clickable?: boolean;
        visible?: boolean;
        zIndex?: number;
    }

    // 폴리라인 옵션
    interface PolylineOptions {
        map?: Map | null;
        path: ArrayOfCoords;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
        strokeStyle?: StrokeStyleType;
        strokeLineCap?: 'butt' | 'round' | 'square';
        strokeLineJoin?: 'miter' | 'round' | 'bevel';
        clickable?: boolean;
        visible?: boolean;
        zIndex?: number;
        startIcon?: SymbolIcon;
        endIcon?: SymbolIcon;
    }

    // 원 옵션
    interface CircleOptions {
        map?: Map | null;
        center: LatLng | LatLngLiteral;
        radius: number;
        fillColor?: string;
        fillOpacity?: number;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
        strokeStyle?: StrokeStyleType;
        clickable?: boolean;
        visible?: boolean;
        zIndex?: number;
    }

    // 커스텀 오버레이 옵션
    interface CustomOverlayOptions {
        map?: Map | null;
        position: LatLng | LatLngLiteral;
        content: string | HTMLElement;
        zIndex?: number;
    }

    // 좌표 배열
    type ArrayOfCoords = Array<LatLng | LatLngLiteral>;
    type ArrayOfArrayOfCoords = Array<ArrayOfCoords>;

    // 지도 타입 ID
    type MapTypeId = 'NORMAL' | 'TERRAIN' | 'SATELLITE' | 'HYBRID';

    // 지도 타입 열거형
    enum MapTypeId {
        NORMAL = 'NORMAL',
        TERRAIN = 'TERRAIN',
        SATELLITE = 'SATELLITE',
        HYBRID = 'HYBRID',
    }

    // 애니메이션
    enum Animation {
        BOUNCE = 1,
        DROP = 2,
    }

    // 선 스타일
    type StrokeStyleType = 'solid' | 'shortdash' | 'shortdot' | 'shortdashdot' | 'shortdashdotdot' | 'dot' | 'dash' | 'longdash' | 'dashdot' | 'longdashdot' | 'longdashdotdot';

    // 아이콘 타입
    interface ImageIcon {
        url: string;
        size?: Size;
        scaledSize?: Size;
        origin?: Point;
        anchor?: Point;
    }

    interface SymbolIcon {
        path: SymbolPath | string;
        style?: SymbolStyle;
        anchor?: Point;
        fillColor?: string;
        fillOpacity?: number;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
    }

    interface HtmlIcon {
        content: string | HTMLElement;
        size?: Size;
        anchor?: Point;
    }

    enum SymbolPath {
        CIRCLE = 1,
        BACKWARD_CLOSED_ARROW = 2,
        FORWARD_CLOSED_ARROW = 3,
        BACKWARD_OPEN_ARROW = 4,
        FORWARD_OPEN_ARROW = 5,
    }

    enum SymbolStyle {
        FILL = 0,
        STROKE = 1,
    }

    // 컨트롤 옵션
    interface ZoomControlOptions {
        position?: Position;
        style?: ZoomControlStyle;
    }

    interface MapTypeControlOptions {
        position?: Position;
        mapTypeIds?: MapTypeId[];
    }

    enum Position {
        TOP_LEFT = 1,
        TOP_CENTER = 2,
        TOP_RIGHT = 3,
        LEFT_CENTER = 4,
        CENTER = 5,
        RIGHT_CENTER = 6,
        BOTTOM_LEFT = 7,
        BOTTOM_CENTER = 8,
        BOTTOM_RIGHT = 9,
    }

    enum ZoomControlStyle {
        LARGE = 1,
        SMALL = 2,
    }

    // 지도 Panes
    interface MapPanes {
        floatPane: HTMLElement;
        overlayLayer: HTMLElement;
        overlayImage: HTMLElement;
        overlayMouseTarget: HTMLElement;
        floatPane2: HTMLElement;
    }

    // Margin
    interface Margin {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
    }

    // TransCoord - 좌표 변환
    namespace TransCoord {
        function fromTM128ToLatLng(tm128: Point): LatLng;
        function fromLatLngToTM128(latlng: LatLng): Point;
        function fromEPSG3857ToLatLng(epsg3857: Point): LatLng;
        function fromLatLngToEPSG3857(latlng: LatLng): Point;
        function fromUTMKToLatLng(utmk: Point): LatLng;
        function fromLatLngToUTMK(latlng: LatLng): Point;
    }
}

// Window 인터페이스 확장
interface Window {
    naver: typeof naver;
}

declare const naver: {
    maps: typeof naver.maps;
};
