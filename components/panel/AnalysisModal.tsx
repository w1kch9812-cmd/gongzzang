'use client';

import { useMemo } from 'react';
import {
    Modal,
    Box,
    Group,
    Stack,
    Text,
    Badge,
    Paper,
    SimpleGrid,
    Progress,
    Divider,
    ThemeIcon,
    RingProgress,
} from '@mantine/core';
import {
    IconBuilding,
    IconBuildingFactory2,
    IconCurrencyWon,
    IconHome,
    IconGavel,
    IconTrendingUp,
    IconTrendingDown,
    IconMinus,
    IconMapPin,
} from '@tabler/icons-react';
import { useAnalysisModal, useAnalysisModalActions } from '@/lib/stores/ui-store';
import { useDataStore } from '@/lib/stores/data-store';
import { useFilteredParcels } from '@/lib/stores/filter-store';

// 통계 카드 컴포넌트
interface StatCardProps {
    title: string;
    value: string | number;
    suffix?: string;
    icon: React.ReactNode;
    color: string;
    change?: number;
    description?: string;
}

function StatCard({ title, value, suffix, icon, color, change, description }: StatCardProps) {
    const TrendIcon = change && change > 0 ? IconTrendingUp : change && change < 0 ? IconTrendingDown : IconMinus;
    const trendColor = change && change > 0 ? 'red' : change && change < 0 ? 'blue' : 'gray';

    return (
        <Paper p="md" radius="md" withBorder>
            <Group justify="space-between" align="flex-start" mb="xs">
                <ThemeIcon size="lg" variant="light" color={color}>
                    {icon}
                </ThemeIcon>
                {change !== undefined && (
                    <Badge size="sm" variant="light" color={trendColor} leftSection={<TrendIcon size={10} />}>
                        {Math.abs(change)}%
                    </Badge>
                )}
            </Group>
            <Text size="xl" fw={700}>
                {typeof value === 'number' ? value.toLocaleString() : value}
                {suffix && <Text span size="sm" c="dimmed" ml={4}>{suffix}</Text>}
            </Text>
            <Text size="sm" c="dimmed" mt={2}>{title}</Text>
            {description && <Text size="xs" c="dimmed" mt={4}>{description}</Text>}
        </Paper>
    );
}

// 차트 항목 컴포넌트
interface BarItemProps {
    label: string;
    value: number;
    max: number;
    color: string;
}

function BarItem({ label, value, max, color }: BarItemProps) {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
        <Box>
            <Group justify="space-between" mb={4}>
                <Text size="sm">{label}</Text>
                <Text size="sm" fw={600}>{value.toLocaleString()}</Text>
            </Group>
            <Progress value={percentage} color={color} size="sm" radius="xl" />
        </Box>
    );
}

