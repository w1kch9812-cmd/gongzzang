// 통합 마커 레이어 (MarkerManager 기반 풀링 적용)
// 줌 0-7: 시도 마커
// 줌 8-11: 시군구 마커
// 줌 12-13: 읍면동 마커
// 줌 14+: 개별 필지/클러스터 마커

'use client';

import { useEffect, useRef, useCallback, useMemo, memo, useState } from 'react';
import { useMapStore, useViewportState, type OverlappingTxMarker } from '@/lib/stores/map-store';
import { useMarkerLayerData } from '@/lib/stores/data-store';
import { useIsFilterActive, useFilteredParcels } from '@/lib/stores/filter-store';
import { useMarkerLayerSettings, useMarkerLayerActions, useUIStore } from '@/lib/stores/ui-store';
import { useMarkerLayerSelection } from '@/lib/stores/selection-store';
import { loadParcelDetail } from '@/lib/data/loadData';
import { logger } from '@/lib/utils/logger';
import Supercluster from 'supercluster';
import { hasListingPrice, hasAuctionPrice, hasTransactionPrice } from '@/lib/utils/dataHelpers';
import type { ComplexStatus } from '@/types/data';
import { formatPrice as formatPriceBase, formatArea as formatAreaBase } from '@/lib/markers';
import { MarkerManager, MarkerType } from '@/lib/map/MarkerManager';
import { loadIndustrialComplexDetail } from '@/lib/data/loadData';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point as turfPoint, polygon as turfPolygon, multiPolygon as turfMultiPolygon } from '@turf/helpers';
import type { Feature, Polygon, MultiPolygon, GeoJsonProperties } from 'geojson';
import { hasValidCoordinate } from '@/lib/utils/geoHelpers';
import { getSamplingHash } from '@/lib/utils/hash';
// ✅ 설정 파일 import (Single Source of Truth)
import { COLORS, SHADOWS, BORDER_RADIUS, PADDING, FONT_SIZE, StyleHelper } from '@/lib/config/style.config';
import { ZOOM_LEVELS, ZoomHelper } from '@/lib/config/map.config';
import { CLUSTER_CONFIG, MarkerHelper as ConfigMarkerHelper } from '@/lib/config/marker.config';
import { TIMING, RENDERING } from '@/lib/config/performance.config';
import { SOURCE_IDS } from '@/lib/config/layer.config';
// ⚡ Canvas 렌더링
import { CanvasMarkerRenderer, type CanvasMarker } from '@/lib/map/CanvasMarkerRenderer';

interface UnifiedMarkerLayerProps {
    map: naver.maps.Map | null;
    skipTransactionMarkers?: boolean; // WebGL 레이어 사용 시 DOM 실거래 마커 비활성화
}

type BBox = [number, number, number, number];

// ========== 선택된 필지 하이라이트 마커 스타일 ==========
// ✅ 설정 파일 사용 (단일 소스)
const HIGHLIGHT_MARKER_STYLE = {
    bgColor: COLORS.selection.selected,
    borderColor: COLORS.selection.selectedBorder,
    textColor: COLORS.selection.selectedText,
    shadow: SHADOWS.selected,
    padding: PADDING.marker.lg,
    borderRadius: BORDER_RADIUS.lg,
    fontSize: {
        title: FONT_SIZE.lg,
        info: FONT_SIZE.sm,
        price: FONT_SIZE.xl,
    },
};

// ========== 실거래가 마커 공통 스타일 ==========
// ✅ 설정 파일 사용 (단일 소스)
const TRANSACTION_MARKER_STYLE = {
    bgColor: `rgba(255, 255, 255, 0.92)`,  // ✅ 흰색 배경 (불투명)
    borderColor: COLORS.ui.border.default,  // ✅ border는 객체이므로 .default 사용
    borderRadius: BORDER_RADIUS.full,
    shadow: SHADOWS.marker,
    padding: PADDING.marker.sm,
    fontSize: {
        price: FONT_SIZE.md,
        type: FONT_SIZE.xs,
        count: FONT_SIZE.xs,
    },
    color: {
        price: COLORS.ui.text.primary,
        count: COLORS.ui.text.secondary,
    },
};

// ⚡ 성능 최적화: 단일 레이어로 단순화 (backdrop-filter 제거)
const getTransactionMarkerStyle = () => `
    display: inline-flex;
    align-items: center;
    padding: ${TRANSACTION_MARKER_STYLE.padding};
    background: ${TRANSACTION_MARKER_STYLE.bgColor};
    border-radius: ${TRANSACTION_MARKER_STYLE.borderRadius};
    border: 1px solid ${TRANSACTION_MARKER_STYLE.borderColor};
    box-shadow: ${TRANSACTION_MARKER_STYLE.shadow};
`;

// ========== 유틸 함수 ==========

// ✅ 설정 파일 헬퍼 사용
const calculateBaseZIndex = StyleHelper.getMarkerZIndex;

// 포맷 함수
const formatPrice = (priceManwon: number): string => formatPriceBase(priceManwon);
const formatArea = (areaSqm: number): string => `${formatAreaBase(areaSqm)}평`;
const formatAreaWithPrefix = (areaSqm: number): string => `전유 ${formatAreaBase(areaSqm)}평`;

// 1평 = 3.3058㎡
const SQM_PER_PYEONG = 3.3058;

// 평단가 계산 (만원/평)
// transactionPrice: 만원, area: ㎡
const calculatePricePerPyeong = (price: number, areaSqm: number): number => {
    if (!price || !areaSqm || areaSqm <= 0) return 0;
    const areaPyeong = areaSqm / SQM_PER_PYEONG;
    return Math.round(price / areaPyeong);
};

// 평단가 포맷 (예: "520만/평", "1.2천/평", "1억/평")
// area가 0이면 pricePerPyeong도 0이므로 빈 문자열 반환
const formatPricePerPyeong = (pricePerPyeong: number): string => {
    if (!pricePerPyeong || pricePerPyeong <= 0) return '';
    if (pricePerPyeong >= 10000) {
        const billions = Math.floor(pricePerPyeong / 10000);
        return `${billions}억/평`;
    }
    if (pricePerPyeong >= 1000) {
        return `${(pricePerPyeong / 1000).toFixed(1)}천/평`;
    }
    return `${pricePerPyeong}만/평`;
};

// 총 거래가 포맷 (평단가 계산 불가 시 사용)
const formatTotalPrice = (price: number): string => {
    if (!price || price <= 0) return '';
    if (price >= 10000) {
        const billions = Math.floor(price / 10000);
        const remainder = price % 10000;
        if (remainder > 0) {
            return `${billions}억${Math.round(remainder / 1000)}천`;
        }
        return `${billions}억`;
    }
    if (price >= 1000) {
        return `${(price / 1000).toFixed(1)}천만`;
    }
    return `${price}만`;
};

// ========== 산업단지 폴리곤 추적 ==========

interface CachedPolygon {
    id: string;
    name: string;
    polylabelCoord: [number, number];
    polygon: Feature<Polygon | MultiPolygon, GeoJsonProperties>;
    status?: string;
    completionRate?: number;
    listingCount?: number;
    auctionCount?: number;
}

// 폴리곤 내부에서 화면 안에 있는 위치 찾기
function findVisiblePointInPolygon(
    mapboxGL: any,
    polylabelCoord: [number, number],
    complexPolygon: Feature<Polygon | MultiPolygon, GeoJsonProperties>,
    screenWidth: number,
    screenHeight: number,
    margin: number = 50
): { screenX: number; screenY: number; angle: number } | null {
    const polylabelScreen = mapboxGL.project(polylabelCoord);
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;

    const dx = centerX - polylabelScreen.x;
    const dy = centerY - polylabelScreen.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) {
        return { screenX: polylabelScreen.x, screenY: polylabelScreen.y, angle: 0 };
    }

    const ndx = dx / distance;
    const ndy = dy / distance;
    const angle = (Math.atan2(-dx, dy) * 180 / Math.PI + 360) % 360;

    // 40px 스텝으로 빠르게 샘플링
    const step = 40;
    const maxSteps = Math.ceil(distance / step);

    for (let i = 0; i <= maxSteps; i++) {
        const t = i * step;
        const screenX = polylabelScreen.x + ndx * t;
        const screenY = polylabelScreen.y + ndy * t;

        if (screenX < margin || screenX > screenWidth - margin ||
            screenY < margin || screenY > screenHeight - margin) {
            continue;
        }

        const lngLat = mapboxGL.unproject([screenX, screenY]);
        try {
            if (booleanPointInPolygon(turfPoint([lngLat.lng, lngLat.lat]), complexPolygon)) {
                return { screenX, screenY, angle };
            }
        } catch {
            continue;
        }
    }

    return null;
}

// Supercluster 설정 팩토리 (중복 제거)
// 평단가(pricePerPyeong) 기반 클러스터링 - 비슷한 가격대끼리 그룹핑
const createClusterConfig = () => ({
    radius: CLUSTER_CONFIG.radius,
    maxZoom: CLUSTER_CONFIG.maxZoom.transaction,
    minZoom: ZOOM_LEVELS.PARCEL.min,
    minPoints: 2,
    map: (props: any) => ({
        // 평단가 합계 (평균 계산용)
        totalPricePerPyeong: props.pricePerPyeong || 0,
        // 평단가 최소/최대 (범위 표시용)
        minPricePerPyeong: props.pricePerPyeong || 0,
        maxPricePerPyeong: props.pricePerPyeong || 0,
        count: 1,
    }),
    reduce: (acc: any, props: any) => {
        acc.totalPricePerPyeong += props.totalPricePerPyeong;
        acc.minPricePerPyeong = Math.min(acc.minPricePerPyeong, props.minPricePerPyeong);
        acc.maxPricePerPyeong = Math.max(acc.maxPricePerPyeong, props.maxPricePerPyeong);
        acc.count += props.count;
    },
});

// ========== 마커 DOM 공통 유틸리티 ==========

/** 마커 하단 화살표 HTML 생성 */
function createMarkerArrow(color: string, size: number = 5, borderColor?: string): string {
    if (borderColor) {
        // 테두리가 있는 화살표 (흰 배경 + 색상 테두리용)
        return `<div style="position: relative; width: 0; height: 0;">
            <div style="position: absolute; left: -${size}px; top: -${size}px; width: 0; height: 0; border-left: ${size}px solid transparent; border-right: ${size}px solid transparent; border-top: ${size}px solid ${borderColor};"></div>
            <div style="position: absolute; left: -${size - 1}px; top: -${size + 1}px; width: 0; height: 0; border-left: ${size - 1}px solid transparent; border-right: ${size - 1}px solid transparent; border-top: ${size - 1}px solid ${color};"></div>
        </div>`;
    }
    return `<div style="width: 0; height: 0; border-left: ${size}px solid transparent; border-right: ${size}px solid transparent; border-top: ${size}px solid ${color};"></div>`;
}

/** 매물/경매 통계 뱃지 HTML 생성 (산업단지, 지식산업센터 공통) */
function createStatsBadges(listingCount: number, auctionCount: number): string {
    if (listingCount <= 0 && auctionCount <= 0) return '';
    return `
        <div style="display: flex; gap: 3px;">
            ${listingCount > 0 ? `<span style="display: flex; align-items: center; gap: 2px; padding: 0 4px; height: 16px; background: #228be6; border-radius: 8px; font-size: 9px; font-weight: 600; color: white;"><span>${listingCount}</span><span style="font-size: 8px;">매물</span></span>` : ''}
            ${auctionCount > 0 ? `<span style="display: flex; align-items: center; gap: 2px; padding: 0 4px; height: 16px; background: #ef4444; border-radius: 8px; font-size: 9px; font-weight: 600; color: white;"><span>${auctionCount}</span><span style="font-size: 8px;">경매</span></span>` : ''}
        </div>
    `;
}

/** 이름 축약 (최대 길이 초과 시 ... 추가) */
function truncateName(name: string, maxLength: number = 8): string {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
}

/** 마커 컨테이너 기본 스타일 */
const MARKER_CONTAINER_STYLE = {
    base: 'display: inline-flex; flex-direction: column; align-items: center; cursor: pointer; user-select: none; -webkit-user-select: none; pointer-events: auto;',
    withShadow: 'display: inline-flex; flex-direction: column; align-items: center; cursor: pointer; user-select: none; -webkit-user-select: none; pointer-events: auto; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.2));',
};

/** 마커 앵커 포인트 */
const MARKER_ANCHOR = {
    center: 'transform: translate(-50%, -50%);',
    bottom: 'transform: translate(-50%, -100%);',
};

// ========== 마커 DOM 생성 함수 ==========

// 행정구역 클러스터 마커 - 미니멀 컴팩트 스타일
function createRegionClusterDOM(
    regionName: string,
    listingCount: number,
    auctionCount: number
): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        background: #fff;
        border-radius: 6px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
        cursor: pointer;
        padding: 8px 12px;
    `;

    const hasListing = listingCount > 0;
    const hasAuction = auctionCount > 0;

    const countsHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            ${hasListing ? `<span style="font-size: 14px; font-weight: 600; color: #2563EB;">${listingCount}<span style="font-size: 11px; color: #64748B; margin-left: 3px;">매물</span></span>` : ''}
            ${hasListing && hasAuction ? `<span style="color: #E2E8F0;">|</span>` : ''}
            ${hasAuction ? `<span style="font-size: 14px; font-weight: 600; color: #DC2626;">${auctionCount}<span style="font-size: 11px; color: #64748B; margin-left: 3px;">경매</span></span>` : ''}
        </div>
    `;

    container.innerHTML = `
        <span style="font-size: 12px; font-weight: 500; color: #64748B; white-space: nowrap;">${regionName}</span>
        ${countsHTML}
    `;
    return container;
}


