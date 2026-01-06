'use client';

import React, { memo, useCallback, useMemo, useState } from 'react';
import {
    Paper,
    Stack,
    Text,
    Group,
    ThemeIcon,
    Slider,
    SegmentedControl,
    UnstyledButton,
    Box,
    Tooltip,
    ActionIcon,
    Divider,
    RangeSlider,
} from '@mantine/core';
import {
    IconCurrencyWon,
    IconHome,
    IconGavel,
    IconMapPin,
    IconBuilding,
    IconBuildingFactory2,
    IconMap,
    IconTrendingUp,
    IconTrendingDown,
    IconCheck,
    IconChevronLeft,
    IconX,
    IconCalendar,
    IconArrowsHorizontal,
} from '@tabler/icons-react';
import { useShallow } from 'zustand/react/shallow';
import { useMapStore } from '@/lib/stores/map-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { useTimeline, useTimelineActions } from '@/lib/stores/filter-store';
import type { LayerType, ParcelColorMode } from '@/types/data';

// ========================================
// 레이어 설정 데이터 구조
// ========================================

interface LayerConfig {
    id: LayerType;
    label: string;
    icon: React.ReactNode;
    color: string;
}

interface LayerCategory {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    layers: LayerConfig[];
    hasAdvancedOptions?: boolean;
}

// 마커 레이어 설정
const MARKER_LAYERS: LayerCategory[] = [
    {
        id: 'transaction',
        label: '실거래',
        icon: <IconCurrencyWon size={18} />,
        color: 'green',
        layers: [{ id: 'transaction-marker', label: '실거래가 마커', icon: <IconCurrencyWon size={14} />, color: 'green' }],
        hasAdvancedOptions: true,
    },
    {
        id: 'listing',
        label: '매물',
        icon: <IconHome size={18} />,
        color: 'blue',
        layers: [{ id: 'listing-marker', label: '매물 마커', icon: <IconHome size={14} />, color: 'blue' }],
    },
    {
        id: 'auction',
        label: '경매',
        icon: <IconGavel size={18} />,
        color: 'red',
        layers: [{ id: 'auction-marker', label: '경매 마커', icon: <IconGavel size={14} />, color: 'red' }],
    },
];

// 산업클러스터 레이어 설정 (산업단지 + 지식산업센터 + 공장 통합)
const INDUSTRIAL_CLUSTER_LAYERS: LayerCategory = {
    id: 'industrial-cluster',
    label: '산업클러스터',
    icon: <IconBuildingFactory2 size={18} />,
    color: 'orange',
    layers: [
        { id: 'industrial-complex', label: '산업단지', icon: <IconBuildingFactory2 size={14} />, color: 'orange' },
        { id: 'knowledge-center', label: '지식산업센터', icon: <IconBuilding size={14} />, color: 'violet' },
        { id: 'factory', label: '공장', icon: <IconBuildingFactory2 size={14} />, color: 'teal' },
    ],
};

// 지도 유형 설정
const MAP_TYPES = [
    { value: 'normal', label: '일반' },
    { value: 'satellite', label: '위성' },
    { value: 'hybrid', label: '혼합' },
    { value: 'terrain', label: '지형' },
] as const;

// 필지 색상 모드 설정
const PARCEL_COLOR_MODES = [
    { value: 'price', label: '실거래가' },
    { value: 'price-change', label: '증감률' },
] as const;

// 증감률 비교 기간 설정 (custom 추가)
const PRICE_CHANGE_PERIODS = [
    { value: '1', label: '1년' },
    { value: '3', label: '3년' },
    { value: '5', label: '5년' },
    { value: 'custom', label: '직접' },
] as const;

// 년도 슬라이더 범위 (2015 ~ 현재)
const MIN_YEAR = 2015;
const MAX_YEAR = new Date().getFullYear();

// 확장된 카테고리 타입
type ExpandedCategory = 'transaction' | 'listing' | 'auction' | 'industrial-cluster' | 'mapType' | null;

