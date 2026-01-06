// lib/stores/types.ts
// 스토어 간 공유되는 타입 정의

import type {
    ParcelDetail,
    IndustrialComplexDetail,
    KnowledgeIndustryCenter,
    Factory,
    PropertyType,
} from '@/types/data';

// ===== 필터 타입 =====

export type DataTypeFilter = 'all' | 'transaction' | 'listing' | 'auction';
export type DealTypeFilter = 'all' | '매매' | '전세' | '월세';
export type { PropertyType };
export type DealType = 'sale' | 'jeonse' | 'monthly';
export type DealCategory = 'all' | 'sale' | 'rent' | 'auction';
export type FloorType = 'all' | 'basement' | 'ground' | 'rooftop';

// 거래유형별 가격 조건
export interface DealTypePrice {
    enabled: boolean;
    priceMin: number | null;
    priceMax: number | null;
    depositMin?: number | null;
    depositMax?: number | null;
    monthlyMin?: number | null;
    monthlyMax?: number | null;
}

export interface FilterState {
    // 기본 필터 (TopFilterBar용)
    dataType: DataTypeFilter;
    dealType: DealTypeFilter;
    priceMin: number | null;
    priceMax: number | null;
    areaMin: number | null;
    areaMax: number | null;
    selectedSig: string[];
    selectedEmd: string[];
    auctionFailCountMin: number | null;

    // === 기본 탭 ===
    propertyTypes: PropertyType[];
    dealTypes: {
        sale: DealTypePrice;
        jeonse: DealTypePrice;
        monthly: DealTypePrice;
    };
    landAreaMin: number | null;
    landAreaMax: number | null;
    totalFloorAreaMin: number | null;
    totalFloorAreaMax: number | null;
    exclusiveAreaMin: number | null;
    exclusiveAreaMax: number | null;

    // === 공장 탭 ===
    factoryBusinessTypes: string[];
    allowedIndustries: string[];
    factoryApprovalTypes: string[];
    inIndustrialComplex: boolean | null;
    powerCapacityMin: number | null;
    powerCapacityMax: number | null;
    ceilingHeightMin: number | null;
    ceilingHeightMax: number | null;
    floorLoadMin: number | null;
    floorLoadMax: number | null;
    hasCrane: boolean | null;
    hasDockLeveler: boolean | null;
    hasHoist: boolean | null;

    // === 지식산업센터 탭 ===
    kcBuildingName: string;
    kcAllowedIndustries: string[];
    kcOccupancyRateMin: number | null;
    kcOccupancyRateMax: number | null;
    kcManagementFeeMin: number | null;
    kcManagementFeeMax: number | null;

    // === 창고 탭 ===
    warehouseTypes: string[];

    // === 토지 탭 ===
    landCategories: string[];
    zoningTypes: string[];
    terrainShapes: string[];
    terrainHeights: string[];
    roadSides: string[];
    officialPriceMin: number | null;
    officialPriceMax: number | null;

    // === 건물 탭 ===
    mainStructures: string[];
    floorsAboveMin: number | null;
    floorsAboveMax: number | null;
    floorsBelowMin: number | null;
    floorsBelowMax: number | null;
    completionYearMin: number | null;
    completionYearMax: number | null;
    buildingAgeMin: number | null;
    buildingAgeMax: number | null;
    buildingCoverageMin: number | null;
    buildingCoverageMax: number | null;
    floorAreaRatioMin: number | null;
    floorAreaRatioMax: number | null;
    hasSeismicDesign: boolean | null;

    // === 경매 탭 ===
    auctionStatuses: string[];
    auctionAppraisalMin: number | null;
    auctionAppraisalMax: number | null;
    auctionMinPriceRateMin: number | null;
    auctionMinPriceRateMax: number | null;
    auctionFailCountMax: number | null;
    auctionSpecialNotes: string[];
    // 추가 경매 필터
    auctionOccupancyStatuses: string[];      // 점유상태: 대항력有, 임차인有, 공실 등
    auctionHasAssumption: boolean | null;     // 인수조건 유무
    auctionDateMin: string | null;            // 매각기일 시작 (YYYY-MM-DD)
    auctionDateMax: string | null;            // 매각기일 종료
    auctionWinningBidRateMin: number | null;  // 낙찰가율 최소 (%)
    auctionWinningBidRateMax: number | null;  // 낙찰가율 최대 (%)
}

// ===== 필터 프리셋 =====

export interface SavedFilter {
    id: string;
    name: string;
    description: string;
    filter: FilterState;
    createdAt: string;
}

export interface FilterPreset {
    id: string;
    name: string;
    icon: string;
    description: string;
    filter: Partial<FilterState>;
}

// ===== 선택 상태 타입 =====

export type Selection =
    | { type: 'parcel'; data: ParcelDetail }
    | { type: 'complex'; data: IndustrialComplexDetail }
    | { type: 'knowledge'; data: KnowledgeIndustryCenter }
    | { type: 'factory'; data: Factory }
    | null;

// ===== 관심 매물 / 비교함 / 최근 본 =====

export interface FavoriteItem {
    id: string;
    type: 'parcel' | 'complex' | 'knowledge' | 'factory';
    data: ParcelDetail | IndustrialComplexDetail | KnowledgeIndustryCenter | Factory;
    memo?: string;
    addedAt: string;
}

export interface CompareItem {
    id: string;
    type: 'parcel' | 'complex' | 'knowledge' | 'factory';
    data: ParcelDetail | IndustrialComplexDetail | KnowledgeIndustryCenter | Factory;
    addedAt: string;
}

