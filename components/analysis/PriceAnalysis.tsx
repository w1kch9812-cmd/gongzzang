// components/analysis/PriceAnalysis.tsx - 시세 및 투자 가치 분석
// 핵심 질문: "지금 얼마인가? 사면 이득인가?"

'use client';

import { useMemo, memo, useState } from 'react';
import { Paper, Title, Text, Group, Stack, SegmentedControl, SimpleGrid, ThemeIcon, Badge, Progress, Box, Divider, Tooltip } from '@mantine/core';
import { IconCash, IconArrowDown, IconArrowUp, IconTrendingUp, IconTrendingDown, IconStar, IconGraph, IconPercentage, IconHome, IconGavel, IconChartAreaLine, IconMapPin } from '@tabler/icons-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ComposedChart, Line, ReferenceLine } from 'recharts';
import { useFilteredParcels } from '@/lib/stores/filter-store';
import { useDataStore } from '@/lib/stores/data-store';

interface PriceAnalysisProps {
    regionCode: string;
    regionLevel: 'sig' | 'emd';
}

// 더미 데이터 생성
function generatePriceTrend(basePrice: number) {
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    let price = basePrice * 0.88;
    return months.map((month, i) => {
        const variation = (Math.random() - 0.35) * basePrice * 0.025;
        price = price + variation;
        const auctionPrice = price * (0.65 + Math.random() * 0.15); // 경매가는 시세의 65-80%
        return {
            month,
            실거래가: Math.round(price),
            경매낙찰가: Math.round(auctionPrice),
            낙찰가율: Math.round((auctionPrice / price) * 100),
        };
    });
}

function generateRegionComparison(currentRegion: string) {
    const regions = ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'];
    return regions.map(region => ({
        region,
        지가변동률: (Math.random() - 0.3) * 8,
        평균평당가: Math.round(800 + Math.random() * 600),
        isCurrent: region === currentRegion || Math.random() > 0.85,
    })).sort((a, b) => b.지가변동률 - a.지가변동률);
}

