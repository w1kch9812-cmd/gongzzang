'use client';

import { useState, useEffect } from 'react';
import { Paper, Stack, Text, ActionIcon, Tooltip, Badge, Box, Tabs, ScrollArea } from '@mantine/core';
import {
    IconStar,
    IconScale,
    IconClock,
    IconFileDownload,
    IconChevronRight,
    IconChevronLeft,
} from '@tabler/icons-react';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { RIGHT_SIDEBAR_COLLAPSED, RIGHT_SIDEBAR_EXPANDED } from '@/lib/constants/ui';
import dynamic from 'next/dynamic';

const FavoritesPanel = dynamic(() => import('./FavoritesPanel'), { ssr: false });
const ComparePanel = dynamic(() => import('./ComparePanel'), { ssr: false });

export default function RightSidebar() {
    const [collapsed, setCollapsed] = useState(true);
    const [activePanel, setActivePanel] = useState<'favorites' | 'compare' | 'recent' | null>(null);

    const favorites = usePreferencesStore((state) => state.favorites);
    const compareList = usePreferencesStore((state) => state.compareList);
    const recentItems = usePreferencesStore((state) => state.recentItems);
    const setRightSidebarWidth = useUIStore((state) => state.setRightSidebarWidth);

    // collapsed 상태 변경 시 전역 store 업데이트
    useEffect(() => {
        setRightSidebarWidth(collapsed ? RIGHT_SIDEBAR_COLLAPSED : RIGHT_SIDEBAR_EXPANDED);
    }, [collapsed, setRightSidebarWidth]);

    const handlePanelToggle = (panel: 'favorites' | 'compare' | 'recent') => {
        if (collapsed) {
            setCollapsed(false);
            setActivePanel(panel);
        } else if (activePanel === panel) {
            setCollapsed(true);
            setActivePanel(null);
        } else {
            setActivePanel(panel);
        }
    };

    return (
        <div
            style={{
                width: 48,  // 항상 48px (아이콘 버튼 영역)
                height: '100vh',
                position: 'relative',
                flexShrink: 0,
            }}
        >
            {/* 확장 패널 (왼쪽으로 슬라이드) */}
            <Box
                style={{
                    position: 'absolute',
                    top: 0,
                    right: collapsed ? -360 : 48,  // 닫혔을 때 화면 밖으로, 열렸을 때 아이콘 왼쪽에 위치
                    width: 360,
                    height: '100%',
                    backgroundColor: 'white',
                    borderLeft: '1px solid #e9ecef',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
                    zIndex: 100,
                    transition: 'right 0.3s ease',  // 슬라이드 애니메이션
                }}
            >
                    {/* 헤더 */}
                    <Box p="md" style={{ borderBottom: '1px solid #e9ecef' }}>
                        <Text size="lg" fw={700}>
                            {activePanel === 'favorites' && '관심 매물'}
                            {activePanel === 'compare' && '비교함'}
                            {activePanel === 'recent' && '최근 본'}
                        </Text>
                    </Box>

                    {/* 탭 네비게이션 */}
                    <Tabs
                        value={activePanel}
                        onChange={(value) => setActivePanel(value as typeof activePanel)}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                    >
                        <Tabs.List px="md" pt="sm">
                            <Tabs.Tab
                                value="favorites"
                                leftSection={<IconStar size={16} />}
                                rightSection={
                                    favorites.length > 0 && (
                                        <Badge size="xs" circle>
                                            {favorites.length}
                                        </Badge>
                                    )
                                }
                            >
                                관심
                            </Tabs.Tab>
                            <Tabs.Tab
                                value="compare"
                                leftSection={<IconScale size={16} />}
                                rightSection={
                                    compareList.length > 0 && (
                                        <Badge size="xs" variant="light">
                                            {compareList.length}/3
                                        </Badge>
                                    )
                                }
                            >
                                비교
                            </Tabs.Tab>
                            <Tabs.Tab
                                value="recent"
                                leftSection={<IconClock size={16} />}
                                rightSection={
                                    recentItems.length > 0 && (
                                        <Badge size="xs" circle color="gray">
                                            {recentItems.length}
                                        </Badge>
                                    )
                                }
                            >
                                최근 본
                            </Tabs.Tab>
                        </Tabs.List>

                        {/* 패널 내용 */}
                        <ScrollArea style={{ flex: 1 }}>
                            <Tabs.Panel value="favorites">
                                <FavoritesPanel />
                            </Tabs.Panel>

                            <Tabs.Panel value="compare">
                                <ComparePanel />
                            </Tabs.Panel>

                            <Tabs.Panel value="recent">
                                {recentItems.length === 0 ? (
                                    <Stack p="lg" align="center" justify="center" style={{ minHeight: 200 }}>
                                        <Text size="sm" c="dimmed" ta="center">
                                            최근 본 매물이 없습니다
                                        </Text>
                                        <Text size="xs" c="dimmed" ta="center">
                                            매물을 클릭하면 자동으로 기록됩니다
                                        </Text>
                                    </Stack>
                                ) : (
                                    <Stack p="md" gap="sm">
                                        {recentItems.map((item) => {
                                            const data = item.data as any;
                                            const name = data.name || data.id || item.id;
                                            const location = data.emd || data.sig || data.address || '';

                                            return (
                                                <Paper key={item.id} p="xs" withBorder style={{ cursor: 'pointer' }}>
                                                    <Text size="sm" fw={600} lineClamp={1}>
                                                        {name}
                                                    </Text>
                                                    {location && (
                                                        <Text size="xs" c="dimmed" mt={4}>
                                                            {location}
                                                        </Text>
                                                    )}
                                                    <Text size="xs" c="dimmed" mt={4}>
                                                        {new Date(item.viewedAt).toLocaleString('ko-KR')}
                                                    </Text>
                                                </Paper>
                                            );
                                        })}
                                    </Stack>
                                )}
                            </Tabs.Panel>
                        </ScrollArea>
                    </Tabs>

                    {/* 하단 내보내기 버튼 */}
                    <Box p="md" style={{ borderTop: '1px solid #e9ecef' }}>
                        <ActionIcon
                            variant="light"
                            color="blue"
                            size="lg"
                            style={{ width: '100%' }}
                            onClick={() => alert('내보내기 기능 준비 중')}
                        >
                            <IconFileDownload size={18} />
                        </ActionIcon>
                    </Box>
                </Box>

            {/* 아이콘 버튼 영역 (항상 표시) */}
            <Stack
                gap="xs"
                align="center"
                pt="lg"
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 48,
                    height: '100%',
                    backgroundColor: 'white',
                    borderLeft: '1px solid #e9ecef',
                    zIndex: 101,
                }}
            >
                {/* 토글 버튼 */}
                <Tooltip label={collapsed ? "열기" : "닫기"} position="left" withArrow zIndex={10003}>
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="lg"
                        onClick={() => {
                            if (collapsed) {
                                setCollapsed(false);
                                setActivePanel('favorites');
                            } else {
                                setCollapsed(true);
                                setActivePanel(null);
                            }
                        }}
                    >
                        {collapsed ? <IconChevronLeft size={20} /> : <IconChevronRight size={20} />}
                    </ActionIcon>
                </Tooltip>

                <Box style={{ width: '80%', height: 1, backgroundColor: '#e9ecef', margin: '4px 0' }} />

                {/* 관심 매물 */}
                <Stack gap={2} align="center" onClick={() => handlePanelToggle('favorites')} style={{ cursor: 'pointer' }}>
                    <ActionIcon
                        variant="subtle"
                        color={activePanel === 'favorites' ? 'blue' : 'gray'}
                        size="lg"
                        style={{ position: 'relative' }}
                    >
                        <IconStar size={20} />
                        {favorites.length > 0 && (
                            <Badge
                                size="xs"
                                circle
                                color="red"
                                style={{
                                    position: 'absolute',
                                    top: -4,
                                    right: -4,
                                    minWidth: 16,
                                    height: 16,
                                    padding: 0,
                                }}
                            >
                                {favorites.length}
                            </Badge>
                        )}
                    </ActionIcon>
                    <Text size="xs" c={activePanel === 'favorites' ? 'blue' : 'dimmed'} ta="center" lh={1}>
                        관심
                    </Text>
                </Stack>

                {/* 비교함 */}
                <Stack gap={2} align="center" onClick={() => handlePanelToggle('compare')} style={{ cursor: 'pointer' }}>
                    <ActionIcon
                        variant="subtle"
                        color={activePanel === 'compare' ? 'blue' : 'gray'}
                        size="lg"
                        style={{ position: 'relative' }}
                    >
                        <IconScale size={20} />
                        {compareList.length > 0 && (
                            <Badge
                                size="xs"
                                circle
                                color="blue"
                                style={{
                                    position: 'absolute',
                                    top: -4,
                                    right: -4,
                                    minWidth: 16,
                                    height: 16,
                                    padding: 0,
                                }}
                            >
                                {compareList.length}
                            </Badge>
                        )}
                    </ActionIcon>
                    <Text size="xs" c={activePanel === 'compare' ? 'blue' : 'dimmed'} ta="center" lh={1}>
                        비교
                    </Text>
                </Stack>

                {/* 최근 본 */}
                <Stack gap={2} align="center" onClick={() => handlePanelToggle('recent')} style={{ cursor: 'pointer' }}>
                    <ActionIcon
                        variant="subtle"
                        color={activePanel === 'recent' ? 'blue' : 'gray'}
                        size="lg"
                        style={{ position: 'relative' }}
                    >
                        <IconClock size={20} />
                        {recentItems.length > 0 && (
                            <Badge
                                size="xs"
                                circle
                                color="gray"
                                style={{
                                    position: 'absolute',
                                    top: -4,
                                    right: -4,
                                    minWidth: 16,
                                    height: 16,
                                    padding: 0,
                                }}
                            >
                                {recentItems.length}
                            </Badge>
                        )}
                    </ActionIcon>
                    <Text size="xs" c={activePanel === 'recent' ? 'blue' : 'dimmed'} ta="center" lh={1}>
                        최근
                    </Text>
                </Stack>

                <Box style={{ width: '80%', height: 1, backgroundColor: '#e9ecef', margin: '4px 0' }} />

                {/* 내보내기 */}
                <Stack gap={2} align="center" onClick={() => alert('내보내기 기능 준비 중')} style={{ cursor: 'pointer' }}>
                    <ActionIcon variant="subtle" color="gray" size="lg">
                        <IconFileDownload size={20} />
                    </ActionIcon>
                    <Text size="xs" c="dimmed" ta="center" lh={1}>
                        내보내기
                    </Text>
                </Stack>
            </Stack>
        </div>
    );
}
