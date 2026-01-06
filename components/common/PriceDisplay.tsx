// components/common/PriceDisplay.tsx
// 가격 표시 공통 컴포넌트

'use client';

import { memo } from 'react';
import { Paper, Text, Divider, Group } from '@mantine/core';

interface PriceDisplayProps {
    label: string;
    price: number;
    area?: number;
    color?: string;
    showPyeongPrice?: boolean;
}

export const PriceDisplay = memo(({
    label,
    price,
    area,
    color = 'blue',
    showPyeongPrice = true,
}: PriceDisplayProps) => {
    const priceInBillion = price / 10000;
    const pricePerPyeong = area ? price / (area / 3.3058) : null;

    return (
        <Paper p="md" radius="md" withBorder bg={`${color}.0`}>
            <Text size="sm" c="dimmed" mb={4}>{label}</Text>
            <Text size="xl" fw={700} c={`${color}.7`}>
                {price.toLocaleString()}만원
            </Text>
            <Text size="xs" c="dimmed">
                ({priceInBillion.toFixed(2)}억원)
            </Text>

            {showPyeongPrice && pricePerPyeong && (
                <>
                    <Divider my="sm" />
                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">평당 가격</Text>
                        <Text size="md" fw={600}>
                            {Math.round(pricePerPyeong).toLocaleString()}만원/평
                        </Text>
                    </Group>
                </>
            )}
        </Paper>
    );
});

PriceDisplay.displayName = 'PriceDisplay';
