// components/analysis/IndustryAnalysis.tsx - 산업 생태계 및 운영 환경 분석
// 핵심 질문: "내 공장이 들어가기 적합한 곳인가? 어떤 공장들이 모여 있는가?"

'use client';

import { useMemo, memo } from 'react';
import { Paper, Title, Text, Group, Stack, ThemeIcon, SimpleGrid, Badge, Box, Divider, Progress, ScrollArea, Tooltip, RingProgress } from '@mantine/core';
import { IconBuildingFactory, IconCategory, IconRuler2, IconActivity, IconCalendar, IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { useDataStore } from '@/lib/stores/data-store';

interface IndustryAnalysisProps {
    regionCode: string;
    regionLevel: 'sig' | 'emd';
}

const COLORS = ['#228be6', '#40c057', '#fab005', '#fa5252', '#be4bdb', '#fd7e14', '#15aabf', '#82c91e', '#e64980', '#7950f2'];

// 면적 구간 정의
const AREA_RANGES = [
    { label: '~100평', min: 0, max: 330, color: '#74c0fc' },
    { label: '100~300평', min: 330, max: 990, color: '#228be6' },
    { label: '300~500평', min: 990, max: 1650, color: '#1971c2' },
    { label: '500~1000평', min: 1650, max: 3300, color: '#1864ab' },
    { label: '1000평~', min: 3300, max: Infinity, color: '#0b3d91' },
];

export const IndustryAnalysis = memo(function IndustryAnalysis({ regionCode, regionLevel }: IndustryAnalysisProps) {
    const allFactories = useDataStore((state) => state.factories);
    const industrialComplexes = useDataStore((state) => state.industrialComplexes);

    const factories = useMemo(() => {
        return allFactories.filter((f) => {
            const code = regionLevel === 'sig' ? f.id?.substring(0, 5) : f.id?.substring(0, 10);
            return code === regionCode;
        });
    }, [allFactories, regionCode, regionLevel]);

    // 업종별 분포
    const industryDistribution = useMemo(() => {
        const counts = new Map<string, number>();
        factories.forEach(f => {
            const industry = f.businessType || '기타';
            counts.set(industry, (counts.get(industry) || 0) + 1);
        });
        return Array.from(counts.entries())
            .map(([industry, count]) => ({ industry, count, percentage: factories.length > 0 ? (count / factories.length) * 100 : 0 }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [factories]);

    // 면적 구성비 (더미 - 실제 면적 데이터 있으면 사용)
    const areaDistribution = useMemo(() => {
        // 더미 분포
        const totalFactories = factories.length || 100;
        return AREA_RANGES.map((range, i) => {
            const ratios = [0.15, 0.35, 0.25, 0.15, 0.1]; // 각 구간별 비율
            const count = Math.round(totalFactories * ratios[i]);
            return {
                ...range,
                count,
                percentage: (count / totalFactories) * 100,
            };
        });
    }, [factories.length]);

    // 주요 입주 기업
    const topFactories = useMemo(() => {
        return factories.filter(f => f.name).slice(0, 10).map(f => ({ name: f.name, businessType: f.businessType || '미분류' }));
    }, [factories]);

    // 산업 집적도
    const industryConcentration = useMemo(() => {
        const score = Math.round(50 + Math.random() * 30);
        return { score, level: score >= 75 ? '높음' : score >= 50 ? '보통' : '낮음', color: score >= 75 ? 'green' : score >= 50 ? 'yellow' : 'red' };
    }, []);

    // 가동률 & 노후도 (더미)
    const operationStats = useMemo(() => {
        return {
            operationRate: Math.round(70 + Math.random() * 25), // 가동률 70-95%
            avgAge: Math.round(10 + Math.random() * 20), // 평균 건물 연령
            newRatio: Math.round(10 + Math.random() * 20), // 신축(5년 이내) 비율
            oldRatio: Math.round(15 + Math.random() * 25), // 노후(20년 이상) 비율
        };
    }, []);

    // 산업단지 현황
    const complexStats = useMemo(() => {
        return {
            total: industrialComplexes.length,
            national: industrialComplexes.filter(c => c.type === 'national').length,
            general: industrialComplexes.filter(c => c.type !== 'national').length,
        };
    }, [industrialComplexes]);

    // 커스텀 라벨
    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        if (percent < 0.05) return null;
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        return <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent * 100).toFixed(0)}%`}</text>;
    };

    return (
        <Stack gap="md">
            <Title order={3}>산업 분석</Title>

            {/* 기본 통계 */}
            <SimpleGrid cols={2}>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="blue" radius="md"><IconBuildingFactory size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">공장 수</Text>
                    </Group>
                    <Text size="xl" fw={700}>{factories.length.toLocaleString()}개</Text>
                </Paper>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="green" radius="md"><IconCategory size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">업종 수</Text>
                    </Group>
                    <Text size="xl" fw={700}>{industryDistribution.length}개</Text>
                </Paper>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="orange" radius="md"><IconActivity size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">가동률</Text>
                    </Group>
                    <Group gap={4} align="baseline">
                        <Text size="xl" fw={700}>{operationStats.operationRate}%</Text>
                        <Badge size="sm" color={operationStats.operationRate >= 85 ? 'green' : operationStats.operationRate >= 70 ? 'yellow' : 'red'} variant="light">
                            {operationStats.operationRate >= 85 ? '양호' : operationStats.operationRate >= 70 ? '보통' : '저조'}
                        </Badge>
                    </Group>
                </Paper>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="violet" radius="md"><IconCalendar size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">평균 건물 연령</Text>
                    </Group>
                    <Text size="xl" fw={700}>{operationStats.avgAge}년</Text>
                </Paper>
            </SimpleGrid>

            {/* 산업 집적도 & 노후도 */}
            <Paper p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                    <Title order={5}>산업 집적도 & 건물 현황</Title>
                    <Badge size="lg" color={industryConcentration.color} variant="light">{industryConcentration.level}</Badge>
                </Group>
                <SimpleGrid cols={2} spacing="md">
                    <Tooltip label="지역 내 동종업계 밀집도">
                        <Box>
                            <Group justify="space-between" mb={4}>
                                <Text size="xs" c="dimmed">집적도 점수</Text>
                                <Text size="xs" fw={600}>{industryConcentration.score}점</Text>
                            </Group>
                            <Progress value={industryConcentration.score} color={industryConcentration.color} size="lg" radius="xl" />
                        </Box>
                    </Tooltip>
                    <Tooltip label="5년 이내 신축 비율">
                        <Box>
                            <Group justify="space-between" mb={4}>
                                <Text size="xs" c="dimmed">신축 비율</Text>
                                <Text size="xs" fw={600} c="green">{operationStats.newRatio}%</Text>
                            </Group>
                            <Progress value={operationStats.newRatio} color="green" size="lg" radius="xl" />
                        </Box>
                    </Tooltip>
                    <Tooltip label="가동 중인 공장 비율">
                        <Box>
                            <Group justify="space-between" mb={4}>
                                <Text size="xs" c="dimmed">가동률</Text>
                                <Text size="xs" fw={600}>{operationStats.operationRate}%</Text>
                            </Group>
                            <Progress value={operationStats.operationRate} color="blue" size="lg" radius="xl" />
                        </Box>
                    </Tooltip>
                    <Tooltip label="20년 이상 노후 건물 비율 (재개발 수요 예측)">
                        <Box>
                            <Group justify="space-between" mb={4}>
                                <Text size="xs" c="dimmed">노후 비율</Text>
                                <Text size="xs" fw={600} c="orange">{operationStats.oldRatio}%</Text>
                            </Group>
                            <Progress value={operationStats.oldRatio} color="orange" size="lg" radius="xl" />
                        </Box>
                    </Tooltip>
                </SimpleGrid>
            </Paper>

            <Divider />

            {/* 공장 면적 구성비 */}
            <Paper p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                    <Title order={5}>공장 면적 구성비</Title>
                    <Text size="xs" c="dimmed">규모 적합성 확인</Text>
                </Group>
                <Group align="center" gap="xl">
                    <RingProgress
                        size={160}
                        thickness={24}
                        roundCaps
                        sections={areaDistribution.map(d => ({ value: d.percentage, color: d.color, tooltip: `${d.label}: ${d.count}개` }))}
                        label={
                            <Box ta="center">
                                <Text size="lg" fw={700}>{factories.length}</Text>
                                <Text size="xs" c="dimmed">전체</Text>
                            </Box>
                        }
                    />
                    <Stack gap="xs" style={{ flex: 1 }}>
                        {areaDistribution.map((d) => (
                            <Group key={d.label} justify="space-between">
                                <Group gap={8}>
                                    <Box w={12} h={12} style={{ backgroundColor: d.color, borderRadius: 3 }} />
                                    <Text size="sm">{d.label}</Text>
                                </Group>
                                <Group gap={8}>
                                    <Text size="sm" fw={600}>{d.count}개</Text>
                                    <Text size="xs" c="dimmed">({d.percentage.toFixed(0)}%)</Text>
                                </Group>
                            </Group>
                        ))}
                    </Stack>
                </Group>
                <Text size="xs" c="dimmed" ta="center" mt="md">
                    {areaDistribution[1].percentage > 30 ? '💡 중소형 공장 위주 (100-300평)' :
                     areaDistribution[3].percentage > 25 ? '💡 대형 공장 위주 (500평 이상)' :
                     '💡 다양한 규모 혼재'}
                </Text>
            </Paper>

            {/* 업종별 분포 */}
            {industryDistribution.length > 0 && (
                <Paper p="lg" radius="md" withBorder>
                    <Title order={5} mb="md">업종별 분포</Title>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={industryDistribution} dataKey="count" nameKey="industry" cx="50%" cy="50%" outerRadius={100} label={renderCustomLabel} labelLine={false}>
                                {industryDistribution.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 12 }} formatter={(v: number | string | undefined, n, props) => [`${v ?? 0}개 (${(props.payload as any)?.percentage?.toFixed(1) || 0}%)`, String(n)]} />
                            <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <Text size="xs" c="dimmed" ta="center" mt="sm">
                        주력 산업: <Text span fw={600} c="blue">{industryDistribution[0]?.industry || '-'}</Text>
                        ({industryDistribution[0]?.percentage.toFixed(1)}%)
                    </Text>
                </Paper>
            )}

            {/* 업종별 개수 막대 차트 */}
            {industryDistribution.length > 0 && (
                <Paper p="lg" radius="md" withBorder>
                    <Title order={5} mb="md">업종별 공장 수</Title>
                    <ResponsiveContainer width="100%" height={Math.max(200, industryDistribution.length * 35)}>
                        <BarChart data={industryDistribution} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                            <XAxis type="number" stroke="#868e96" style={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="industry" stroke="#868e96" style={{ fontSize: 11 }} width={120} />
                            <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 12 }} formatter={(v: number | string | undefined, _, props) => [`${v ?? 0}개 (${(props.payload as any)?.percentage?.toFixed(1) || 0}%)`, '공장 수']} />
                            <Bar dataKey="count" fill="#228be6" name="공장 수" />
                        </BarChart>
                    </ResponsiveContainer>
                </Paper>
            )}

            {/* 산업단지 현황 */}
            {complexStats.total > 0 && (
                <Paper p="lg" radius="md" withBorder>
                    <Group justify="space-between" mb="md">
                        <Title order={5}>산업단지 현황</Title>
                        <Badge color="orange" variant="light">{complexStats.total}개 단지</Badge>
                    </Group>
                    <SimpleGrid cols={2} mb="md">
                        <Paper p="sm" radius="sm" bg="blue.0">
                            <Text size="xs" c="dimmed">국가산단</Text>
                            <Text size="lg" fw={700} c="blue">{complexStats.national}개</Text>
                        </Paper>
                        <Paper p="sm" radius="sm" bg="gray.0">
                            <Text size="xs" c="dimmed">일반산단</Text>
                            <Text size="lg" fw={700}>{complexStats.general}개</Text>
                        </Paper>
                    </SimpleGrid>
                    <ScrollArea.Autosize mah={200}>
                        <Stack gap="xs">
                            {industrialComplexes.slice(0, 5).map((complex) => (
                                <Paper key={complex.id} p="sm" radius="sm" withBorder>
                                    <Group justify="space-between">
                                        <Text size="sm" fw={500}>{complex.name}</Text>
                                        <Badge size="xs" variant="light" color={complex.type === 'national' ? 'blue' : 'gray'}>
                                            {complex.type === 'national' ? '국가' : '일반'}
                                        </Badge>
                                    </Group>
                                </Paper>
                            ))}
                        </Stack>
                    </ScrollArea.Autosize>
                </Paper>
            )}

            {/* 주요 입주 기업 */}
            {topFactories.length > 0 && (
                <Paper p="lg" radius="md" withBorder>
                    <Title order={5} mb="md">주요 입주 기업</Title>
                    <ScrollArea.Autosize mah={250}>
                        <Stack gap="xs">
                            {topFactories.map((factory, index) => (
                                <Paper key={index} p="sm" radius="sm" withBorder>
                                    <Group justify="space-between">
                                        <Group gap="sm">
                                            <ThemeIcon size="sm" variant="light" color="teal" radius="sm"><IconBuildingFactory size={12} /></ThemeIcon>
                                            <Text size="sm" fw={500} lineClamp={1}>{factory.name}</Text>
                                        </Group>
                                        <Badge size="xs" variant="light" color="gray">{factory.businessType}</Badge>
                                    </Group>
                                </Paper>
                            ))}
                        </Stack>
                    </ScrollArea.Autosize>
                </Paper>
            )}

            <Paper p="sm" radius="md" bg="gray.0">
                <Text size="xs" c="dimmed" ta="center" fw={500}>* 가동률, 노후도, 면적 구성 등은 시뮬레이션 데이터입니다</Text>
            </Paper>
        </Stack>
    );
});
