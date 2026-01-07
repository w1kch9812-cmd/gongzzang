'use client';

import { useState, useEffect, useMemo } from 'react';
import { Drawer, Stack, Title, Text, Divider, Badge, Group, Tabs, Box, UnstyledButton, ScrollArea, Button, SimpleGrid, Paper } from '@mantine/core';
import { IconHome, IconTag, IconGavel, IconBuildingFactory, IconBuilding, IconMap, IconCategory, IconFocus2, IconStar, IconScale, IconCopy } from '@tabler/icons-react';
import ParcelDetailContent from './ParcelDetailContent';
import { useSelectionState, useClearAllSelections, useFocusMode, useExitFocusMode, useEnterFocusMode } from '@/lib/stores/selection-store';
import { useActiveSidePanel, useSidePanelActions, useComparePanelOpen, useComparePanelActions, useCompareSelectModalActions } from '@/lib/stores/ui-store';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
import { SIDE_PANEL_WIDTH, SIDE_PANEL_Z_INDEX } from '@/lib/constants/ui';
import { PriceDisplay } from '@/components/common/PriceDisplay';
import { calculatePricePerPyeong, squareMetersToPyeong } from '@/lib/utils/statistics';
import { logger } from '@/lib/utils/logger';

export default function DetailPanel() {
    const { selectedParcel, selectedComplex, selectedFactory } = useSelectionState();
    const clearAllSelections = useClearAllSelections();
    const { focusMode, focusedComplex } = useFocusMode();
    const exitFocusMode = useExitFocusMode();
    const enterFocusMode = useEnterFocusMode();
    const [mainTab, setMainTab] = useState<string>('basic');
    const [basicSubTab, setBasicSubTab] = useState<string>('transaction');
    const [complexTab, setComplexTab] = useState<string>('overview');

    // 통합 패널 상태
    const activeSidePanel = useActiveSidePanel();
    const { closeSidePanel } = useSidePanelActions();

    // 비교 패널 상태
    const comparePanelOpen = useComparePanelOpen();
    const { toggleComparePanel } = useComparePanelActions();
    const { openCompareSelectModal } = useCompareSelectModalActions();

    // 디버깅 로그
    logger.log('🎨 [DetailPanel] 렌더링:', {
        activeSidePanel,
        selectedParcel: !!selectedParcel,
        selectedFactory: !!selectedFactory,
        selectedComplex: !!selectedComplex,
        opened: activeSidePanel === 'detail'
    });

    // 관심매물/비교함 상태
    const addToFavorites = usePreferencesStore((state) => state.addToFavorites);
    const removeFromFavorites = usePreferencesStore((state) => state.removeFromFavorites);
    const isFavorite = usePreferencesStore((state) => state.isFavorite);
    const addToCompare = usePreferencesStore((state) => state.addToCompare);
    const isInCompare = usePreferencesStore((state) => state.isInCompare);
    const addToRecent = usePreferencesStore((state) => state.addToRecent);
    const compareListCount = usePreferencesStore((state) => state.compareList.length);
    const favoritesCount = usePreferencesStore((state) => state.favorites.length);

    // 새 필지 선택 시 탭 전환 (지식산업센터가 있으면 먼저 표시) + 최근 본에 추가
    useEffect(() => {
        if (selectedParcel) {
            const hasKC = selectedParcel.knowledgeIndustryCenters && selectedParcel.knowledgeIndustryCenters.length > 0;
            if (hasKC) {
                setMainTab('knowledgeCenter');
            } else {
                setMainTab('basic');
            }
            setBasicSubTab('transaction');

            // 최근 본 매물에 추가 (자동)
            addToRecent({
                id: selectedParcel.id,
                type: 'parcel',
                data: selectedParcel,
            });
        }
    }, [selectedParcel, addToRecent]);

    // 공장/산업단지 선택 시 최근 본에 추가
    useEffect(() => {
        if (selectedFactory) {
            addToRecent({
                id: selectedFactory.id,
                type: 'factory',
                data: selectedFactory,
            });
        }
    }, [selectedFactory, addToRecent]);

    useEffect(() => {
        if (selectedComplex) {
            addToRecent({
                id: selectedComplex.id,
                type: 'complex',
                data: selectedComplex,
            });
        }
    }, [selectedComplex, addToRecent]);

    const handleClose = () => {
        closeSidePanel();
        clearAllSelections();
        setMainTab('basic');
        setBasicSubTab('transaction');
    };

    // 공장 정보 패널
    if (selectedFactory) {
        return (
            <Drawer
                opened={activeSidePanel === 'detail'}
                onClose={handleClose}
                position="left"
                size={SIDE_PANEL_WIDTH}
                padding="lg"
                styles={{
                    header: { padding: '20px' },
                    body: { padding: '0 20px 20px' },
                }}
                zIndex={SIDE_PANEL_Z_INDEX}
            >
                <Stack gap="md">
                    <div>
                        <Title order={3} mb="xs">🏭 {selectedFactory.name}</Title>
                        <Text size="sm" c="dimmed">{selectedFactory.address}</Text>
                    </div>

                    {/* 빠른 액션 버튼 */}
                    <Group gap="xs" justify="flex-end">
                        <Button
                            variant={isFavorite(selectedFactory.id) ? 'filled' : 'light'}
                            color="yellow"
                            size="xs"
                            leftSection={<IconStar size={14} />}
                            onClick={() => {
                                if (isFavorite(selectedFactory.id)) {
                                    removeFromFavorites(selectedFactory.id);
                                } else {
                                    addToFavorites({
                                        id: selectedFactory.id,
                                        type: 'factory',
                                        data: selectedFactory,
                                    });
                                }
                            }}
                        >
                            {isFavorite(selectedFactory.id) ? '관심 해제' : '관심'}
                        </Button>
                        <Button
                            variant={isInCompare(selectedFactory.id) ? 'filled' : 'light'}
                            color="blue"
                            size="xs"
                            leftSection={<IconScale size={14} />}
                            onClick={() => {
                                if (!isInCompare(selectedFactory.id)) {
                                    addToCompare({
                                        id: selectedFactory.id,
                                        type: 'factory',
                                        data: selectedFactory,
                                    });
                                }
                            }}
                            disabled={isInCompare(selectedFactory.id)}
                        >
                            {isInCompare(selectedFactory.id) ? '비교 중' : '비교'}
                        </Button>
                    </Group>

                    <Divider />

                    <div>
                        <Text size="sm" fw={600} mb="xs">기본 정보</Text>
                        <Stack gap="xs">
                            {selectedFactory.businessType && (
                                <Group justify="space-between">
                                    <Text size="sm" c="dimmed">업종</Text>
                                    <Text size="sm">{selectedFactory.businessType}</Text>
                                </Group>
                            )}
                            {selectedFactory.employeeCount !== undefined && selectedFactory.employeeCount > 0 && (
                                <Group justify="space-between">
                                    <Text size="sm" c="dimmed">종업원 수</Text>
                                    <Text size="sm" fw={600}>{selectedFactory.employeeCount}명</Text>
                                </Group>
                            )}
                        </Stack>
                    </div>

                    <Divider />

                    <div>
                        <Text size="sm" fw={600} mb="xs">면적 정보</Text>
                        <Stack gap="xs">
                            {selectedFactory.area && (
                                <Group justify="space-between">
                                    <Text size="sm" c="dimmed">용지면적</Text>
                                    <Text size="sm">{selectedFactory.area.toLocaleString()}㎡</Text>
                                </Group>
                            )}
                            {selectedFactory.buildingArea && (
                                <Group justify="space-between">
                                    <Text size="sm" c="dimmed">건축면적</Text>
                                    <Text size="sm">{selectedFactory.buildingArea.toLocaleString()}㎡</Text>
                                </Group>
                            )}
                        </Stack>
                    </div>
                </Stack>
            </Drawer>
        );
    }

    // 산업단지 정보 패널 (포커스 모드)
    if (selectedComplex || (focusMode && focusedComplex)) {
        const complex = selectedComplex || focusedComplex;
        if (!complex) return null;

        const typeColor = {
            '국가': 'red',
            '일반': 'blue',
            '농공': 'green',
            '도시첨단': 'violet',
        }[complex.type] || 'gray';

        const hasLots = complex.lots && complex.lots.length > 0;
        const hasIndustries = complex.industries && complex.industries.length > 0;

        return (
            <Drawer
                opened={activeSidePanel === 'detail'}
                onClose={() => {
                    if (focusMode) {
                        exitFocusMode();
                    }
                    handleClose();
                }}
                position="left"
                size={SIDE_PANEL_WIDTH}
                title={
                    <Group gap="xs">
                        <IconBuildingFactory size={24} color="#f59e0b" />
                        <Title order={4}>{complex.name}</Title>
                        <Badge variant="light" color={typeColor} size="sm">
                            {complex.type}
                        </Badge>
                    </Group>
                }
                styles={{
                    header: { marginBottom: 0 },
                    body: {
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        height: 'calc(100vh - 60px)',
                    },
                    root: { zIndex: SIDE_PANEL_Z_INDEX },
                    content: { pointerEvents: 'auto' }
                }}
                withCloseButton
                withOverlay={false}
                lockScroll={false}
                trapFocus={false}
                closeOnEscape={false}
                zIndex={SIDE_PANEL_Z_INDEX}
            >
                {/* 탭 영역 */}
                <Tabs value={complexTab} onChange={(v) => setComplexTab(v || 'overview')} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Tabs.List px="md" pt="sm">
                        <Tabs.Tab value="overview" leftSection={<IconHome size={16} />}>개요</Tabs.Tab>
                        {hasLots && <Tabs.Tab value="lots" leftSection={<IconMap size={16} />}>용지</Tabs.Tab>}
                        {hasIndustries && <Tabs.Tab value="industries" leftSection={<IconCategory size={16} />}>업종</Tabs.Tab>}
                    </Tabs.List>

                    <ScrollArea style={{ flex: 1 }} p="md">
                        {/* 개요 탭 */}
                        <Tabs.Panel value="overview">
                            <Stack gap="md">
                                {/* 빠른 액션 버튼 */}
                                <Group gap="xs" justify="flex-end">
                                    <Button
                                        variant={isFavorite(complex.id) ? 'filled' : 'light'}
                                        color="yellow"
                                        size="xs"
                                        leftSection={<IconStar size={14} />}
                                        onClick={() => {
                                            if (isFavorite(complex.id)) {
                                                removeFromFavorites(complex.id);
                                            } else {
                                                addToFavorites({
                                                    id: complex.id,
                                                    type: 'complex',
                                                    data: complex,
                                                });
                                            }
                                        }}
                                    >
                                        {isFavorite(complex.id) ? '관심 해제' : '관심'}
                                    </Button>
                                    <Button
                                        variant={isInCompare(complex.id) ? 'filled' : 'light'}
                                        color="blue"
                                        size="xs"
                                        leftSection={<IconScale size={14} />}
                                        onClick={() => {
                                            if (!isInCompare(complex.id)) {
                                                addToCompare({
                                                    id: complex.id,
                                                    type: 'complex',
                                                    data: complex,
                                                });
                                            }
                                        }}
                                        disabled={isInCompare(complex.id)}
                                    >
                                        {isInCompare(complex.id) ? '비교 중' : '비교'}
                                    </Button>
                                </Group>

                                {/* 면적 정보 */}
                                <div style={{
                                    background: '#fff7ed',
                                    borderRadius: 12,
                                    padding: 16,
                                }}>
                                    <Text size="sm" c="dimmed" mb={4}>총 면적</Text>
                                    <Text size="xl" fw={700} c="orange">
                                        {(complex.area / 10000).toFixed(1)}만㎡
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                        ({(complex.area / 3.3058 / 10000).toFixed(1)}만평)
                                    </Text>
                                </div>

                                {/* 용지/업종 현황 */}
                                <Group grow>
                                    <div style={{
                                        background: '#eff6ff',
                                        borderRadius: 12,
                                        padding: 12,
                                        textAlign: 'center',
                                    }}>
                                        <Text size="lg" fw={700} c="blue">{complex.lots?.length || 0}</Text>
                                        <Text size="xs" c="dimmed">용지</Text>
                                    </div>
                                    <div style={{
                                        background: '#f0fdf4',
                                        borderRadius: 12,
                                        padding: 12,
                                        textAlign: 'center',
                                    }}>
                                        <Text size="lg" fw={700} c="green">{complex.industries?.length || 0}</Text>
                                        <Text size="xs" c="dimmed">유치업종</Text>
                                    </div>
                                </Group>

                                <Divider />

                                {/* 상세 정보 */}
                                <Stack gap="xs">
                                    {complex.status && (
                                        <Group justify="space-between">
                                            <Text size="sm" c="dimmed">운영상태</Text>
                                            <Badge variant="outline" color="gray">{complex.status}</Badge>
                                        </Group>
                                    )}
                                    {complex.developmentStatus && (
                                        <Group justify="space-between">
                                            <Text size="sm" c="dimmed">개발상태</Text>
                                            <Text size="sm">{complex.developmentStatus}</Text>
                                        </Group>
                                    )}
                                    {complex.coord && (
                                        <Group justify="space-between">
                                            <Text size="sm" c="dimmed">좌표</Text>
                                            <Text size="xs" ff="monospace">
                                                {complex.coord[1].toFixed(5)}, {complex.coord[0].toFixed(5)}
                                            </Text>
                                        </Group>
                                    )}
                                </Stack>

                                {/* 포커스 모드 진입 버튼 - 이미 포커스 모드가 아닐 때만 표시 */}
                                {!focusMode && (
                                    <>
                                        <Divider />
                                        <Button
                                            fullWidth
                                            variant="light"
                                            color="orange"
                                            size="md"
                                            leftSection={<IconFocus2 size={18} />}
                                            onClick={() => {
                                                enterFocusMode(complex);
                                                clearAllSelections();
                                            }}
                                        >
                                            이 산업단지 집중 탐색
                                        </Button>
                                        <Text size="xs" c="dimmed" ta="center">
                                            용지, 유치업종, 주변 도로를 자세히 살펴볼 수 있습니다
                                        </Text>
                                    </>
                                )}
                            </Stack>
                        </Tabs.Panel>

                        {/* 용지 탭 */}
                        <Tabs.Panel value="lots">
                            <Stack gap="sm">
                                <Text size="sm" fw={600}>용지 목록 ({complex.lots?.length || 0}개)</Text>
                                {complex.lots?.map((lot, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            background: '#f8fafc',
                                            borderRadius: 8,
                                            padding: 12,
                                            border: '1px solid #e2e8f0',
                                        }}
                                    >
                                        <Group justify="space-between">
                                            <Badge color="blue" variant="light" size="sm">
                                                {lot.type || '용지'}
                                            </Badge>
                                            {lot.area && (
                                                <Text size="xs" c="dimmed">
                                                    {lot.area.toLocaleString()}㎡
                                                </Text>
                                            )}
                                        </Group>
                                        {lot.name && (
                                            <Text size="sm" mt={4}>{lot.name}</Text>
                                        )}
                                    </div>
                                ))}
                                {(!complex.lots || complex.lots.length === 0) && (
                                    <Text size="sm" c="dimmed" ta="center" py="xl">
                                        용지 정보가 없습니다.
                                    </Text>
                                )}
                            </Stack>
                        </Tabs.Panel>

                        {/* 유치업종 탭 */}
                        <Tabs.Panel value="industries">
                            <Stack gap="sm">
                                <Text size="sm" fw={600}>유치업종 목록 ({complex.industries?.length || 0}개)</Text>
                                {complex.industries?.map((ind, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            background: '#f0fdf4',
                                            borderRadius: 8,
                                            padding: 12,
                                            border: '1px solid #dcfce7',
                                        }}
                                    >
                                        <Group gap="xs">
                                            <Badge color="green" variant="light" size="sm">
                                                {ind.type || ind.name || '업종'}
                                            </Badge>
                                        </Group>
                                        {ind.name && ind.type && (
                                            <Text size="sm" mt={4}>{ind.name}</Text>
                                        )}
                                    </div>
                                ))}
                                {(!complex.industries || complex.industries.length === 0) && (
                                    <Text size="sm" c="dimmed" ta="center" py="xl">
                                        유치업종 정보가 없습니다.
                                    </Text>
                                )}
                            </Stack>
                        </Tabs.Panel>
                    </ScrollArea>
                </Tabs>
            </Drawer>
        );
    }

    // 필지 정보 패널
    if (!selectedParcel) {
        return null;
    }

    return (
        <Drawer
            opened={activeSidePanel === 'detail'}
            onClose={handleClose}
            position="left"
            size={SIDE_PANEL_WIDTH}
            styles={{
                header: { display: 'none' },
                body: {
                    padding: 0,
                    height: '100vh',
                    overflow: 'auto',
                },
                root: { zIndex: SIDE_PANEL_Z_INDEX },
                content: { pointerEvents: 'auto' }
            }}
            withCloseButton={false}
            withOverlay={false}
            lockScroll={false}
            trapFocus={false}
            closeOnEscape={false}
            zIndex={SIDE_PANEL_Z_INDEX}
        >
            <ParcelDetailContent parcel={selectedParcel} />
        </Drawer>
    );
}
