// components/analysis/InfraAnalysis.tsx - 배후 인프라 및 기반 정보
// 핵심 질문: "직원 구하기 쉬운가? 공장 돌리는 비용(유틸리티)은 어떤가?"

'use client';

import { useMemo, memo } from 'react';
import { Paper, Title, Text, Group, Stack, ThemeIcon, SimpleGrid, Badge, Box, Divider, Progress, ScrollArea, Tooltip, Table } from '@mantine/core';
import { IconBuildingFactory2, IconBuilding, IconMapPin, IconRoad, IconCar, IconTrain, IconBus, IconParking, IconSchool, IconBuildingBank, IconShoppingBag, IconUsers, IconBolt, IconFlame, IconTrendingUp, IconTrendingDown, IconCurrencyWon } from '@tabler/icons-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ComposedChart, Line } from 'recharts';
import { useDataStore } from '@/lib/stores/data-store';

interface InfraAnalysisProps {
    regionCode: string;
    regionLevel: 'sig' | 'emd';
}

// 더미 데이터 생성
function generatePopulationTrend() {
    const years = ['2019', '2020', '2021', '2022', '2023', '2024'];
    let pop = 150000 + Math.random() * 100000;
    return years.map((year) => {
        pop = pop * (0.98 + Math.random() * 0.04);
        return {
            year,
            인구수: Math.round(pop),
            경제활동인구: Math.round(pop * (0.55 + Math.random() * 0.1)),
        };
    });
}

function generateUtilityCost() {
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    return months.map((month, i) => {
        // 여름/겨울에 전기 사용량 증가
        const seasonFactor = (i >= 5 && i <= 8) || (i === 0 || i === 11) ? 1.2 : 1;
        return {
            month,
            전기: Math.round((80 + Math.random() * 40) * seasonFactor),
            가스: Math.round((i >= 10 || i <= 2 ? 60 : 20) + Math.random() * 30), // 겨울에 가스 사용량 증가
        };
    });
}

