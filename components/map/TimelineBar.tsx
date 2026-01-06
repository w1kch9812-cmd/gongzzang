// components/map/TimelineBar.tsx
// 타임라인 바 - 하단에 날짜 슬라이더 표시

'use client';

import { memo, useCallback, useMemo } from 'react';
import { useTimeline, useTimelineActions } from '@/lib/stores/filter-store';
import { Paper, Slider, Group, Text, Switch, ActionIcon, Tooltip } from '@mantine/core';
import { IconCalendar, IconPlayerPlay, IconPlayerPause, IconX } from '@tabler/icons-react';

function TimelineBarInner() {
    const { enabled, date, minDate, maxDate } = useTimeline();
    const { setEnabled, setDate } = useTimelineActions();

    // 날짜를 숫자로 변환 (슬라이더용)
    const minTimestamp = useMemo(() => new Date(minDate).getTime(), [minDate]);
    const maxTimestamp = useMemo(() => new Date(maxDate).getTime(), [maxDate]);
    const currentTimestamp = useMemo(() => {
        if (!date) return maxTimestamp;
        return new Date(date).getTime();
    }, [date, maxTimestamp]);

    // 슬라이더 값 변경 핸들러
    const handleSliderChange = useCallback((value: number) => {
        const newDate = new Date(value).toISOString().split('T')[0];
        setDate(newDate);
    }, [setDate]);

    // 날짜 포맷팅
    const formatDate = useCallback((timestamp: number) => {
        const d = new Date(timestamp);
        return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    }, []);

    const displayDate = useMemo(() => {
        if (!date) return '전체';
        const d = new Date(date);
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    }, [date]);

    // 슬라이더 마크 (년도별)
    const marks = useMemo(() => {
        const result: { value: number; label: string }[] = [];
        const startYear = new Date(minDate).getFullYear();
        const endYear = new Date(maxDate).getFullYear();

        for (let year = startYear; year <= endYear; year++) {
            result.push({
                value: new Date(`${year}-01-01`).getTime(),
                label: `${year}`,
            });
        }
        return result;
    }, [minDate, maxDate]);

    if (!enabled) {
        // 비활성화 상태: 작은 토글 버튼만 표시
        return (
            <Paper
                shadow="sm"
                p="xs"
                radius="md"
                style={{
                    position: 'absolute',
                    bottom: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(4px)',
                }}
            >
                <Group gap="xs">
                    <IconCalendar size={16} color="#6b7280" />
                    <Text size="sm" c="dimmed">타임라인</Text>
                    <Switch
                        size="xs"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.currentTarget.checked)}
                    />
                </Group>
            </Paper>
        );
    }

    return (
        <Paper
            shadow="md"
            p="md"
            radius="lg"
            style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                width: 'calc(100% - 480px)',
                maxWidth: 800,
                minWidth: 400,
            }}
        >
            <Group justify="space-between" mb="xs">
                <Group gap="xs">
                    <IconCalendar size={18} color="#3b82f6" />
                    <Text size="sm" fw={600}>타임라인</Text>
                    <Text size="sm" c="blue" fw={700}>{displayDate}</Text>
                </Group>
                <Group gap="xs">
                    <Tooltip label="전체 보기">
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={() => setDate(null)}
                        >
                            <IconPlayerPlay size={16} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="타임라인 닫기">
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={() => setEnabled(false)}
                        >
                            <IconX size={16} />
                        </ActionIcon>
                    </Tooltip>
                </Group>
            </Group>

            <Slider
                min={minTimestamp}
                max={maxTimestamp}
                step={86400000 * 30}  // 약 1개월 단위
                value={currentTimestamp}
                onChange={handleSliderChange}
                marks={marks}
                label={(value) => formatDate(value)}
                styles={{
                    mark: { display: 'none' },
                    markLabel: { fontSize: 10, color: '#6b7280' },
                    thumb: { borderColor: '#3b82f6' },
                    bar: { backgroundColor: '#3b82f6' },
                }}
            />

            <Group justify="space-between" mt="xs">
                <Text size="xs" c="dimmed">{minDate}</Text>
                <Text size="xs" c="dimmed">{maxDate}</Text>
            </Group>
        </Paper>
    );
}

export const TimelineBar = memo(TimelineBarInner);
export default TimelineBar;
