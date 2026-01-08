// lib/map/CanvasMarkerRenderer.ts
// Mapbox GL Canvas 기반 통합 마커 렌더러
// 모든 마커 타입을 Canvas 2D로 직접 그리기

import { logger } from '@/lib/utils/logger';

// ========== 마커 타입 ==========

export type MarkerType =
    | 'transaction'      // 실거래
    | 'listing'          // 매물
    | 'auction'          // 경매
    | 'region-cluster'   // 행정구역 클러스터
    | 'listing-cluster'  // 매물 클러스터
    | 'auction-cluster'  // 경매 클러스터
    | 'industrial'       // 산업단지
    | 'knowledge'        // 지식산업센터
    | 'factory'          // 공장
    | 'warehouse'        // 창고
    | 'highlight';       // 선택된 필지 하이라이트

// ========== 마커 데이터 인터페이스 ==========

export interface BaseMarker {
    id: string;
    lng: number;
    lat: number;
    type: MarkerType;
}

// 실거래 마커
export interface TransactionMarker extends BaseMarker {
    type: 'transaction';
    price: string;
    propertyType?: string;
    jibun?: string;
    transactionDate?: string;
    area?: number;
}

// 매물 마커
export interface ListingMarker extends BaseMarker {
    type: 'listing';
    price: string;
    area: string;
    dealType: string; // 매매, 전세, 임대, 분양
    propertyType?: string;
    auctionInfo?: { price: number; failCount: number };
}

// 경매 마커
export interface AuctionMarker extends BaseMarker {
    type: 'auction';
    price: string;
    area: string;
    failCount?: number;
    propertyType?: string;
}

// 행정구역 클러스터 마커
export interface RegionClusterMarker extends BaseMarker {
    type: 'region-cluster';
    regionName: string;
    listingCount: number;
    auctionCount: number;
}

// 매물/경매 클러스터 마커
export interface ListingClusterMarker extends BaseMarker {
    type: 'listing-cluster';
    count: number;
    propertyType?: string;
}

export interface AuctionClusterMarker extends BaseMarker {
    type: 'auction-cluster';
    count: number;
    propertyType?: string;
}

// 산업단지 마커
export interface IndustrialMarker extends BaseMarker {
    type: 'industrial';
    name: string;
    status?: string;
    completionRate?: number;
    listingCount?: number;
    auctionCount?: number;
}

// 지식산업센터 마커
export interface KnowledgeMarker extends BaseMarker {
    type: 'knowledge';
    name: string;
    status?: string;
    completionRate?: number;
    listingCount?: number;
    auctionCount?: number;
}

// 공장/창고 마커
export interface FactoryMarker extends BaseMarker {
    type: 'factory';
    name: string;
}

export interface WarehouseMarker extends BaseMarker {
    type: 'warehouse';
    name: string;
}

// 하이라이트 마커
export interface HighlightMarker extends BaseMarker {
    type: 'highlight';
    title: string;
    price?: string;
    area?: string;
    info?: string;
}

export type AnyMarker =
    | TransactionMarker
    | ListingMarker
    | AuctionMarker
    | RegionClusterMarker
    | ListingClusterMarker
    | AuctionClusterMarker
    | IndustrialMarker
    | KnowledgeMarker
    | FactoryMarker
    | WarehouseMarker
    | HighlightMarker;

// UnifiedMarkerLayer와 호환성을 위한 alias
export type CanvasMarker = AnyMarker;

// ========== 색상 상수 ==========

const COLORS = {
    // 실거래 유형
    factory: { label: '공장', color: '#8B5CF6' },
    warehouse: { label: '창고', color: '#F59E0B' },
    land: { label: '토지', color: '#10B981' },
    'knowledge-center': { label: '지산', color: '#3B82F6' },

    // 마커 테마
    listing: { main: '#2563EB', bg: '#EFF6FF', dark: '#1E40AF' },
    auction: { main: '#DC2626', bg: '#FEF2F2', dark: '#991B1B' },
    industrial: { main: '#FF6B35', bg: '#FFF7ED' },
    knowledge: { main: '#0066FF', bg: '#EFF6FF' },
    factoryMarker: { main: '#6366F1', glow: 'rgba(99, 102, 241, 0.4)' },
    warehouseMarker: { main: '#EA580C', glow: 'rgba(234, 88, 12, 0.4)' },
};

const SQM_PER_PYEONG = 3.3058;

function getTypeInfo(propertyType?: string, jibun?: string): { label: string; color: string } {
    if (propertyType && COLORS[propertyType as keyof typeof COLORS]) {
        const c = COLORS[propertyType as keyof typeof COLORS];
        if ('label' in c) return c;
    }
    if (jibun?.includes('공장')) return COLORS.factory;
    if (jibun?.includes('창고')) return COLORS.warehouse;
    return { label: '토지', color: '#6B7280' };
}

function truncateName(name: string, maxLen = 8): string {
    return name.length > maxLen ? name.slice(0, maxLen) + '…' : name;
}

// ========== 렌더러 ==========

