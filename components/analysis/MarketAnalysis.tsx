// components/analysis/MarketAnalysis.tsx - 시장 유동성 및 수급 분석
// 핵심 질문: "시장이 활발한가? 물건이 잘 빠지는가? 위험하진 않은가?"

'use client';

import { useMemo, memo } from 'react';
import { Paper, Title, Text, Group, Stack, SimpleGrid, Progress, Badge, ThemeIcon, Box, Divider, RingProgress, Tooltip } from '@mantine/core';
import { IconShoppingCart, IconHammer, IconChartBar, IconHome, IconTrendingUp, IconTrendingDown, IconAlertTriangle, IconClock, IconBuilding, IconBuildingFactory2, IconUsers } from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, ComposedChart, Area, Legend } from 'recharts';
import { useFilteredParcels } from '@/lib/stores/filter-store';
import { useDataStore } from '@/lib/stores/data-store';
import { getListings, getAuctions, getTransactions } from '@/lib/utils/dataHelpers';

interface MarketAnalysisProps {
    regionCode: string;
    regionLevel: 'sig' | 'emd';
}

const LISTING_COLOR = '#228be6';
const AUCTION_COLOR = '#fa5252';
const TRANSACTION_COLOR = '#40c057';

// 더미 데이터 생성
function generateVolumeHistory() {
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    return months.map((month) => ({
        month,
        거래량: Math.floor(Math.random() * 40) + 10,
        전년동월: Math.floor(Math.random() * 35) + 8,
        경매건수: Math.floor(Math.random() * 15) + 3,
    }));
}

function generateAuctionTrend() {
    const months = ['7월', '8월', '9월', '10월', '11월', '12월'];
    let count = Math.floor(Math.random() * 20) + 30;
    return months.map((month) => {
        count = count + Math.floor((Math.random() - 0.4) * 8);
        return { month, 경매건수: Math.max(5, count), 증감률: Math.round((Math.random() - 0.4) * 30) };
    });
}

function generateFactoryTrend() {
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    return months.map((month) => ({
        month,
        등록: Math.floor(Math.random() * 15) + 5,
        폐업: Math.floor(Math.random() * 10) + 2,
    }));
}

