// types/data.ts - 모든 데이터 타입의 Single Source of Truth

// ===== 공통 타입 =====

/** 통일된 좌표 형식 (GeoJSON 표준) */
export type Coordinate = [number, number]; // [lng, lat]

/** 폴리곤 지오메트리 (클라이언트에서는 사용 안함, MVT가 처리) */
export type PolygonGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon | null;

// ===== 필지 (Parcel) =====

/** 필지 기본 정보 (초기 로딩용, 최소 데이터) */
export interface ParcelIndex {
    pnu?: string;         // PNU (19자리) - 단일 ID 필드 (optional: 일부 필지는 PNU 없을 수 있음)
    center: Coordinate;   // 폴리라벨 중심점 [lng, lat]
    type: number;         // 비트 플래그: 1=실거래, 2=매물, 4=경매
    /**
     * @deprecated pnu를 사용하세요
     */
    id?: string;
    /**
     * @deprecated center를 사용하세요
     */
    coord?: Coordinate;
}

/** 매물 유형 */
export type PropertyType = 'factory' | 'knowledge-center' | 'warehouse' | 'land';

/** 거래 이력 기본 정보 (마커용 최소 데이터) */
export interface TransactionBase {
    date: string;    // YYYY-MM-DD
    price: number;   // 만원
}

/** 거래 이력 (축약형, TransactionBase 별칭) */
export type TransactionHistory = TransactionBase;

// ===== 토지대장/건축물대장 (Ledger) =====

/** 토지대장 정보 (브이월드 API 기반) */
export interface LandLedger {
    lndpclAr: number;           // 면적(㎡) - 공부상 면적
    lndcgrCode: string;         // 지목코드
    lndcgrCodeNm: string;       // 지목명 (대, 공장용지, 창고용지 등)
    posesnSeCode: string;       // 소유구분코드
    posesnSeCodeNm: string;     // 소유구분명 (개인, 법인, 국유지 등)
    lastUpdtDt: string;         // 데이터기준일자
}

/** 건축물대장 정보 (공공데이터 API 기반) */
export interface BuildingLedger {
    archArea: number;           // 건축면적(㎡)
    totArea: number;            // 연면적(㎡)
    platArea: number;           // 대지면적(㎡)
    mainPurpsCdNm: string;      // 주용도 (공장, 창고시설 등)
    grndFlrCnt: number;         // 지상층수
    ugrndFlrCnt: number;        // 지하층수
    bcRat: number;              // 건폐율(%)
    vlRat: number;              // 용적률(%)
    strctCdNm: string;          // 구조 (철골구조, 철근콘크리트 등)
    heit: number;               // 높이(m)
    useAprDay: string;          // 사용승인일
}

/** 필지 마커 데이터 (마커 렌더링용) - Single Source of Truth */
export interface ParcelMarkerData extends ParcelIndex {
    area: number;                    // 면적 (㎡)
    transactionPrice?: number;       // 최근 실거래가 (만원)
    listingPrice?: number;           // 매물 최저가 (만원)
    auctionPrice?: number;           // 경매 최저가 (만원)
    sigCode?: string;                // 시군구 코드
    emdCode?: string;                // 읍면동 코드
    jibun?: string;                  // 지번
    dealType?: '매매' | '전세' | '월세' | string;  // 거래유형
    auctionFailCount?: number;       // 경매 유찰 횟수
    propertyType?: PropertyType;     // 매물 유형 (공장/지산센/창고/토지)
    transactions?: TransactionHistory[];  // 거래 이력 (증감률 계산용)
    landLedger?: LandLedger;         // 토지대장 정보
    buildingLedger?: BuildingLedger; // 건축물대장 정보
}

/** 데이터 경로 상수 */
export const DATA_PATHS = {
    // Geometry (PMTiles) - 불변, 폴리곤만
    geometry: {
        parcels: '/data/geometry/parcels.pmtiles',
        complex: '/data/geometry/complex.pmtiles',
        lots: '/data/geometry/lots.pmtiles',
        industries: '/data/geometry/industries.pmtiles',
        sido: '/data/geometry/sido.pmtiles',
        sig: '/data/geometry/sig.pmtiles',
        emd: '/data/geometry/emd.pmtiles',
    },
    // Entities (JSON) - 비즈니스 데이터
    entities: {
        parcels: '/data/entities/parcels.json',
        complexes: '/data/entities/complexes.json',
        factories: '/data/entities/factories.json',
        factoriesIndex: '/data/entities/factories-index.json',
        factoryContours: '/data/entities/factory-contours.json',
        knowledgeCenters: '/data/entities/knowledge-centers.json',
        knowledgeCentersIndex: '/data/entities/knowledge-centers-index.json',
        lots: '/data/entities/lots.json',
        industries: '/data/entities/industries.json',
        districtsSido: '/data/entities/districts-sido.json',
        districtsSig: '/data/entities/districts-sig.json',
        districtsEmd: '/data/entities/districts-emd.json',
    },
} as const;