export class CanvasMarkerRenderer {
    private mapboxGL: any = null;
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    private markers: AnyMarker[] = [];
    private selectedMarkerId: string | null = null;
    private onClick: ((marker: AnyMarker) => void) | null = null;
    private hitAreas: { id: string; x: number; y: number; w: number; h: number }[] = [];

    private fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    private debug: boolean;

    constructor(debug: boolean = false) {
        this.debug = debug;
        logger.log('🎨 [CanvasMarkerRenderer] 생성 (debug:', debug, ')');
    }

    /** 지도에 렌더러 추가 (UnifiedMarkerLayer 호환) */
    addToMap(mapboxGL: any) {
        this.mapboxGL = mapboxGL;

        const mapCanvas = mapboxGL.getCanvas();
        const dpr = window.devicePixelRatio || 1;
        this.canvas = document.createElement('canvas');

        const cssWidth = mapCanvas.clientWidth;
        const cssHeight = mapCanvas.clientHeight;
        this.canvas.style.cssText = `position:absolute;top:0;left:0;pointer-events:none;width:${cssWidth}px;height:${cssHeight}px;`;
        this.canvas.width = cssWidth * dpr;
        this.canvas.height = cssHeight * dpr;
        this.ctx = this.canvas.getContext('2d')!;

        mapCanvas.parentElement?.appendChild(this.canvas);
        this.bindEvents();

        logger.log('🎨 [CanvasMarkerRenderer] 지도에 추가 완료');
    }

    private bindEvents() {
        this.mapboxGL.on('render', this.render);
        this.mapboxGL.on('resize', this.handleResize);
        this.mapboxGL.getCanvas().addEventListener('click', this.handleClick);
    }

    private handleResize = () => {
        const mapCanvas = this.mapboxGL.getCanvas();
        const dpr = window.devicePixelRatio || 1;
        const cssWidth = mapCanvas.clientWidth;
        const cssHeight = mapCanvas.clientHeight;
        this.canvas.style.width = `${cssWidth}px`;
        this.canvas.style.height = `${cssHeight}px`;
        this.canvas.width = cssWidth * dpr;
        this.canvas.height = cssHeight * dpr;
        this.render();
    };