export const PriceAnalysis = memo(function PriceAnalysis({ regionCode, regionLevel }: PriceAnalysisProps) {
    const allParcels = useFilteredParcels();
    const districts = useDataStore((state) => state.districts);
    const [priceType, setPriceType] = useState<'transaction' | 'listing' | 'auction'>('transaction');

    // 현재 지역명 찾기
    const currentRegionName = useMemo(() => {
        const district = districts.find(d => d.code === regionCode);
        return district?.name || '';
    }, [districts, regionCode]);

    // 지역 필터링
    const parcels = useMemo(() => {
        return allParcels.filter((p) => {
            if (regionLevel === 'sig') return p.sigCode === regionCode;
            return p.emdCode === regionCode;
        });
    }, [allParcels, regionCode, regionLevel]);

    // 기본 통계 계산
    const stats = useMemo(() => {
        const txPrices = parcels.filter(p => p.type & 1).map(p => p.transactionPrice).filter((p): p is number => p !== undefined && p > 0);
        const listPrices = parcels.filter(p => p.type & 2).map(p => p.listingPrice).filter((p): p is number => p !== undefined && p > 0);
        const auctPrices = parcels.filter(p => p.type & 4).map(p => p.auctionPrice).filter((p): p is number => p !== undefined && p > 0);

        const getStats = (prices: number[]) => {
            if (prices.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
            const sorted = [...prices].sort((a, b) => a - b);
            return {
                avg: prices.reduce((a, b) => a + b, 0) / prices.length,
                min: sorted[0],
                max: sorted[sorted.length - 1],
                count: prices.length,
            };
        };

        return {
            transaction: getStats(txPrices),
            listing: getStats(listPrices),
            auction: getStats(auctPrices),
        };
    }, [parcels]);

    const currentStats = stats[priceType];

    // 평당가 계산
    const pricePerPyeong = useMemo(() => {
        const validParcels = parcels.filter(p => {
            const price = priceType === 'transaction' ? p.transactionPrice : priceType === 'listing' ? p.listingPrice : p.auctionPrice;
            return price && price > 0 && p.area && p.area > 0;
        });
        if (validParcels.length === 0) return 0;

        const totalPricePerPyeong = validParcels.reduce((sum, p) => {
            const price = priceType === 'transaction' ? p.transactionPrice! : priceType === 'listing' ? p.listingPrice! : p.auctionPrice!;
            return sum + (price / (p.area! / 3.3058));
        }, 0);
        return Math.round(totalPricePerPyeong / validParcels.length);
    }, [parcels, priceType]);

    // 경매 낙찰가율 계산
    const auctionBidRate = useMemo(() => {
        if (stats.transaction.avg === 0 || stats.auction.avg === 0) return 0;
        return Math.round((stats.auction.avg / stats.transaction.avg) * 100);
    }, [stats]);

    // 추정 임대 수익률 (더미)
    const estimatedRentalYield = useMemo(() => {
        const baseYield = 4 + Math.random() * 4; // 4-8%
        return {
            yield: baseYield.toFixed(1),
            monthlyRent: Math.round((currentStats.avg * (baseYield / 100)) / 12),
        };
    }, [currentStats.avg]);

    // 더미 데이터
    const priceTrend = useMemo(() => generatePriceTrend(currentStats.avg || 50000), [currentStats.avg]);
    const regionComparison = useMemo(() => generateRegionComparison(currentRegionName), [currentRegionName]);

    const yearOverYear = useMemo(() => ({
        priceChange: Math.round((Math.random() - 0.3) * 15 * 10) / 10,
        volumeChange: Math.round((Math.random() - 0.5) * 25 * 10) / 10,
    }), []);

    const investmentScore = useMemo(() => {
        const scores = {
            priceCompetitiveness: Math.round(40 + Math.random() * 45), // 가격 경쟁력
            liquidityScore: Math.round(35 + Math.random() * 50),       // 유동성
            growthPotential: Math.round(45 + Math.random() * 40),      // 성장 잠재력
            rentalYield: Math.round(50 + Math.random() * 35),          // 임대 수익성
        };
        const total = Math.round(Object.values(scores).reduce((a, b) => a + b) / 4);
        return { ...scores, total };
    }, []);

    const priceTypeLabel = priceType === 'transaction' ? '실거래가' : priceType === 'listing' ? '매물가' : '경매가';
    const formatPrice = (value: number) => value >= 10000 ? `${(value / 10000).toFixed(1)}억` : `${Math.round(value / 1000)}천만`;
    const formatPyeongPrice = (value: number) => `${(value / 10000).toFixed(0)}만원`;

    return (
        <Stack gap="md">
            {/* 헤더 */}
            <Group justify="space-between">
                <Title order={3}>시세/투자 분석</Title>
                <SegmentedControl
                    value={priceType}
                    onChange={(v) => setPriceType(v as typeof priceType)}
                    data={[{ label: '실거래', value: 'transaction' }, { label: '매물', value: 'listing' }, { label: '경매', value: 'auction' }]}
                    size="xs"
                />
            </Group>

            {/* 핵심 지표 */}
            <SimpleGrid cols={2}>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="blue" radius="md"><IconCash size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">평균 {priceTypeLabel}</Text>
                    </Group>
                    <Group gap={4} align="baseline">
                        <Text size="xl" fw={700}>{formatPrice(currentStats.avg)}</Text>
                        <Badge size="sm" color={yearOverYear.priceChange > 0 ? 'red' : 'blue'} variant="light"
                            leftSection={yearOverYear.priceChange > 0 ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}>
                            {yearOverYear.priceChange > 0 ? '+' : ''}{yearOverYear.priceChange}%
                        </Badge>
                    </Group>
                </Paper>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="cyan" radius="md"><IconGraph size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">평당가</Text>
                    </Group>
                    <Text size="xl" fw={700}>{formatPyeongPrice(pricePerPyeong)}</Text>
                </Paper>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="green" radius="md"><IconArrowDown size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">최저가</Text>
                    </Group>
                    <Text size="xl" fw={700}>{formatPrice(currentStats.min)}</Text>
                    <Text size="xs" c="dimmed">MIN</Text>
                </Paper>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="red" radius="md"><IconArrowUp size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">최고가</Text>
                    </Group>
                    <Text size="xl" fw={700}>{formatPrice(currentStats.max)}</Text>
                    <Text size="xs" c="dimmed">MAX</Text>
                </Paper>
            </SimpleGrid>

            {/* 경매 낙찰가율 & 임대 수익률 */}
            <SimpleGrid cols={2}>
                <Paper p="md" radius="md" withBorder bg="orange.0">
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="orange" radius="md"><IconGavel size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">경매 낙찰가율</Text>
                    </Group>
                    <Group gap={4} align="baseline">
                        <Text size="xl" fw={700} c="orange.7">{auctionBidRate || 72}%</Text>
                        <Text size="xs" c="dimmed">실거래가 대비</Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>
                        {auctionBidRate < 70 ? '⚡ 저가 매수 기회' : auctionBidRate < 80 ? '적정 수준' : '시세 근접'}
                    </Text>
                </Paper>
                <Paper p="md" radius="md" withBorder bg="green.0">
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="green" radius="md"><IconPercentage size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">추정 임대수익률</Text>
                    </Group>
                    <Group gap={4} align="baseline">
                        <Text size="xl" fw={700} c="green.7">{estimatedRentalYield.yield}%</Text>
                        <Text size="xs" c="dimmed">연간</Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>월 예상 임대료 약 {formatPrice(estimatedRentalYield.monthlyRent)}</Text>
                </Paper>
            </SimpleGrid>

            <Divider />

            {/* 투자 매력도 */}
            <Paper p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                    <Title order={5}>투자 매력도 종합</Title>
                    <Badge size="lg" color={investmentScore.total >= 70 ? 'green' : investmentScore.total >= 50 ? 'yellow' : 'red'} variant="light">
                        <Group gap={4}><IconStar size={14} />{investmentScore.total}점</Group>
                    </Badge>
                </Group>
                <SimpleGrid cols={2} spacing="sm">
                    {[
                        { label: '가격 경쟁력', desc: '시세 대비 저평가 여부', score: investmentScore.priceCompetitiveness, color: 'blue' },
                        { label: '유동성', desc: '거래 활발도', score: investmentScore.liquidityScore, color: 'cyan' },
                        { label: '성장 잠재력', desc: '향후 가치 상승 기대', score: investmentScore.growthPotential, color: 'green' },
                        { label: '임대 수익성', desc: '월세 수익 기대치', score: investmentScore.rentalYield, color: 'orange' },
                    ].map(({ label, desc, score, color }) => (
                        <Tooltip key={label} label={desc} position="top">
                            <Box>
                                <Group justify="space-between" mb={4}>
                                    <Text size="xs" c="dimmed">{label}</Text>
                                    <Text size="xs" fw={600}>{score}점</Text>
                                </Group>
                                <Progress value={score} color={color} size="sm" radius="xl" />
                            </Box>
                        </Tooltip>
                    ))}
                </SimpleGrid>
            </Paper>

            {/* 가격 추이 (실거래가 vs 경매낙찰가) */}
            <Paper p="lg" radius="md" withBorder>
                <Title order={5} mb="md">거래가 추이 & 낙찰가율</Title>
                <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={priceTrend}>
                        <defs>
                            <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#228be6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#228be6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                        <XAxis dataKey="month" stroke="#868e96" style={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" stroke="#868e96" style={{ fontSize: 11 }} tickFormatter={formatPrice} />
                        <YAxis yAxisId="right" orientation="right" stroke="#fd7e14" style={{ fontSize: 11 }} domain={[50, 100]} tickFormatter={(v) => `${v}%`} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area yAxisId="left" type="monotone" dataKey="실거래가" stroke="#228be6" strokeWidth={2} fill="url(#colorTx)" />
                        <Area yAxisId="left" type="monotone" dataKey="경매낙찰가" stroke="#fa5252" strokeWidth={2} fill="#fa525220" />
                        <Line yAxisId="right" type="monotone" dataKey="낙찰가율" stroke="#fd7e14" strokeWidth={2} dot={false} />
                        <ReferenceLine yAxisId="right" y={70} stroke="#868e96" strokeDasharray="3 3" label={{ value: '70%', position: 'right', fontSize: 10 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </Paper>

            {/* 지역간 비교 */}
            <Paper p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                    <Title order={5}>지역간 지가변동률 비교</Title>
                    <Badge size="sm" variant="light" color="gray">최근 1년</Badge>
                </Group>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={regionComparison.slice(0, 8)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                        <XAxis type="number" stroke="#868e96" style={{ fontSize: 11 }} domain={[-5, 8]} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="region" stroke="#868e96" style={{ fontSize: 11 }} width={60} />
                        <RechartsTooltip
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 12 }}
                            formatter={(v: number | undefined, name: string | undefined) => [`${(v ?? 0).toFixed(1)}%`, name === '지가변동률' ? '변동률' : (name ?? '')]}
                        />
                        <Bar dataKey="지가변동률" fill="#228be6" name="지가변동률">
                            {regionComparison.slice(0, 8).map((entry, index) => (
                                <rect key={index} fill={entry.isCurrent ? '#fa5252' : entry.지가변동률 >= 0 ? '#40c057' : '#228be6'} />
                            ))}
                        </Bar>
                        <ReferenceLine x={0} stroke="#868e96" />
                    </BarChart>
                </ResponsiveContainer>
                <Text size="xs" c="dimmed" ta="center" mt="sm">🔴 현재 선택 지역 | 🟢 상승 | 🔵 하락</Text>
            </Paper>

            <Paper p="sm" radius="md" bg="gray.0">
                <Text size="xs" c="dimmed" ta="center" fw={500}>* 임대수익률, 지가변동률 등 일부 지표는 시뮬레이션 데이터입니다</Text>
            </Paper>
        </Stack>
    );
});