export const MarketAnalysis = memo(function MarketAnalysis({ regionCode, regionLevel }: MarketAnalysisProps) {
    const allParcels = useFilteredParcels();
    const factories = useDataStore((state) => state.factories);

    const parcels = useMemo(() => {
        return allParcels.filter((p) => regionLevel === 'sig' ? p.sigCode === regionCode : p.emdCode === regionCode);
    }, [allParcels, regionCode, regionLevel]);

    // 지역 내 공장
    const regionFactories = useMemo(() => {
        return factories.filter((f) => {
            const code = regionLevel === 'sig' ? f.id?.substring(0, 5) : f.id?.substring(0, 10);
            return code === regionCode;
        });
    }, [factories, regionCode, regionLevel]);

    const marketStats = useMemo(() => {
        const listings = getListings(parcels);
        const auctions = getAuctions(parcels);
        const transactions = getTransactions(parcels);

        const listingPrices = listings.map(p => p.listingPrice).filter((p): p is number => p !== undefined && p > 0);
        const auctionPrices = auctions.map(p => p.auctionPrice).filter((p): p is number => p !== undefined && p > 0);

        return {
            totalListings: listings.length,
            totalAuctions: auctions.length,
            totalTransactions: transactions.length,
            avgListingPrice: listingPrices.length > 0 ? listingPrices.reduce((a, b) => a + b, 0) / listingPrices.length : 0,
            avgAuctionPrice: auctionPrices.length > 0 ? auctionPrices.reduce((a, b) => a + b, 0) / auctionPrices.length : 0,
        };
    }, [parcels]);

    // 경매 유찰 통계
    const auctionStats = useMemo(() => {
        const auctions = getAuctions(parcels);
        if (auctions.length === 0) return null;

        const distribution = [
            { label: '신건', count: Math.floor(auctions.length * 0.3), color: '#40c057' },
            { label: '1회', count: Math.floor(auctions.length * 0.25), color: '#228be6' },
            { label: '2회', count: Math.floor(auctions.length * 0.2), color: '#fab005' },
            { label: '3회', count: Math.floor(auctions.length * 0.15), color: '#fd7e14' },
            { label: '4회+', count: Math.floor(auctions.length * 0.1), color: '#fa5252' },
        ].filter(d => d.count > 0);

        return { total: auctions.length, distribution };
    }, [parcels]);

    // 거래 유형 분포
    const typeDistribution = useMemo(() => {
        const total = marketStats.totalListings + marketStats.totalAuctions + marketStats.totalTransactions;
        if (total === 0) return [];
        return [
            { type: '매물', count: marketStats.totalListings, color: LISTING_COLOR },
            { type: '경매', count: marketStats.totalAuctions, color: AUCTION_COLOR },
            { type: '실거래', count: marketStats.totalTransactions, color: TRANSACTION_COLOR },
        ].filter(d => d.count > 0);
    }, [marketStats]);

    // 더미 데이터
    const volumeHistory = useMemo(() => generateVolumeHistory(), []);
    const auctionTrend = useMemo(() => generateAuctionTrend(), []);
    const factoryTrend = useMemo(() => generateFactoryTrend(), []);

    // 시장 위험도 지표 (더미)
    const marketRisk = useMemo(() => {
        const auctionGrowth = Math.round((Math.random() - 0.3) * 40); // 경매 건수 증감률
        const vacancyRate = Math.round(5 + Math.random() * 15); // 공실률
        const avgHoldingPeriod = Math.round(24 + Math.random() * 36); // 평균 보유기간 (개월)
        const ownerOccupiedRate = Math.round(55 + Math.random() * 30); // 자가 비율

        const riskLevel = auctionGrowth > 20 || vacancyRate > 15 ? 'high' : auctionGrowth > 0 || vacancyRate > 10 ? 'medium' : 'low';

        return { auctionGrowth, vacancyRate, avgHoldingPeriod, ownerOccupiedRate, riskLevel };
    }, []);

    const formatPrice = (value: number) => value >= 10000 ? `${(value / 10000).toFixed(1)}억` : value >= 1000 ? `${(value / 1000).toFixed(1)}천만` : `${value}만원`;

    const totalMarket = marketStats.totalListings + marketStats.totalAuctions;
    const listingRatio = totalMarket > 0 ? (marketStats.totalListings / totalMarket) * 100 : 0;
    const auctionRatio = totalMarket > 0 ? (marketStats.totalAuctions / totalMarket) * 100 : 0;

    return (
        <Stack gap="md">
            <Title order={3}>시장 동향</Title>

            {/* 기본 통계 */}
            <SimpleGrid cols={2}>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="blue" radius="md"><IconShoppingCart size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">매물</Text>
                    </Group>
                    <Text size="xl" fw={700}>{marketStats.totalListings.toLocaleString()}건</Text>
                    {marketStats.avgListingPrice > 0 && <Text size="xs" c="dimmed" mt={4}>평균 {formatPrice(marketStats.avgListingPrice)}</Text>}
                </Paper>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="red" radius="md"><IconHammer size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">경매</Text>
                    </Group>
                    <Text size="xl" fw={700}>{marketStats.totalAuctions.toLocaleString()}건</Text>
                    {marketStats.avgAuctionPrice > 0 && <Text size="xs" c="dimmed" mt={4}>평균 {formatPrice(marketStats.avgAuctionPrice)}</Text>}
                </Paper>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="green" radius="md"><IconHome size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">실거래</Text>
                    </Group>
                    <Text size="xl" fw={700}>{marketStats.totalTransactions.toLocaleString()}건</Text>
                </Paper>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="violet" radius="md"><IconBuildingFactory2 size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">공장 수</Text>
                    </Group>
                    <Text size="xl" fw={700}>{regionFactories.length.toLocaleString()}개</Text>
                </Paper>
            </SimpleGrid>

            {/* 시장 위험도 지표 */}
            <Paper p="lg" radius="md" withBorder bg={marketRisk.riskLevel === 'high' ? 'red.0' : marketRisk.riskLevel === 'medium' ? 'yellow.0' : 'green.0'}>
                <Group justify="space-between" mb="md">
                    <Group gap="sm">
                        <ThemeIcon size="md" variant="light" color={marketRisk.riskLevel === 'high' ? 'red' : marketRisk.riskLevel === 'medium' ? 'yellow' : 'green'} radius="md">
                            <IconAlertTriangle size={18} />
                        </ThemeIcon>
                        <Title order={5}>시장 위험도</Title>
                    </Group>
                    <Badge size="lg" color={marketRisk.riskLevel === 'high' ? 'red' : marketRisk.riskLevel === 'medium' ? 'yellow' : 'green'} variant="filled">
                        {marketRisk.riskLevel === 'high' ? '주의' : marketRisk.riskLevel === 'medium' ? '보통' : '양호'}
                    </Badge>
                </Group>
                <SimpleGrid cols={2} spacing="md">
                    <Tooltip label="경매 건수 증가는 부실 채권 증가 신호">
                        <Box>
                            <Group justify="space-between" mb={4}>
                                <Text size="xs" c="dimmed">경매 건수 증감률</Text>
                                <Group gap={4}>
                                    {marketRisk.auctionGrowth > 0 ? <IconTrendingUp size={12} color="#fa5252" /> : <IconTrendingDown size={12} color="#40c057" />}
                                    <Text size="xs" fw={600} c={marketRisk.auctionGrowth > 0 ? 'red' : 'green'}>{marketRisk.auctionGrowth > 0 ? '+' : ''}{marketRisk.auctionGrowth}%</Text>
                                </Group>
                            </Group>
                            <Progress value={Math.abs(marketRisk.auctionGrowth)} color={marketRisk.auctionGrowth > 20 ? 'red' : marketRisk.auctionGrowth > 0 ? 'yellow' : 'green'} size="sm" radius="xl" />
                        </Box>
                    </Tooltip>
                    <Tooltip label="임차 수요 대비 공급 과잉 여부">
                        <Box>
                            <Group justify="space-between" mb={4}>
                                <Text size="xs" c="dimmed">공실률</Text>
                                <Text size="xs" fw={600} c={marketRisk.vacancyRate > 15 ? 'red' : marketRisk.vacancyRate > 10 ? 'yellow' : 'green'}>{marketRisk.vacancyRate}%</Text>
                            </Group>
                            <Progress value={marketRisk.vacancyRate} color={marketRisk.vacancyRate > 15 ? 'red' : marketRisk.vacancyRate > 10 ? 'yellow' : 'green'} size="sm" radius="xl" />
                        </Box>
                    </Tooltip>
                    <Tooltip label="손바뀜 빈도 (투기성 자본 유입 여부)">
                        <Box>
                            <Group justify="space-between" mb={4}>
                                <Text size="xs" c="dimmed">평균 보유기간</Text>
                                <Text size="xs" fw={600}>{marketRisk.avgHoldingPeriod}개월</Text>
                            </Group>
                            <Progress value={(marketRisk.avgHoldingPeriod / 60) * 100} color="blue" size="sm" radius="xl" />
                        </Box>
                    </Tooltip>
                    <Tooltip label="자가 소유 vs 임대 수익형">
                        <Box>
                            <Group justify="space-between" mb={4}>
                                <Text size="xs" c="dimmed">자가 비율</Text>
                                <Text size="xs" fw={600}>{marketRisk.ownerOccupiedRate}%</Text>
                            </Group>
                            <Progress value={marketRisk.ownerOccupiedRate} color="cyan" size="sm" radius="xl" />
                        </Box>
                    </Tooltip>
                </SimpleGrid>
            </Paper>

            <Divider />

            {/* 거래 유형 분포 */}
            {typeDistribution.length > 0 && (
                <Paper p="lg" radius="md" withBorder>
                    <Title order={5} mb="md">거래 유형 분포</Title>
                    <Group align="center" gap="xl">
                        <RingProgress
                            size={140}
                            thickness={20}
                            roundCaps
                            sections={typeDistribution.map(d => ({ value: (d.count / parcels.length) * 100, color: d.color, tooltip: `${d.type}: ${d.count}건` }))}
                            label={<Box ta="center"><Text size="xl" fw={700}>{parcels.length}</Text><Text size="xs" c="dimmed" fw={500}>전체</Text></Box>}
                        />
                        <Stack gap="sm" style={{ flex: 1 }}>
                            {typeDistribution.map((d) => (
                                <Box key={d.type}>
                                    <Group justify="space-between" mb={4}>
                                        <Group gap={6}>
                                            <Box w={10} h={10} style={{ backgroundColor: d.color, borderRadius: 2 }} />
                                            <Text size="sm" fw={500}>{d.type}</Text>
                                        </Group>
                                        <Text size="sm" fw={600}>{d.count}건</Text>
                                    </Group>
                                    <Progress value={(d.count / parcels.length) * 100} color={d.color === LISTING_COLOR ? 'blue' : d.color === AUCTION_COLOR ? 'red' : 'green'} size="sm" radius="xl" />
                                </Box>
                            ))}
                        </Stack>
                    </Group>
                </Paper>
            )}

            {/* 거래량 & 경매 추이 */}
            <Paper p="lg" radius="md" withBorder>
                <Title order={5} mb="md">거래량 추이 (전년 비교)</Title>
                <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={volumeHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                        <XAxis dataKey="month" stroke="#868e96" style={{ fontSize: 11 }} />
                        <YAxis stroke="#868e96" style={{ fontSize: 11 }} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="거래량" fill="#228be6" name="금년 거래량" />
                        <Bar dataKey="전년동월" fill="#e9ecef" name="전년 거래량" />
                        <Line type="monotone" dataKey="경매건수" stroke="#fa5252" strokeWidth={2} dot={false} name="경매 건수" />
                    </ComposedChart>
                </ResponsiveContainer>
            </Paper>

            {/* 경매 건수 증감 추이 */}
            {auctionStats && auctionStats.total > 0 && (
                <Paper p="lg" radius="md" withBorder>
                    <Group justify="space-between" mb="md">
                        <Title order={5}>경매 유찰 현황</Title>
                        <Badge color="red" variant="light">총 {auctionStats.total}건</Badge>
                    </Group>
                    <Group align="flex-start" gap="xl">
                        <RingProgress
                            size={120}
                            thickness={16}
                            roundCaps
                            sections={auctionStats.distribution.map(d => ({ value: (d.count / auctionStats.total) * 100, color: d.color, tooltip: `${d.label}: ${d.count}건` }))}
                            label={<Text ta="center" size="sm" fw={600}>유찰</Text>}
                        />
                        <Stack gap="xs" style={{ flex: 1 }}>
                            {auctionStats.distribution.map((d) => (
                                <Group key={d.label} justify="space-between">
                                    <Group gap={6}>
                                        <Box w={8} h={8} style={{ backgroundColor: d.color, borderRadius: '50%' }} />
                                        <Text size="sm">{d.label} 유찰</Text>
                                    </Group>
                                    <Text size="sm" fw={600}>{d.count}건</Text>
                                </Group>
                            ))}
                        </Stack>
                    </Group>
                </Paper>
            )}

            {/* 공장 등록/폐업 추이 */}
            <Paper p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                    <Title order={5}>공장 등록/폐업 추이</Title>
                    <Text size="xs" c="dimmed">제조업 경기 활성도</Text>
                </Group>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={factoryTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                        <XAxis dataKey="month" stroke="#868e96" style={{ fontSize: 11 }} />
                        <YAxis stroke="#868e96" style={{ fontSize: 11 }} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="등록" fill="#40c057" name="신규 등록" />
                        <Bar dataKey="폐업" fill="#fa5252" name="폐업" />
                    </BarChart>
                </ResponsiveContainer>
            </Paper>

            <Paper p="sm" radius="md" bg="gray.0">
                <Text size="xs" c="dimmed" ta="center" fw={500}>* 공실률, 보유기간, 등록/폐업 추이 등은 시뮬레이션 데이터입니다</Text>
            </Paper>
        </Stack>
    );
});