    private handleClick = (e: MouseEvent) => {
        if (!this.onClick) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        for (let i = this.hitAreas.length - 1; i >= 0; i--) {
            const h = this.hitAreas[i];
            if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
                const marker = this.markers.find(m => m.id === h.id);
                if (marker) {
                    this.onClick(marker);
                    return;
                }
            }
        }
    };

    private render = () => {
        const ctx = this.ctx;
        const dpr = window.devicePixelRatio || 1;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.hitAreas = [];

        if (this.markers.length === 0) return;

        const bounds = this.mapboxGL.getBounds();
        const minLng = bounds.getWest();
        const maxLng = bounds.getEast();
        const minLat = bounds.getSouth();
        const maxLat = bounds.getNorth();

        // 남쪽부터 그리기 (z-order)
        const sorted = [...this.markers]
            .filter(m => m.lng >= minLng && m.lng <= maxLng && m.lat >= minLat && m.lat <= maxLat)
            .sort((a, b) => b.lat - a.lat);

        for (const m of sorted) {
            const pt = this.mapboxGL.project([m.lng, m.lat]);
            const isSelected = m.id === this.selectedMarkerId;

            switch (m.type) {
                case 'transaction':
                    this.drawTransaction(ctx, m, pt, dpr, isSelected);
                    break;
                case 'listing':
                    this.drawListing(ctx, m, pt, dpr, isSelected);
                    break;
                case 'auction':
                    this.drawAuction(ctx, m, pt, dpr, isSelected);
                    break;
                case 'region-cluster':
                    this.drawRegionCluster(ctx, m, pt, dpr);
                    break;
                case 'listing-cluster':
                    this.drawListingCluster(ctx, m, pt, dpr);
                    break;
                case 'auction-cluster':
                    this.drawAuctionCluster(ctx, m, pt, dpr);
                    break;
                case 'industrial':
                    this.drawIndustrial(ctx, m, pt, dpr, isSelected);
                    break;
                case 'knowledge':
                    this.drawKnowledge(ctx, m, pt, dpr, isSelected);
                    break;
                case 'factory':
                    this.drawFactory(ctx, m, pt, dpr);
                    break;
                case 'warehouse':
                    this.drawWarehouse(ctx, m, pt, dpr);
                    break;
                case 'highlight':
                    this.drawHighlight(ctx, m, pt, dpr);
                    break;
            }
        }
    };

    // ========== 실거래 마커 ==========
    private drawTransaction(ctx: CanvasRenderingContext2D, m: TransactionMarker, pt: { x: number; y: number }, dpr: number, isSelected: boolean) {
        const typeInfo = getTypeInfo(m.propertyType, m.jibun);

        let dateStr = '';
        let isRecent = false;
        if (m.transactionDate) {
            const d = new Date(m.transactionDate);
            dateStr = `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}`;
            const ago = new Date();
            ago.setMonth(ago.getMonth() - 3);
            isRecent = d >= ago;
        }
        const areaPyeong = m.area ? `${Math.round(m.area / SQM_PER_PYEONG)}평` : '';

        // 텍스트 측정
        ctx.font = `500 ${10 * dpr}px ${this.fontFamily}`;
        const typeW = ctx.measureText(typeInfo.label).width;

        ctx.font = `${isSelected ? 600 : 500} ${(isSelected ? 15 : 12) * dpr}px ${this.fontFamily}`;
        const priceW = ctx.measureText(m.price).width;

        ctx.font = `400 ${9 * dpr}px ${this.fontFamily}`;
        let row2W = 0;
        if (dateStr) row2W += ctx.measureText(dateStr).width;
        if (areaPyeong) row2W += ctx.measureText(areaPyeong).width;
        if (dateStr && areaPyeong) row2W += 4 * dpr;

        // 크기 계산
        const lineHeight = 1.2;
        const paddingX = 10 * dpr;
        const paddingY = (isSelected ? 8 : 4) * dpr;
        const gap = 4 * dpr;

        const row1W = typeW + gap + priceW;
        const contentW = Math.max(row1W, row2W);
        const markerW = contentW + paddingX * 2;

        const row1FontSize = (isSelected ? 15 : 12) * dpr;
        const row2FontSize = 9 * dpr;
        const row1H = row1FontSize * lineHeight;
        const row2H = (dateStr || areaPyeong) ? row2FontSize * lineHeight : 0;
        const rowGap = (dateStr || areaPyeong) ? 1 * dpr : 0;
        const markerH = paddingY * 2 + row1H + rowGap + row2H;

        const mx = pt.x * dpr - markerW / 2;
        const my = pt.y * dpr - markerH;

        ctx.save();

        // 그림자
        ctx.shadowColor = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = (isSelected ? 12 : 6) * dpr;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = (isSelected ? 4 : 2) * dpr;

        // 배경
        const radius = isSelected ? 6 * dpr : markerH / 2;
        ctx.beginPath();
        ctx.roundRect(mx, my, markerW, markerH, radius);
        ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.95)';
        ctx.fill();

        // 테두리
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = isSelected ? '#3B82F6' : 'rgba(200, 200, 200, 0.8)';
        ctx.lineWidth = (isSelected ? 2 : 1) * dpr;
        ctx.stroke();

        // 텍스트
        ctx.textBaseline = 'middle';
        const row1Y = my + paddingY + row1H / 2;

        ctx.font = `500 ${10 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = typeInfo.color;
        ctx.fillText(typeInfo.label, mx + paddingX, row1Y);

        ctx.font = `${isSelected ? 600 : 500} ${(isSelected ? 15 : 12) * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = isSelected ? '#1F2937' : '#374151';
        ctx.fillText(m.price, mx + paddingX + typeW + gap, row1Y);

        if (dateStr || areaPyeong) {
            const row2Y = my + paddingY + row1H + rowGap + row2H / 2;
            ctx.font = `400 ${9 * dpr}px ${this.fontFamily}`;
            ctx.fillStyle = '#9CA3AF';

            let textX = mx + paddingX + (contentW - row2W) / 2;
            if (dateStr) {
                ctx.fillText(dateStr, textX, row2Y);
                textX += ctx.measureText(dateStr).width + 4 * dpr;
            }
            if (areaPyeong) {
                ctx.fillText(areaPyeong, textX, row2Y);
            }
        }

        // N 뱃지
        if (isRecent && !isSelected) {
            this.drawNBadge(ctx, mx + markerW, my, dpr);
        }

        ctx.restore();

        this.hitAreas.push({ id: m.id, x: mx / dpr, y: my / dpr, w: markerW / dpr, h: markerH / dpr });
    }

    // ========== 매물 마커 (pill 형태, 심플) ==========
    private drawListing(ctx: CanvasRenderingContext2D, m: ListingMarker, pt: { x: number; y: number }, dpr: number, _isSelected: boolean) {
        const dealLabel = m.dealType === '임대' ? '임대' : m.dealType === '분양' ? '분양' : m.dealType === '전세' ? '전세' : '매매';

        // 텍스트 측정
        ctx.font = `600 ${10 * dpr}px ${this.fontFamily}`;
        const dealW = ctx.measureText(dealLabel).width;

        ctx.font = `600 ${12 * dpr}px ${this.fontFamily}`;
        const priceW = ctx.measureText(m.price).width;

        ctx.font = `400 ${9 * dpr}px ${this.fontFamily}`;
        const areaW = ctx.measureText(m.area).width;

        // 크기 계산 (실거래 마커와 비슷한 구조)
        const lineHeight = 1.2;
        const paddingX = 10 * dpr;
        const paddingY = 4 * dpr;
        const gap = 4 * dpr;

        const row1W = dealW + gap + priceW;
        const contentW = Math.max(row1W, areaW);
        const markerW = contentW + paddingX * 2;

        const row1FontSize = 12 * dpr;
        const row2FontSize = 9 * dpr;
        const row1H = row1FontSize * lineHeight;
        const row2H = m.area ? row2FontSize * lineHeight : 0;
        const rowGap = m.area ? 1 * dpr : 0;
        const markerH = paddingY * 2 + row1H + rowGap + row2H;

        const mx = pt.x * dpr - markerW / 2;
        const my = pt.y * dpr - markerH;

        ctx.save();

        // 그림자 (파란색 계열)
        ctx.shadowColor = 'rgba(37, 99, 235, 0.25)';
        ctx.shadowBlur = 8 * dpr;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2 * dpr;

        // 배경 (pill 형태)
        ctx.beginPath();
        ctx.roundRect(mx, my, markerW, markerH, markerH / 2);
        ctx.fillStyle = '#2563EB';  // 파란 배경
        ctx.fill();

        ctx.shadowColor = 'transparent';

        // 텍스트
        ctx.textBaseline = 'middle';
        const row1Y = my + paddingY + row1H / 2;

        // 거래유형 (흰색, 살짝 투명)
        ctx.font = `500 ${10 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(dealLabel, mx + paddingX, row1Y);

        // 가격 (흰색, 굵게)
        ctx.font = `600 ${12 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(m.price, mx + paddingX + dealW + gap, row1Y);

        // 면적 (흰색, 투명)
        if (m.area) {
            const row2Y = my + paddingY + row1H + rowGap + row2H / 2;
            ctx.font = `400 ${9 * dpr}px ${this.fontFamily}`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.textAlign = 'center';
            ctx.fillText(m.area, mx + markerW / 2, row2Y);
            ctx.textAlign = 'left';
        }

        ctx.restore();

        this.hitAreas.push({ id: m.id, x: mx / dpr, y: my / dpr, w: markerW / dpr, h: markerH / dpr });
    }

    // ========== 경매 마커 (pill 형태, 심플) ==========
    private drawAuction(ctx: CanvasRenderingContext2D, m: AuctionMarker, pt: { x: number; y: number }, dpr: number, _isSelected: boolean) {
        // 유찰 횟수가 있으면 표시
        const failBadge = m.failCount && m.failCount > 0 ? `${m.failCount}회` : '';

        // 텍스트 측정
        ctx.font = `600 ${10 * dpr}px ${this.fontFamily}`;
        const labelW = ctx.measureText('경매').width;

        ctx.font = `600 ${12 * dpr}px ${this.fontFamily}`;
        const priceW = ctx.measureText(m.price).width;

        ctx.font = `400 ${9 * dpr}px ${this.fontFamily}`;
        const areaW = ctx.measureText(m.area).width;

        // 크기 계산 (실거래 마커와 비슷한 구조)
        const lineHeight = 1.2;
        const paddingX = 10 * dpr;
        const paddingY = 4 * dpr;
        const gap = 4 * dpr;

        const row1W = labelW + gap + priceW;
        const contentW = Math.max(row1W, areaW);
        const markerW = contentW + paddingX * 2;

        const row1FontSize = 12 * dpr;
        const row2FontSize = 9 * dpr;
        const row1H = row1FontSize * lineHeight;
        const row2H = m.area ? row2FontSize * lineHeight : 0;
        const rowGap = m.area ? 1 * dpr : 0;
        const markerH = paddingY * 2 + row1H + rowGap + row2H;

        const mx = pt.x * dpr - markerW / 2;
        const my = pt.y * dpr - markerH;

        ctx.save();

        // 그림자 (빨간색 계열)
        ctx.shadowColor = 'rgba(220, 38, 38, 0.25)';
        ctx.shadowBlur = 8 * dpr;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2 * dpr;

        // 배경 (pill 형태)
        ctx.beginPath();
        ctx.roundRect(mx, my, markerW, markerH, markerH / 2);
        ctx.fillStyle = '#DC2626';  // 빨간 배경
        ctx.fill();

        ctx.shadowColor = 'transparent';

        // 텍스트
        ctx.textBaseline = 'middle';
        const row1Y = my + paddingY + row1H / 2;

        // 경매 라벨 (흰색, 살짝 투명)
        ctx.font = `500 ${10 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillText('경매', mx + paddingX, row1Y);

        // 가격 (흰색, 굵게)
        ctx.font = `600 ${12 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(m.price, mx + paddingX + labelW + gap, row1Y);

        // 면적 (흰색, 투명)
        if (m.area) {
            const row2Y = my + paddingY + row1H + rowGap + row2H / 2;
            ctx.font = `400 ${9 * dpr}px ${this.fontFamily}`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.textAlign = 'center';
            ctx.fillText(m.area, mx + markerW / 2, row2Y);
            ctx.textAlign = 'left';
        }

        // 유찰 뱃지 (오른쪽 상단)
        if (failBadge) {
            ctx.font = `700 ${8 * dpr}px ${this.fontFamily}`;
            const badgeTextW = ctx.measureText(failBadge).width;
            const badgePadX = 4 * dpr;
            const badgePadY = 2 * dpr;
            const badgeW = badgeTextW + badgePadX * 2;
            const badgeH = 8 * dpr + badgePadY * 2;
            const badgeX = mx + markerW + 4 * dpr - badgeW;
            const badgeY = my - 4 * dpr;

            // 뱃지 배경 (노란색)
            ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
            ctx.shadowBlur = 2 * dpr;
            ctx.shadowOffsetY = 1 * dpr;

            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3 * dpr);
            ctx.fillStyle = '#FCD34D';
            ctx.fill();

            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 1 * dpr;
            ctx.stroke();

            // 뱃지 텍스트
            ctx.fillStyle = '#92400E';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(failBadge, badgeX + badgeW / 2, badgeY + badgeH / 2);
            ctx.textAlign = 'left';
        }

        ctx.restore();

        this.hitAreas.push({ id: m.id, x: mx / dpr, y: my / dpr, w: markerW / dpr, h: markerH / dpr });
    }

    // ========== 행정구역 클러스터 마커 ==========
    private drawRegionCluster(ctx: CanvasRenderingContext2D, m: RegionClusterMarker, pt: { x: number; y: number }, dpr: number) {
        const hasListing = m.listingCount > 0;
        const hasAuction = m.auctionCount > 0;

        // 텍스트 측정
        ctx.font = `500 ${12 * dpr}px ${this.fontFamily}`;
        const nameW = ctx.measureText(m.regionName).width;

        ctx.font = `600 ${14 * dpr}px ${this.fontFamily}`;
        const listingNumW = hasListing ? ctx.measureText(String(m.listingCount)).width : 0;
        const auctionNumW = hasAuction ? ctx.measureText(String(m.auctionCount)).width : 0;

        ctx.font = `400 ${11 * dpr}px ${this.fontFamily}`;
        const listingLabelW = hasListing ? ctx.measureText('매물').width + 3 * dpr : 0;
        const auctionLabelW = hasAuction ? ctx.measureText('경매').width + 3 * dpr : 0;
        const dividerW = (hasListing && hasAuction) ? 16 * dpr : 0;

        const countsW = listingNumW + listingLabelW + dividerW + auctionNumW + auctionLabelW;
        const contentW = Math.max(nameW, countsW);

        const paddingX = 12 * dpr;
        const paddingY = 8 * dpr;
        const markerW = contentW + paddingX * 2;
        const markerH = paddingY * 2 + 12 * dpr + 3 * dpr + 14 * dpr;

        const mx = pt.x * dpr - markerW / 2;
        const my = pt.y * dpr - markerH / 2;

        ctx.save();

        // 그림자
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 4 * dpr;
        ctx.shadowOffsetY = 1 * dpr;

        // 배경
        ctx.beginPath();
        ctx.roundRect(mx, my, markerW, markerH, 6 * dpr);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.shadowColor = 'transparent';

        // 지역명
        ctx.textBaseline = 'middle';
        ctx.font = `500 ${12 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = '#64748B';
        ctx.fillText(m.regionName, mx + paddingX + (contentW - nameW) / 2, my + paddingY + 6 * dpr);

        // 카운트
        const countY = my + paddingY + 12 * dpr + 3 * dpr + 7 * dpr;
        let countX = mx + paddingX + (contentW - countsW) / 2;

        if (hasListing) {
            ctx.font = `600 ${14 * dpr}px ${this.fontFamily}`;
            ctx.fillStyle = '#2563EB';
            ctx.fillText(String(m.listingCount), countX, countY);
            countX += listingNumW;

            ctx.font = `400 ${11 * dpr}px ${this.fontFamily}`;
            ctx.fillStyle = '#64748B';
            ctx.fillText('매물', countX + 3 * dpr, countY);
            countX += listingLabelW;
        }

        if (hasListing && hasAuction) {
            ctx.fillStyle = '#E2E8F0';
            ctx.fillText('|', countX + 4 * dpr, countY);
            countX += dividerW;
        }

        if (hasAuction) {
            ctx.font = `600 ${14 * dpr}px ${this.fontFamily}`;
            ctx.fillStyle = '#DC2626';
            ctx.fillText(String(m.auctionCount), countX, countY);
            countX += auctionNumW;

            ctx.font = `400 ${11 * dpr}px ${this.fontFamily}`;
            ctx.fillStyle = '#64748B';
            ctx.fillText('경매', countX + 3 * dpr, countY);
        }

        ctx.restore();

        this.hitAreas.push({ id: m.id, x: mx / dpr, y: my / dpr, w: markerW / dpr, h: markerH / dpr });
    }

    // ========== 매물 클러스터 마커 ==========
    private drawListingCluster(ctx: CanvasRenderingContext2D, m: ListingClusterMarker, pt: { x: number; y: number }, dpr: number) {
        const { main } = COLORS.listing;

        ctx.font = `600 ${13 * dpr}px ${this.fontFamily}`;
        const countW = ctx.measureText(String(m.count)).width;

        ctx.font = `400 ${11 * dpr}px ${this.fontFamily}`;
        const labelW = ctx.measureText('매물').width;

        const paddingX = 10 * dpr;
        const paddingY = 5 * dpr;
        const gap = 4 * dpr;
        const markerW = countW + gap + labelW + paddingX * 2;
        const markerH = paddingY * 2 + 13 * dpr;

        const mx = pt.x * dpr - markerW / 2;
        const my = pt.y * dpr - markerH / 2;

        ctx.save();

        // 그림자
        ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
        ctx.shadowBlur = 6 * dpr;
        ctx.shadowOffsetY = 2 * dpr;

        // 배경
        ctx.beginPath();
        ctx.roundRect(mx, my, markerW, markerH, 6 * dpr);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // 테두리
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = main;
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();

        // 텍스트
        ctx.textBaseline = 'middle';
        const textY = my + markerH / 2;

        ctx.font = `600 ${13 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = '#2563EB';
        ctx.fillText(String(m.count), mx + paddingX, textY);

        ctx.font = `400 ${11 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = '#64748B';
        ctx.fillText('매물', mx + paddingX + countW + gap, textY);

        ctx.restore();

        this.hitAreas.push({ id: m.id, x: mx / dpr, y: my / dpr, w: markerW / dpr, h: markerH / dpr });
    }

    // ========== 경매 클러스터 마커 ==========
    private drawAuctionCluster(ctx: CanvasRenderingContext2D, m: AuctionClusterMarker, pt: { x: number; y: number }, dpr: number) {
        const { main } = COLORS.auction;

        ctx.font = `600 ${13 * dpr}px ${this.fontFamily}`;
        const countW = ctx.measureText(String(m.count)).width;

        ctx.font = `400 ${11 * dpr}px ${this.fontFamily}`;
        const labelW = ctx.measureText('경매').width;

        const paddingX = 10 * dpr;
        const paddingY = 5 * dpr;
        const gap = 4 * dpr;
        const markerW = countW + gap + labelW + paddingX * 2;
        const markerH = paddingY * 2 + 13 * dpr;

        const mx = pt.x * dpr - markerW / 2;
        const my = pt.y * dpr - markerH / 2;

        ctx.save();

        // 그림자
        ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
        ctx.shadowBlur = 6 * dpr;
        ctx.shadowOffsetY = 2 * dpr;

        // 배경
        ctx.beginPath();
        ctx.roundRect(mx, my, markerW, markerH, 6 * dpr);
        ctx.fillStyle = main;
        ctx.fill();

        ctx.shadowColor = 'transparent';

        // 텍스트
        ctx.textBaseline = 'middle';
        const textY = my + markerH / 2;

        ctx.font = `600 ${13 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(String(m.count), mx + paddingX, textY);

        ctx.font = `400 ${11 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText('경매', mx + paddingX + countW + gap, textY);

        ctx.restore();

        this.hitAreas.push({ id: m.id, x: mx / dpr, y: my / dpr, w: markerW / dpr, h: markerH / dpr });
    }

    // ========== 산업단지 마커 ==========
    private drawIndustrial(ctx: CanvasRenderingContext2D, m: IndustrialMarker, pt: { x: number; y: number }, dpr: number, _isSelected: boolean) {
        const { main } = COLORS.industrial;
        const displayName = truncateName(m.name);

        ctx.font = `600 ${11 * dpr}px ${this.fontFamily}`;
        const nameW = ctx.measureText(displayName).width;

        const paddingX = 8 * dpr;
        const paddingY = 5 * dpr;
        const iconW = 12 * dpr;
        const gap = 6 * dpr;
        const markerW = iconW + gap + nameW + paddingX * 2;
        const markerH = paddingY * 2 + 12 * dpr;

        const mx = pt.x * dpr - markerW / 2;
        const my = pt.y * dpr - markerH - 6 * dpr;

        ctx.save();

        // 그림자
        ctx.shadowColor = 'rgba(255, 107, 53, 0.3)';
        ctx.shadowBlur = 6 * dpr;
        ctx.shadowOffsetY = 2 * dpr;

        // 배경
        ctx.beginPath();
        ctx.roundRect(mx, my, markerW, markerH, 6 * dpr);
        ctx.fillStyle = main;
        ctx.fill();

        ctx.shadowColor = 'transparent';

        // 아이콘 (간단한 공장 모양)
        const iconX = mx + paddingX;
        const iconY = my + paddingY;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(iconX, iconY + 10 * dpr);
        ctx.lineTo(iconX, iconY + 4 * dpr);
        ctx.lineTo(iconX + 4 * dpr, iconY + 7 * dpr);
        ctx.lineTo(iconX + 4 * dpr, iconY + 4 * dpr);
        ctx.lineTo(iconX + 8 * dpr, iconY + 7 * dpr);
        ctx.lineTo(iconX + 8 * dpr, iconY);
        ctx.lineTo(iconX + 12 * dpr, iconY);
        ctx.lineTo(iconX + 12 * dpr, iconY + 10 * dpr);
        ctx.closePath();
        ctx.stroke();

        // 텍스트
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${11 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(displayName, mx + paddingX + iconW + gap, my + markerH / 2);

        // 화살표
        this.drawArrow(ctx, mx + markerW / 2, my + markerH, main, undefined, dpr);

        ctx.restore();

        this.hitAreas.push({ id: m.id, x: mx / dpr, y: my / dpr, w: markerW / dpr, h: (markerH + 6 * dpr) / dpr });
    }

    // ========== 지식산업센터 마커 ==========
    private drawKnowledge(ctx: CanvasRenderingContext2D, m: KnowledgeMarker, pt: { x: number; y: number }, dpr: number, _isSelected: boolean) {
        const { main } = COLORS.knowledge;
        const displayName = truncateName(m.name);

        ctx.font = `600 ${11 * dpr}px ${this.fontFamily}`;
        const nameW = ctx.measureText(displayName).width;

        const paddingX = 8 * dpr;
        const paddingY = 5 * dpr;
        const iconW = 12 * dpr;
        const gap = 6 * dpr;
        const markerW = iconW + gap + nameW + paddingX * 2;
        const markerH = paddingY * 2 + 12 * dpr;

        const mx = pt.x * dpr - markerW / 2;
        const my = pt.y * dpr - markerH - 6 * dpr;

        ctx.save();

        // 그림자
        ctx.shadowColor = 'rgba(0, 102, 255, 0.3)';
        ctx.shadowBlur = 6 * dpr;
        ctx.shadowOffsetY = 2 * dpr;

        // 배경
        ctx.beginPath();
        ctx.roundRect(mx, my, markerW, markerH, 6 * dpr);
        ctx.fillStyle = main;
        ctx.fill();

        ctx.shadowColor = 'transparent';

        // 아이콘 (빌딩 모양)
        const iconX = mx + paddingX;
        const iconY = my + paddingY;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * dpr;
        ctx.strokeRect(iconX + 2 * dpr, iconY, 8 * dpr, 12 * dpr);

        // 텍스트
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${11 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(displayName, mx + paddingX + iconW + gap, my + markerH / 2);

        // 화살표
        this.drawArrow(ctx, mx + markerW / 2, my + markerH, main, undefined, dpr);

        ctx.restore();

        this.hitAreas.push({ id: m.id, x: mx / dpr, y: my / dpr, w: markerW / dpr, h: (markerH + 6 * dpr) / dpr });
    }

    // ========== 공장 마커 ==========
    private drawFactory(ctx: CanvasRenderingContext2D, m: FactoryMarker, pt: { x: number; y: number }, dpr: number) {
        const { main, glow } = COLORS.factoryMarker;
        const displayName = truncateName(m.name, 10);

        ctx.font = `500 ${13 * dpr}px ${this.fontFamily}`;
        const nameW = ctx.measureText(displayName).width;

        const paddingX = 12 * dpr;
        const paddingY = 6 * dpr;
        const iconW = 14 * dpr;
        const gap = 5 * dpr;
        const markerW = iconW + gap + nameW + paddingX * 2;
        const markerH = paddingY * 2 + 14 * dpr;

        const mx = pt.x * dpr - markerW / 2;
        const my = pt.y * dpr - markerH - 6 * dpr;

        ctx.save();

        // 그림자
        ctx.shadowColor = glow;
        ctx.shadowBlur = 6 * dpr;
        ctx.shadowOffsetY = 2 * dpr;

        // 배경
        ctx.beginPath();
        ctx.roundRect(mx, my, markerW, markerH, 6 * dpr);
        ctx.fillStyle = main;
        ctx.fill();

        ctx.shadowColor = 'transparent';

        // 텍스트
        ctx.textBaseline = 'middle';
        ctx.font = `500 ${13 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(displayName, mx + paddingX + iconW + gap, my + markerH / 2);

        // 화살표
        this.drawArrow(ctx, mx + markerW / 2, my + markerH, main, undefined, dpr);

        ctx.restore();

        this.hitAreas.push({ id: m.id, x: mx / dpr, y: my / dpr, w: markerW / dpr, h: (markerH + 6 * dpr) / dpr });
    }

    // ========== 창고 마커 ==========
    private drawWarehouse(ctx: CanvasRenderingContext2D, m: WarehouseMarker, pt: { x: number; y: number }, dpr: number) {
        const { main, glow } = COLORS.warehouseMarker;
        const displayName = truncateName(m.name, 10);

        ctx.font = `500 ${13 * dpr}px ${this.fontFamily}`;
        const nameW = ctx.measureText(displayName).width;

        const paddingX = 12 * dpr;
        const paddingY = 6 * dpr;
        const iconW = 14 * dpr;
        const gap = 5 * dpr;
        const markerW = iconW + gap + nameW + paddingX * 2;
        const markerH = paddingY * 2 + 14 * dpr;

        const mx = pt.x * dpr - markerW / 2;
        const my = pt.y * dpr - markerH - 6 * dpr;

        ctx.save();

        // 그림자
        ctx.shadowColor = glow;
        ctx.shadowBlur = 6 * dpr;
        ctx.shadowOffsetY = 2 * dpr;

        // 배경
        ctx.beginPath();
        ctx.roundRect(mx, my, markerW, markerH, 6 * dpr);
        ctx.fillStyle = main;
        ctx.fill();

        ctx.shadowColor = 'transparent';

        // 텍스트
        ctx.textBaseline = 'middle';
        ctx.font = `500 ${13 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(displayName, mx + paddingX + iconW + gap, my + markerH / 2);

        // 화살표
        this.drawArrow(ctx, mx + markerW / 2, my + markerH, main, undefined, dpr);

        ctx.restore();

        this.hitAreas.push({ id: m.id, x: mx / dpr, y: my / dpr, w: markerW / dpr, h: (markerH + 6 * dpr) / dpr });
    }

    // ========== 하이라이트 마커 ==========
    private drawHighlight(ctx: CanvasRenderingContext2D, m: HighlightMarker, pt: { x: number; y: number }, dpr: number) {
        ctx.font = `600 ${13 * dpr}px ${this.fontFamily}`;
        const titleW = ctx.measureText(m.title).width;

        ctx.font = `500 ${11 * dpr}px ${this.fontFamily}`;
        const infoW = m.info ? ctx.measureText(m.info).width : 0;

        ctx.font = `700 ${14 * dpr}px ${this.fontFamily}`;
        const priceW = m.price ? ctx.measureText(m.price).width : 0;

        const contentW = Math.max(titleW, infoW, priceW);
        const paddingX = 14 * dpr;
        const paddingY = 8 * dpr;
        const markerW = contentW + paddingX * 2;

        let markerH = paddingY * 2 + 13 * dpr;
        if (m.info) markerH += 4 * dpr + 11 * dpr;
        if (m.price) markerH += 4 * dpr + 14 * dpr;

        const mx = pt.x * dpr - markerW / 2;
        const my = pt.y * dpr - markerH - 8 * dpr;

        ctx.save();

        // 그림자
        ctx.shadowColor = 'rgba(29, 78, 216, 0.4)';
        ctx.shadowBlur = 12 * dpr;
        ctx.shadowOffsetY = 4 * dpr;

        // 배경
        ctx.beginPath();
        ctx.roundRect(mx, my, markerW, markerH, 12 * dpr);
        ctx.fillStyle = '#1d4ed8';
        ctx.fill();

        ctx.shadowColor = 'transparent';

        // 테두리
        ctx.strokeStyle = '#1e40af';
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();

        // 텍스트
        ctx.textBaseline = 'middle';
        let textY = my + paddingY + 7 * dpr;

        ctx.font = `600 ${13 * dpr}px ${this.fontFamily}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(m.title, mx + paddingX, textY);

        if (m.info) {
            textY += 13 * dpr / 2 + 4 * dpr + 11 * dpr / 2;
            ctx.font = `500 ${11 * dpr}px ${this.fontFamily}`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(m.info, mx + paddingX, textY);
        }

        if (m.price) {
            textY += (m.info ? 11 * dpr / 2 : 13 * dpr / 2) + 4 * dpr + 14 * dpr / 2;
            ctx.font = `700 ${14 * dpr}px ${this.fontFamily}`;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(m.price, mx + paddingX, textY);
        }

        // 화살표
        this.drawArrow(ctx, mx + markerW / 2, my + markerH, '#ffffff', '#3B82F6', dpr, 7);

        ctx.restore();

        this.hitAreas.push({ id: m.id, x: mx / dpr, y: my / dpr, w: markerW / dpr, h: (markerH + 8 * dpr) / dpr });
    }

    // ========== 유틸리티 ==========

    private drawNBadge(ctx: CanvasRenderingContext2D, rightX: number, topY: number, dpr: number) {
        ctx.font = `700 ${9 * dpr}px ${this.fontFamily}`;
        const nTextW = ctx.measureText('N').width;
        const badgePadX = 4 * dpr;
        const badgePadY = 2 * dpr;
        const badgeW = nTextW + badgePadX * 2;
        const badgeH = 9 * dpr + badgePadY * 2;

        const badgeX = rightX + 6 * dpr - badgeW;
        const badgeY = topY - 6 * dpr;

        ctx.save();

        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 3 * dpr;
        ctx.shadowOffsetY = 1 * dpr;

        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3 * dpr);
        ctx.fillStyle = '#EF4444';
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', badgeX + badgeW / 2, badgeY + badgeH / 2);
        ctx.textAlign = 'left';

        ctx.restore();
    }

    private drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, fillColor: string, strokeColor?: string, dpr: number = 1, size: number = 5) {
        const s = size * dpr;
        ctx.beginPath();
        ctx.moveTo(x - s, y);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y + s);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();

        if (strokeColor) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1.5 * dpr;
            ctx.stroke();
        }
    }

    // ========== API ==========

    updateMarkers(markers: AnyMarker[]) {
        this.markers = markers;
        this.render();
    }

    setSelectedMarkerId(id: string | null) {
        if (this.selectedMarkerId !== id) {
            this.selectedMarkerId = id;
            this.render();
        }
    }

    setOnClick(cb: (m: AnyMarker) => void) {
        this.onClick = cb;
    }

    destroy() {
        if (!this.mapboxGL) return;
        this.mapboxGL.off('render', this.render);
        this.mapboxGL.off('resize', this.handleResize);
        this.mapboxGL.getCanvas().removeEventListener('click', this.handleClick);
        this.canvas.remove();
        logger.log('🎨 [CanvasMarkerRenderer] 정리 완료');
    }

    /** UnifiedMarkerLayer 호환 - updateMarkers의 alias */
    setMarkers(markers: CanvasMarker[]) {
        this.updateMarkers(markers);
    }

    /** UnifiedMarkerLayer 호환 - destroy의 alias */
    cleanup() {
        this.destroy();
    }
}
