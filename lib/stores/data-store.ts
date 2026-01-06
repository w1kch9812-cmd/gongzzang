// lib/stores/data-store.ts
// 데이터 관리 스토어

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type {
    ParcelMarkerData,
    District,
    DistrictAggregation,
    IndustrialComplex,
    KnowledgeCenterIndex,
    FactoryIndex,
} from '@/types/data';
import type { RegionAggregationData } from './types';
import { extractSido, extractSig, extractEmd } from '@/lib/utils/pnu';
import { calculatePriceChangeRateByYears } from '@/lib/utils/priceChangeCalculator';
import { hasTransactionPrice, hasListingPrice, hasAuctionPrice } from '@/lib/utils/dataHelpers';

interface DataState {
    parcels: ParcelMarkerData[];
    parcelMap: Map<string, ParcelMarkerData>;
    districts: District[];
    districtAggregations: Map<string, DistrictAggregation>;
    regionAggregations: Map<string, RegionAggregationData>;
    sigRegions: DistrictAggregation[];
    emdRegions: DistrictAggregation[];
    industrialComplexes: IndustrialComplex[];
    knowledgeCenters: KnowledgeCenterIndex[];
    factories: FactoryIndex[];
}

interface DataActions {
    setParcels: (parcels: ParcelMarkerData[]) => void;
    setDistricts: (districts: District[]) => void;
    setDistrictAggregations: (aggregations: DistrictAggregation[]) => void;
    setIndustrialComplexes: (complexes: IndustrialComplex[]) => void;
    setKnowledgeCenters: (centers: KnowledgeCenterIndex[]) => void;
    setFactories: (factories: FactoryIndex[]) => void;
    computeRegionAggregations: () => void;
    getParcelById: (pnu: string) => ParcelMarkerData | undefined;
}

type DataStore = DataState & DataActions;