// 매물 유형별 색상 헬퍼
function getPropertyTypeColor(type: string): string {
    const colors: Record<string, string> = {
        factory: COLORS.entity.factory,
        'knowledge-center': COLORS.entity.knowledgeCenter,
        warehouse: COLORS.entity.warehouse,
        land: COLORS.entity.land,
    };
    return colors[type] || '#6B7280';
}

function getPropertyTypeBgColor(type: string): string {
    const colors: Record<string, string> = {
        factory: '#EFF6FF',           // blue-50 (파란색 계열)
        'knowledge-center': '#F5F3FF',
        warehouse: '#FFF7ED',
        land: '#F0FDF4',
    };
    return colors[type] || '#F3F4F6';
}

// 매물 클러스터 마커 - 컴팩트 스타일 (매물 전용)
function createListingClusterDOM(count: number, propertyType?: string): HTMLDivElement {
    const LISTING_COLOR = '#3B82F6';
    const container = document.createElement('div');
    const typeStyle = propertyType ? PROPERTY_TYPE_STYLES[propertyType] : null;
    const typeLabelHTML = typeStyle ? `<span style="font-size: 10px; color: ${typeStyle.color}; font-weight: 500;">${typeStyle.label}</span>` : '';

    container.style.cssText = `
        display: inline-flex; align-items: center; gap: 4px;
        padding: 5px 10px; background: #fff; border-radius: 6px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12); cursor: pointer;
        border: 1.5px solid ${LISTING_COLOR}; ${MARKER_ANCHOR.center}
    `;
    container.innerHTML = `
        ${typeLabelHTML}
        <span style="font-size: 13px; font-weight: 600; color: #2563EB;">${count}</span>
        <span style="font-size: 11px; color: #64748B;">매물</span>
    `;
    return container;
}

// 경매 클러스터 마커 - 눈에 띄는 스타일 (경매 전용)
// ⚡ 성능 최적화: gradient → 단색
function createAuctionClusterDOM(count: number, propertyType?: string): HTMLDivElement {
    const AUCTION_COLOR = '#DC2626';
    const container = document.createElement('div');
    const typeStyle = propertyType ? PROPERTY_TYPE_STYLES[propertyType] : null;
    const typeLabelHTML = typeStyle ? `<span style="font-size: 10px; color: rgba(255,255,255,0.9); font-weight: 500;">${typeStyle.label}</span>` : '';

    // 망치 아이콘 SVG (작은 버전)
    const hammerIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M15.12 7.88L7.88 15.12M16.24 3.76L20.24 7.76c.39.39.39 1.02 0 1.41l-8.49 8.49"/></svg>`;

    container.style.cssText = `
        display: inline-flex; align-items: center; gap: 4px;
        padding: 5px 10px; background: ${AUCTION_COLOR}; border-radius: 6px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2); cursor: pointer;
        border: 2px solid #FCA5A5; ${MARKER_ANCHOR.center}
    `;
    container.innerHTML = `
        ${hammerIcon}
        ${typeLabelHTML}
        <span style="font-size: 13px; font-weight: 700; color: #fff;">${count}</span>
        <span style="font-size: 11px; color: rgba(255,255,255,0.9);">경매</span>
    `;
    return container;
}

// 매물+경매 통합 클러스터 마커 (사용하지 않음, 호환성 유지용)
function createPropertyClusterDOM(listingCount: number, auctionCount: number, propertyType?: string): HTMLDivElement {
    const container = document.createElement('div');
    const hasListing = listingCount > 0;
    const hasAuction = auctionCount > 0;

    if (hasListing && !hasAuction) {
        return createListingClusterDOM(listingCount);
    } else if (hasAuction && !hasListing) {
        return createAuctionClusterDOM(auctionCount);
    } else {
        // 혼합 (거의 사용 안됨)
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: #fff;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            cursor: pointer;
        `;
        container.innerHTML = `
            <span style="font-size: 11px; font-weight: 600; color: #2563EB;">${listingCount}</span>
            <span style="font-size: 9px; color: #64748B;">매물</span>
            <span style="color: #E2E8F0;">|</span>
            <span style="font-size: 11px; font-weight: 600; color: #DC2626;">${auctionCount}</span>
            <span style="font-size: 9px; color: #64748B;">경매</span>
        `;
    }
    return container;
}

// 매물 유형별 색상/아이콘 정보
const PROPERTY_TYPE_STYLES: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
    factory: {
        label: '공장',
        color: COLORS.entity.factory,
        bgColor: '#EFF6FF',  // blue-50
        icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20V8l6 4V8l6 4V4h8v16H2z"/></svg>`
    },
    'knowledge-center': {
        label: '지산',
        color: COLORS.entity.knowledgeCenter,
        bgColor: '#F5F3FF',
        icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22V12h6v10M9 6h.01M15 6h.01"/></svg>`
    },
    warehouse: {
        label: '창고',
        color: COLORS.entity.warehouse,
        bgColor: '#FFF7ED',
        icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V9l9-6 9 6v12H3z"/><rect x="9" y="13" width="6" height="8"/></svg>`
    },
    land: {
        label: '토지',
        color: COLORS.entity.land,
        bgColor: '#F0FDF4',
        icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`
    },
};

// ========== 지목(토지) 분류 ==========
// 지목 코드 → 풀 명칭 (28개)
const LAND_COLOR = '#16A34A';

const LAND_CATEGORY_LABELS: Record<string, string> = {
    '전': '전',
    '답': '답',
    '과': '과수원',
    '목': '목장',
    '임': '임야',
    '광': '광천지',
    '염': '염전',
    '대': '대지',
    '장': '공장',      // 공장용지 → 공장 (간결하게)
    '공': '공원',
    '학': '학교',
    '차': '주차장',
    '주': '주유소',
    '창': '창고',      // 창고용지 → 창고 (간결하게)
    '도': '도로',
    '철': '철도',
    '제': '제방',
    '천': '하천',
    '구': '구거',
    '유': '유지',
    '양': '양어장',
    '수': '수도',
    '원': '공원',
    '체': '체육',
    '종': '종교',
    '사': '사적지',
    '묘': '묘지',
    '잡': '잡종지',
};

// 지번 마지막 한글에서 지목 추출
function extractLandCategory(jibun: string | undefined): string | null {
    if (!jibun) return null;
    const match = jibun.match(/([가-힣])$/);
    return match ? match[1] : null;
}

// 매물 유형 + 지번에서 라벨/색상 정보 추출
function getTypeInfo(propertyType: string | undefined, jibun: string | undefined): { label: string; color: string; category: string } {
    // 공장, 지산, 창고는 그대로 사용
    if (propertyType && propertyType !== 'land' && PROPERTY_TYPE_STYLES[propertyType]) {
        return {
            label: PROPERTY_TYPE_STYLES[propertyType].label,
            color: PROPERTY_TYPE_STYLES[propertyType].color,
            category: propertyType,
        };
    }

    // 토지: 지번에서 지목 추출
    const landCat = extractLandCategory(jibun);
    if (landCat && LAND_CATEGORY_LABELS[landCat]) {
        return {
            label: LAND_CATEGORY_LABELS[landCat],
            color: LAND_COLOR,
            category: 'land',
        };
    }

    // 기본값: 토지
    return {
        label: '토지',
        color: LAND_COLOR,
        category: 'land',
    };
}

// 매물 마커 - 컴팩트 강조 디자인 (연파랑 배경)
function createListingMarkerDOM(
    area: string,
    price: string,
    dealType: string,
    propertyType?: string,
    auctionInfo?: { price: number; failCount: number }
): HTMLDivElement {
    const LISTING_COLOR = '#2563EB';
    const LISTING_BG = '#EFF6FF';
    const container = document.createElement('div');
    container.style.cssText = `${MARKER_CONTAINER_STYLE.base} ${MARKER_ANCHOR.bottom}`;

    const dealTypeLabel = dealType === '임대' ? '임대' : dealType === '분양' ? '분양' : dealType === '전세' ? '전세' : '매매';

    // 경매 정보가 있으면 간략하게 표시
    const auctionInfoHTML = auctionInfo ? `
        <div style="font-size: 9px; color: #DC2626; font-weight: 600;">경매 ${formatPrice(auctionInfo.price)}${auctionInfo.failCount > 0 ? ` (${auctionInfo.failCount}회)` : ''}</div>
    ` : '';

    container.innerHTML = `
        <div style="
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 5px 8px;
            background: ${LISTING_BG};
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
            border: 2px solid ${LISTING_COLOR};
        ">
            <div style="display: flex; align-items: baseline; gap: 3px;">
                <span style="font-size: 10px; color: ${LISTING_COLOR}; font-weight: 700;">${dealTypeLabel}</span>
                <span style="font-weight: 800; font-size: 13px; color: #1E40AF;">${price}</span>
            </div>
            <div style="font-size: 10px; color: #6B7280; font-weight: 500;">${area}</div>
            ${auctionInfoHTML}
        </div>
        ${createMarkerArrow(LISTING_BG, 5, LISTING_COLOR)}
    `;
    return container;
}

// 경매 마커 - 컴팩트 강조 디자인 (연분홍 배경)
function createAuctionMarkerDOM(area: string, price: string, failCount?: number, propertyType?: string): HTMLDivElement {
    const AUCTION_COLOR = '#DC2626';
    const AUCTION_BG = '#FEF2F2';
    const container = document.createElement('div');
    container.style.cssText = `${MARKER_CONTAINER_STYLE.base} ${MARKER_ANCHOR.bottom}`;

    // 유찰 횟수 표시 (있을 때만)
    const failInfoHTML = failCount !== undefined && failCount > 0 ? `
        <div style="font-size: 9px; color: #991B1B; font-weight: 600;">유찰 ${failCount}회</div>
    ` : '';

    container.innerHTML = `
        <div style="
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 5px 8px;
            background: ${AUCTION_BG};
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(220, 38, 38, 0.35);
            border: 2px solid ${AUCTION_COLOR};
        ">
            <div style="display: flex; align-items: baseline; gap: 3px;">
                <span style="font-size: 10px; color: ${AUCTION_COLOR}; font-weight: 700;">경매</span>
                <span style="font-weight: 800; font-size: 13px; color: #991B1B;">${price}</span>
            </div>
            <div style="font-size: 10px; color: #6B7280; font-weight: 500;">${area}</div>
            ${failInfoHTML}
        </div>
        ${createMarkerArrow(AUCTION_BG, 5, AUCTION_COLOR)}
    `;
    return container;
}

// 실거래 마커 - 심플 디자인 심플 디자인 (매물/경매보다 덜 강조)
// 두 줄 레이아웃: 1줄 = 유형 + 가격, 2줄 = 날짜 + 평수
function createTransactionMarkerDOM(
    price: string,
    propertyType?: string,
    jibun?: string,
    transactionDate?: string,
    area?: number
): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `${MARKER_CONTAINER_STYLE.base} ${MARKER_ANCHOR.center}`;

    // 지목 정보 포함 라벨 추출
    const typeInfo = getTypeInfo(propertyType, jibun);
    const { fontSize, color } = TRANSACTION_MARKER_STYLE;
    const typeLabelHTML = `<span style="font-size: ${fontSize.type}; color: ${typeInfo.color}; font-weight: 500; margin-right: 4px;">${typeInfo.label}</span>`;

    // 최근 3개월 이내 거래 판단
    let isRecent = false;
    if (transactionDate) {
        const txDate = new Date(transactionDate);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        isRecent = txDate >= threeMonthsAgo;
    }

    // N 뱃지 (최근 거래)
    const newBadgeHTML = isRecent ? `
        <span style="
            position: absolute;
            top: -6px;
            right: -6px;
            background: #EF4444;
            color: #fff;
            font-size: 9px;
            font-weight: 700;
            padding: 2px 4px;
            border-radius: 3px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            border: 1.5px solid #fff;
        ">N</span>
    ` : '';

    // 면적 표시 (평)
    const areaPyeong = area && area > 0 ? (area / SQM_PER_PYEONG).toFixed(0) : '';

    // 거래일자 표시 (년.월)
    let dateStr = '';
    if (transactionDate) {
        const txDate = new Date(transactionDate);
        const year = txDate.getFullYear().toString().slice(2);
        const month = String(txDate.getMonth() + 1).padStart(2, '0');
        dateStr = `${year}.${month}`;
    }

    // 두 줄 레이아웃: 1줄 = 유형 + 가격, 2줄 = 날짜 + 평수
    const secondLineHTML = (dateStr || areaPyeong) ? `
        <div style="font-size: 9px; color: #9CA3AF; margin-top: 1px; display: flex; gap: 4px;">
            ${dateStr ? `<span>${dateStr}</span>` : ''}
            ${areaPyeong ? `<span>${areaPyeong}평</span>` : ''}
        </div>
    ` : '';

    // ⚡ 성능 최적화: 단일 레이어 구조 (backdrop-filter 제거)
    container.innerHTML = `
        <div style="${getTransactionMarkerStyle()}; position: relative; display: flex; flex-direction: column; align-items: center; line-height: 1.2;">
            ${newBadgeHTML}
            <div style="display: flex; align-items: center; white-space: nowrap;">
                ${typeLabelHTML}
                <span style="font-weight: 500; font-size: ${fontSize.price}; color: ${color.price};">${price}</span>
            </div>
            ${secondLineHTML}
        </div>
    `;
    return container;
}

// ========== 선택된 필지 하이라이트 마커 (복합 정보 표시) ==========
// 실거래/매물/경매가 모두 있을 때 깔끔하게 표시
// 우선순위: 매물 > 경매 > 실거래
function createHighlightMarkerDOM(
    jibun: string,
    area: number,
    propertyType?: string,
    transactionPrice?: number,
    listingPrice?: number,
    auctionPrice?: number,
    auctionFailCount?: number
): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `${MARKER_CONTAINER_STYLE.base} ${MARKER_ANCHOR.bottom}`;

    const typeInfo = getTypeInfo(propertyType, jibun);
    const areaPyeong = area > 0 ? (area / SQM_PER_PYEONG).toFixed(1) : '0';

    // 상단 배지 (경매/실거래 존재 여부)
    const badges: string[] = [];
    if (listingPrice) badges.push(`<span style="font-size: 9px; font-weight: 700; color: #2563EB; padding: 2px 5px; background: #DBEAFE; border-radius: 3px;">매물</span>`);
    if (auctionPrice) badges.push(`<span style="font-size: 9px; font-weight: 700; color: #DC2626; padding: 2px 5px; background: #FEE2E2; border-radius: 3px;">경매</span>`);
    if (transactionPrice) badges.push(`<span style="font-size: 9px; font-weight: 700; color: #059669; padding: 2px 5px; background: #D1FAE5; border-radius: 3px;">실거래</span>`);
    const badgesHTML = badges.length > 0 ? `<div style="display: flex; gap: 3px;">${badges.join('')}</div>` : '';

    // 가격 정보 (우선순위: 매물 > 경매 > 실거래)
    let mainPrice = '';
    let mainPriceColor = '#1F2937';
    let subPriceHTML = ''; // 부가 정보 (경매가 등)

    if (listingPrice) {
        mainPrice = formatTotalPrice(listingPrice);
        mainPriceColor = '#2563EB';
        // 매물이 있을 때 경매 정보가 있으면 하단에 표시
        if (auctionPrice) {
            subPriceHTML = `<div style="font-size: 8px; color: #DC2626; line-height: 1; font-weight: 600;">경매 최저가 ${formatTotalPrice(auctionPrice)}${auctionFailCount && auctionFailCount > 0 ? `(${auctionFailCount})` : ''}</div>`;
        }
    } else if (auctionPrice) {
        mainPrice = formatTotalPrice(auctionPrice);
        mainPriceColor = '#DC2626';
        if (auctionFailCount && auctionFailCount > 0) {
            mainPrice += ` <span style="font-size: 11px; color: #DC2626;">(${auctionFailCount}회)</span>`;
        }
    } else if (transactionPrice) {
        mainPrice = formatTotalPrice(transactionPrice);
        mainPriceColor = '#059669';
        const pricePerPyeong = calculatePricePerPyeong(transactionPrice, area);
        const pppText = formatPricePerPyeong(pricePerPyeong);
        if (pppText) mainPrice += ` <span style="font-size: 11px; color: #9CA3AF;">(${pppText})</span>`;
    }

    container.innerHTML = `
        <div style="
            display: flex; flex-direction: column; gap: 4px;
            padding: 8px 10px;
            background: #fff;
            border: 2px solid #3B82F6;
            border-radius: 6px;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15), 0 3px 10px rgba(0, 0, 0, 0.12);
            min-width: 90px;
        ">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                <span style="font-size: 10px; font-weight: 600; color: #6B7280;">${typeInfo.label}</span>
                ${badgesHTML}
            </div>
            <div style="font-size: 15px; font-weight: 800; color: ${mainPriceColor}; line-height: 1;">${mainPrice}</div>
            ${subPriceHTML}
            <div style="font-size: 9px; color: #9CA3AF; line-height: 1;">${areaPyeong}평 · ${jibun || '지번 없음'}</div>
        </div>
        <div style="display: flex; justify-content: center; width: 100%;">
            ${createMarkerArrow('#fff', 7, '#3B82F6')}
        </div>
    `;
    return container;
}


// ========== 광고 마커 (플로팅 스타일 - 다크 테마) ==========
// 광고 활성화된 산업단지/지식산업센터용 프리미엄 마커

// 광고 마커 테마 설정
const AD_MARKER_THEMES = {
    'industrial-complex': {
        primary: '#ff6b35',
        glow: 'rgba(255, 107, 53, 0.4)',
        glowHover: 'rgba(255, 107, 53, 0.5)',
        icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" stroke-width="2.5">
            <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
        </svg>`,
    },
    'knowledge-center': {
        primary: '#0066FF',
        glow: 'rgba(0, 102, 255, 0.4)',
        glowHover: 'rgba(0, 102, 255, 0.5)',
        icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0066FF" stroke-width="2.5">
            <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
            <path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/>
            <path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/>
            <path d="M8 10h.01"/><path d="M8 14h.01"/>
        </svg>`,
    },
};

// 통합 광고 마커 생성 함수
// ⚡ 성능 최적화: 애니메이션 제거, DOM 구조 단순화
function createAdMarkerDOM(
    type: 'industrial-complex' | 'knowledge-center',
    name: string,
    phoneNumber?: string,
    thumbnailUrl?: string
): HTMLDivElement {
    const AD_BG_COLOR = '#222';
    const theme = AD_MARKER_THEMES[type];
    const container = document.createElement('div');
    container.style.cssText = `${MARKER_CONTAINER_STYLE.base} ${MARKER_ANCHOR.bottom}`;

    const thumbnailHTML = thumbnailUrl ? `
        <div style="width: 56px; flex-shrink: 0; overflow: hidden; border-radius: 6px 0 0 6px; align-self: stretch;">
            <img src="${thumbnailUrl}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
    ` : '';

    // ⚡ 성능 최적화: gradient → 단색, box-shadow 간소화
    container.innerHTML = `
        <div style="
            display: flex; flex-direction: row; align-items: stretch;
            background: ${AD_BG_COLOR};
            border-radius: 10px;
            border: 1px solid ${theme.primary}80;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            overflow: hidden;
        ">
            ${thumbnailHTML}
            <div style="display: flex; flex-direction: column; padding: 8px 12px; gap: 2px; justify-content: center;">
                <span style="font-size: 12px; font-weight: 700; color: #ffffff; white-space: nowrap;">${truncateName(name, 10)}</span>
                ${phoneNumber ? `<span style="font-size: 10px; color: #9ca3af;">${phoneNumber}</span>` : ''}
            </div>
        </div>
        ${createMarkerArrow(AD_BG_COLOR, 8)}
    `;
    return container;
}

// 하위 호환성을 위한 래퍼 함수
function createIndustrialComplexAdMarkerDOM(name: string, phoneNumber?: string, thumbnailUrl?: string): HTMLDivElement {
    return createAdMarkerDOM('industrial-complex', name, phoneNumber, thumbnailUrl);
}

function createKnowledgeCenterAdMarkerDOM(name: string, phoneNumber?: string, thumbnailUrl?: string): HTMLDivElement {
    return createAdMarkerDOM('knowledge-center', name, phoneNumber, thumbnailUrl);
}

// 산업단지 마커 - 주황색 카드 스타일 (조성상태 조건부 렌더링)
function createIndustrialComplexMarkerDOM(
    name: string,
    status?: ComplexStatus,
    completionRate?: number,
    listingCount?: number,
    auctionCount?: number,
    salePricePerPyeong?: number
): HTMLDivElement {
    const IC_COLOR = '#ff6b35';
    const container = document.createElement('div');
    container.style.cssText = `${MARKER_CONTAINER_STYLE.withShadow} ${MARKER_ANCHOR.bottom}`;

    const displayName = truncateName(name);
    const isComplete = status === '조성완료';

    // 조성 완료: 매물/경매 뱃지, 미완료: 상태 표시, 없으면 빈 문자열
    let statsHTML = '';
    if (isComplete && (listingCount || auctionCount)) {
        statsHTML = createStatsBadges(listingCount ?? 0, auctionCount ?? 0);
    } else if (status && completionRate !== undefined) {
        statsHTML = `<span style="font-size: 9px; color: rgba(255,255,255,0.9);">${status} ${completionRate}%</span>`;
    }

    const priceText = salePricePerPyeong ? `<span style="font-size: 9px; color: rgba(255,255,255,0.8); margin-left: auto;">${salePricePerPyeong}만/평</span>` : '';

    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: ${IC_COLOR}; border-radius: 6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
            <span style="font-size: 11px; font-weight: 600; color: white; white-space: nowrap;">${displayName}</span>
            ${statsHTML}
            ${priceText}
        </div>
        <div style="display: flex; justify-content: center; width: 100%;">${createMarkerArrow(IC_COLOR)}</div>
    `;
    return container;
}