export default function AnalysisModal() {
    const { open, target } = useAnalysisModal();
    const { setOpen } = useAnalysisModalActions();

    // FilterStore - 필터된 데이터
    const parcels = useFilteredParcels();

    // DataStore - 데이터
    const factories = useDataStore((state) => state.factories);
    const knowledgeCenters = useDataStore((state) => state.knowledgeCenters);
    const industrialComplexes = useDataStore((state) => state.industrialComplexes);

    // 해당 지역 데이터 필터링 및 통계 계산
    const stats = useMemo(() => {
        if (!target) return null;

        // 지역 코드로 필터링
        const regionParcels = parcels.filter((p) => {
            if (target.level === 'sig') {
                return p.sigCode === target.code;
            } else {
                return p.emdCode === target.code;
            }
        });

        const regionFactories = factories.filter((f) => {
            const factoryCode = target.level === 'sig'
                ? f.id?.substring(0, 5)
                : f.id?.substring(0, 10);
            return factoryCode === target.code;
        });

        const regionKnowledgeCenters = knowledgeCenters.filter((k) => {
            // 좌표 기반 필터링 또는 PNU 기반
            return true; // 일단 전체 (실제로는 좌표 기반 필터 필요)
        });

        const regionComplexes = industrialComplexes.filter((c) => {
            // 실제로는 좌표나 지역 코드로 필터링 필요
            return true;
        });

        // 거래 유형별 분류
        const transactionCount = regionParcels.filter((p) => p.type & 1).length;
        const listingCount = regionParcels.filter((p) => p.type & 2).length;
        const auctionCount = regionParcels.filter((p) => p.type & 4).length;

        // 가격 통계
        const prices = regionParcels
            .map((p) => p.transactionPrice || p.listingPrice || 0)
            .filter((p) => p > 0);
        const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

        // 면적 통계
        const areas = regionParcels.map((p) => p.area || 0).filter((a) => a > 0);
        const avgArea = areas.length > 0 ? areas.reduce((a, b) => a + b, 0) / areas.length : 0;
        const totalArea = areas.reduce((a, b) => a + b, 0);

        // 평당가 계산
        const pricePerPyeong = avgArea > 0 ? avgPrice / (avgArea / 3.3058) : 0;

        return {
            totalParcels: regionParcels.length,
            transactionCount,
            listingCount,
            auctionCount,
            factoryCount: regionFactories.length,
            knowledgeCenterCount: regionKnowledgeCenters.length,
            complexCount: regionComplexes.length,
            avgPrice: Math.round(avgPrice / 10000), // 억원
            maxPrice: Math.round(maxPrice / 10000),
            minPrice: Math.round(minPrice / 10000),
            avgArea: Math.round(avgArea),
            totalArea: Math.round(totalArea),
            pricePerPyeong: Math.round(pricePerPyeong),
        };
    }, [target, parcels, factories, knowledgeCenters, industrialComplexes]);

    if (!target || !stats) return null;

    // 거래 유형 분포
    const maxTypeCount = Math.max(stats.transactionCount, stats.listingCount, stats.auctionCount);

    // 거래 유형 비율
    const totalType = stats.transactionCount + stats.listingCount + stats.auctionCount;
    const transactionPercent = totalType > 0 ? Math.round((stats.transactionCount / totalType) * 100) : 0;
    const listingPercent = totalType > 0 ? Math.round((stats.listingCount / totalType) * 100) : 0;
    const auctionPercent = totalType > 0 ? Math.round((stats.auctionCount / totalType) * 100) : 0;

    return (
        <Modal
            opened={open}
            onClose={() => setOpen(false)}
            size="lg"
            title={
                <Group gap="sm">
                    <ThemeIcon size="md" variant="light" color="blue">
                        <IconMapPin size={16} />
                    </ThemeIcon>
                    <Box>
                        <Text size="lg" fw={700}>{target.name} 지역 분석</Text>
                        <Text size="xs" c="dimmed">{target.level === 'sig' ? '시군구' : '읍면동'} 단위</Text>
                    </Box>
                </Group>
            }
            centered
            zIndex={10001}
        >
            <Stack gap="lg">
                {/* 주요 지표 */}
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                    <StatCard
                        title="총 매물"
                        value={stats.totalParcels}
                        suffix="건"
                        icon={<IconHome size={18} />}
                        color="blue"
                    />
                    <StatCard
                        title="평균 가격"
                        value={stats.avgPrice}
                        suffix="억"
                        icon={<IconCurrencyWon size={18} />}
                        color="green"
                        change={5}
                        description="전월 대비"
                    />
                    <StatCard
                        title="평당 시세"
                        value={stats.pricePerPyeong}
                        suffix="만원"
                        icon={<IconTrendingUp size={18} />}
                        color="orange"
                    />
                    <StatCard
                        title="평균 면적"
                        value={stats.avgArea}
                        suffix="m²"
                        icon={<IconBuilding size={18} />}
                        color="violet"
                    />
                </SimpleGrid>

                <Divider />

                {/* 거래 유형 분포 */}
                <Box>
                    <Text size="sm" fw={600} mb="md">거래 유형 분포</Text>
                    <Group align="center" gap="xl">
                        <RingProgress
                            size={120}
                            thickness={16}
                            sections={[
                                { value: transactionPercent, color: 'green' },
                                { value: listingPercent, color: 'blue' },
                                { value: auctionPercent, color: 'red' },
                            ]}
                            label={
                                <Text ta="center" size="xs" fw={600}>
                                    {totalType}건
                                </Text>
                            }
                        />
                        <Stack gap="xs" style={{ flex: 1 }}>
                            <BarItem label="실거래" value={stats.transactionCount} max={maxTypeCount} color="green" />
                            <BarItem label="매물" value={stats.listingCount} max={maxTypeCount} color="blue" />
                            <BarItem label="경매" value={stats.auctionCount} max={maxTypeCount} color="red" />
                        </Stack>
                    </Group>
                </Box>

                <Divider />

                {/* 시설 현황 */}
                <Box>
                    <Text size="sm" fw={600} mb="md">시설 현황</Text>
                    <SimpleGrid cols={3} spacing="md">
                        <Paper p="md" radius="md" withBorder ta="center">
                            <ThemeIcon size="xl" variant="light" color="teal" mb="xs">
                                <IconBuildingFactory2 size={24} />
                            </ThemeIcon>
                            <Text size="lg" fw={700}>{stats.factoryCount.toLocaleString()}</Text>
                            <Text size="xs" c="dimmed">공장</Text>
                        </Paper>
                        <Paper p="md" radius="md" withBorder ta="center">
                            <ThemeIcon size="xl" variant="light" color="violet" mb="xs">
                                <IconBuilding size={24} />
                            </ThemeIcon>
                            <Text size="lg" fw={700}>{stats.knowledgeCenterCount.toLocaleString()}</Text>
                            <Text size="xs" c="dimmed">지식산업센터</Text>
                        </Paper>
                        <Paper p="md" radius="md" withBorder ta="center">
                            <ThemeIcon size="xl" variant="light" color="orange" mb="xs">
                                <IconMapPin size={24} />
                            </ThemeIcon>
                            <Text size="lg" fw={700}>{stats.complexCount.toLocaleString()}</Text>
                            <Text size="xs" c="dimmed">산업단지</Text>
                        </Paper>
                    </SimpleGrid>
                </Box>

                <Divider />

                {/* 가격 범위 */}
                <Box>
                    <Text size="sm" fw={600} mb="md">가격 범위</Text>
                    <Paper p="md" radius="md" withBorder>
                        <Group justify="space-between">
                            <Box ta="center">
                                <Text size="xs" c="dimmed">최저가</Text>
                                <Text size="lg" fw={600} c="blue">{stats.minPrice.toLocaleString()}억</Text>
                            </Box>
                            <Box ta="center">
                                <Text size="xs" c="dimmed">평균가</Text>
                                <Text size="xl" fw={700}>{stats.avgPrice.toLocaleString()}억</Text>
                            </Box>
                            <Box ta="center">
                                <Text size="xs" c="dimmed">최고가</Text>
                                <Text size="lg" fw={600} c="red">{stats.maxPrice.toLocaleString()}억</Text>
                            </Box>
                        </Group>
                        <Progress.Root size="lg" mt="md">
                            <Progress.Section value={stats.minPrice > 0 ? (stats.minPrice / stats.maxPrice) * 100 : 0} color="blue" />
                            <Progress.Section value={stats.avgPrice > 0 ? ((stats.avgPrice - stats.minPrice) / stats.maxPrice) * 100 : 0} color="gray" />
                            <Progress.Section value={stats.maxPrice > 0 ? ((stats.maxPrice - stats.avgPrice) / stats.maxPrice) * 100 : 0} color="red" />
                        </Progress.Root>
                    </Paper>
                </Box>

                {/* 안내 메시지 */}
                <Text size="xs" c="dimmed" ta="center">
                    * 현재 표시된 데이터는 필터가 적용된 상태입니다. 정확한 통계는 실제 데이터 연동 후 제공됩니다.
                </Text>
            </Stack>
        </Modal>
    );
}