export const useDataStore = create<DataStore>()(
    subscribeWithSelector((set, get) => ({
        // State
        parcels: [],
        parcelMap: new Map(),
        districts: [],
        districtAggregations: new Map(),
        regionAggregations: new Map(),
        sigRegions: [],
        emdRegions: [],
        industrialComplexes: [],
        knowledgeCenters: [],
        factories: [],

        // Actions
        setParcels: (parcels) => {
            // 레거시 호환성: pnu/center와 id/coord 모두 지원
            const normalizedParcels = parcels.map(p => ({
                ...p,
                // 새 필드명 → 레거시 필드명 매핑
                id: p.pnu || p.id,
                coord: p.center || p.coord,
                // 레거시 필드명 → 새 필드명 매핑
                pnu: p.pnu || p.id,
                center: p.center || p.coord,
            }));
            const parcelMap = new Map(normalizedParcels.map(p => [p.pnu, p]));
            set({ parcels: normalizedParcels, parcelMap });
        },

        setDistricts: (districts) => {
            set({ districts });
            const { parcels } = get();
            if (parcels.length > 0 && districts.length > 0) {
                get().computeRegionAggregations();
            }
        },

        setDistrictAggregations: (aggregations) => {
            const map = new Map(aggregations.map(a => [a.id, a]));
            set({ districtAggregations: map });
        },

        setIndustrialComplexes: (complexes) => set({ industrialComplexes: complexes }),
        setKnowledgeCenters: (centers) => set({ knowledgeCenters: centers }),
        setFactories: (factories) => set({ factories }),

        computeRegionAggregations: () => {
            const { parcels, districts } = get();
            if (parcels.length === 0 || districts.length === 0) return;

            const nameMap = new Map<string, string>();
            const coordMap = new Map<string, [number, number]>();

            districts.forEach(d => {
                const code = d.code || d.id;
                if (!code) return;

                const level = d.level;
                nameMap.set(code, d.name);
                coordMap.set(code, d.coord);

                if (level === 'sido' && code.length >= 2) {
                    const shortCode = code.substring(0, 2);
                    nameMap.set(shortCode, d.name);
                    coordMap.set(shortCode, d.coord);
                } else if (level === 'sig' && code.length >= 5) {
                    nameMap.set(code.substring(0, 5), d.name);
                    coordMap.set(code.substring(0, 5), d.coord);
                } else if (level === 'emd') {
                    if (code.length >= 8) {
                        nameMap.set(code.substring(0, 8), d.name);
                        coordMap.set(code.substring(0, 8), d.coord);
                    }
                    if (code.length >= 10) {
                        nameMap.set(code.substring(0, 10), d.name);
                        coordMap.set(code.substring(0, 10), d.coord);
                    }
                }
            });

            const result = new Map<string, RegionAggregationData & {
                totalTxPrice: number;
                txCount: number;
                totalChangeRate: number;
                changeRateCount: number;
            }>();
            const levels: ('sido' | 'sig' | 'emd')[] = ['sido', 'sig', 'emd'];

            for (const level of levels) {
                for (const parcel of parcels) {
                    if (parcel.type === 0) continue;

                    // 헬퍼 함수 활용 (비트 플래그 중앙화)
                    const parcelHasListing = hasListingPrice(parcel.type) && (parcel.listingPrice ?? 0) > 0;
                    const parcelHasAuction = hasAuctionPrice(parcel.type) && (parcel.auctionPrice ?? 0) > 0;
                    const parcelHasTx = hasTransactionPrice(parcel.type) && (parcel.transactionPrice ?? 0) > 0;

                    if (!parcelHasListing && !parcelHasAuction && !parcelHasTx) continue;

                    let regionCode: string;
                    if (level === 'sido') {
                        regionCode = extractSido(parcel.id);
                    } else if (level === 'sig') {
                        regionCode = parcel.sigCode || extractSig(parcel.id);
                    } else {
                        regionCode = parcel.emdCode ? extractEmd(parcel.emdCode) : extractEmd(parcel.id);
                    }

                    const key = `${level}-${regionCode}`;

                    if (!result.has(key)) {
                        const regionName = nameMap.get(regionCode) || regionCode;
                        const coord = coordMap.get(regionCode) || parcel.coord;
                        result.set(key, {
                            regionCode,
                            regionName,
                            coord,
                            listingCount: 0,
                            auctionCount: 0,
                            totalTxPrice: 0,
                            txCount: 0,
                            totalChangeRate: 0,
                            changeRateCount: 0,
                        });
                    }

                    const agg = result.get(key)!;
                    if (parcelHasListing) agg.listingCount++;
                    if (parcelHasAuction) agg.auctionCount++;
                    if (parcelHasTx) {
                        agg.totalTxPrice += parcel.transactionPrice!;
                        agg.txCount++;

                        const changeRate = calculatePriceChangeRateByYears(parcel.transactions, 3);
                        if (changeRate !== null) {
                            agg.totalChangeRate += changeRate;
                            agg.changeRateCount++;
                        }
                    }
                }
            }

            const finalResult = new Map<string, RegionAggregationData>();
            result.forEach((agg, key) => {
                finalResult.set(key, {
                    regionCode: agg.regionCode,
                    regionName: agg.regionName,
                    coord: agg.coord,
                    listingCount: agg.listingCount,
                    auctionCount: agg.auctionCount,
                    avgTxPrice: agg.txCount > 0 ? Math.round(agg.totalTxPrice / agg.txCount) : 0,
                    avgChangeRate: agg.changeRateCount > 0 ? agg.totalChangeRate / agg.changeRateCount : undefined,
                });
            });

            set({ regionAggregations: finalResult });
        },

        getParcelById: (pnu) => get().parcelMap.get(pnu),
    }))
);

// ===== 편의 훅 (그룹화된 상태) =====

// 마커 레이어 데이터 (렌더링 최적화용)
export const useMarkerLayerData = () =>
    useDataStore(
        useShallow((state) => ({
            parcels: state.parcels,
            regionAggregations: state.regionAggregations,
            knowledgeCenters: state.knowledgeCenters,
            industrialComplexes: state.industrialComplexes,
        }))
    );