// 산업단지 클러스터 마커 - 카드 스타일
function createIndustrialComplexClusterDOM(count: number): HTMLDivElement {
    const IC_COLOR = '#ff6b35';
    const container = document.createElement('div');
    container.style.cssText = `${MARKER_CONTAINER_STYLE.withShadow} ${MARKER_ANCHOR.bottom}`;
    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: rgba(255,255,255,0.95); border-radius: 6px; border: 2px solid ${IC_COLOR};">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${IC_COLOR}" stroke-width="2.5"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
            <span style="font-size: 12px; font-weight: 700; color: ${IC_COLOR};">${count}</span>
            <span style="font-size: 9px; color: #666;">산단</span>
        </div>
        <div style="display: flex; justify-content: center; width: 100%;">${createMarkerArrow(IC_COLOR)}</div>
    `;
    return container;
}

// 지식산업센터 마커 - 파란색 카드 스타일 (컴팩트, 직관적 라벨)
function createKnowledgeCenterMarkerDOM(
    name: string,
    status?: string,
    completionRate?: number,
    listingCount?: number,
    auctionCount?: number,
    salePricePerPyeong?: number
): HTMLDivElement {
    const KC_COLOR = '#0066FF';
    const container = document.createElement('div');
    container.style.cssText = `${MARKER_CONTAINER_STYLE.withShadow} ${MARKER_ANCHOR.bottom}`;

    const displayName = truncateName(name);
    const isComplete = status === '완료신고';

    // 완료신고: 매물/경매 뱃지, 미완료: 상태 표시
    const statsHTML = isComplete
        ? createStatsBadges(listingCount ?? 0, auctionCount ?? 0)
        : (status ? `<span style="font-size: 9px; color: rgba(255,255,255,0.9);">${status} ${completionRate ?? 0}%</span>` : '');

    const priceText = salePricePerPyeong ? `<span style="font-size: 9px; color: rgba(255,255,255,0.8); margin-left: auto;">${salePricePerPyeong}만/평</span>` : '';

    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: ${KC_COLOR}; border-radius: 6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
                <path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/>
                <path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/>
                <path d="M8 10h.01"/><path d="M8 14h.01"/>
            </svg>
            <span style="font-size: 11px; font-weight: 600; color: white; white-space: nowrap;">${displayName}</span>
            ${statsHTML}
            ${priceText}
        </div>
        <div style="display: flex; justify-content: center; width: 100%;">${createMarkerArrow(KC_COLOR)}</div>
    `;
    return container;
}

// 지식산업센터 클러스터 마커 - 카드 스타일
function createKnowledgeCenterClusterDOM(count: number): HTMLDivElement {
    const KC_COLOR = '#0066FF';
    const container = document.createElement('div');
    container.style.cssText = `${MARKER_CONTAINER_STYLE.withShadow} ${MARKER_ANCHOR.bottom}`;
    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: rgba(255,255,255,0.95); border-radius: 6px; border: 2px solid ${KC_COLOR};">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${KC_COLOR}" stroke-width="2.5">
                <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
                <path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/>
            </svg>
            <span style="font-size: 12px; font-weight: 700; color: ${KC_COLOR};">${count}</span>
            <span style="font-size: 9px; color: #666;">지산</span>
        </div>
        <div style="display: flex; justify-content: center; width: 100%;">${createMarkerArrow(KC_COLOR)}</div>
    `;
    return container;
}

// ========== 매물 유형별 마커 (공장, 창고, 토지) - 통일된 깔끔한 스타일 ==========

// 공장 마커 - 깔끔한 라벨 스타일
function createFactoryMarkerDOM(name: string): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = MARKER_CONTAINER_STYLE.base;
    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 5px; padding: 6px 12px; background: ${COLORS.entity.factory}; border-radius: 6px; box-shadow: 0 2px 6px ${COLORS.entity.factoryGlow};">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M2 20V8l6 4V8l6 4V4h8v16H2z"/></svg>
            <span style="font-size: 13px; font-weight: 500; color: #fff; white-space: nowrap;">${truncateName(name, 10)}</span>
        </div>
        ${createMarkerArrow(COLORS.entity.factory, 6)}
    `;
    return container;
}