function LayerControlPanelInner() {
    // MapStore - 지도 상태
    const currentMapType = useMapStore((state) => state.currentMapType);
    const setMapType = useMapStore((state) => state.setMapType);

    // UIStore - UI 상태 (useShallow로 그룹화)
    const uiState = useUIStore(
        useShallow((state) => ({
            rightSidebarWidth: state.rightSidebarWidth,
            visibleLayers: state.visibleLayers,
            parcelColorMode: state.parcelColorMode,
            dataVisualizationEnabled: state.dataVisualizationEnabled,
            priceChangePeriod: state.priceChangePeriod,
            priceChangeRange: state.priceChangeRange,
            transactionYear: state.transactionYear,
            transactionYearRange: state.transactionYearRange,
            transactionMarkerViewMode: state.transactionMarkerViewMode,
            transactionPriceDisplayMode: state.transactionPriceDisplayMode,
        }))
    );

    // UIStore - 액션 (변경되지 않으므로 별도 구독)
    const uiActions = useUIStore(
        useShallow((state) => ({
            toggleLayer: state.toggleLayer,
            setParcelColorMode: state.setParcelColorMode,
            setDataVisualizationEnabled: state.setDataVisualizationEnabled,
            setPriceChangePeriod: state.setPriceChangePeriod,
            setPriceChangeRange: state.setPriceChangeRange,
            setTransactionYear: state.setTransactionYear,
            setTransactionYearRange: state.setTransactionYearRange,
            setTransactionMarkerViewMode: state.setTransactionMarkerViewMode,
            setTransactionPriceDisplayMode: state.setTransactionPriceDisplayMode,
        }))
    );

    const { enabled: timelineEnabled, date: timelineDate, minDate, maxDate } = useTimeline();
    const { setEnabled: setTimelineEnabled, setDate: setTimelineDate } = useTimelineActions();

    // 확장 상태
    const [expanded, setExpanded] = useState<ExpandedCategory>(null);

    // Destructuring for convenience
    const {
        rightSidebarWidth,
        visibleLayers,
        parcelColorMode,
        dataVisualizationEnabled,
        priceChangePeriod,
        priceChangeRange,
        transactionYear,
        transactionYearRange,
        transactionMarkerViewMode,
        transactionPriceDisplayMode,
    } = uiState;

    const {
        toggleLayer,
        setParcelColorMode,
        setDataVisualizationEnabled,
        setPriceChangePeriod,
        setPriceChangeRange,
        setTransactionYear,
        setTransactionYearRange,
        setTransactionMarkerViewMode,
        setTransactionPriceDisplayMode,
    } = uiActions;

    const isLayerVisible = useCallback((layer: LayerType) => {
        return visibleLayers.has(layer);
    }, [visibleLayers]);

    const handleToggle = useCallback((layer: LayerType) => {
        toggleLayer(layer);
    }, [toggleLayer]);

    // 타임라인 관련
    const minTimestamp = useMemo(() => new Date(minDate).getTime(), [minDate]);
    const maxTimestamp = useMemo(() => new Date(maxDate).getTime(), [maxDate]);
    const currentTimestamp = useMemo(() => {
        if (!timelineDate) return maxTimestamp;
        return new Date(timelineDate).getTime();
    }, [timelineDate, maxTimestamp]);

    const handleSliderChange = useCallback((value: number) => {
        const newDate = new Date(value).toISOString().split('T')[0];
        setTimelineDate(newDate);
    }, [setTimelineDate]);

    const displayDate = useMemo(() => {
        if (!timelineDate) return '현재';
        const d = new Date(timelineDate);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    }, [timelineDate]);

    // 확장 핸들러
    const handleExpand = useCallback((category: ExpandedCategory) => {
        setExpanded((prev) => prev === category ? null : category);
    }, []);

    // 메뉴 버튼 렌더러
    const renderMenuButton = (
        id: ExpandedCategory,
        icon: React.ReactNode,
        label: string,
        color: string,
        isActive: boolean,
        badge?: string
    ) => (
        <Tooltip label={label} position="left" withArrow disabled={expanded === id}>
            <UnstyledButton
                onClick={() => handleExpand(id)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: expanded === id ? '#f1f5f9' : 'transparent',
                    border: expanded === id ? '1px solid #e2e8f0' : '1px solid transparent',
                    position: 'relative',
                    transition: 'all 0.15s',
                }}
            >
                <ThemeIcon
                    size="md"
                    variant={isActive ? 'filled' : 'light'}
                    color={color}
                    radius="md"
                >
                    {icon}
                </ThemeIcon>
                {/* 활성 표시 점 */}
                {isActive && (
                    <Box
                        style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#22c55e',
                            border: '1.5px solid white',
                        }}
                    />
                )}
            </UnstyledButton>
        </Tooltip>
    );

    // 토글 아이템 렌더러
    const renderToggleItem = (
        icon: React.ReactNode,
        label: string,
        color: string,
        isActive: boolean,
        onToggle: () => void
    ) => (
        <UnstyledButton
            onClick={onToggle}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                background: isActive ? '#f8fafc' : 'transparent',
                border: isActive ? '1px solid #e2e8f0' : '1px solid transparent',
                width: '100%',
            }}
        >
            <ThemeIcon size="sm" variant={isActive ? 'filled' : 'light'} color={color} radius="md">
                {icon}
            </ThemeIcon>
            <Text size="sm" fw={500} style={{ flex: 1 }}>{label}</Text>
            <Box
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    background: isActive ? '#22c55e' : '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {isActive && <IconCheck size={12} color="white" />}
            </Box>
        </UnstyledButton>
    );

    // 증감률 범례
    const renderPriceChangeLegend = () => (
        <Group gap="lg" justify="center" py={4}>
            <Group gap={4}>
                <Box style={{
                    width: 24,
                    height: 6,
                    background: 'linear-gradient(to right, rgba(239,68,68,0.3), rgba(239,68,68,1))',
                    borderRadius: 2
                }} />
                <IconTrendingUp size={12} color="#ef4444" />
                <Text size="xs" c="dimmed">상승</Text>
            </Group>
            <Group gap={4}>
                <Box style={{
                    width: 24,
                    height: 6,
                    background: 'linear-gradient(to right, rgba(59,130,246,0.3), rgba(59,130,246,1))',
                    borderRadius: 2
                }} />
                <IconTrendingDown size={12} color="#3b82f6" />
                <Text size="xs" c="dimmed">하락</Text>
            </Group>
        </Group>
    );

    // ON/OFF 토글 버튼 렌더러
    const renderOnOffToggle = (
        label: string,
        layerId: LayerType,
        activeColor: string,
        activeBg: string
    ) => (
        <Group justify="space-between">
            <Text size="sm" fw={600}>{label}</Text>
            <UnstyledButton
                onClick={() => handleToggle(layerId)}
                style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: isLayerVisible(layerId) ? activeBg : '#f1f5f9',
                    color: isLayerVisible(layerId) ? activeColor : '#64748b',
                    fontSize: 12,
                    fontWeight: 600,
                }}
            >
                {isLayerVisible(layerId) ? 'ON' : 'OFF'}
            </UnstyledButton>
        </Group>
    );

    // 증감률 기간 선택 상태에서 파생된 날짜 표시
    const priceChangeDisplayDates = useMemo(() => {
        if (priceChangePeriod === 'custom' && priceChangeRange) {
            return {
                from: priceChangeRange.from.substring(0, 7).replace('-', '.'),
                to: priceChangeRange.to.substring(0, 7).replace('-', '.'),
            };
        }
        const years = priceChangePeriod === 'custom' ? 3 : priceChangePeriod;
        const now = new Date();
        const past = new Date(now);
        past.setFullYear(past.getFullYear() - years);
        return {
            from: `${past.getFullYear()}.${String(past.getMonth() + 1).padStart(2, '0')}`,
            to: `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`,
        };
    }, [priceChangePeriod, priceChangeRange]);

    // 커스텀 날짜 범위 슬라이더 핸들러
    const handleCustomRangeChange = useCallback((value: [number, number]) => {
        const fromYear = value[0];
        const toYear = value[1];
        setPriceChangeRange({
            from: `${fromYear}-01-01`,
            to: `${toYear}-12-31`,
        });
    }, [setPriceChangeRange]);

    // 현재 커스텀 범위 값 (슬라이더용)
    const customRangeValue = useMemo((): [number, number] => {
        if (priceChangeRange) {
            const fromYear = parseInt(priceChangeRange.from.substring(0, 4));
            const toYear = parseInt(priceChangeRange.to.substring(0, 4));
            return [fromYear, toYear];
        }
        return [MAX_YEAR - 3, MAX_YEAR];
    }, [priceChangeRange]);

    // 비교 기간 선택 렌더러 (프리셋 + 커스텀)
    const renderPeriodSelector = () => (
        <Box>
            <Text size="xs" c="dimmed" mb={4}>비교 기간</Text>
            <SegmentedControl
                size="xs"
                value={priceChangePeriod === 'custom' ? 'custom' : String(priceChangePeriod)}
                onChange={(value) => {
                    if (value === 'custom') {
                        setPriceChangePeriod('custom');
                        // 기본 커스텀 범위 설정
                        if (!priceChangeRange) {
                            setPriceChangeRange({
                                from: `${MAX_YEAR - 3}-01-01`,
                                to: `${MAX_YEAR}-12-31`,
                            });
                        }
                    } else {
                        setPriceChangePeriod(Number(value) as 1 | 3 | 5);
                    }
                }}
                data={PRICE_CHANGE_PERIODS.map(p => ({ value: p.value, label: p.label }))}
                fullWidth
            />

            {/* 커스텀 모드: 년도 범위 슬라이더 */}
            {priceChangePeriod === 'custom' && (
                <Box mt="sm" p="xs" style={{ background: '#f1f5f9', borderRadius: 6 }}>
                    <Group justify="space-between" mb={6}>
                        <Text size="xs" c="dimmed">
                            <IconArrowsHorizontal size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            비교 구간
                        </Text>
                        <Text size="xs" fw={600}>
                            {priceChangeDisplayDates.from} → {priceChangeDisplayDates.to}
                        </Text>
                    </Group>
                    <RangeSlider
                        min={MIN_YEAR}
                        max={MAX_YEAR}
                        step={1}
                        value={customRangeValue}
                        onChange={handleCustomRangeChange}
                        size="sm"
                        color="violet"
                        minRange={1}
                        marks={[
                            { value: MIN_YEAR, label: String(MIN_YEAR) },
                            { value: MAX_YEAR, label: String(MAX_YEAR) },
                        ]}
                        styles={{
                            track: { height: 4 },
                            thumb: { width: 14, height: 14 },
                            markLabel: { fontSize: 10 },
                        }}
                    />
                </Box>
            )}

            {/* 프리셋 모드: 비교 구간 표시 */}
            {priceChangePeriod !== 'custom' && (
                <Text size="xs" c="dimmed" ta="center" mt={4}>
                    {priceChangeDisplayDates.from} → {priceChangeDisplayDates.to}
                </Text>
            )}
        </Box>
    );

    // 실거래가 년도 범위 슬라이더 렌더러
    const renderTransactionYearSlider = () => {
        const currentRange = transactionYearRange ?? { from: MIN_YEAR, to: MAX_YEAR };
        const isFullRange = transactionYearRange === null;

        return (
            <Box>
                <Group justify="space-between" mb={6}>
                    <Group gap={6}>
                        <IconCalendar size={14} color="#64748b" />
                        <Text size="xs" c="dimmed">거래 기간</Text>
                    </Group>
                    <Text size="sm" fw={700} c="green">
                        {isFullRange ? '전체' : `${currentRange.from}~${currentRange.to}년`}
                    </Text>
                </Group>
                <Box p="xs" style={{ background: '#f8fafc', borderRadius: 8 }}>
                    <RangeSlider
                        min={MIN_YEAR}
                        max={MAX_YEAR}
                        step={1}
                        value={[currentRange.from, currentRange.to]}
                        onChange={([from, to]) => {
                            // 전체 범위면 null로 설정
                            if (from === MIN_YEAR && to === MAX_YEAR) {
                                setTransactionYearRange(null);
                            } else {
                                setTransactionYearRange({ from, to });
                            }
                        }}
                        size="sm"
                        color="green"
                        minRange={0}
                        marks={[
                            { value: MIN_YEAR, label: String(MIN_YEAR) },
                            { value: 2020, label: '2020' },
                            { value: MAX_YEAR, label: String(MAX_YEAR) },
                        ]}
                        styles={{
                            track: { height: 4 },
                            thumb: { width: 14, height: 14 },
                            markLabel: { fontSize: 10 },
                        }}
                    />
                    <Group justify="center" mt={8}>
                        <UnstyledButton
                            onClick={() => setTransactionYearRange(null)}
                            style={{
                                padding: '2px 10px',
                                borderRadius: 4,
                                background: isFullRange ? '#dcfce7' : '#f1f5f9',
                                color: isFullRange ? '#16a34a' : '#64748b',
                                fontSize: 11,
                                fontWeight: 600,
                            }}
                        >
                            전체 기간
                        </UnstyledButton>
                    </Group>
                </Box>
            </Box>
        );
    };

    // 마커 보기 방식 렌더러
    const renderMarkerViewMode = () => (
        <Box>
            <Text size="xs" c="dimmed" mb={4}>마커 보기 방식</Text>
            <SegmentedControl
                size="xs"
                value={transactionMarkerViewMode}
                onChange={(value) => setTransactionMarkerViewMode(value as 'average' | 'all')}
                data={[
                    { value: 'average', label: '평균' },
                    { value: 'all', label: '전체' },
                ]}
                fullWidth
            />
            <Text size="xs" c="dimmed" ta="center" mt={4}>
                {transactionMarkerViewMode === 'average'
                    ? '동일 필지 거래를 평균값으로 표시'
                    : '모든 거래 내역을 개별 마커로 표시'
                }
            </Text>
        </Box>
    );

    // 가격 표시 방식 렌더러 (평단가 / 총거래가)
    const renderPriceDisplayMode = () => (
        <Box mt="sm">
            <Text size="xs" c="dimmed" mb={4}>가격 표시</Text>
            <SegmentedControl
                size="xs"
                value={transactionPriceDisplayMode}
                onChange={(value) => setTransactionPriceDisplayMode(value as 'perPyeong' | 'total')}
                data={[
                    { value: 'perPyeong', label: '평단가' },
                    { value: 'total', label: '총거래가' },
                ]}
                fullWidth
            />
            <Text size="xs" c="dimmed" ta="center" mt={4}>
                {transactionPriceDisplayMode === 'perPyeong'
                    ? '면적당 가격 (만원/평)'
                    : '실제 거래 금액'
                }
            </Text>
        </Box>
    );

    // 실거래가 패널
    const renderTransactionPanel = () => (
        <Stack gap="sm">
            {/* ON/OFF */}
            {renderOnOffToggle('실거래가 마커', 'transaction-marker', '#16a34a', '#dcfce7')}

            {/* 마커 보기 방식 + 가격 표시 모드 */}
            {isLayerVisible('transaction-marker') && (
                <Box p="sm" style={{ background: '#f0fdf4', borderRadius: 8 }}>
                    {renderMarkerViewMode()}
                    {renderPriceDisplayMode()}
                </Box>
            )}

            <Divider />

            {/* 데이터 시각화 활성화 */}
            <Box>
                <Group justify="space-between" mb={8}>
                    <Text size="sm" fw={600}>필지 데이터 시각화</Text>
                    <UnstyledButton
                        onClick={() => setDataVisualizationEnabled(!dataVisualizationEnabled)}
                        style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: dataVisualizationEnabled ? '#dcfce7' : '#f1f5f9',
                            color: dataVisualizationEnabled ? '#16a34a' : '#64748b',
                            fontSize: 12,
                            fontWeight: 600,
                        }}
                    >
                        {dataVisualizationEnabled ? 'ON' : 'OFF'}
                    </UnstyledButton>
                </Group>

                {dataVisualizationEnabled && (
                    <Box p="sm" style={{ background: '#f8fafc', borderRadius: 8 }}>
                        {/* 필지 색상 모드 */}
                        <Box mb="sm">
                            <Text size="xs" c="dimmed" mb={6}>색상 모드</Text>
                            <SegmentedControl
                                size="xs"
                                value={parcelColorMode}
                                onChange={(value) => setParcelColorMode(value as ParcelColorMode)}
                                data={PARCEL_COLOR_MODES.map(m => ({ value: m.value, label: m.label }))}
                                fullWidth
                            />
                        </Box>

                        {/* 증감률 모드일 때 범례 */}
                        {parcelColorMode === 'price-change' && (
                            <>
                                {renderPriceChangeLegend()}
                                <Box mt="sm">
                                    {renderPeriodSelector()}
                                </Box>
                            </>
                        )}

                        {/* 실거래가 모드일 때 범례 + 년도 슬라이더 */}
                        {parcelColorMode === 'price' && (
                            <>
                                <Group gap="lg" justify="center" py={4}>
                                    <Group gap={4}>
                                        <Box style={{
                                            width: 24,
                                            height: 6,
                                            background: 'linear-gradient(to right, #3b82f6, #ef4444)',
                                            borderRadius: 2
                                        }} />
                                        <Text size="xs" c="dimmed">저가 → 고가</Text>
                                    </Group>
                                </Group>
                                <Divider my="xs" />
                                {renderTransactionYearSlider()}
                            </>
                        )}
                    </Box>
                )}
            </Box>
        </Stack>
    );

    // 매물 패널
    const renderListingPanel = () => (
        <Stack gap="sm">
            {renderOnOffToggle('매물 마커', 'listing-marker', '#2563eb', '#dbeafe')}

            {isLayerVisible('listing-marker') && (
                <>
                    <Divider />
                    <Box p="sm" style={{ background: '#f8fafc', borderRadius: 8 }}>
                        <Text size="xs" c="dimmed" ta="center">
                            매물 필터 옵션 (준비중)
                        </Text>
                    </Box>
                </>
            )}
        </Stack>
    );

    // 경매 패널
    const renderAuctionPanel = () => (
        <Stack gap="sm">
            {renderOnOffToggle('경매 마커', 'auction-marker', '#dc2626', '#fee2e2')}

            {isLayerVisible('auction-marker') && (
                <>
                    <Divider />
                    <Box p="sm" style={{ background: '#f8fafc', borderRadius: 8 }}>
                        <Text size="xs" c="dimmed" ta="center">
                            경매 필터 옵션 (준비중)
                        </Text>
                    </Box>
                </>
            )}
        </Stack>
    );

    // 레이어 목록 렌더러 (데이터 기반)
    const renderLayerList = (layers: LayerConfig[]) => (
        <Stack gap={6}>
            {layers.map((layer) =>
                renderToggleItem(
                    layer.icon,
                    layer.label,
                    layer.color,
                    isLayerVisible(layer.id),
                    () => handleToggle(layer.id)
                )
            )}
        </Stack>
    );

    // 산업클러스터 패널 (산업단지 + 지식산업센터 + 공장)
    const renderIndustrialClusterPanel = () => renderLayerList(INDUSTRIAL_CLUSTER_LAYERS.layers);

    // 지도 유형 패널
    const renderMapTypePanel = () => (
        <Stack gap={4}>
            {MAP_TYPES.map((type) => (
                <UnstyledButton
                    key={type.value}
                    onClick={() => setMapType(type.value)}
                    style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: currentMapType === type.value ? '#f1f5f9' : 'transparent',
                        border: currentMapType === type.value ? '1px solid #e2e8f0' : '1px solid transparent',
                    }}
                >
                    <Group gap="xs">
                        <Box
                            style={{
                                width: 16,
                                height: 16,
                                borderRadius: 4,
                                background: currentMapType === type.value ? '#3b82f6' : '#e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {currentMapType === type.value && <IconCheck size={10} color="white" />}
                        </Box>
                        <Text size="sm" fw={currentMapType === type.value ? 600 : 400}>
                            {type.label}
                        </Text>
                    </Group>
                </UnstyledButton>
            ))}
        </Stack>
    );

    // 패널 내용 가져오기
    const getPanelContent = () => {
        switch (expanded) {
            case 'transaction': return { title: '실거래', content: renderTransactionPanel() };
            case 'listing': return { title: '매물', content: renderListingPanel() };
            case 'auction': return { title: '경매', content: renderAuctionPanel() };
            case 'industrial-cluster': return { title: '산업클러스터', content: renderIndustrialClusterPanel() };
            case 'mapType': return { title: '지도 유형', content: renderMapTypePanel() };
            default: return null;
        }
    };

    const panelContent = getPanelContent();

    return (
        <Box
            style={{
                position: 'fixed',
                top: '50%',
                right: `${rightSidebarWidth + 16}px`,
                transform: 'translateY(-50%)',
                zIndex: 1000,
                transition: 'right 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
            }}
        >
            {/* 확장 패널 */}
            {panelContent && (
                <Paper
                    shadow="md"
                    radius="lg"
                    p="md"
                    style={{
                        width: 260,
                        background: 'white',
                        border: '1px solid #e2e8f0',
                    }}
                >
                    {/* 헤더 */}
                    <Group justify="space-between" mb="sm">
                        <Text size="sm" fw={700}>{panelContent.title}</Text>
                        <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="gray"
                            onClick={() => setExpanded(null)}
                        >
                            <IconX size={14} />
                        </ActionIcon>
                    </Group>

                    {panelContent.content}
                </Paper>
            )}

            {/* 메뉴 버튼들 */}
            <Paper
                shadow="md"
                radius="lg"
                p="xs"
                style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                }}
            >
                <Stack gap={4} align="center">
                    {/* 마커 레이어 버튼 */}
                    {MARKER_LAYERS.map((category) => (
                        <React.Fragment key={category.id}>
                            {renderMenuButton(
                                category.id as ExpandedCategory,
                                category.icon,
                                category.label,
                                category.color,
                                category.layers.some(l => isLayerVisible(l.id))
                            )}
                        </React.Fragment>
                    ))}

                    <Divider w="80%" my={4} />

                    {/* 산업클러스터 버튼 */}
                    {renderMenuButton(
                        INDUSTRIAL_CLUSTER_LAYERS.id as ExpandedCategory,
                        INDUSTRIAL_CLUSTER_LAYERS.icon,
                        INDUSTRIAL_CLUSTER_LAYERS.label,
                        INDUSTRIAL_CLUSTER_LAYERS.color,
                        INDUSTRIAL_CLUSTER_LAYERS.layers.some(l => isLayerVisible(l.id))
                    )}

                    <Divider w="80%" my={4} />

                    {/* 지도 유형 버튼 */}
                    {renderMenuButton(
                        'mapType',
                        <IconMap size={18} />,
                        '지도 유형',
                        'cyan',
                        true
                    )}
                </Stack>
            </Paper>
        </Box>
    );
}

export const LayerControlPanel = memo(LayerControlPanelInner);
export default LayerControlPanel;