export interface RecentItem {
    id: string;
    type: 'parcel' | 'complex' | 'knowledge' | 'factory';
    data: ParcelDetail | IndustrialComplexDetail | KnowledgeIndustryCenter | Factory;
    viewedAt: string;
}

// ===== 행정구역 집계 =====

export interface RegionAggregationData {
    regionCode: string;
    regionName: string;
    coord: [number, number];
    listingCount: number;
    auctionCount: number;
    avgTxPrice?: number;
    avgChangeRate?: number;
}

// ===== 기본 필터 상태 =====

const DEFAULT_DEAL_TYPE_PRICE: DealTypePrice = {
    enabled: false,
    priceMin: null,
    priceMax: null,
    depositMin: null,
    depositMax: null,
    monthlyMin: null,
    monthlyMax: null,
};

export const DEFAULT_FILTER: FilterState = {
    dataType: 'all',
    dealType: 'all',
    priceMin: null,
    priceMax: null,
    areaMin: null,
    areaMax: null,
    selectedSig: [],
    selectedEmd: [],
    auctionFailCountMin: null,

    propertyTypes: [],
    dealTypes: {
        sale: { ...DEFAULT_DEAL_TYPE_PRICE },
        jeonse: { ...DEFAULT_DEAL_TYPE_PRICE },
        monthly: { ...DEFAULT_DEAL_TYPE_PRICE },
    },
    landAreaMin: null,
    landAreaMax: null,
    totalFloorAreaMin: null,
    totalFloorAreaMax: null,
    exclusiveAreaMin: null,
    exclusiveAreaMax: null,

    factoryBusinessTypes: [],
    allowedIndustries: [],
    factoryApprovalTypes: [],
    inIndustrialComplex: null,
    powerCapacityMin: null,
    powerCapacityMax: null,
    ceilingHeightMin: null,
    ceilingHeightMax: null,
    floorLoadMin: null,
    floorLoadMax: null,
    hasCrane: null,
    hasDockLeveler: null,
    hasHoist: null,

    kcBuildingName: '',
    kcAllowedIndustries: [],
    kcOccupancyRateMin: null,
    kcOccupancyRateMax: null,
    kcManagementFeeMin: null,
    kcManagementFeeMax: null,

    warehouseTypes: [],

    landCategories: [],
    zoningTypes: [],
    terrainShapes: [],
    terrainHeights: [],
    roadSides: [],
    officialPriceMin: null,
    officialPriceMax: null,

    mainStructures: [],
    floorsAboveMin: null,
    floorsAboveMax: null,
    floorsBelowMin: null,
    floorsBelowMax: null,
    completionYearMin: null,
    completionYearMax: null,
    buildingAgeMin: null,
    buildingAgeMax: null,
    buildingCoverageMin: null,
    buildingCoverageMax: null,
    floorAreaRatioMin: null,
    floorAreaRatioMax: null,
    hasSeismicDesign: null,

    auctionStatuses: [],
    auctionAppraisalMin: null,
    auctionAppraisalMax: null,
    auctionMinPriceRateMin: null,
    auctionMinPriceRateMax: null,
    auctionFailCountMax: null,
    auctionSpecialNotes: [],
    // 추가 경매 필터
    auctionOccupancyStatuses: [],
    auctionHasAssumption: null,
    auctionDateMin: null,
    auctionDateMax: null,
    auctionWinningBidRateMin: null,
    auctionWinningBidRateMax: null,
};

// ===== 필터 프리셋 =====

export const FILTER_PRESETS: FilterPreset[] = [
    {
        id: 'manufacturing-startup',
        name: '제조업 창업',
        icon: '',
        description: '50-200평 공장, 화물엘베/호이스트, 전력 300kW+',
        filter: {
            propertyTypes: ['factory'],
            areaMin: 50,
            areaMax: 200,
            priceMax: 30000,
            hasHoist: true,
            powerCapacityMin: 300,
        },
    },
    {
        id: 'logistics-warehouse',
        name: '물류/창고업',
        icon: '',
        description: '1층, 천정고 6m+, 대지 500평+',
        filter: {
            propertyTypes: ['warehouse'],
            ceilingHeightMin: 6,
            landAreaMin: 1650,  // 500평 = 1650㎡
        },
    },
    {
        id: 'investment-premium',
        name: '투자 프리미엄',
        icon: '',
        description: '준공 5년 이내, 지식산업센터',
        filter: {
            propertyTypes: ['knowledge-center'],
            completionYearMin: new Date().getFullYear() - 5,
        },
    },
    {
        id: 'small-startup',
        name: '소규모 스타트업',
        icon: '',
        description: '지식산업센터, 30-100평, 저렴한 가격',
        filter: {
            propertyTypes: ['knowledge-center'],
            areaMin: 30,
            areaMax: 100,
            priceMax: 20000,
        },
    },
    {
        id: 'development-value',
        name: '개발 가치형',
        icon: '',
        description: '용적률 여유, 넓은 대지, 대로변',
        filter: {
            propertyTypes: ['land'],
            landAreaMin: 990,  // 300평 = 990㎡
            floorAreaRatioMax: 150,
        },
    },
    {
        id: 'heavy-machinery',
        name: '중장비 제조',
        icon: '',
        description: '천정고 7m+, 크레인 5톤+, 전력 1000kW+',
        filter: {
            propertyTypes: ['factory'],
            ceilingHeightMin: 7,
            hasCrane: true,
            powerCapacityMin: 1000,
            areaMin: 200,
        },
    },
];