/** Parcel 타입 (ParcelDetail의 별칭, 호환성용) */
export type Parcel = ParcelDetail;

/** 건물 정보 */
export interface Building {
    id: string;
    name?: string;
    floors?: number;
    area?: number;
    usage?: string;
    use?: string;        // usage 별칭
    buildingArea?: number; // area 별칭
}

/** 필지 상세 정보 (클릭 시 API로 로드) */
export interface ParcelDetail extends ParcelMarkerData {
    pnu?: string;                    // PNU (id 별칭)
    jibun: string;                   // 지번
    address: string;                 // 전체 주소
    roadAddress?: string;            // 도로명 주소
    landUseType?: string;            // 용도지역
    officialLandPrice?: number;      // 공시지가 (원/㎡)
    transactions: Transaction[];     // 거래 내역
    listings: Listing[];             // 매물 목록
    auctions: Auction[];             // 경매 목록
    transactionDate?: string;        // 최근 거래일
    buildings?: Building[];          // 건물 정보
    factories?: Factory[];           // 공장 정보
    knowledgeIndustryCenters?: KnowledgeIndustryCenter[];  // 지식산업센터
    industrialComplexId?: string;    // 산업단지 ID
    knowledgeIndustryCenterId?: string; // 지식산업센터 ID
}

/** 실거래 내역 (상세 정보 포함) */
export interface Transaction extends TransactionBase {
    area?: number;         // 거래 면적
    type?: string;         // 거래 유형 (토지, 건물 등)
    dealType?: string;     // 거래 유형 (매매, 전세 등)
}

/** 매물 정보 */
export interface Listing {
    id: string;
    price: number;         // 만원
    area?: number;         // 면적
    dealType: '매매' | '전세' | '월세';
    deposit?: number;      // 보증금 (월세 시)
    monthly?: number;      // 월세
    source?: string;       // 출처
}

/** 경매 정보 */
export interface Auction {
    id: string;
    minPrice: number;      // 최저가 (만원)
    appraisedPrice: number; // 감정가 (만원)
    failCount: number;     // 유찰 횟수
    date: string;          // 경매일
    court?: string;        // 법원
    caseNo?: string;       // 사건번호
}

// ===== 행정구역 (District) =====

export interface District {
    id: string;            // 행정구역 코드
    code?: string;         // 코드 (id 별칭)
    name: string;          // 이름 (예: "남동구")
    coord: Coordinate;     // 중심점
    level: 'sido' | 'sig' | 'emd'; // 레벨
    parcelCount?: number;  // 필지 수
    listingCount?: number; // 매물 수
    auctionCount?: number; // 경매 수
    avgPrice?: number;     // 평균 실거래가
}

/** 행정구역 집계 데이터 */
export interface DistrictAggregation extends District {
    parcelCount: number;
    listingCount: number;
    auctionCount: number;
    avgPrice?: number;
    avgChangeRate?: number;
    // 레거시 호환 속성
    code?: string;                   // id 별칭
    regionCode?: string;             // id 별칭
    regionName?: string;             // name 별칭
    centroid?: { lat: number; lng: number }; // coord 대체
}

/** RegionAggregation 별칭 (호환성용) */
export type RegionAggregation = DistrictAggregation;

// ===== 산업단지 (IndustrialComplex) =====

/** 산업단지 조성 상태 */
export type ComplexStatus = '조성완료' | '조성중' | '미착공' | '계획중';

export interface IndustrialComplex {
    id: string;            // DAN_ID
    name: string;          // 산업단지명
    type: '국가' | '일반' | '농공' | '도시첨단' | string;
    coord: Coordinate;
    area: number;          // 면적 (㎡)
    sigCode?: string;      // 시군구 코드
    emdCode?: string;      // 읍면동 코드
    centroid?: { lat: number; lng: number }; // 중심점 (레거시 호환)
    // 마커 표시용 추가 필드
    status?: ComplexStatus;           // 조성 상태
    completionRate?: number;          // 조성률 (0~100%)
    salePricePerPyeong?: number;      // 평당 분양가 (만원)
    listingCount?: number;            // 매물 수
    auctionCount?: number;            // 경매 수
    // 광고 속성
    isAd?: boolean;                   // 광고 활성화 여부
    phoneNumber?: string;             // 전화번호
    thumbnailUrl?: string;            // 썸네일 이미지 URL
}

