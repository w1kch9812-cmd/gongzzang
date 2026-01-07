// components/analysis/PriceAnalysis.tsx - 시세 및 투자 가치 분석
// 핵심 질문: "지금 얼마인가? 사면 이득인가?"

'use client';

import { useMemo, memo, useState } from 'react';
import { Paper, Title, Text, Group, Stack, SegmentedControl, SimpleGrid, ThemeIcon, Badge, Progress, Box, Divider, Tooltip } from '@mantine/core';
import { IconCash, IconArrowDown, IconArrowUp, IconTrendingUp, IconTrendingDown, IconStar, IconGraph, IconGavel } from '@tabler/icons-react';
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

    // 더미 데이터
    const priceTrend = useMemo(() => generatePriceTrend(currentStats.avg || 50000), [currentStats.avg]);
    const regionComparison = useMemo(() => generateRegionComparison(currentRegionName), [currentRegionName]);

    const yearOverYear = useMemo(() => ({
        priceChange: Math.round((Math.random() - 0.3) * 15 * 10) / 10,
        volumeChange: Math.round((Math.random() - 0.5) * 25 * 10) / 10,
    }), []);

    // 지역 내 주요 매물 유형 파악
    const dominantPropertyType = useMemo(() => {
        const typeCounts = new Map<string, number>();
        parcels.forEach(p => {
            const type = p.propertyType || 'unknown';
            typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
        });
        let maxType = 'factory';
        let maxCount = 0;
        typeCounts.forEach((count, type) => {
            if (count > maxCount) {
                maxCount = count;
                maxType = type;
            }
        });
        return maxType;
    }, [parcels]);

    // 인천 전체 통계 (동일 매물 유형 기준 비교)
    const incheonStats = useMemo(() => {
        // 동일 매물 유형만 필터링
        const sameTypeParcels = allParcels.filter(p => p.propertyType === dominantPropertyType || !dominantPropertyType);

        const txParcels = sameTypeParcels.filter(p => p.type & 1 && p.transactionPrice && p.transactionPrice > 0);
        const txPrices = txParcels.map(p => p.transactionPrice!);

        // 평당가 계산 (면적 있는 것만)
        const txWithArea = txParcels.filter(p => p.area && p.area > 0);
        const avgPricePerPyeong = txWithArea.length > 0
            ? txWithArea.reduce((sum, p) => sum + (p.transactionPrice! / (p.area! / 3.3058)), 0) / txWithArea.length
            : 0;

        return {
            avgPrice: txPrices.length > 0 ? txPrices.reduce((a, b) => a + b, 0) / txPrices.length : 0,
            avgPricePerPyeong,
            totalCount: sameTypeParcels.length,
            txCount: txPrices.length,
            auctionCount: sameTypeParcels.filter(p => p.type & 4).length,
        };
    }, [allParcels, dominantPropertyType]);

    // 지역 평당가 계산
    const regionPricePerPyeong = useMemo(() => {
        const txWithArea = parcels.filter(p =>
            p.type & 1 && p.transactionPrice && p.transactionPrice > 0 && p.area && p.area > 0
        );
        if (txWithArea.length === 0) return 0;
        return txWithArea.reduce((sum, p) => sum + (p.transactionPrice! / (p.area! / 3.3058)), 0) / txWithArea.length;
    }, [parcels]);

    // 투자 매력도 스코어링 (실제 데이터 기반)
    const investmentScore = useMemo(() => {
        // 1. 가격 경쟁력: 동일 유형 인천 평균 평당가 대비 현재 지역 평당가 비교
        // 인천 평균보다 저렴하면 높은 점수
        let priceCompetitiveness = 50;
        if (incheonStats.avgPricePerPyeong > 0 && regionPricePerPyeong > 0) {
            const priceRatio = regionPricePerPyeong / incheonStats.avgPricePerPyeong;
            // 비율 0.7 → 80점, 1.0 → 50점, 1.3 → 20점
            priceCompetitiveness = Math.round(Math.max(0, Math.min(100, 50 + (1 - priceRatio) * 100)));
        }

        // 2. 유동성: 전체 대비 해당 지역 거래 비중
        let liquidityScore = 50;
        if (incheonStats.txCount > 0 && stats.transaction.count > 0) {
            const txRatio = stats.transaction.count / incheonStats.txCount;
            // 인천 시군구가 약 10개이므로 1/10 = 10%가 평균
            const avgRatio = 0.1;
            liquidityScore = Math.round(Math.max(0, Math.min(100, 50 + (txRatio - avgRatio) * 300)));
        }

        // 3. 시장 안정성: 경매 비율 역산 (경매 적을수록 안정적 = 높은 점수)
        let marketStability = 50;
        const totalDeals = stats.transaction.count + stats.auction.count + stats.listing.count;
        if (totalDeals > 0) {
            const auctionRatio = stats.auction.count / totalDeals;
            // 경매 비율 0% → 80점, 20% → 50점, 40% 이상 → 20점
            marketStability = Math.round(Math.max(0, Math.min(100, 80 - auctionRatio * 150)));
        }

        const total = Math.round((priceCompetitiveness + liquidityScore + marketStability) / 3);
        return { priceCompetitiveness, liquidityScore, marketStability, total };
    }, [incheonStats, regionPricePerPyeong, stats]);

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

            {/* 경매 낙찰가율 */}
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
                    {auctionBidRate < 70 ? '저가 매수 기회' : auctionBidRate < 80 ? '적정 수준' : '시세 근접'}
                </Text>
            </Paper>

            <Divider />

            {/* 투자 매력도 */}
            <Paper p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                    <Title order={5}>투자 매력도 종합</Title>
                    <Badge size="lg" color={investmentScore.total >= 70 ? 'green' : investmentScore.total >= 50 ? 'yellow' : 'red'} variant="light">
                        <Group gap={4}><IconStar size={14} />{investmentScore.total}점</Group>
                    </Badge>
                </Group>
                <SimpleGrid cols={3} spacing="sm">
                    {[
                        { label: '가격 경쟁력', desc: `동일 유형 인천 평균 평당가 대비 (${dominantPropertyType === 'factory' ? '공장' : dominantPropertyType === 'warehouse' ? '창고' : dominantPropertyType === 'land' ? '토지' : '지산'})`, score: investmentScore.priceCompetitiveness, color: 'blue' },
                        { label: '유동성', desc: '인천 전체 대비 거래 비중', score: investmentScore.liquidityScore, color: 'cyan' },
                        { label: '시장 안정성', desc: '경매 비율 낮을수록 안정', score: investmentScore.marketStability, color: 'green' },
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
