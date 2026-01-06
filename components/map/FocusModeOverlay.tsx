// components/map/FocusModeOverlay.tsx
// 포커스 모드 UI - 산업단지 정보 표시 및 나가기 버튼

'use client';

import { useEffect, useCallback, memo, useState } from 'react';
import { useFocusMode, useExitFocusMode, useSelectionStore } from '@/lib/stores/selection-store';
import { ActionIcon, Paper, Text, Group, Badge, Switch, Tooltip, TextInput, Button, Stack } from '@mantine/core';
import { IconX, IconBuilding, IconMap, IconRoad } from '@tabler/icons-react';

// 주요 고속도로 프리셋
const HIGHWAY_PRESETS = [
    { id: '서해안', label: '서해안고속도로', keywords: ['서해안', '서해선'] },
    { id: '영동', label: '영동고속도로', keywords: ['영동', '영동선'] },
    { id: '경인', label: '경인고속도로', keywords: ['경인', '경인선'] },
    { id: '인천국제공항', label: '인천공항고속도로', keywords: ['인천국제공항', '공항', '인천공항'] },
    { id: '수도권제1순환', label: '수도권제1순환', keywords: ['수도권제1순환', '외곽순환', '제1순환'] },
    { id: '제2경인', label: '제2경인고속도로', keywords: ['제2경인', '2경인'] },
    { id: '인천대교', label: '인천대교고속도로', keywords: ['인천대교'] },
];

function FocusModeOverlayInner() {
    const { focusMode, focusedComplex, showLots, showIndustries, highlightRoads } = useFocusMode();
    const exitFocusMode = useExitFocusMode();
    const setFocusModeShowLots = useSelectionStore(state => state.setFocusModeShowLots);
    const setFocusModeShowIndustries = useSelectionStore(state => state.setFocusModeShowIndustries);
    const setFocusModeHighlightRoads = useSelectionStore(state => state.setFocusModeHighlightRoads);
    const [showRoadPanel, setShowRoadPanel] = useState(false);
    const [customRoad, setCustomRoad] = useState('');

    // ESC 키로 포커스 모드 종료
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && focusMode) {
            exitFocusMode();
        }
    }, [focusMode, exitFocusMode]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    if (!focusMode || !focusedComplex) return null;

    // 산업단지 타입 색상
    const typeColor = {
        '국가': 'red',
        '일반': 'blue',
        '농공': 'green',
        '도시첨단': 'violet',
    }[focusedComplex.type] || 'gray';

    return (
        <Paper
            shadow="md"
            p="md"
            radius="md"
            style={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                minWidth: 280,
                maxWidth: 400,
            }}
        >
            <Group justify="space-between" mb="xs">
                <Group gap="xs">
                    <IconBuilding size={20} color="#f59e0b" />
                    <Text fw={600} size="lg">{focusedComplex.name}</Text>
                </Group>
                <Tooltip label="포커스 모드 종료 (ESC)">
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={exitFocusMode}
                        aria-label="포커스 모드 종료"
                    >
                        <IconX size={18} />
                    </ActionIcon>
                </Tooltip>
            </Group>

            <Group gap="xs" mb="sm">
                <Badge color={typeColor} variant="light" size="sm">
                    {focusedComplex.type}산업단지
                </Badge>
                {focusedComplex.area > 0 && (
                    <Badge color="gray" variant="light" size="sm">
                        {(focusedComplex.area / 10000).toFixed(1)}만㎡
                    </Badge>
                )}
                {focusedComplex.lots?.length > 0 && (
                    <Badge color="blue" variant="light" size="sm">
                        용지 {focusedComplex.lots.length}개
                    </Badge>
                )}
            </Group>

            <Group gap="lg">
                <Group gap="xs">
                    <IconMap size={16} color="#3b82f6" />
                    <Switch
                        size="xs"
                        label="용지"
                        checked={showLots}
                        onChange={(e) => setFocusModeShowLots(e.currentTarget.checked)}
                    />
                </Group>
                <Group gap="xs">
                    <IconMap size={16} color="#22c55e" />
                    <Switch
                        size="xs"
                        label="유치업종"
                        checked={showIndustries}
                        onChange={(e) => setFocusModeShowIndustries(e.currentTarget.checked)}
                    />
                </Group>
                <Group gap="xs">
                    <IconRoad size={16} color="#8b5cf6" />
                    <Switch
                        size="xs"
                        label="도로"
                        checked={highlightRoads.length > 0}
                        onChange={() => setShowRoadPanel(!showRoadPanel)}
                    />
                </Group>
            </Group>

            {/* 도로 하이라이트 패널 */}
            {showRoadPanel && (
                <Stack gap="xs" mt="sm" p="xs" style={{ background: 'rgba(139, 92, 246, 0.05)', borderRadius: 8 }}>
                    <Text size="xs" fw={500} c="violet">고속도로 선택</Text>
                    <Group gap="xs" wrap="wrap">
                        {HIGHWAY_PRESETS.map(preset => {
                            const isActive = preset.keywords.some(kw => highlightRoads.includes(kw));
                            return (
                                <Badge
                                    key={preset.id}
                                    color={isActive ? 'violet' : 'gray'}
                                    variant={isActive ? 'filled' : 'light'}
                                    size="sm"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => {
                                        if (isActive) {
                                            // 제거
                                            setFocusModeHighlightRoads(
                                                highlightRoads.filter(r => !preset.keywords.includes(r))
                                            );
                                        } else {
                                            // 추가
                                            setFocusModeHighlightRoads([...highlightRoads, ...preset.keywords]);
                                        }
                                    }}
                                >
                                    {preset.label}
                                </Badge>
                            );
                        })}
                    </Group>
                    <Group gap="xs">
                        <TextInput
                            size="xs"
                            placeholder="직접 입력 (예: 국도1호선)"
                            value={customRoad}
                            onChange={(e) => setCustomRoad(e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <Button
                            size="xs"
                            variant="light"
                            color="violet"
                            onClick={() => {
                                if (customRoad.trim()) {
                                    setFocusModeHighlightRoads([...highlightRoads, customRoad.trim()]);
                                    setCustomRoad('');
                                }
                            }}
                        >
                            추가
                        </Button>
                    </Group>
                    {highlightRoads.length > 0 && (
                        <Button
                            size="xs"
                            variant="subtle"
                            color="gray"
                            onClick={() => setFocusModeHighlightRoads([])}
                        >
                            전체 해제
                        </Button>
                    )}
                </Stack>
            )}

            <Text size="xs" c="dimmed" mt="xs">
                ESC 키를 눌러 나가기
            </Text>
        </Paper>
    );
}

export const FocusModeOverlay = memo(FocusModeOverlayInner);
export default FocusModeOverlay;
