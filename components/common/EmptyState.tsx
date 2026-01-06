// components/common/EmptyState.tsx
// 빈 상태 표시 공통 컴포넌트

'use client';

import { memo } from 'react';
import { Paper, Stack, Text } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';

interface EmptyStateProps {
    icon?: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;
    title?: string;
    message: string;
    action?: React.ReactNode;
}

export const EmptyState = memo(({
    icon: Icon,
    title,
    message,
    action,
}: EmptyStateProps) => (
    <Paper p="xl" ta="center" bg="gray.0" radius="md">
        <Stack align="center" gap="md">
            {Icon && (
                <Icon size={48} color="#adb5bd" style={{ margin: '0 auto' }} />
            )}
            {title && (
                <Text size="lg" fw={600} c="dark">
                    {title}
                </Text>
            )}
            <Text size="sm" c="dimmed">
                {message}
            </Text>
            {action}
        </Stack>
    </Paper>
));

EmptyState.displayName = 'EmptyState';
