'use client';

import { useMemo } from 'react';
import { Box, Text, Group, Badge } from '@mantine/core';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';

interface Transaction {
    date: string;
    price: number;
}

interface PriceChartProps {
    transactions?: Transaction[];
    currentPrice?: number;
    listingPrice?: number;
    auctionPrice?: number;
}

export default function PriceChart({ transactions = [], currentPrice, listingPrice, auctionPrice }: PriceChartProps) {
    // 차트 데이터 생성
    const chartData = useMemo(() => {
        if (transactions.length === 0) {
            // 샘플 데이터 생성 (데모용)
            const basePrice = currentPrice || 30000;
            return [
                { date: '2023.01', price: basePrice * 0.85, label: '23.01' },
                { date: '2023.06', price: basePrice * 0.9, label: '23.06' },
                { date: '2024.01', price: basePrice * 0.95, label: '24.01' },
                { date: '2024.06', price: basePrice * 0.98, label: '24.06' },
                { date: '2025.01', price: basePrice, label: '25.01' },
            ];
        }

        return transactions
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map((tx) => ({
                date: tx.date,
                price: tx.price,
                label: tx.date.substring(2, 7).replace('-', '.'),
            }));
    }, [transactions, currentPrice]);

    // 가격 변동 계산
    const priceChange = useMemo(() => {
        if (chartData.length < 2) return { value: 0, percent: 0, isUp: true };

        const first = chartData[0].price;
        const last = chartData[chartData.length - 1].price;
        const diff = last - first;
        const percent = ((diff / first) * 100).toFixed(1);

        return {
            value: Math.abs(diff),
            percent: Math.abs(Number(percent)),
            isUp: diff >= 0,
        };
    }, [chartData]);

    // Y축 도메인 계산
    const yDomain = useMemo(() => {
        const prices = chartData.map((d) => d.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const padding = (max - min) * 0.1;
        return [Math.floor((min - padding) / 1000) * 1000, Math.ceil((max + padding) / 1000) * 1000];
    }, [chartData]);

    // 가격 포맷
    const formatPrice = (value: number) => {
        if (value >= 10000) {
            return `${(value / 10000).toFixed(1)}억`;
        }
        return `${value.toLocaleString()}만`;
    };

    return (
        <Box>
            {/* 헤더 */}
            <Group justify="space-between" mb="xs">
                <Text size="sm" fw={600}>가격 추이</Text>
                <Badge
                    size="sm"
                    variant="light"
                    color={priceChange.isUp ? 'red' : 'blue'}
                    leftSection={priceChange.isUp ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
                >
                    {priceChange.percent}% {priceChange.isUp ? '상승' : '하락'}
                </Badge>
            </Group>

            {/* 차트 */}
            <Box style={{ height: 160, background: '#fafafa', borderRadius: 8, padding: '12px 0' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <defs>
                            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#228be6" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#228be6" stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#868e96' }}
                        />
                        <YAxis
                            domain={yDomain}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#868e96' }}
                            tickFormatter={formatPrice}
                            width={45}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <Box
                                            style={{
                                                background: 'white',
                                                border: '1px solid #e9ecef',
                                                borderRadius: 6,
                                                padding: '8px 12px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                            }}
                                        >
                                            <Text size="xs" c="dimmed">{data.date}</Text>
                                            <Text size="sm" fw={600}>{formatPrice(data.price)}</Text>
                                        </Box>
                                    );
                                }
                                return null;
                            }}
                        />
                        {/* 매물가 참조선 */}
                        {listingPrice && (
                            <ReferenceLine
                                y={listingPrice}
                                stroke="#40c057"
                                strokeDasharray="3 3"
                                label={{ value: '매물가', fontSize: 10, fill: '#40c057', position: 'right' }}
                            />
                        )}
                        {/* 경매가 참조선 */}
                        {auctionPrice && (
                            <ReferenceLine
                                y={auctionPrice}
                                stroke="#fa5252"
                                strokeDasharray="3 3"
                                label={{ value: '경매가', fontSize: 10, fill: '#fa5252', position: 'right' }}
                            />
                        )}
                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#228be6"
                            strokeWidth={2}
                            fill="url(#priceGradient)"
                            dot={{ r: 3, fill: '#228be6', strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: '#228be6', strokeWidth: 2, stroke: 'white' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </Box>

            {/* 범례 */}
            <Group gap="md" mt="xs" justify="center">
                <Group gap={4}>
                    <Box style={{ width: 12, height: 2, background: '#228be6' }} />
                    <Text size="xs" c="dimmed">실거래가</Text>
                </Group>
                {listingPrice && (
                    <Group gap={4}>
                        <Box style={{ width: 12, height: 2, background: '#40c057', borderStyle: 'dashed' }} />
                        <Text size="xs" c="dimmed">매물가</Text>
                    </Group>
                )}
                {auctionPrice && (
                    <Group gap={4}>
                        <Box style={{ width: 12, height: 2, background: '#fa5252', borderStyle: 'dashed' }} />
                        <Text size="xs" c="dimmed">경매가</Text>
                    </Group>
                )}
            </Group>
        </Box>
    );
}