export const InfraAnalysis = memo(function InfraAnalysis({ regionCode, regionLevel }: InfraAnalysisProps) {
    const allFactories = useDataStore((state) => state.factories);
    const knowledgeCenters = useDataStore((state) => state.knowledgeCenters);
    const industrialComplexes = useDataStore((state) => state.industrialComplexes);

    const factories = useMemo(() => {
        return allFactories.filter((f) => {
            const code = regionLevel === 'sig' ? f.id?.substring(0, 5) : f.id?.substring(0, 10);
            return code === regionCode;
        });
    }, [allFactories, regionCode, regionLevel]);

    // 교통 접근성 (더미)
    const transportAccess = useMemo(() => ({
        highway: { name: '고속도로 IC', distance: `${(Math.random() * 5 + 1).toFixed(1)}km`, score: Math.round(60 + Math.random() * 30) },
        station: { name: '기차역', distance: `${(Math.random() * 8 + 2).toFixed(1)}km`, score: Math.round(50 + Math.random() * 35) },
        bus: { name: '버스정류장', distance: `${(Math.random() * 1 + 0.2).toFixed(1)}km`, score: Math.round(70 + Math.random() * 25) },
        parking: { name: '화물터미널', distance: `${(Math.random() * 10 + 3).toFixed(1)}km`, score: Math.round(55 + Math.random() * 35) },
    }), []);

    // 주변 시설 (더미)
    const nearbyFacilities = useMemo(() => ({
        banks: Math.floor(Math.random() * 5) + 1,
        restaurants: Math.floor(Math.random() * 30) + 10,
        convenience: Math.floor(Math.random() * 10) + 3,
        hospitals: Math.floor(Math.random() * 3) + 1,
    }), []);

    // 전체 교통 점수
    const overallTransportScore = useMemo(() => {
        const scores = Object.values(transportAccess).map(t => t.score);
        return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }, [transportAccess]);

    // 인구 추이 (더미)
    const populationTrend = useMemo(() => generatePopulationTrend(), []);
    const utilityCost = useMemo(() => generateUtilityCost(), []);

    // 인구 변동률
    const populationChange = useMemo(() => {
        const first = populationTrend[0].인구수;
        const last = populationTrend[populationTrend.length - 1].인구수;
        return ((last - first) / first * 100).toFixed(1);
    }, [populationTrend]);

    // 유틸리티 비용 (더미)
    const utilityCostSummary = useMemo(() => ({
        electricityRate: Math.round(100 + Math.random() * 30), // 원/kWh
        gasRate: Math.round(15 + Math.random() * 10), // 원/MJ
        avgElectricity: Math.round(500 + Math.random() * 300), // 만원/월 (평균 공장 기준)
        avgGas: Math.round(100 + Math.random() * 150), // 만원/월
        waterRate: Math.round(800 + Math.random() * 400), // 원/톤
    }), []);

    // 인력 수급 지표 (더미)
    const laborStats = useMemo(() => ({
        economicPopulation: populationTrend[populationTrend.length - 1].경제활동인구,
        unemploymentRate: (2 + Math.random() * 3).toFixed(1),
        avgWage: Math.round(280 + Math.random() * 80), // 만원
        technicianRatio: Math.round(15 + Math.random() * 20), // 기술직 비율 %
    }), [populationTrend]);

    return (
        <Stack gap="md">
            <Title order={3}>인프라 분석</Title>

            {/* 기본 통계 */}
            <SimpleGrid cols={2}>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="orange" radius="md"><IconMapPin size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">산업단지</Text>
                    </Group>
                    <Text size="xl" fw={700}>{industrialComplexes.length}개</Text>
                </Paper>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="violet" radius="md"><IconBuilding size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">지식산업센터</Text>
                    </Group>
                    <Text size="xl" fw={700}>{knowledgeCenters.length}개</Text>
                </Paper>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="teal" radius="md"><IconBuildingFactory2 size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">공장</Text>
                    </Group>
                    <Text size="xl" fw={700}>{factories.length.toLocaleString()}개</Text>
                </Paper>
                <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb={8}>
                        <ThemeIcon size="md" variant="light" color="blue" radius="md"><IconRoad size={18} /></ThemeIcon>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">교통 접근성</Text>
                    </Group>
                    <Group gap={4} align="baseline">
                        <Text size="xl" fw={700}>{overallTransportScore}점</Text>
                        <Badge size="sm" color={overallTransportScore >= 70 ? 'green' : overallTransportScore >= 50 ? 'yellow' : 'red'} variant="light">
                            {overallTransportScore >= 70 ? '양호' : overallTransportScore >= 50 ? '보통' : '미흡'}
                        </Badge>
                    </Group>
                </Paper>
            </SimpleGrid>

            <Divider />

            {/* 인구수 추이 */}
            <Paper p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                    <Group gap="sm">
                        <ThemeIcon size="md" variant="light" color="indigo" radius="md"><IconUsers size={18} /></ThemeIcon>
                        <Title order={5}>인구수 추이</Title>
                    </Group>
                    <Badge
                        size="lg"
                        color={Number(populationChange) >= 0 ? 'green' : 'red'}
                        variant="light"
                        leftSection={Number(populationChange) >= 0 ? <IconTrendingUp size={14} /> : <IconTrendingDown size={14} />}
                    >
                        {Number(populationChange) >= 0 ? '+' : ''}{populationChange}%
                    </Badge>
                </Group>
                <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={populationTrend}>
                        <defs>
                            <linearGradient id="colorPop" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4c6ef5" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#4c6ef5" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                        <XAxis dataKey="year" stroke="#868e96" style={{ fontSize: 11 }} />
                        <YAxis stroke="#868e96" style={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 12 }} formatter={(v: number | undefined) => [`${(v ?? 0).toLocaleString()}명`, '']} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="인구수" stroke="#4c6ef5" strokeWidth={2} fill="url(#colorPop)" />
                        <Line type="monotone" dataKey="경제활동인구" stroke="#40c057" strokeWidth={2} dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
                <Text size="xs" c="dimmed" ta="center" mt="sm">
                    {Number(populationChange) < -3 ? '⚠️ 인구 감소 지역 - 인력 수급 어려움 예상' :
                     Number(populationChange) > 3 ? '✅ 인구 증가 지역 - 인력 수급 양호' :
                     '인구 변동 안정적'}
                </Text>
            </Paper>

            {/* 인력 수급 지표 */}
            <Paper p="lg" radius="md" withBorder>
                <Title order={5} mb="md">인력 수급 현황</Title>
                <SimpleGrid cols={2} spacing="md">
                    <Tooltip label="15세 이상 취업 가능 인구">
                        <Box>
                            <Group justify="space-between" mb={4}>
                                <Text size="xs" c="dimmed">경제활동인구</Text>
                                <Text size="xs" fw={600}>{laborStats.economicPopulation.toLocaleString()}명</Text>
                            </Group>
                            <Progress value={70} color="blue" size="sm" radius="xl" />
                        </Box>
                    </Tooltip>
                    <Tooltip label="낮을수록 구인 어려움">
                        <Box>
                            <Group justify="space-between" mb={4}>
                                <Text size="xs" c="dimmed">실업률</Text>
                                <Text size="xs" fw={600} c={Number(laborStats.unemploymentRate) < 3 ? 'red' : 'green'}>{laborStats.unemploymentRate}%</Text>
                            </Group>
                            <Progress value={Number(laborStats.unemploymentRate) * 10} color={Number(laborStats.unemploymentRate) < 3 ? 'red' : 'green'} size="sm" radius="xl" />
                        </Box>
                    </Tooltip>
                    <Tooltip label="지역 평균 임금 수준">
                        <Box>
                            <Group justify="space-between" mb={4}>
                                <Text size="xs" c="dimmed">평균 임금</Text>
                                <Text size="xs" fw={600}>{laborStats.avgWage}만원</Text>
                            </Group>
                            <Progress value={(laborStats.avgWage / 400) * 100} color="cyan" size="sm" radius="xl" />
                        </Box>
                    </Tooltip>
                    <Tooltip label="기술직/전문직 인력 비율">
                        <Box>
                            <Group justify="space-between" mb={4}>
                                <Text size="xs" c="dimmed">기술직 비율</Text>
                                <Text size="xs" fw={600}>{laborStats.technicianRatio}%</Text>
                            </Group>
                            <Progress value={laborStats.technicianRatio} color="violet" size="sm" radius="xl" />
                        </Box>
                    </Tooltip>
                </SimpleGrid>
            </Paper>

            <Divider />

            {/* 유틸리티 비용 */}
            <Paper p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                    <Title order={5}>유틸리티 비용</Title>
                    <Text size="xs" c="dimmed">전기/가스 월별 사용량 추이</Text>
                </Group>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={utilityCost}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                        <XAxis dataKey="month" stroke="#868e96" style={{ fontSize: 11 }} />
                        <YAxis stroke="#868e96" style={{ fontSize: 11 }} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="전기" fill="#fab005" name="전기 (kWh x100)" />
                        <Bar dataKey="가스" fill="#fa5252" name="가스 (MJ x100)" />
                    </BarChart>
                </ResponsiveContainer>
            </Paper>

            {/* 유틸리티 단가표 */}
            <Paper p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                    <Group gap="sm">
                        <ThemeIcon size="md" variant="light" color="yellow" radius="md"><IconCurrencyWon size={18} /></ThemeIcon>
                        <Title order={5}>유틸리티 단가</Title>
                    </Group>
                    <Badge size="sm" variant="light" color="gray">산업용 기준</Badge>
                </Group>
                <SimpleGrid cols={3} spacing="md">
                    <Paper p="sm" radius="sm" bg="yellow.0" withBorder style={{ borderColor: '#fab005' }}>
                        <Group gap={6} mb={4}>
                            <IconBolt size={16} color="#fab005" />
                            <Text size="xs" c="dimmed">전기 단가</Text>
                        </Group>
                        <Text size="lg" fw={700} c="yellow.8">{utilityCostSummary.electricityRate}원/kWh</Text>
                        <Text size="xs" c="dimmed">월평균 {utilityCostSummary.avgElectricity}만원</Text>
                    </Paper>
                    <Paper p="sm" radius="sm" bg="red.0" withBorder style={{ borderColor: '#fa5252' }}>
                        <Group gap={6} mb={4}>
                            <IconFlame size={16} color="#fa5252" />
                            <Text size="xs" c="dimmed">가스 단가</Text>
                        </Group>
                        <Text size="lg" fw={700} c="red.7">{utilityCostSummary.gasRate}원/MJ</Text>
                        <Text size="xs" c="dimmed">월평균 {utilityCostSummary.avgGas}만원</Text>
                    </Paper>
                    <Paper p="sm" radius="sm" bg="blue.0" withBorder style={{ borderColor: '#228be6' }}>
                        <Group gap={6} mb={4}>
                            <IconBuildingFactory2 size={16} color="#228be6" />
                            <Text size="xs" c="dimmed">용수 단가</Text>
                        </Group>
                        <Text size="lg" fw={700} c="blue.7">{utilityCostSummary.waterRate}원/톤</Text>
                        <Text size="xs" c="dimmed">상수도 기준</Text>
                    </Paper>
                </SimpleGrid>
            </Paper>

            <Divider />

            {/* 교통 접근성 */}
            <Paper p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                    <Title order={5}>교통 접근성</Title>
                    <Badge size="lg" color={overallTransportScore >= 70 ? 'green' : overallTransportScore >= 50 ? 'yellow' : 'red'} variant="light">{overallTransportScore}점</Badge>
                </Group>
                <Stack gap="sm">
                    {[
                        { icon: <IconCar size={14} color="#868e96" />, ...transportAccess.highway, color: 'blue' },
                        { icon: <IconTrain size={14} color="#868e96" />, ...transportAccess.station, color: 'cyan' },
                        { icon: <IconBus size={14} color="#868e96" />, ...transportAccess.bus, color: 'green' },
                        { icon: <IconParking size={14} color="#868e96" />, ...transportAccess.parking, color: 'orange' },
                    ].map((item) => (
                        <Box key={item.name}>
                            <Group justify="space-between" mb={4}>
                                <Group gap={6}>{item.icon}<Text size="sm">{item.name}</Text></Group>
                                <Text size="sm" c="dimmed">{item.distance}</Text>
                            </Group>
                            <Progress value={item.score} color={item.color} size="sm" radius="xl" />
                        </Box>
                    ))}
                </Stack>
            </Paper>

            {/* 주변 시설 */}
            <Paper p="lg" radius="md" withBorder>
                <Title order={5} mb="md">주변 편의시설</Title>
                <SimpleGrid cols={2} spacing="sm">
                    {[
                        { icon: <IconBuildingBank size={14} />, label: '금융기관', value: `${nearbyFacilities.banks}개`, color: 'blue' },
                        { icon: <IconShoppingBag size={14} />, label: '음식점', value: `${nearbyFacilities.restaurants}개`, color: 'orange' },
                        { icon: <IconShoppingBag size={14} />, label: '편의점', value: `${nearbyFacilities.convenience}개`, color: 'green' },
                        { icon: <IconSchool size={14} />, label: '병원/의원', value: `${nearbyFacilities.hospitals}개`, color: 'red' },
                    ].map(({ icon, label, value, color }) => (
                        <Paper key={label} p="sm" radius="sm" withBorder>
                            <Group justify="space-between">
                                <Group gap="sm">
                                    <ThemeIcon size="sm" variant="light" color={color} radius="sm">{icon}</ThemeIcon>
                                    <Text size="sm" fw={500}>{label}</Text>
                                </Group>
                                <Text size="sm" fw={600}>{value}</Text>
                            </Group>
                        </Paper>
                    ))}
                </SimpleGrid>
            </Paper>

            {/* 산업단지/지식산업센터 목록 */}
            {industrialComplexes.length > 0 && (
                <Paper p="lg" radius="md" withBorder>
                    <Title order={5} mb="md">산업단지 현황</Title>
                    <ScrollArea.Autosize mah={180}>
                        <Stack gap="xs">
                            {industrialComplexes.map((complex) => (
                                <Paper key={complex.id} p="sm" radius="sm" withBorder>
                                    <Group justify="space-between">
                                        <Group gap="sm">
                                            <ThemeIcon size="sm" variant="light" color="orange" radius="sm"><IconMapPin size={12} /></ThemeIcon>
                                            <Text size="sm" fw={500}>{complex.name}</Text>
                                        </Group>
                                        <Badge size="xs" variant="light" color={complex.type === 'national' ? 'blue' : 'gray'}>{complex.type === 'national' ? '국가' : '일반'}</Badge>
                                    </Group>
                                </Paper>
                            ))}
                        </Stack>
                    </ScrollArea.Autosize>
                </Paper>
            )}

            {knowledgeCenters.length > 0 && (
                <Paper p="lg" radius="md" withBorder>
                    <Title order={5} mb="md">지식산업센터 현황</Title>
                    <Text size="sm" c="dimmed" mb="sm">총 {knowledgeCenters.length}개 센터</Text>
                    <ScrollArea.Autosize mah={180}>
                        <Stack gap="xs">
                            {knowledgeCenters.slice(0, 8).map((center) => (
                                <Paper key={center.id} p="sm" radius="sm" withBorder>
                                    <Group justify="space-between">
                                        <Group gap="sm">
                                            <ThemeIcon size="sm" variant="light" color="violet" radius="sm"><IconBuilding size={12} /></ThemeIcon>
                                            <Text size="sm" fw={500} lineClamp={1}>{center.name}</Text>
                                        </Group>
                                        {center.status && <Badge size="xs" variant="light" color={center.status === '운영중' ? 'green' : 'yellow'}>{center.status}</Badge>}
                                    </Group>
                                </Paper>
                            ))}
                        </Stack>
                    </ScrollArea.Autosize>
                    {knowledgeCenters.length > 8 && <Text size="xs" c="dimmed" ta="center" mt="sm">+ {knowledgeCenters.length - 8}개 더 있음</Text>}
                </Paper>
            )}

            <Paper p="sm" radius="md" bg="gray.0">
                <Text size="xs" c="dimmed" ta="center" fw={500}>* 인구, 인력, 유틸리티 비용 등은 시뮬레이션 데이터입니다</Text>
            </Paper>
        </Stack>
    );
});
