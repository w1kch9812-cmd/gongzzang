// scripts/data.config.ts
// 데이터 처리 설정 (Single Source of Truth)

export interface DataSourceConfig {
    name: string;
    description: string;
    rawFiles: string[];
    encoding?: 'utf-8' | 'euc-kr';
    outputGeoJSON?: string;        // 중간 GeoJSON (처리용, 서빙 안함)
    outputProperties?: string;      // Properties JSON (클라이언트용)
    outputPMTiles?: string;         // PMTiles (벡터 타일)
    tileOptions?: {
        minZoom: number;
        maxZoom: number;
        layerName: string;
        idProperty?: string;        // feature ID로 사용할 속성
    };
    transform?: {
        filterRegion?: string;      // 지역 필터 (예: '28' = 인천)
        simplify?: number;          // 단순화 tolerance
        properties?: string[];      // 추출할 속성 목록
        rename?: Record<string, string>;  // 속성명 변경
        computed?: Record<string, string>; // 계산된 속성
    };
}

export const DATA_SOURCES: Record<string, DataSourceConfig> = {
    // 시도 행정구역
    sido: {
        name: 'sido',
        description: '시도 행정구역',
        rawFiles: ['N3A_G0010000.shp'],
        encoding: 'euc-kr',
        outputGeoJSON: 'temp/sido.geojson',
        outputProperties: 'public/data/properties/districts-sido.json',
        outputPMTiles: 'public/tiles/sido.pmtiles',
        tileOptions: {
            minZoom: 0,
            maxZoom: 12,
            layerName: 'sido',
            idProperty: 'code',
        },
        transform: {
            properties: ['BJCD', 'NAME'],
            rename: {
                'BJCD': 'code',
                'NAME': 'name',
            },
        },
    },

    // 시군구 행정구역
    sig: {
        name: 'sig',
        description: '시군구 행정구역',
        rawFiles: ['AL_D001_00_20251204(SIG).shp'],
        encoding: 'euc-kr',
        outputGeoJSON: 'temp/sig.geojson',
        outputProperties: 'public/data/properties/districts-sig.json',
        outputPMTiles: 'public/tiles/sig.pmtiles',
        tileOptions: {
            minZoom: 0,
            maxZoom: 12,  // 표시: 8-12, 오버줌 불필요
            layerName: 'sig',
            idProperty: 'code',
        },
        transform: {
            // filterRegion 제거 - 전국 데이터 포함
            properties: ['A1', 'A2'],
            rename: {
                'A1': 'code',
                'A2': 'name',
            },
        },
    },

    // 읍면동 행정구역
    emd: {
        name: 'emd',
        description: '읍면동 행정구역',
        rawFiles: ['AL_D001_00_20251204(EMD).shp'],
        encoding: 'euc-kr',
        outputGeoJSON: 'temp/emd.geojson',
        outputProperties: 'public/data/properties/districts-emd.json',
        outputPMTiles: 'public/tiles/emd.pmtiles',
        tileOptions: {
            minZoom: 0,
            maxZoom: 14,  // 표시: 12-14, 오버줌 불필요
            layerName: 'emd',
            idProperty: 'code',
        },
        transform: {
            // filterRegion 제거 - 전국 데이터 포함
            properties: ['A1', 'A2', 'A4'],
            rename: {
                'A1': 'code',
                'A2': 'name',
                'A4': 'sigCode',
            },
        },
    },

    // 리 행정구역
    li: {
        name: 'li',
        description: '리 행정구역',
        rawFiles: ['AL_D001_00_20251204(LIO).shp'],
        encoding: 'euc-kr',
        outputGeoJSON: 'temp/li.geojson',
        outputProperties: 'public/data/properties/districts-li.json',
        outputPMTiles: 'public/tiles/li.pmtiles',
        tileOptions: {
            minZoom: 12,
            maxZoom: 17,  // 표시: 14-22, 오버줌 17→22
            layerName: 'li',
            idProperty: 'code',
        },
        transform: {
            // filterRegion 제거 - 전국 데이터 포함
            properties: ['A1', 'A2', 'A4'],
            rename: {
                'A1': 'code',
                'A2': 'name',
                'A4': 'emdCode',
            },
        },
    },

    // 인천 전체 필지
    allParcels: {
        name: 'allParcels',
        description: '인천 전체 필지',
        rawFiles: ['AL_D010_28_20251204.shp'],
        encoding: 'euc-kr',
        outputGeoJSON: 'temp/all-parcels.geojson',
        outputProperties: 'public/data/properties/all-parcels.json',
        outputPMTiles: 'public/tiles/all-parcels.pmtiles',
        tileOptions: {
            minZoom: 12,
            maxZoom: 17,  // 표시: 14-22, 오버줌 17→22
            layerName: 'allParcels',
            idProperty: 'PNU',
        },
        transform: {
            properties: ['A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
            rename: {
                'A2': 'PNU',
                'A3': 'emdCode',
                'A4': 'address',
                'A5': 'jibunMain',
                'A6': 'jibunSub',
                'A7': 'landType',
            },
        },
    },

    // 필지 (남동구)
    parcels: {
        name: 'parcels',
        description: '남동구 필지',
        rawFiles: ['LSMD_CONT_LDREG_28200_202511.shp'],
        encoding: 'euc-kr',
        outputGeoJSON: 'temp/parcels.geojson',
        outputProperties: 'public/data/properties/parcels.json',
        outputPMTiles: 'public/tiles/parcels.pmtiles',
        tileOptions: {
            minZoom: 12,
            maxZoom: 17,  // 표시: 14-22, 오버줌 17→22
            layerName: 'parcels',
            idProperty: 'PNU',
        },
        transform: {
            properties: ['PNU', 'JIBUN', 'BCHK', 'PNUCD', 'REGST_SE_CD'],
            rename: {
                'JIBUN': 'jibun',
            },
            computed: {
                'sigCode': 'PNU.substring(0, 5)',
                'emdCode': 'PNU.substring(0, 10)',
            },
        },
    },

    // 산업단지
    complex: {
        name: 'complex',
        description: '산업단지',
        rawFiles: ['dam_dan.shp'],
        encoding: 'euc-kr',
        outputGeoJSON: 'temp/complex.geojson',
        outputProperties: 'public/data/properties/complexes.json',
        outputPMTiles: 'public/tiles/complex.pmtiles',
        tileOptions: {
            minZoom: 0,
            maxZoom: 16,  // 표시: 0-22 (전체), 오버줌 16→22
            layerName: 'complex',
            idProperty: 'id',
        },
        transform: {
            // filterRegion 제거 - 전국 데이터 포함
            properties: ['DAN_ID', 'DAN_NAME', 'DANJI_TYPE'],
            rename: {
                'DAN_ID': 'id',
                'DAN_NAME': 'name',
                'DANJI_TYPE': 'type',
            },
        },
    },

    // 용지
    lots: {
        name: 'lots',
        description: '산업단지 용지',
        rawFiles: ['dam_yoj.shp'],
        encoding: 'euc-kr',
        outputGeoJSON: 'temp/lots.geojson',
        outputProperties: 'public/data/properties/lots.json',
        outputPMTiles: 'public/tiles/lots.pmtiles',
        tileOptions: {
            minZoom: 12,
            maxZoom: 17,  // 표시: 12-22, 오버줌 17→22
            layerName: 'lots',
            idProperty: 'id',
        },
        transform: {
            // filterRegion 제거 - 전국 데이터 포함
            properties: ['YOJ_ID', 'DAN_ID'],
            rename: {
                'YOJ_ID': 'id',
                'DAN_ID': 'complexId',
            },
        },
    },

    // 유치업종
    industries: {
        name: 'industries',
        description: '유치업종',
        rawFiles: ['dam_yuch.shp'],
        encoding: 'euc-kr',
        outputGeoJSON: 'temp/industries.geojson',
        outputProperties: 'public/data/properties/industries.json',
        outputPMTiles: 'public/tiles/industries.pmtiles',
        tileOptions: {
            minZoom: 12,
            maxZoom: 17,  // 표시: 12-22, 오버줌 17→22
            layerName: 'industries',
            idProperty: 'id',
        },
        transform: {
            // filterRegion 제거 - 전국 데이터 포함
            properties: ['UPJ_ID', 'DAN_ID', 'UPJ6'],
            rename: {
                'UPJ_ID': 'id',
                'DAN_ID': 'complexId',
                'UPJ6': 'name',
            },
        },
    },
};

// 비-SHP 데이터 소스
export const NON_SHP_SOURCES = {
    factories: {
        name: 'factories',
        description: '공장 등록 현황',
        rawFiles: ['전국공장등록현황.xlsx'],
        outputProperties: 'public/data/properties/factories.json',
        filterRegion: '인천',
    },
    knowledgeCenters: {
        name: 'knowledgeCenters',
        description: '지식산업센터',
        rawFiles: ['한국산업단지공단_전국지식산업센터현황_20240630.csv'],
        outputProperties: 'public/data/properties/knowledge-centers.json',
        filterRegion: '인천',
    },
};

// 출력 디렉토리
export const OUTPUT_DIRS = {
    temp: 'temp',
    properties: 'public/data/properties',
    tiles: 'public/tiles',
};

export default DATA_SOURCES;