// 공장 클러스터 마커 - 깔끔한 원형 배지
function createFactoryClusterDOM(count: number): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = MARKER_CONTAINER_STYLE.base;
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: ${COLORS.entity.factory}; border-radius: 50%; box-shadow: 0 2px 6px ${COLORS.entity.factoryGlow}; border: 2px solid #fff;">
            <span style="font-size: 14px; font-weight: 700; color: #fff;">${count}</span>
        </div>
        <div style="font-size: 11px; color: ${COLORS.entity.factory}; font-weight: 600; margin-top: 2px;">공장</div>
    `;
    return container;
}

// 창고 마커 - 깔끔한 라벨 스타일
function createWarehouseMarkerDOM(name: string): HTMLDivElement {
    const WAREHOUSE_COLOR = '#EA580C';
    const container = document.createElement('div');
    container.style.cssText = MARKER_CONTAINER_STYLE.base;
    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 5px; padding: 6px 12px; background: ${WAREHOUSE_COLOR}; border-radius: 6px; box-shadow: 0 2px 6px rgba(234, 88, 12, 0.4);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M3 21V9l9-6 9 6v12H3z"/><rect x="9" y="13" width="6" height="8"/></svg>
            <span style="font-size: 13px; font-weight: 500; color: #fff; white-space: nowrap;">${truncateName(name, 10)}</span>
        </div>
        ${createMarkerArrow(WAREHOUSE_COLOR, 6)}
    `;
    return container;
}

// 창고 클러스터 마커 - 깔끔한 원형 배지
function createWarehouseClusterDOM(count: number): HTMLDivElement {
    const WAREHOUSE_COLOR = '#EA580C';
    const container = document.createElement('div');
    container.style.cssText = MARKER_CONTAINER_STYLE.base;
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: ${WAREHOUSE_COLOR}; border-radius: 50%; box-shadow: 0 2px 6px rgba(234, 88, 12, 0.4); border: 2px solid #fff;">
            <span style="font-size: 14px; font-weight: 700; color: #fff;">${count}</span>
        </div>
        <div style="font-size: 11px; color: ${WAREHOUSE_COLOR}; font-weight: 600; margin-top: 2px;">창고</div>
    `;
    return container;
}

// 토지 마커 - 깔끔한 라벨 스타일
function createLandMarkerDOM(jibun: string): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = MARKER_CONTAINER_STYLE.base;
    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 5px; padding: 6px 12px; background: ${LAND_COLOR}; border-radius: 6px; box-shadow: 0 2px 6px rgba(22, 163, 74, 0.4);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            <span style="font-size: 13px; font-weight: 500; color: #fff; white-space: nowrap;">${truncateName(jibun, 12)}</span>
        </div>
        ${createMarkerArrow(LAND_COLOR, 6)}
    `;
    return container;
}

