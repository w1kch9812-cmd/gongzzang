'use client';

import { Box, Text, Transition } from '@mantine/core';
import { IconEyeOff } from '@tabler/icons-react';
import { useMarkerSampling } from '@/lib/stores/ui-store';

export default function HiddenMarkerToast() {
    const { hiddenCount } = useMarkerSampling();

    // 숨겨진 마커가 없으면 표시 안함
    if (hiddenCount === 0) return null;

    return (
        <Transition mounted={hiddenCount > 0} transition="slide-up" duration={200}>
            {(styles) => (
                <Box
                    style={{
                        ...styles,
                        position: 'fixed',
                        bottom: 70, // LocationBar 위
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 999,
                    }}
                >
                    <Box
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            background: 'rgba(0, 0, 0, 0.8)',
                            borderRadius: 20,
                            backdropFilter: 'blur(8px)',
                        }}
                    >
                        <IconEyeOff size={14} color="#fbbf24" />
                        <Text size="xs" c="white">
                            현재 화면에 숨겨진 매물 <Text span fw={700} c="yellow.4">{hiddenCount.toLocaleString()}</Text>개
                        </Text>
                    </Box>
                </Box>
            )}
        </Transition>
    );
}