/** 산업단지 상세 (포커스 모드용) */
export interface IndustrialComplexDetail extends IndustrialComplex {
    lots: IndustrialLot[];
    industries: IndustryType[];
    developmentStatus?: string;  // 개발 상태
    // status는 IndustrialComplex에서 상속 (ComplexStatus)
}

export interface IndustrialLot {
    id: string;
    complexId: string;
    name?: string;
    type?: string;          // 용지 유형 코드 (100=공장용지, 200=지원시설 등)
    coord: Coordinate;
    area?: number;
}

export interface IndustryType {
    id?: string;
    complexId: string;
    name?: string;          // 업종명
    type?: string;          // 업종 코드
    coord: Coordinate;
}

// ===== 지식산업센터 =====

/** 지식산업센터 상태 */
export type KnowledgeCenterStatus = '완료신고' | '신설승인' | '변경승인' | '착공' | '미착공';

/** 지식산업센터 인덱스 (마커 렌더링용, ~40KB) */
export interface KnowledgeCenterIndex {
    id: string;
    name: string;            // 이름은 마커에 표시되어야 함
    coord: Coordinate | null;
    status: KnowledgeCenterStatus | string;
    pnu?: string;            // 필지 PNU (필지 클릭 시 매칭용)
    // 마커 표시용 추가 필드
    completionRate?: number;          // 완료율 (0~100%), 미완료 시 표시
    salePricePerPyeong?: number;      // 평당 분양가 (만원)
    listingCount?: number;            // 매물 수
    auctionCount?: number;            // 경매 수
    // 광고 속성
    isAd?: boolean;                   // 광고 활성화 여부
    phoneNumber?: string;             // 전화번호
    thumbnailUrl?: string;            // 썸네일 이미지 URL
}

/** 지식산업센터 상세 (클릭 시 로드) */
export interface KnowledgeIndustryCenter extends KnowledgeCenterIndex {
    coordinates?: [number, number]; // [lng, lat] (레거시 호환)
    roadAddress?: string;
    jibunAddress?: string;
    saleType?: '분양' | '임대' | string;
    landArea?: number;
    buildingArea?: number;
    floors?: number;
    sigName?: string;      // 시군구명
    complexName?: string;  // 단지명
}

// ===== 공장 =====

/** 공장 인덱스 (마커 렌더링용, ~500KB for 14,000개) */
export interface FactoryIndex {
    id: string;
    name: string;            // 이름은 마커에 표시되어야 함
    coord: Coordinate | null;
    businessType?: string;   // 업종 (필터링/색상용)
    pnu?: string;            // 필지 PNU (필지 클릭 시 매칭용)
}

/** 공장 상세 (클릭 시 로드) */
export interface Factory extends FactoryIndex {
    coordinates?: [number, number]; // [lng, lat] (레거시 호환)
    address: string;
    employeeCount?: number;
    area?: number;
    buildingArea?: number;          // 건축면적
    sigName?: string;               // 시군구명
    knowledgeCenterName?: string;   // 지식산업센터명
}

// ===== UI 상태 타입 =====

export type LayerType =
    | 'parcel'
    | 'administrative-sig'
    | 'administrative-emd'
    | 'industrial-complex'
    | 'industrial-lot'
    | 'industry-type'
    | 'knowledge-center'
    | 'knowledge-industry-center'  // 별칭
    | 'factory'
    | 'industrial-cluster'         // 산업클러스터 (산업단지+지산센터+공장 통합)
    | 'poi'
    | 'transaction-marker'
    | 'transaction-price'          // 별칭
    | 'listing-marker'
    | 'listing'                    // 별칭
    | 'auction-marker'
    | 'auction';                   // 별칭

export type ParcelColorMode =
    | 'default'
    | 'area'
    | 'building'
    | 'factory'
    | 'price'
    | 'price-change'
    | 'transaction-activity';

// ===== 사전 필터링 타입 =====

export interface PreFilteredParcels {
    all: ParcelMarkerData[];
    transactionOnly: ParcelMarkerData[];  // 실거래만 (매물/경매 없음)
    withListing: ParcelMarkerData[];      // 매물 있음
    auctionOnly: ParcelMarkerData[];      // 경매만 (매물 없음)
}

// ===== 클러스터 타입 =====

export interface ClusterFeature {
    type: 'Feature';
    id: number;
    properties: {
        cluster: boolean;
        cluster_id?: number;
        point_count?: number;
        point_count_abbreviated?: string;
        // 개별 포인트인 경우
        pnu?: string;
        price?: number;
        markerType?: 'transaction' | 'listing' | 'auction';
    };
    geometry: {
        type: 'Point';
        coordinates: Coordinate;
    };
}

// ===== 뷰포트 타입 =====

// ViewportBounds는 types/map.ts에서 정의됨
export type { ViewportBounds } from './map';