// 토지 클러스터 마커 - 깔끔한 원형 배지
function createLandClusterDOM(count: number): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = MARKER_CONTAINER_STYLE.base;
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: ${LAND_COLOR}; border-radius: 50%; box-shadow: 0 2px 6px rgba(22, 163, 74, 0.4); border: 2px solid #fff;">
            <span style="font-size: 14px; font-weight: 700; color: #fff;">${count}</span>
        </div>
        <div style="font-size: 11px; color: ${LAND_COLOR}; font-weight: 600; margin-top: 2px;">토지</div>
    `;
    return container;
}

// ========== 메인 컴포넌트 ==========

function UnifiedMarkerLayerInner({ map, skipTransactionMarkers = false }: UnifiedMarkerLayerProps) {
    // MarkerManager 인스턴스 (풀링 관리)
    const markerManagerRef = useRef<MarkerManager | null>(null);
    const kcClusterRef = useRef<Supercluster | null>(null);

    // ⚡ Canvas 렌더러 (GPU 가속)
    const canvasRendererRef = useRef<CanvasMarkerRenderer | null>(null);
    const canvasLayerAddedRef = useRef(false);

    // ⚡ 성능: Supercluster.getClusters() 결과 캐싱 (줌 렉 방지)
    const clusterCacheRef = useRef<Map<string, any[]>>(new Map());

    // ⚡ 성능: 마지막 렌더링 키 (동일하면 전체 렌더링 스킵)
    const lastRenderKeyRef = useRef<string>('');

    // 산업단지 폴리곤 추적용 refs
    const icPolygonCacheRef = useRef<CachedPolygon[]>([]);
    const icContainerRef = useRef<HTMLDivElement | null>(null);
    const icRafIdRef = useRef<number>(0);
    const icIsMovingRef = useRef(false);
    const icMarkersRef = useRef<Map<string, HTMLDivElement>>(new Map());
    // ✅ 이벤트 핸들러 저장 (메모리 누수 방지)
    const icHandlersRef = useRef<Map<string, { click: (e: Event) => void; enter: () => void; leave: () => void }>>(new Map());

    // MarkerManager 초기화
    useEffect(() => {
        if (!markerManagerRef.current) {
            markerManagerRef.current = new MarkerManager();
        }
        return () => {
            markerManagerRef.current?.dispose();
            markerManagerRef.current = null;
        };
    }, []);

    // ⚡ Canvas 렌더러 초기화
    useEffect(() => {
        if (!RENDERING.useCanvasMarkers || !map) return;

        // 내부 Mapbox GL 인스턴스 접근
        const mbMap = (map as any)._mapbox;
        if (!mbMap) return;

        // Canvas 렌더러 생성
        if (!canvasRendererRef.current) {
            canvasRendererRef.current = new CanvasMarkerRenderer();
        }

        // Mapbox GL Custom Layer 추가
        if (!canvasLayerAddedRef.current) {
            const layer = canvasRendererRef.current.getLayer('canvas-markers');

            try {
                // 다른 마커 레이어 위에 표시
                mbMap.addLayer(layer);
                canvasLayerAddedRef.current = true;
                logger.log('[Canvas] ⚡ Canvas 마커 레이어 추가 완료');
            } catch (e) {
                logger.warn('[Canvas] 레이어 추가 실패:', e);
            }
        }

        return () => {
            // 정리
            if (canvasLayerAddedRef.current) {
                try {
                    mbMap.removeLayer('canvas-markers');
                    canvasLayerAddedRef.current = false;
                } catch (e) {
                    // ignore - 이미 제거되었을 수 있음
                }
            }
            canvasRendererRef.current?.cleanup();
            canvasRendererRef.current = null;
        };
    }, [map]);

    // 지도 인스턴스 연결
    useEffect(() => {
        markerManagerRef.current?.setMap(map);
    }, [map]);

    // ===== Store 상태 (그룹화된 훅으로 렌더링 최적화) =====

    // 뷰포트 (bounds + zoom)
    const { currentBounds, currentZoom } = useViewportState();

    // 마커 데이터
    const { parcels, regionAggregations, knowledgeCenters, industrialComplexes } = useMarkerLayerData();

    // 필터
    const filteredParcels = useFilteredParcels();
    const isFilterActive = useIsFilterActive();

    // 선택 상태 + 액션
    const { selection, setSelectedParcel, enterFocusMode } = useMarkerLayerSelection();
    const selectedParcel = selection?.type === 'parcel' ? selection.data : null;

    // UI 설정
    const { visibleLayers, clusteringDisableZoom, markerSampleRate, transactionYearRange, transactionPriceDisplayMode } = useMarkerLayerSettings();
    const { setHiddenMarkerCount } = useMarkerLayerActions();

    // 레이어 가시성 체크
    // skipTransactionMarkers: WebGL 레이어 활성화 시 DOM 마커 비활성화
    const showTransactionMarker = visibleLayers.has('transaction-marker') && !skipTransactionMarkers;
    const showListingMarker = visibleLayers.has('listing-marker');
    const showAuctionMarker = visibleLayers.has('auction-marker');
    const showKnowledgeCenter = visibleLayers.has('knowledge-center');
    const showIndustrialComplex = visibleLayers.has('industrial-complex');

    // 필터 활성화 시 filteredParcels 사용, 아니면 전체 parcels
    const baseParcels = isFilterActive ? filteredParcels : parcels;

    // 샘플링 적용 (일관된 결과를 위해 ID 해시 기반, 캐싱됨)
    const { displayParcels, hiddenCount } = useMemo(() => {
        if (markerSampleRate >= 1.0) {
            return { displayParcels: baseParcels, hiddenCount: 0 };
        }

        // ID 기반 해시로 일관된 샘플링 (캐싱된 해시 함수 사용)
        const sampled = baseParcels.filter((p) => getSamplingHash(p.id) < markerSampleRate);

        return {
            displayParcels: sampled,
            hiddenCount: baseParcels.length - sampled.length
        };
    }, [baseParcels, markerSampleRate]);

    // 정수 줌 레벨 (스로틀 적용 - 줌 렉 방지)
    const [flooredZoom, setFlooredZoom] = useState(Math.floor(currentZoom));
    const zoomThrottleRef = useRef<NodeJS.Timeout | null>(null);
    const lastZoomUpdateRef = useRef<number>(0);

    useEffect(() => {
        const newFloor = Math.floor(currentZoom);
        if (newFloor === flooredZoom) return;

        // ⚡ 성능: 줌 업데이트도 150ms 스로틀 (클러스터링 재계산 빈도 감소)
        const now = Date.now();
        const elapsed = now - lastZoomUpdateRef.current;

        if (elapsed < 150) {
            // 150ms 이내 재호출 → 타이머로 지연
            if (zoomThrottleRef.current) {
                clearTimeout(zoomThrottleRef.current);
            }
            zoomThrottleRef.current = setTimeout(() => {
                setFlooredZoom(newFloor);
                lastZoomUpdateRef.current = Date.now();
                zoomThrottleRef.current = null;
            }, 150 - elapsed);
        } else {
            // 150ms 경과 → 즉시 업데이트
            setFlooredZoom(newFloor);
            lastZoomUpdateRef.current = now;
        }

        // 정리 함수
        return () => {
            if (zoomThrottleRef.current) {
                clearTimeout(zoomThrottleRef.current);
            }
        };
    }, [currentZoom, flooredZoom]);

    // 스로틀된 bounds (150ms로 증가)
    const [throttledBounds, setThrottledBounds] = useState(currentBounds);
    const boundsThrottleRef = useRef<NodeJS.Timeout | null>(null);
    const lastBoundsUpdateRef = useRef<number>(0);

    useEffect(() => {
        let cancelled = false;  // ✅ 취소 플래그 (stale 상태 업데이트 방지)
        const now = Date.now();
        const elapsed = now - lastBoundsUpdateRef.current;

        // 메모리 누수 방지: 기존 타이머 항상 정리 후 새 타이머 설정
        if (boundsThrottleRef.current) {
            clearTimeout(boundsThrottleRef.current);
            boundsThrottleRef.current = null;
        }

        if (elapsed >= TIMING.debounce.markerLayer) {
            lastBoundsUpdateRef.current = now;
            setThrottledBounds(currentBounds);
        } else {
            boundsThrottleRef.current = setTimeout(() => {
                if (cancelled) return;  // ✅ 취소 확인
                lastBoundsUpdateRef.current = Date.now();
                setThrottledBounds(currentBounds);
                boundsThrottleRef.current = null; // 타이머 완료 후 정리
            }, TIMING.debounce.markerLayer - elapsed);
        }

        return () => {
            cancelled = true;  // ✅ 플래그 설정
            if (boundsThrottleRef.current) {
                clearTimeout(boundsThrottleRef.current);
                boundsThrottleRef.current = null;
            }
        };
    }, [currentBounds]);

    const mapBounds = useMemo((): BBox | null => {
        if (!throttledBounds) return null;
        return [throttledBounds.minLng, throttledBounds.minLat, throttledBounds.maxLng, throttledBounds.maxLat];
    }, [throttledBounds]);

    // ⚡ 성능: 숨겨진 마커 개수 계산 최적화 (43,000개 → 뷰포트 내 필지만)
    useEffect(() => {
        if (!throttledBounds || markerSampleRate >= 1.0) {
            setHiddenMarkerCount(0);
            return;
        }

        const { minLng, minLat, maxLng, maxLat } = throttledBounds;

        // ⚡ 최적화: displayParcels (이미 필터링됨)를 사용
        // baseParcels (43,000개) 대신 displayParcels (뷰포트 내 수백개) 사용
        let hiddenInViewport = 0;
        for (const p of displayParcels) {
            const [lng, lat] = p.coord;
            // 뷰포트 내에 있는지 확인
            if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
                // 해시 계산 (샘플링과 동일한 로직)
                const hash = getSamplingHash(p.id);
                // 샘플링에서 제외된 것만 카운트
                if (hash >= markerSampleRate) {
                    hiddenInViewport++;
                }
            }
        }

        setHiddenMarkerCount(hiddenInViewport);
    }, [throttledBounds, displayParcels, markerSampleRate, setHiddenMarkerCount]);

    // 좌표 있는 지식산업센터만 필터
    const knowledgeCentersWithCoord = useMemo(() => {
        return knowledgeCenters.filter(kc => kc.coord !== null && kc.coord[0] !== 0);
    }, [knowledgeCenters]);

    // 좌표 있는 산업단지만 필터
    const industrialComplexesWithCoord = useMemo(() => {
        return industrialComplexes.filter(ic => ic.coord !== null && ic.coord[0] !== 0);
    }, [industrialComplexes]);

    // 매물 유형: 공장, 지산, 창고, 토지
    const PROPERTY_TYPES = ['factory', 'knowledge-center', 'warehouse', 'land'] as const;

    // Supercluster (필지 레벨)
    // - 실거래가: 매물 유형별 분리 (평균가 비교 의미 있음)
    // - 매물/경매: 통합 (개수만 보여주므로 유형 구분 불필요)
    // - 지산 실거래가: 실제 지식산업센터 위치에서만 표시

    // 지산 실거래가가 실제 지산 위치에 있는지 확인 (약 200m 이내)
    const isNearKnowledgeCenter = useCallback((coord: [number, number]): boolean => {
        const THRESHOLD = 0.002; // 약 200m (위도/경도 기준)
        for (const kc of knowledgeCentersWithCoord) {
            if (kc.coord) {
                const dLng = Math.abs(coord[0] - kc.coord[0]);
                const dLat = Math.abs(coord[1] - kc.coord[1]);
                if (dLng < THRESHOLD && dLat < THRESHOLD) {
                    return true;
                }
            }
        }
        return false;
    }, [knowledgeCentersWithCoord]);

    const {
        transactionClusterByType,
        listingCluster,
        auctionCluster,
    } = useMemo(() => {
        // ⚡ 성능: 클러스터 재생성 시 캐시 무효화
        clusterCacheRef.current.clear();

        const clusterStart = performance.now();
        const config = createClusterConfig();

        // 실거래가: 유형별 클러스터
        const txByType: Record<string, Supercluster> = {};
        for (const pt of PROPERTY_TYPES) {
            txByType[pt] = new Supercluster(config);
        }

        // 매물/경매: 통합 클러스터
        const listCluster = new Supercluster(config);
        const auctCluster = new Supercluster(config);

        // 피처 배열
        const txFeatures: Record<string, GeoJSON.Feature<GeoJSON.Point>[]> = {};
        for (const pt of PROPERTY_TYPES) {
            txFeatures[pt] = [];
        }
        const listFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
        const auctFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];

        let kcTxFiltered = 0;  // 필터링된 지산 실거래가 개수

        for (const p of displayParcels) {
            if (p.type === 0) continue;

            // 1. 지산 → KC 위치 매칭
            // 2. 공장/창고 → propertyType 있으면 그대로 사용
            // 3. 나머지 → land (지목 추출)
            let propType: string;
            if (isNearKnowledgeCenter(p.coord)) {
                propType = 'knowledge-center';
            } else if (p.propertyType === 'factory' || p.propertyType === 'warehouse') {
                propType = p.propertyType;
            } else {
                propType = 'land';
            }

            // ===== 마커 우선순위: 매물 > 경매 > 실거래 =====
            const hasListing = hasListingPrice(p.type) && p.listingPrice;
            const hasAuction = hasAuctionPrice(p.type) && p.auctionPrice;
            const hasTransaction = hasTransactionPrice(p.type) && p.transactionPrice;

            // 매물: 통합 클러스터 (경매 정보 함께 포함)
            if (hasListing) {
                listFeatures.push({
                    type: 'Feature',
                    properties: {
                        id: p.id,
                        area: p.area,
                        price: p.listingPrice,
                        dealType: p.dealType,
                        propertyType: propType,
                        // 경매 정보 함께 저장
                        auctionPrice: hasAuction ? p.auctionPrice : undefined,
                        auctionFailCount: hasAuction ? p.auctionFailCount : undefined,
                        // 실거래가 정보도 함께 저장 (우선순위 판단용)
                        hasTransaction: hasTransaction,
                    },
                    geometry: { type: 'Point', coordinates: p.coord },
                });
            }
            // 경매: 매물이 없을 때만 추가
            else if (hasAuction) {
                auctFeatures.push({
                    type: 'Feature',
                    properties: {
                        id: p.id,
                        area: p.area,
                        price: p.auctionPrice,
                        failCount: p.auctionFailCount,
                        propertyType: propType,
                        // 실거래가 정보도 함께 저장 (우선순위 판단용)
                        hasTransaction: hasTransaction,
                    },
                    geometry: { type: 'Point', coordinates: p.coord },
                });
            }

            // 실거래가: 항상 클러스터에 추가 (점 마커로 표시하기 위함)
            // DOM 마커 렌더링 시 매물/경매 우선순위로 필터링
            if (hasTransaction) {
                // 년도 범위 필터 적용
                if (transactionYearRange && p.transactions && p.transactions.length > 0) {
                    // transactions 배열에서 범위 내 거래 필터링
                    const filteredTx = p.transactions.filter(tx => {
                        const year = parseInt(tx.date.substring(0, 4));
                        return year >= transactionYearRange.from && year <= transactionYearRange.to;
                    });

                    // 범위 내 거래가 없으면 마커 제외
                    if (filteredTx.length === 0) continue;

                    // 필터링된 거래 중 최신 거래 사용
                    const latestTx = filteredTx.reduce((a, b) => a.date > b.date ? a : b);
                    const pricePerPyeong = calculatePricePerPyeong(latestTx.price, p.area);

                    // 지산 실거래가는 실제 지식산업센터 위치에서만 표시
                    if (propType === 'knowledge-center') {
                        if (isNearKnowledgeCenter(p.coord)) {
                            txFeatures[propType].push({
                                type: 'Feature',
                                properties: {
                                    id: p.id,
                                    area: p.area,
                                    price: latestTx.price,
                                    pricePerPyeong,
                                    propertyType: propType,
                                    jibun: p.jibun,
                                    transactionDate: latestTx.date,
                                    // 우선순위 판단용
                                    hasListing,
                                    hasAuction,
                                },
                                geometry: { type: 'Point', coordinates: p.coord },
                            });
                        } else {
                            kcTxFiltered++;
                        }
                    } else {
                        txFeatures[propType].push({
                            type: 'Feature',
                            properties: {
                                id: p.id,
                                area: p.area,
                                price: latestTx.price,
                                pricePerPyeong,
                                propertyType: propType,
                                jibun: p.jibun,
                                transactionDate: latestTx.date,
                                // 우선순위 판단용
                                hasListing,
                                hasAuction,
                            },
                            geometry: { type: 'Point', coordinates: p.coord },
                        });
                    }
                } else {
                    // 필터 없음 또는 transactions 없음 - 기존 로직 사용
                    const pricePerPyeong = calculatePricePerPyeong(p.transactionPrice, p.area);

                    // 최신 거래 날짜 추출 (transactions 배열이 있으면)
                    let transactionDate: string | undefined = undefined;
                    if (p.transactions && p.transactions.length > 0) {
                        const latestTx = p.transactions.reduce((a, b) => a.date > b.date ? a : b);
                        transactionDate = latestTx.date;
                    }

                    // 지산 실거래가는 실제 지식산업센터 위치에서만 표시
                    if (propType === 'knowledge-center') {
                        if (isNearKnowledgeCenter(p.coord)) {
                            txFeatures[propType].push({
                                type: 'Feature',
                                properties: {
                                    id: p.id,
                                    area: p.area,
                                    price: p.transactionPrice,
                                    pricePerPyeong,
                                    propertyType: propType,
                                    jibun: p.jibun,
                                    transactionDate,
                                    // 우선순위 판단용
                                    hasListing,
                                    hasAuction,
                                },
                                geometry: { type: 'Point', coordinates: p.coord },
                            });
                        } else {
                            kcTxFiltered++;
                        }
                    } else {
                        txFeatures[propType].push({
                            type: 'Feature',
                            properties: {
                                id: p.id,
                                area: p.area,
                                price: p.transactionPrice,
                                pricePerPyeong,
                                propertyType: propType,
                                jibun: p.jibun,
                                transactionDate,
                                // 우선순위 판단용
                                hasListing,
                                hasAuction,
                            },
                            geometry: { type: 'Point', coordinates: p.coord },
                        });
                    }
                }
            }
        }

        // 클러스터 로드
        for (const propType of PROPERTY_TYPES) {
            txByType[propType].load(txFeatures[propType] as any);
        }
        listCluster.load(listFeatures as any);
        auctCluster.load(auctFeatures as any);

        const clusterEnd = performance.now();
        const clusterTime = clusterEnd - clusterStart;
        if (clusterTime > 30) {  // 30ms 이상 걸리면 로그
            console.warn(`🐌 [성능] Supercluster 생성/로드 느림: ${clusterTime.toFixed(1)}ms | 필지: ${displayParcels.length}`);
        }

        logger.log(`📊 [Supercluster] 실거래 유형별: 공장 ${txFeatures.factory.length}, 지산 ${txFeatures['knowledge-center'].length}${kcTxFiltered > 0 ? ` (${kcTxFiltered}개 필터링됨)` : ''}, 창고 ${txFeatures.warehouse.length}, 토지 ${txFeatures.land.length} / 매물 ${listFeatures.length}, 경매 ${auctFeatures.length}`);

        return {
            transactionClusterByType: txByType,
            listingCluster: listCluster,
            auctionCluster: auctCluster,
        };
    }, [displayParcels, isNearKnowledgeCenter, transactionYearRange]);

    // 지식산업센터: 광고 아이템 분리 (클러스터링 제외)
    const { kcCluster, kcAdItems } = useMemo(() => {
        const cluster = new Supercluster({
            radius: 80,
            maxZoom: 16,
            minZoom: 0,
            minPoints: 2,
        });

        // 광고가 아닌 아이템만 클러스터링
        const regularItems = knowledgeCentersWithCoord.filter(kc => !kc.isAd);
        // 광고 아이템은 별도 배열로 분리
        const adItems = knowledgeCentersWithCoord.filter(kc => kc.isAd);

        const features: GeoJSON.Feature<GeoJSON.Point>[] = regularItems.map(kc => ({
            type: 'Feature',
            properties: {
                id: kc.id,
                name: kc.name,
                status: kc.status,
                completionRate: kc.completionRate,
                listingCount: kc.listingCount,
                auctionCount: kc.auctionCount,
                salePricePerPyeong: kc.salePricePerPyeong,
            },
            geometry: { type: 'Point', coordinates: kc.coord as [number, number] },
        }));

        cluster.load(features as any);
        kcClusterRef.current = cluster;

        logger.log(`📊 [Supercluster] 지식산업센터 로드: ${features.length}개 (광고 ${adItems.length}개는 별도 렌더링)`);
        return { kcCluster: cluster, kcAdItems: adItems };
    }, [knowledgeCentersWithCoord]);

    // 산업단지: 광고 아이템 분리 (클러스터링 제외)
    const icClusterRef = useRef<Supercluster | null>(null);
    const { icCluster, icAdItems } = useMemo(() => {
        const cluster = new Supercluster({
            radius: 80,
            maxZoom: 14,  // 산업단지는 더 낮은 줌에서 개별 표시
            minZoom: 0,
            minPoints: 2,
        });

        // 광고가 아닌 아이템만 클러스터링
        const regularItems = industrialComplexesWithCoord.filter(ic => !ic.isAd);
        // 광고 아이템은 별도 배열로 분리
        const adItems = industrialComplexesWithCoord.filter(ic => ic.isAd);

        const features: GeoJSON.Feature<GeoJSON.Point>[] = regularItems.map(ic => ({
            type: 'Feature',
            properties: {
                id: ic.id,
                name: ic.name,
                status: ic.status,
                completionRate: ic.completionRate,
                listingCount: ic.listingCount,
                auctionCount: ic.auctionCount,
                salePricePerPyeong: ic.salePricePerPyeong,
            },
            geometry: { type: 'Point', coordinates: ic.coord },
        }));

        cluster.load(features as any);
        icClusterRef.current = cluster;

        logger.log(`📊 [Supercluster] 산업단지 로드: ${features.length}개 (광고 ${adItems.length}개는 별도 렌더링)`);
        return { icCluster: cluster, icAdItems: adItems };
    }, [industrialComplexesWithCoord]);

    // 핸들러
    const handleClusterClick = useCallback((clusterId: number, lat: number, lng: number, clusterRef: React.MutableRefObject<Supercluster | null>) => {
        if (!map || !clusterRef.current) return;
        try {
            const expansionZoom = clusterRef.current.getClusterExpansionZoom(clusterId);
            (map as any).morph(new window.naver.maps.LatLng(lat, lng), Math.min(expansionZoom, 19), { duration: 300 });
        } catch { /* ignore */ }
    }, [map]);

    const handleParcelClick = useCallback(async (pnu: string) => {
        logger.log(`🖱️ [마커 클릭] PNU: ${pnu}`);

        // 즉시 패널 열기 (기본 정보로)
        const basicInfo = {
            id: pnu,
            pnu: pnu,
            jibun: '',
            address: '',
            area: 0,
            transactionPrice: 0,
        };

        try {
            const { useUIStore } = await import('@/lib/stores/ui-store');
            setSelectedParcel(basicInfo as any);
            useUIStore.getState().openSidePanel('detail');
            logger.log('✅ [마커] 패널 열기 완료');

            // API로 상세 정보 로드 (백그라운드)
            const response = await fetch(`/api/parcel/${pnu}`);
            if (response.ok) {
                const apiData = await response.json();
                setSelectedParcel(apiData);
                logger.log('✅ [마커] API 데이터 로드 완료');
            } else {
                logger.warn(`⚠️ [마커] API 응답 실패: ${response.status}`);
            }
        } catch (e) {
            logger.error('❌ 필지 상세 로드 실패:', e);
        }
    }, [setSelectedParcel]);

    const handleRegionClick = useCallback((lat: number, lng: number, level: 'sido' | 'sig' | 'emd') => {
        if (!map) return;
        const targetZoom = level === 'sido' ? ZOOM_LEVELS.SIG.min : level === 'sig' ? ZOOM_LEVELS.EMD.min : ZOOM_LEVELS.PARCEL.min;
        (map as any).morph(new window.naver.maps.LatLng(lat, lng), targetZoom, { duration: 300 });
    }, [map]);


    // 마커 생성/업데이트 (MarkerManager 풀링 적용)
    useEffect(() => {
        const manager = markerManagerRef.current;
        if (!map || !mapBounds || !manager) {
            return;
        }

        // ⚡ 성능 측정
        const perfStart = performance.now();
        let clusterTime = 0;
        let domTime = 0;

        const zoom = flooredZoom;
        const level = ZoomHelper.getDistrictLevel(zoom);
        const [minLng, minLat, maxLng, maxLat] = mapBounds;

        // ⚡ 성능: Supercluster.getClusters() 캐싱 헬퍼 (줌 렉 90% 감소)
        const cache = clusterCacheRef.current;

        // bounds를 bucketing해서 캐시 히트율 증가 (0.01도 = ~1km 단위)
        const bucketBounds = (bbox: BBox): string => {
            const bucket = 0.01;
            return [
                Math.floor(bbox[0] / bucket),
                Math.floor(bbox[1] / bucket),
                Math.ceil(bbox[2] / bucket),
                Math.ceil(bbox[3] / bucket),
            ].join(',');
        };

        // ⚡ 성능: 동일한 줌/bounds면 전체 렌더링 스킵 (95% 렉 감소)
        const renderKey = `z${zoom}-${bucketBounds(mapBounds)}`;
        if (renderKey === lastRenderKeyRef.current) {
            // 완전히 동일한 상태 - 렌더링 불필요
            return;
        }
        lastRenderKeyRef.current = renderKey;

        const getClustersCached = (cluster: Supercluster, bbox: BBox, zoom: number, prefix: string): any[] => {
            const key = `${prefix}-z${zoom}-${bucketBounds(bbox)}`;
            if (cache.has(key)) {
                return cache.get(key)!;
            }
            const result = cluster.getClusters(bbox, zoom);
            cache.set(key, result);
            // 캐시 크기 제한 (최대 50개 항목)
            if (cache.size > 50) {
                const firstKey = cache.keys().next().value;
                cache.delete(firstKey);
            }
            return result;
        };

        // 타입별 현재 사용 중인 ID 추적
        const currentIdsByType = new Map<MarkerType, Set<string>>();
        currentIdsByType.set('region', new Set());
        currentIdsByType.set('transaction', new Set());
        currentIdsByType.set('cluster-tx', new Set());
        currentIdsByType.set('listing', new Set());
        currentIdsByType.set('cluster-prop', new Set());
        currentIdsByType.set('auction', new Set());
        currentIdsByType.set('kc', new Set());
        currentIdsByType.set('kc-cluster', new Set());
        currentIdsByType.set('ic', new Set());
        currentIdsByType.set('ic-cluster', new Set());

        // ========== 행정구역 마커 (줌 0-13) ==========
        if (level !== 'PARCEL') {
            // level은 'SIDO', 'SIG', 'EMD' (대문자) → regionAggregations key는 소문자 필요
            const regionLevel = level.toLowerCase() as 'sido' | 'sig' | 'emd';
            const prefix = `${regionLevel}-`;
            const regionIds = currentIdsByType.get('region')!;

            regionAggregations.forEach((agg, key) => {
                if (!key.startsWith(prefix)) return;
                if (agg.listingCount === 0 && agg.auctionCount === 0) return;

                const markerId = `region-${key}`;
                regionIds.add(markerId);

                const [lng, lat] = agg.coord;
                const position = new window.naver.maps.LatLng(lat, lng);
                const baseZIndex = 200 + Math.floor(((38 - lat) / 5) * 1000);

                const pooledMarker = manager.acquire(
                    markerId,
                    'region',
                    position,
                    () => {
                        const container = createRegionClusterDOM(agg.regionName, agg.listingCount, agg.auctionCount);
                        container.style.transform = 'translate(-50%, -50%)';
                        return container;
                    },
                    new window.naver.maps.Point(0, 0),
                    baseZIndex
                );

                if (pooledMarker && !pooledMarker.cleanup) {
                    const clickHandler = (e: Event) => {
                        e.stopPropagation();
                        handleRegionClick(lat, lng, regionLevel);
                    };
                    // 호버 시 폴리곤 하이라이트용 콜백
                    const onHoverEnter = () => {
                        if (regionLevel === 'sig' || regionLevel === 'emd') {
                            useUIStore.getState().setHoveredRegion(agg.regionCode, regionLevel);
                        }
                    };
                    const onHoverLeave = () => {
                        useUIStore.getState().setHoveredRegion(null, null);
                    };
                    manager.setupHoverEffect(markerId, pooledMarker, baseZIndex, clickHandler, onHoverEnter, onHoverLeave);
                }
            });
        }

        // ========== 필지 마커 (줌 14+) - 매물 유형별 클러스터링 ==========
        // clusteringDisableZoom 이상이면 클러스터링 비활성화 (모든 마커 개별 표시)
        if (level === 'PARCEL') {
            const disableClustering = zoom >= clusteringDisableZoom;
            const clusterZoom = disableClustering
                ? CLUSTER_CONFIG.maxZoom.transaction + 1  // 클러스터링 해제: 개별 마커 모두 표시
                : (zoom >= CLUSTER_CONFIG.maxZoom.transaction ? CLUSTER_CONFIG.maxZoom.transaction + 1 : zoom);

            // 매물/경매 개별 마커로 렌더링된 필지 ID 추적 (실거래 점 마커 제외용)
            const renderedListingParcelIds = new Set<string>();
            const renderedAuctionParcelIds = new Set<string>();

            // 실거래 마커 - 겹치면 Deck.gl 점, 안 겹치면 DOM 마커
            // 화면상 픽셀 거리로 겹침 감지
            if (showTransactionMarker) {
                const txIds = currentIdsByType.get('transaction')!;

                // ⚡ 성능: overlap detection 캐싱 (projection 계산 스킵)
                const overlapCacheKey = `overlap-z${zoom}-${bucketBounds(mapBounds)}`;
                let allTxPoints: Array<{
                    point: any;
                    propType: string;
                    screenX: number;
                    screenY: number;
                    lat: number;
                    lng: number;
                }>;
                let overlapSet: Set<number>;

                if (cache.has(overlapCacheKey)) {
                    // 캐시 히트: projection 계산 스킵!
                    const cached = cache.get(overlapCacheKey) as any;
                    allTxPoints = cached.allTxPoints;
                    overlapSet = cached.overlapSet;
                } else {
                    // 캐시 미스: 계산 필요
                    allTxPoints = [];
                    const projection = map.getProjection();
                    for (const propType of PROPERTY_TYPES) {
                        const txCluster = transactionClusterByType[propType];
                        if (!txCluster) continue;

                        // 클러스터링 비활성화 (개별 마커 모두 가져옴)
                        const txPoints = getClustersCached(txCluster, mapBounds, CLUSTER_CONFIG.maxZoom.transaction + 1, `tx-${propType}`);
                        txPoints.forEach((point: any) => {
                            const [lng, lat] = point.geometry.coordinates;
                            const screenCoord = projection.fromCoordToOffset(
                                new window.naver.maps.LatLng(lat, lng)
                            );
                            allTxPoints.push({
                                point,
                                propType,
                                screenX: screenCoord.x,
                                screenY: screenCoord.y,
                                lat,
                                lng,
                            });
                        });
                    }

                    // 2. 겹침 감지 (그리드 기반 최적화: O(n²) → O(n))
                    const OVERLAP_THRESHOLD_PX = 30; // 30px 이내면 겹침으로 판단
                    const GRID_SIZE = OVERLAP_THRESHOLD_PX; // 그리드 셀 크기
                    overlapSet = new Set<number>(); // 겹치는 마커 인덱스
                    const grid = new Map<string, number[]>(); // 그리드 셀 → 마커 인덱스 배열

                    // 그리드에 마커 할당 (O(n))
                    allTxPoints.forEach((item, idx) => {
                        const cellX = Math.floor(item.screenX / GRID_SIZE);
                        const cellY = Math.floor(item.screenY / GRID_SIZE);
                        const key = `${cellX},${cellY}`;
                        if (!grid.has(key)) grid.set(key, []);
                        grid.get(key)!.push(idx);
                    });

                    // 인접 셀 체크 (O(n), 각 마커는 최대 9개 셀만 확인)
                    allTxPoints.forEach((item, i) => {
                        const cellX = Math.floor(item.screenX / GRID_SIZE);
                        const cellY = Math.floor(item.screenY / GRID_SIZE);

                        // 주변 9개 셀 확인 (3x3 그리드)
                        for (let dx = -1; dx <= 1; dx++) {
                            for (let dy = -1; dy <= 1; dy++) {
                                const key = `${cellX + dx},${cellY + dy}`;
                                const neighbors = grid.get(key);
                                if (!neighbors) continue;

                                for (const j of neighbors) {
                                    if (i >= j) continue; // 중복 체크 방지
                                    const dx2 = allTxPoints[i].screenX - allTxPoints[j].screenX;
                                    const dy2 = allTxPoints[i].screenY - allTxPoints[j].screenY;
                                    const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                                    if (dist < OVERLAP_THRESHOLD_PX) {
                                        overlapSet.add(i);
                                        overlapSet.add(j);
                                    }
                                }
                            }
                        }
                    });

                    // ⚡ 캐시에 저장
                    cache.set(overlapCacheKey, { allTxPoints, overlapSet } as any);
                    if (cache.size > 50) {
                        const firstKey = cache.keys().next().value;
                        cache.delete(firstKey);
                    }
                }

                // 3. 겹치는 마커 + 매물/경매가 있는 실거래가 → store에 저장 (점 마커로 렌더링)
                // 선택된 필지는 점 마커에서도 제외 (하이라이트 마커로 대체)
                const selectedId = selectedParcel?.id || selectedParcel?.pnu;
                const overlappingMarkers: OverlappingTxMarker[] = [];
                let selectedInOverlap = false; // 선택된 필지가 겹치는 마커인지 추적

                allTxPoints.forEach((item, idx) => {
                    const props = item.point.properties;

                    // 조건 1: 실거래가끼리 겹침
                    const isOverlapping = overlapSet.has(idx);

                    // 조건 2: 매물/경매가 있지만 개별 마커로 렌더링 안됨 (클러스터링됨)
                    const hasListingButClustered = props.hasListing && !renderedListingParcelIds.has(props.id);
                    const hasAuctionButClustered = props.hasAuction && !renderedAuctionParcelIds.has(props.id);
                    const hasHigherPriorityButClustered = hasListingButClustered || hasAuctionButClustered;

                    if (isOverlapping || hasHigherPriorityButClustered) {
                        // 선택된 필지는 점 마커에서 제외하고 하이라이트 마커로 표시
                        if (selectedId && props.id === selectedId) {
                            selectedInOverlap = true;
                            return;
                        }
                        overlappingMarkers.push({
                            id: props.id,
                            lng: item.lng,
                            lat: item.lat,
                            propertyType: item.propType,
                        });
                    }
                });
                useMapStore.getState().setOverlappingTxMarkers(overlappingMarkers);

                // 4. 비겹침 마커만 렌더링 (Canvas 또는 DOM)
                // 우선순위: 매물/경매가 있으면 실거래 마커 숨김
                let selectedRenderedInTx = false; // 선택된 필지가 실거래가 마커로 렌더링되었는지

                // ⚡ Canvas 렌더링 경로 (DOM 대체)
                if (RENDERING.useCanvasMarkers && canvasRendererRef.current) {
                    const canvasMarkers: CanvasMarker[] = [];

                    allTxPoints.forEach((item, idx) => {
                        if (overlapSet.has(idx)) return; // 겹치는 마커는 점 마커로 렌더링

                        const { point, propType, lat, lng } = item;
                        const props = point.properties;

                        // 우선순위: 매물이나 경매가 있으면 실거래 DOM 마커는 숨김
                        if (props.hasListing || props.hasAuction) return;

                        const isSelected = selectedId && props.id === selectedId;

                        if (isSelected) {
                            selectedRenderedInTx = true;
                        }

                        // 가격 텍스트
                        let priceText: string;
                        if (transactionPriceDisplayMode === 'perPyeong') {
                            const ppp = props.pricePerPyeong || 0;
                            priceText = formatPricePerPyeong(ppp) || formatTotalPrice(props.price);
                        } else {
                            priceText = formatTotalPrice(props.price);
                        }

                        // Canvas 마커 데이터 생성
                        canvasMarkers.push({
                            id: `tx-${propType}-${props.id}`,
                            lng,
                            lat,
                            type: 'transaction',
                            text: priceText,
                            subtext: isSelected ? (selectedParcel?.jibun || props.jibun) : undefined,
                            bgColor: isSelected ? HIGHLIGHT_MARKER_STYLE.bgColor : TRANSACTION_MARKER_STYLE.bgColor,
                            textColor: isSelected ? HIGHLIGHT_MARKER_STYLE.textColor : TRANSACTION_MARKER_STYLE.color.price,
                            borderColor: isSelected ? HIGHLIGHT_MARKER_STYLE.borderColor : TRANSACTION_MARKER_STYLE.borderColor,
                            shadow: isSelected ? HIGHLIGHT_MARKER_STYLE.shadow : TRANSACTION_MARKER_STYLE.shadow,
                            size: { width: isSelected ? 120 : 80, height: isSelected ? 50 : 32 },
                            fontSize: {
                                main: isSelected ? parseFloat(HIGHLIGHT_MARKER_STYLE.fontSize.price) : parseFloat(TRANSACTION_MARKER_STYLE.fontSize.price),
                                sub: isSelected ? parseFloat(HIGHLIGHT_MARKER_STYLE.fontSize.info) : parseFloat(TRANSACTION_MARKER_STYLE.fontSize.type),
                            },
                            data: props,
                            onClick: () => handleParcelClick(props.id),
                        });
                    });

                    // Canvas에 일괄 렌더링
                    canvasRendererRef.current.setMarkers(canvasMarkers);
                    logger.log(`[Canvas] ⚡ 실거래 마커 ${canvasMarkers.length}개 렌더링`);

                } else {
                    // 🔻 DOM 렌더링 경로 (기존 방식, Canvas 비활성화 시만 사용)
                    allTxPoints.forEach((item, idx) => {
                    if (overlapSet.has(idx)) return; // 겹치는 마커는 점 마커로 렌더링

                    const { point, propType, lat, lng } = item;
                    const props = point.properties;

                    // 우선순위: 매물이나 경매가 있으면 실거래 DOM 마커는 숨김
                    if (props.hasListing || props.hasAuction) return;

                    const isSelected = selectedId && props.id === selectedId;

                    if (isSelected) {
                        selectedRenderedInTx = true;
                    }

                    // 선택 상태가 바뀌면 다른 마커로 인식되어 내용이 갱신됨
                    const markerId = isSelected
                        ? `tx-selected-${props.id}`
                        : `tx-${propType}-${props.id}`;
                    txIds.add(markerId);

                    const position = new window.naver.maps.LatLng(lat, lng);
                    // 선택된 마커는 z-index 높게
                    const baseZIndex = isSelected ? 900 : calculateBaseZIndex(lat, 100);

                    const pooledMarker = manager.acquire(
                        markerId,
                        'transaction',
                        position,
                        () => {
                            // 선택된 필지는 하이라이트 스타일
                            if (isSelected && selectedParcel) {
                                return createHighlightMarkerDOM(
                                    selectedParcel.jibun || props.jibun || '',
                                    selectedParcel.area || 0,
                                    selectedParcel.propertyType || propType,
                                    selectedParcel.transactionPrice || props.price,
                                    selectedParcel.listingPrice,
                                    selectedParcel.auctionPrice,
                                    selectedParcel.auctionFailCount
                                );
                            }
                            // 일반 실거래 마커
                            let priceText: string;
                            if (transactionPriceDisplayMode === 'perPyeong') {
                                const ppp = props.pricePerPyeong || 0;
                                priceText = formatPricePerPyeong(ppp) || formatTotalPrice(props.price);
                            } else {
                                priceText = formatTotalPrice(props.price);
                            }
                            return createTransactionMarkerDOM(
                                priceText,
                                propType,
                                props.jibun,
                                props.transactionDate,
                                props.area
                            );
                        },
                        new window.naver.maps.Point(0, 0),
                        baseZIndex
                    );

                    if (pooledMarker && !pooledMarker.cleanup) {
                        const clickHandler = (e: Event) => {
                            e.stopPropagation();
                            handleParcelClick(props.id);
                        };
                        manager.setupHoverEffect(markerId, pooledMarker, baseZIndex, clickHandler);
                    }
                    }); // DOM forEach 종료
                } // else (DOM 렌더링) 종료

                // 5. 선택된 필지가 겹치는 마커(점)였던 경우 → 별도 하이라이트 마커 렌더링
                // ⚠️ Canvas 모드에서는 위 Canvas 마커 생성에서 이미 처리됨 (isSelected 분기)
                if (!RENDERING.useCanvasMarkers) {
                if (selectedParcel && selectedInOverlap && !selectedRenderedInTx) {
                    const selectedPoint = allTxPoints.find(item => item.point.properties.id === selectedId);
                    if (selectedPoint) {
                        const { point, propType, lat, lng } = selectedPoint;
                        const props = point.properties;
                        const markerId = `tx-highlight-${selectedId}`;
                        txIds.add(markerId);

                        const position = new window.naver.maps.LatLng(lat, lng);
                        const baseZIndex = 900;

                        const pooledMarker = manager.acquire(
                            markerId,
                            'transaction',
                            position,
                            () => createHighlightMarkerDOM(
                                selectedParcel.jibun || props.jibun || '',
                                selectedParcel.area || props.area || 0,
                                selectedParcel.propertyType || propType,
                                selectedParcel.transactionPrice || props.price,
                                selectedParcel.listingPrice,
                                selectedParcel.auctionPrice,
                                selectedParcel.auctionFailCount
                            ),
                            new window.naver.maps.Point(0, 0),
                            baseZIndex
                        );

                        if (pooledMarker && !pooledMarker.cleanup) {
                            const clickHandler = (e: Event) => {
                                e.stopPropagation();
                                handleParcelClick(selectedId!);
                            };
                            manager.setupHoverEffect(markerId, pooledMarker, baseZIndex, clickHandler);
                        }
                    }
                }
                } // if (!RENDERING.useCanvasMarkers) 종료
            } else {
                // 실거래 마커 비활성화 시 겹침 데이터 초기화
                useMapStore.getState().setOverlappingTxMarkers([]);
            }

            // ========== 선택된 필지 하이라이트 마커 (실거래가 마커 레이어 밖에서 선택된 경우) ==========
            // 폴리곤 클릭으로 선택되었거나, 실거래 마커 레이어가 비활성화된 경우에도 하이라이트 표시
            if (selectedParcel && selectedParcel.transactionPrice) {
                const selectedId = selectedParcel.id || selectedParcel.pnu;
                const txIds = currentIdsByType.get('transaction')!;

                // 이미 실거래 마커로 렌더링되었는지 확인
                const alreadyRendered = txIds.has(`tx-selected-${selectedId}`) || txIds.has(`tx-highlight-${selectedId}`);

                if (!alreadyRendered && selectedParcel.coord) {
                    const [lng, lat] = selectedParcel.coord;
                    const markerId = `tx-parcel-highlight-${selectedId}`;
                    txIds.add(markerId);

                    const position = new window.naver.maps.LatLng(lat, lng);
                    const baseZIndex = 900;

                    const pooledMarker = manager.acquire(
                        markerId,
                        'transaction',
                        position,
                        () => createHighlightMarkerDOM(
                            selectedParcel.jibun || '',
                            selectedParcel.area || 0,
                            selectedParcel.propertyType,
                            selectedParcel.transactionPrice,
                            selectedParcel.listingPrice,
                            selectedParcel.auctionPrice,
                            selectedParcel.auctionFailCount
                        ),
                        new window.naver.maps.Point(0, 0),
                        baseZIndex
                    );

                    if (pooledMarker && !pooledMarker.cleanup) {
                        const clickHandler = (e: Event) => {
                            e.stopPropagation();
                            handleParcelClick(selectedId!);
                        };
                        manager.setupHoverEffect(markerId, pooledMarker, baseZIndex, clickHandler);
                    }
                }
            }

            // 매물 마커 - 통합 클러스터링
            if (showListingMarker) {
                const listIds = currentIdsByType.get('listing')!;
                const listClusterIds = currentIdsByType.get('cluster-prop')!;
                const listClusterRef = { current: listingCluster };

                const listClusters = getClustersCached(listingCluster, mapBounds, clusterZoom, 'listing');
                listClusters.forEach((cluster: any) => {
                    const [lng, lat] = cluster.geometry.coordinates;
                    const isCluster = cluster.properties.cluster || false;
                    const props = cluster.properties;
                    const markerId = isCluster
                        ? `list-cluster-${props.cluster_id}`
                        : `list-${props.id}`;
                    const markerType: MarkerType = isCluster ? 'cluster-prop' : 'listing';

                    if (isCluster) {
                        listClusterIds.add(markerId);
                    } else {
                        listIds.add(markerId);
                        // 개별 마커로 렌더링됨 → 실거래 점 마커 불필요
                        renderedListingParcelIds.add(props.id);
                    }

                    const position = new window.naver.maps.LatLng(lat, lng);
                    const baseZIndex = calculateBaseZIndex(lat, 300);

                    const pooledMarker = manager.acquire(
                        markerId,
                        markerType,
                        position,
                        () => {
                            if (isCluster) {
                                const count = props.point_count || props.count || 1;
                                return createListingClusterDOM(count);
                            } else {
                                // 경매 정보가 있으면 함께 전달
                                const auctionInfo = props.auctionPrice ? {
                                    price: props.auctionPrice,
                                    failCount: props.auctionFailCount || 0
                                } : undefined;
                                return createListingMarkerDOM(
                                    formatAreaWithPrefix(props.area || 0),
                                    formatPrice(props.price || 0),
                                    props.dealType || '매매',
                                    props.propertyType,
                                    auctionInfo
                                );
                            }
                        },
                        // 앵커: 중심 (transform으로 조정)
                        new window.naver.maps.Point(0, 0),
                        baseZIndex
                    );

                    if (pooledMarker && !pooledMarker.cleanup) {
                        const clickHandler = isCluster
                            ? (e: Event) => { e.stopPropagation(); handleClusterClick(props.cluster_id, lat, lng, listClusterRef as any); }
                            : (e: Event) => { e.stopPropagation(); handleParcelClick(props.id); };
                        manager.setupHoverEffect(markerId, pooledMarker, baseZIndex, clickHandler);
                    }
                });
            }

            // 경매 마커 - 통합 클러스터링
            if (showAuctionMarker) {
                const auctIds = currentIdsByType.get('auction')!;
                const auctClusterIds = currentIdsByType.get('cluster-prop')!;
                const auctClusterRef = { current: auctionCluster };

                const auctClusters = getClustersCached(auctionCluster, mapBounds, clusterZoom, 'auction');
                auctClusters.forEach((cluster: any) => {
                    const [lng, lat] = cluster.geometry.coordinates;
                    const isCluster = cluster.properties.cluster || false;
                    const props = cluster.properties;
                    const markerId = isCluster
                        ? `auct-cluster-${props.cluster_id}`
                        : `auct-${props.id}`;
                    const markerType: MarkerType = isCluster ? 'cluster-prop' : 'auction';

                    if (isCluster) {
                        auctClusterIds.add(markerId);
                    } else {
                        auctIds.add(markerId);
                        // 개별 마커로 렌더링됨 → 실거래 점 마커 불필요
                        renderedAuctionParcelIds.add(props.id);
                    }

                    const position = new window.naver.maps.LatLng(lat, lng);
                    const baseZIndex = calculateBaseZIndex(lat, 350);

                    const pooledMarker = manager.acquire(
                        markerId,
                        markerType,
                        position,
                        () => {
                            if (isCluster) {
                                const count = props.point_count || props.count || 1;
                                return createAuctionClusterDOM(count);
                            } else {
                                return createAuctionMarkerDOM(formatArea(props.area || 0), formatPrice(props.price || 0), props.failCount, props.propertyType);
                            }
                        },
                        // 앵커: 중심 (transform으로 조정)
                        new window.naver.maps.Point(0, 0),
                        baseZIndex
                    );

                    if (pooledMarker && !pooledMarker.cleanup) {
                        const clickHandler = isCluster
                            ? (e: Event) => { e.stopPropagation(); handleClusterClick(props.cluster_id, lat, lng, auctClusterRef as any); }
                            : (e: Event) => { e.stopPropagation(); handleParcelClick(props.id); };
                        manager.setupHoverEffect(markerId, pooledMarker, baseZIndex, clickHandler);
                    }
                });
            }

        }

        // ========== 산업단지 마커 ==========
        // 폴리곤 가시 영역 추적 마커는 별도 useEffect에서 처리 (아래 참조)
        // 좌표 기반 클러스터링은 폴리곤 추적과 중복되므로 비활성화

        // ========== 지식산업센터 마커 (모든 줌 레벨, 클러스터링 적용) ==========
        if (showKnowledgeCenter && mapBounds) {
            const kcIds = currentIdsByType.get('kc')!;
            const kcClusterIds = currentIdsByType.get('kc-cluster')!;

            // 일반 지식산업센터 (클러스터링 대상)
            const kcClusters = getClustersCached(kcCluster, mapBounds, zoom, 'kc');
            kcClusters.forEach((cluster: any) => {
                const [lng, lat] = cluster.geometry.coordinates;
                const isCluster = cluster.properties.cluster || false;
                const props = cluster.properties;
                const markerId = isCluster ? `kc-cluster-${props.cluster_id}` : `kc-${props.id}`;

                if (isCluster) {
                    kcClusterIds.add(markerId);
                } else {
                    kcIds.add(markerId);
                }

                const position = new window.naver.maps.LatLng(lat, lng);
                const baseZIndex = calculateBaseZIndex(lat, 500);

                const pooledMarker = manager.acquire(
                    markerId,
                    isCluster ? 'kc-cluster' : 'kc',
                    position,
                    () => {
                        if (isCluster) {
                            const count = props.point_count || 1;
                            return createKnowledgeCenterClusterDOM(count);
                        } else {
                            return createKnowledgeCenterMarkerDOM(
                                props.name || '지식산업센터',
                                props.status,
                                props.completionRate,
                                props.listingCount,
                                props.auctionCount,
                                props.salePricePerPyeong
                            );
                        }
                    },
                    new window.naver.maps.Point(0, 0),
                    baseZIndex
                );

                if (pooledMarker && !pooledMarker.cleanup) {
                    const clickHandler = isCluster
                        ? (e: Event) => { e.stopPropagation(); handleClusterClick(props.cluster_id, lat, lng, kcClusterRef); }
                        : (e: Event) => { e.stopPropagation(); logger.log(`🏢 [지식산업센터 클릭] ${props.name}`); };
                    manager.setupHoverEffect(markerId, pooledMarker, baseZIndex, clickHandler);
                }
            });

            // 광고 지식산업센터 (클러스터링 제외, 항상 개별 표시)
            kcAdItems.forEach(kc => {
                if (!kc.coord) return;
                const [lng, lat] = kc.coord;

                // 뷰포트 내에 있는지 확인
                if (lng < mapBounds[0] || lng > mapBounds[2] || lat < mapBounds[1] || lat > mapBounds[3]) {
                    return; // 오프스크린은 OffscreenMarkerLayer에서 처리
                }

                const markerId = `kc-ad-${kc.id}`;
                kcIds.add(markerId);

                const position = new window.naver.maps.LatLng(lat, lng);
                const baseZIndex = calculateBaseZIndex(lat, 600); // 광고는 더 높은 z-index

                const pooledMarker = manager.acquire(
                    markerId,
                    'kc',
                    position,
                    () => createKnowledgeCenterAdMarkerDOM(kc.name, kc.phoneNumber, kc.thumbnailUrl),
                    new window.naver.maps.Point(0, 0),
                    baseZIndex
                );

                if (pooledMarker && !pooledMarker.cleanup) {
                    const clickHandler = (e: Event) => {
                        e.stopPropagation();
                        logger.log(`🏢 [광고 지식산업센터 클릭] ${kc.name}`);
                    };
                    manager.setupHoverEffect(markerId, pooledMarker, baseZIndex, clickHandler);
                }
            });
        }

        // 더 이상 사용되지 않는 마커들을 풀로 반납 (DOM 재사용)
        manager.releaseAllUnused(currentIdsByType);

        // ⚡ 성능 로그
        const perfEnd = performance.now();
        const totalTime = perfEnd - perfStart;
        const cacheHits = [...cache.keys()].filter(k => k.startsWith('overlap-') || k.startsWith('tx-') || k.startsWith('listing-') || k.startsWith('auction-') || k.startsWith('kc-')).length;

        if (totalTime > 50) {  // 50ms 이상 걸리면 로그
            console.warn(`🐌 [성능] 마커 렌더링 느림: ${totalTime.toFixed(1)}ms | 줌: ${zoom} | 캐시: ${cacheHits}개`);
        } else if (totalTime > 20) {
            console.log(`⚡ [성능] 마커 렌더링: ${totalTime.toFixed(1)}ms | 줌: ${zoom} | 캐시: ${cacheHits}개`);
        }

        // 디버그 로깅
        if (process.env.NODE_ENV === 'development') {
            manager.logStats();
        }

    }, [
        map, mapBounds, flooredZoom, regionAggregations,
        transactionClusterByType, listingCluster, auctionCluster, kcCluster, icCluster,
        kcAdItems, icAdItems, selectedParcel,
        handleClusterClick, handleParcelClick, handleRegionClick,
        showKnowledgeCenter, showTransactionMarker, showListingMarker, showAuctionMarker,
        showIndustrialComplex, clusteringDisableZoom, transactionPriceDisplayMode
    ]);

    // ========== 산업단지 폴리곤 추적 마커 (폴리곤 가시 영역에 마커 표시) ==========

    // 산업단지 마커 클릭 핸들러
    const handleIcMarkerClick = useCallback(async (complexId: string) => {
        logger.log(`🏭 [산업단지] 클릭: ${complexId}`);
        const detail = await loadIndustrialComplexDetail(complexId);
        if (detail) {
            enterFocusMode(detail);
            logger.log(`✅ 포커스 모드 진입: ${detail.name}`);
        }
    }, [enterFocusMode]);

    // 컨테이너 생성
    useEffect(() => {
        if (!map || !showIndustrialComplex) return;

        const mapboxGL = (map as any)._mapbox;
        if (!mapboxGL) return;

        const mapContainer = mapboxGL.getContainer();
        if (!mapContainer) return;

        const container = document.createElement('div');
        container.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 90;
        `;
        mapContainer.appendChild(container);
        icContainerRef.current = container;

        return () => {
            // ✅ 이벤트 리스너 정리 (메모리 누수 방지)
            icMarkersRef.current.forEach((element, id) => {
                const handlers = icHandlersRef.current.get(id);
                if (handlers) {
                    element.removeEventListener('click', handlers.click);
                    element.removeEventListener('mouseenter', handlers.enter);
                    element.removeEventListener('mouseleave', handlers.leave);
                }
            });
            if (icContainerRef.current && icContainerRef.current.parentNode) {
                icContainerRef.current.parentNode.removeChild(icContainerRef.current);
            }
            icContainerRef.current = null;
            icMarkersRef.current.clear();
            icHandlersRef.current.clear();
        };
    }, [map, showIndustrialComplex]);

    // 폴리곤 캐시 업데이트
    useEffect(() => {
        if (!map || !showIndustrialComplex || !icContainerRef.current) return;

        const mapboxGL = (map as any)._mapbox;
        if (!mapboxGL) return;

        const container = icContainerRef.current;

        const updatePolygonCache = () => {
            let features: any[] = [];
            try {
                // ✅ 설정 파일의 SOURCE_IDS 사용 (하드코딩 제거)
                features = mapboxGL.querySourceFeatures(SOURCE_IDS.complex, {
                    sourceLayer: 'complex',
                });
            } catch {
                return;
            }

            const seenIds = new Set<string>();
            const newCached: CachedPolygon[] = [];

            for (const feature of features) {
                const id = feature.properties?.id || feature.properties?.DAN_ID;
                if (!id || seenIds.has(id)) continue;
                seenIds.add(id);

                const name = feature.properties?.name || feature.properties?.DAN_NAME || '';
                const complexInfo = industrialComplexes.find(c => c.id === id);
                if (!complexInfo || !hasValidCoordinate(complexInfo.coord)) continue;

                const geometry = feature.geometry;
                if (!geometry) continue;

                // 기존 캐시에서 재사용
                const existing = icPolygonCacheRef.current.find(p => p.id === id);
                if (existing) {
                    newCached.push(existing);
                    continue;
                }

                try {
                    let polygon: Feature<Polygon | MultiPolygon, GeoJsonProperties>;
                    if (geometry.type === 'Polygon') {
                        polygon = turfPolygon(geometry.coordinates);
                    } else if (geometry.type === 'MultiPolygon') {
                        polygon = turfMultiPolygon(geometry.coordinates);
                    } else {
                        continue;
                    }

                    // 마커 요소 생성 (없으면)
                    let element = icMarkersRef.current.get(id);
                    if (!element) {
                        element = createIndustrialComplexMarkerDOM(
                            name,
                            complexInfo.status as ComplexStatus,
                            complexInfo.completionRate ?? 0,
                            complexInfo.listingCount ?? 0,
                            complexInfo.auctionCount ?? 0,
                            complexInfo.salePricePerPyeong
                        );
                        element.style.position = 'absolute';
                        element.style.pointerEvents = 'auto';
                        element.style.cursor = 'pointer';
                        element.style.willChange = 'transform';

                        // ✅ 이벤트 핸들러 생성 및 저장 (메모리 누수 방지)
                        const clickHandler = (e: Event) => {
                            e.stopPropagation();
                            handleIcMarkerClick(id);
                        };

                        const preventScroll = (e: WheelEvent) => {
                            e.stopPropagation();
                            e.preventDefault();
                        };

                        const enterHandler = () => {
                            map?.getPanes().overlayLayer?.addEventListener('wheel', preventScroll, { passive: false });
                        };

                        const leaveHandler = () => {
                            map?.getPanes().overlayLayer?.removeEventListener('wheel', preventScroll);
                        };

                        element.addEventListener('click', clickHandler);
                        element.addEventListener('mouseenter', enterHandler);
                        element.addEventListener('mouseleave', leaveHandler);

                        // 핸들러 저장 (cleanup용)
                        icHandlersRef.current.set(id, { click: clickHandler, enter: enterHandler, leave: leaveHandler });

                        container.appendChild(element);
                        icMarkersRef.current.set(id, element);
                    }

                    newCached.push({
                        id,
                        name,
                        polylabelCoord: complexInfo.coord as [number, number],
                        polygon,
                        status: complexInfo.status,
                        completionRate: complexInfo.completionRate,
                        listingCount: complexInfo.listingCount,
                        auctionCount: complexInfo.auctionCount,
                    });
                } catch {
                    continue;
                }
            }

            // 더 이상 보이지 않는 마커 숨기기
            for (const cached of icPolygonCacheRef.current) {
                if (!seenIds.has(cached.id)) {
                    const element = icMarkersRef.current.get(cached.id);
                    if (element) {
                        element.style.display = 'none';
                    }
                }
            }

            icPolygonCacheRef.current = newCached;
        };

        // 초기 캐시 생성
        setTimeout(updatePolygonCache, 100);

        mapboxGL.on('moveend', updatePolygonCache);
        mapboxGL.on('sourcedata', (e: any) => {
            if (e.sourceId === 'vt-complex' && e.isSourceLoaded) {
                updatePolygonCache();
            }
        });

        return () => {
            mapboxGL.off('moveend', updatePolygonCache);
            // ✅ 마커 요소 정리 (이벤트 리스너 먼저 제거)
            icMarkersRef.current.forEach((element, id) => {
                const handlers = icHandlersRef.current.get(id);
                if (handlers) {
                    element.removeEventListener('click', handlers.click);
                    element.removeEventListener('mouseenter', handlers.enter);
                    element.removeEventListener('mouseleave', handlers.leave);
                }
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            });
            icMarkersRef.current.clear();
            icHandlersRef.current.clear();
            icPolygonCacheRef.current = [];
        };
    }, [map, showIndustrialComplex, industrialComplexes, handleIcMarkerClick]);

    // 마커 위치 업데이트 (폴리곤 내 가시 영역)
    useEffect(() => {
        if (!map || !showIndustrialComplex) return;

        const mapboxGL = (map as any)._mapbox;
        // ✅ mapboxGL 및 필수 메서드 존재 확인 (초기화 완료 보장)
        if (!mapboxGL?.getContainer || !mapboxGL?.project) return;

        const updateMarkerPositions = () => {
            const cached = icPolygonCacheRef.current;
            if (cached.length === 0) return;

            const mapContainer = mapboxGL.getContainer();
            const screenWidth = mapContainer?.clientWidth || window.innerWidth;
            const screenHeight = mapContainer?.clientHeight || window.innerHeight;

            if (screenWidth === 0) return;

            const margin = 50;

            for (const item of cached) {
                const element = icMarkersRef.current.get(item.id);
                if (!element) continue;

                const polylabelScreen = mapboxGL.project(item.polylabelCoord);

                const isPolylabelOnScreen =
                    polylabelScreen.x >= margin && polylabelScreen.x <= screenWidth - margin &&
                    polylabelScreen.y >= margin && polylabelScreen.y <= screenHeight - margin;

                if (isPolylabelOnScreen) {
                    element.style.left = `${polylabelScreen.x}px`;
                    element.style.top = `${polylabelScreen.y}px`;
                    element.style.display = 'block';
                    element.style.opacity = '1';
                } else {
                    const visiblePoint = findVisiblePointInPolygon(
                        mapboxGL,
                        item.polylabelCoord,
                        item.polygon,
                        screenWidth,
                        screenHeight
                    );

                    if (visiblePoint) {
                        element.style.left = `${visiblePoint.screenX}px`;
                        element.style.top = `${visiblePoint.screenY}px`;
                        element.style.display = 'block';
                        element.style.opacity = '0.9';
                    } else {
                        element.style.display = 'none';
                    }
                }
            }
        };

        const animationLoop = () => {
            updateMarkerPositions();
            if (icIsMovingRef.current) {
                icRafIdRef.current = requestAnimationFrame(animationLoop);
            }
        };

        const onMoveStart = () => {
            // ✅ RAF 중복 방지: 이미 실행 중이면 새로 시작하지 않음
            if (!icIsMovingRef.current && icRafIdRef.current === 0) {
                icIsMovingRef.current = true;
                animationLoop();
            }
        };

        const onMoveEnd = () => {
            icIsMovingRef.current = false;
            if (icRafIdRef.current) {
                cancelAnimationFrame(icRafIdRef.current);
                icRafIdRef.current = 0;
            }
            updateMarkerPositions();
        };

        updateMarkerPositions();

        mapboxGL.on('movestart', onMoveStart);
        mapboxGL.on('moveend', onMoveEnd);

        return () => {
            icIsMovingRef.current = false;
            if (icRafIdRef.current) {
                cancelAnimationFrame(icRafIdRef.current);
            }
            mapboxGL.off('movestart', onMoveStart);
            mapboxGL.off('moveend', onMoveEnd);
        };
    }, [map, showIndustrialComplex]);

    return null;
}

export const UnifiedMarkerLayer = memo(UnifiedMarkerLayerInner);
