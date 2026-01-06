// types/global.d.ts
// 전역 Window 인터페이스 확장

interface Window {
    // 마커 클릭 플래그 (폴리곤과 충돌 방지)
    __markerClicking?: boolean;

    // 디버그용 네이버 지도 인스턴스
    __NAVER_MAP__?: naver.maps.Map;
    __MAPBOX_GL__?: any;  // Mapbox GL 인스턴스
    __naverMap?: naver.maps.Map;
    __mapboxGL?: any;

    // 도로 포커스 디버그 함수
    __toggleRoadFocus__?: (enabled: boolean) => void;
    __highlightRoad__?: (roadName: string) => void;

    // Mapbox GL 라이브러리
    mapboxgl?: any;

    // 네이버 지도 라이브러리
    naver?: typeof naver;
}
