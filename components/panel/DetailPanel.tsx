'use client';

import { useState, useEffect, useMemo } from 'react';
import { Drawer, Stack, Title, Text, Divider, Badge, Group, Tabs, Box, UnstyledButton, ScrollArea, Button, SimpleGrid, Paper } from '@mantine/core';
import { IconHome, IconTag, IconGavel, IconBuildingFactory, IconBuilding, IconMap, IconCategory, IconFocus2, IconStar, IconScale, IconCopy } from '@tabler/icons-react';
import { useSelectionState, useClearAllSelections, useFocusMode, useExitFocusMode, useEnterFocusMode } from '@/lib/stores/selection-store';
import { useActiveSidePanel, useSidePanelActions } from '@/lib/stores/ui-store';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
import { SIDE_PANEL_WIDTH, SIDE_PANEL_Z_INDEX } from '@/lib/constants/ui';
import { PriceDisplay } from '@/components/common/PriceDisplay';
import { calculatePricePerPyeong, squareMetersToPyeong } from '@/lib/utils/statistics';

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

    // 디버깅 로그
    console.log('🎨 [DetailPanel] 렌더링:', {
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

    const hasListing = selectedParcel.listingPrice && selectedParcel.listingPrice > 0;
    const hasAuction = selectedParcel.auctionPrice && selectedParcel.auctionPrice > 0;
    const hasFactory = selectedParcel.factories && selectedParcel.factories.length > 0;
    const hasKnowledgeCenter = selectedParcel.knowledgeIndustryCenters && selectedParcel.knowledgeIndustryCenters.length > 0;

    return (
        <Drawer
            opened={activeSidePanel === 'detail'}
            onClose={handleClose}
            position="left"
            size={SIDE_PANEL_WIDTH}
            title={
                <Group justify="space-between" w="100%">
                    <Title order={3}>필지 상세정보</Title>
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
            {/* 메인 콘텐츠 영역 */}
            <Box style={{ flex: 1, overflow: 'auto', padding: '20px', paddingBottom: '80px' }}>
                {/* 빠른 액션 버튼 */}
                <Group gap="xs" mb="md" justify="flex-end">
                    <Button
                        variant={isFavorite(selectedParcel.id) ? 'filled' : 'light'}
                        color="yellow"
                        size="xs"
                        leftSection={<IconStar size={14} />}
                        onClick={() => {
                            if (isFavorite(selectedParcel.id)) {
                                removeFromFavorites(selectedParcel.id);
                            } else {
                                addToFavorites({
                                    id: selectedParcel.id,
                                    type: 'parcel',
                                    data: selectedParcel,
                                });
                            }
                        }}
                    >
                        {isFavorite(selectedParcel.id) ? '관심 해제' : '관심'}
                    </Button>
                    <Button
                        variant={isInCompare(selectedParcel.id) ? 'filled' : 'light'}
                        color="blue"
                        size="xs"
                        leftSection={<IconScale size={14} />}
                        onClick={() => {
                            if (!isInCompare(selectedParcel.id)) {
                                addToCompare({
                                    id: selectedParcel.id,
                                    type: 'parcel',
                                    data: selectedParcel,
                                });
                            }
                        }}
                        disabled={isInCompare(selectedParcel.id)}
                    >
                        {isInCompare(selectedParcel.id) ? '비교 중' : '비교'}
                    </Button>
                    <Button
                        variant="light"
                        color="gray"
                        size="xs"
                        leftSection={<IconCopy size={14} />}
                        onClick={() => {
                            const address = selectedParcel.roadAddress || selectedParcel.address || selectedParcel.jibun;
                            if (address) {
                                navigator.clipboard.writeText(address);
                                alert('주소가 복사되었습니다.');
                            }
                        }}
                    >
                        주소복사
                    </Button>
                </Group>

                {/* 기본정보 탭 콘텐츠 */}
                {mainTab === 'basic' && (
                    <Tabs value={basicSubTab} onChange={(value) => setBasicSubTab(value || 'transaction')}>
                        <Tabs.List mb="md">
                            <Tabs.Tab value="transaction">실거래가</Tabs.Tab>
                            <Tabs.Tab value="land">토지정보</Tabs.Tab>
                        </Tabs.List>

                        {/* 실거래가 서브탭 */}
                        <Tabs.Panel value="transaction">
                            <Stack gap="md">
                                {selectedParcel.transactionPrice ? (
                                    <>
                                        <PriceDisplay
                                            label="최신 실거래가"
                                            price={selectedParcel.transactionPrice}
                                            area={selectedParcel.area}
                                            color="blue"
                                        />

                                        {selectedParcel.transactionDate && (
                                            <Text size="xs" c="dimmed" ta="center" mt={-8}>
                                                거래일: {selectedParcel.transactionDate}
                                            </Text>
                                        )}

                                        {/* 면적 정보 */}
                                        {selectedParcel.area && (
                                            <SimpleGrid cols={2} spacing="xs">
                                                <Paper p="sm" withBorder bg="gray.0">
                                                    <Text size="xs" c="dimmed">면적 (평)</Text>
                                                    <Text size="md" fw={600}>
                                                        {squareMetersToPyeong(selectedParcel.area).toFixed(1)}평
                                                    </Text>
                                                </Paper>
                                                <Paper p="sm" withBorder bg="gray.0">
                                                    <Text size="xs" c="dimmed">면적 (㎡)</Text>
                                                    <Text size="md" fw={600}>
                                                        {selectedParcel.area.toLocaleString()}㎡
                                                    </Text>
                                                </Paper>
                                            </SimpleGrid>
                                        )}
                                    </>
                                ) : (
                                    <Text size="sm" c="dimmed" ta="center" py="xl">
                                        실거래가 정보가 없습니다.
                                    </Text>
                                )}

                                {selectedParcel.transactions && selectedParcel.transactions.length > 0 && (
                                    <div>
                                        <Text size="sm" fw={600} mb={8}>
                                            거래 이력 ({selectedParcel.transactions.length}건)
                                        </Text>
                                        <Stack gap={8}>
                                            {[...selectedParcel.transactions]
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                .map((transaction, index) => (
                                                    <div
                                                        key={index}
                                                        style={{
                                                            background: '#f8f9fa',
                                                            borderRadius: 8,
                                                            padding: 12,
                                                            border: '1px solid #e9ecef',
                                                        }}
                                                    >
                                                        <Group justify="space-between" mb={4}>
                                                            <Text size="xs" c="dimmed">{transaction.date}</Text>
                                                            {transaction.dealType && (
                                                                <Badge size="xs" variant="light">{transaction.dealType}</Badge>
                                                            )}
                                                        </Group>
                                                        <Text size="sm" fw={600}>
                                                            {transaction.price.toLocaleString()}만원
                                                        </Text>
                                                        <Text size="xs" c="dimmed">
                                                            ({(transaction.price / 10000).toFixed(2)}억원)
                                                        </Text>
                                                    </div>
                                                ))}
                                        </Stack>
                                    </div>
                                )}
                            </Stack>
                        </Tabs.Panel>

                        {/* 토지정보 서브탭 */}
                        <Tabs.Panel value="land">
                            <Stack gap="md">
                                <div style={{
                                    background: '#f8f9fa',
                                    borderRadius: 12,
                                    padding: 16,
                                }}>
                                    <div style={{ marginBottom: 12 }}>
                                        <Group gap={6} mb={4}>
                                            <Badge size="xs" color="blue" variant="light">도로명</Badge>
                                        </Group>
                                        <Text size="md" fw={600} c="dark">
                                            {selectedParcel.roadAddress || '도로명주소 정보 없음'}
                                        </Text>
                                    </div>

                                    <div>
                                        <Group gap={6} mb={4}>
                                            <Badge size="xs" color="gray" variant="light">지번</Badge>
                                        </Group>
                                        <Text size="sm" c="dimmed">
                                            {selectedParcel.address || selectedParcel.jibun || '지번주소 정보 없음'}
                                        </Text>
                                    </div>
                                </div>

                                {selectedParcel.pnu && (
                                    <div>
                                        <Text size="sm" c="dimmed" mb={4}>PNU (필지고유번호)</Text>
                                        <Text size="sm" ff="monospace" style={{
                                            background: '#f1f3f5',
                                            padding: '4px 8px',
                                            borderRadius: 4,
                                            display: 'inline-block',
                                        }}>
                                            {selectedParcel.pnu}
                                        </Text>
                                    </div>
                                )}

                                <Divider />

                                {/* 토지대장 정보 */}
                                {selectedParcel.landLedger && (
                                    <>
                                        <Text size="sm" fw={600} c="dark">📋 토지대장</Text>
                                        <SimpleGrid cols={2} spacing="xs">
                                            <Paper p="sm" withBorder bg="blue.0">
                                                <Text size="xs" c="dimmed">공부상 면적</Text>
                                                <Text size="md" fw={600}>
                                                    {selectedParcel.landLedger.lndpclAr.toLocaleString()}㎡
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                    ({(selectedParcel.landLedger.lndpclAr / 3.3058).toFixed(1)}평)
                                                </Text>
                                            </Paper>
                                            <Paper p="sm" withBorder bg="green.0">
                                                <Text size="xs" c="dimmed">지목</Text>
                                                <Text size="md" fw={600}>
                                                    {selectedParcel.landLedger.lndcgrCodeNm}
                                                </Text>
                                            </Paper>
                                            <Paper p="sm" withBorder bg="gray.0">
                                                <Text size="xs" c="dimmed">소유구분</Text>
                                                <Text size="md" fw={600}>
                                                    {selectedParcel.landLedger.posesnSeCodeNm}
                                                </Text>
                                            </Paper>
                                            <Paper p="sm" withBorder bg="gray.0">
                                                <Text size="xs" c="dimmed">기준일자</Text>
                                                <Text size="sm">
                                                    {selectedParcel.landLedger.lastUpdtDt}
                                                </Text>
                                            </Paper>
                                        </SimpleGrid>
                                        <Divider />
                                    </>
                                )}

                                {/* 건축물대장 정보 */}
                                {selectedParcel.buildingLedger && (
                                    <>
                                        <Text size="sm" fw={600} c="dark">🏗️ 건축물대장</Text>
                                        <SimpleGrid cols={2} spacing="xs">
                                            <Paper p="sm" withBorder bg="orange.0">
                                                <Text size="xs" c="dimmed">건축면적</Text>
                                                <Text size="md" fw={600}>
                                                    {selectedParcel.buildingLedger.archArea.toLocaleString()}㎡
                                                </Text>
                                            </Paper>
                                            <Paper p="sm" withBorder bg="orange.0">
                                                <Text size="xs" c="dimmed">연면적</Text>
                                                <Text size="md" fw={600}>
                                                    {selectedParcel.buildingLedger.totArea.toLocaleString()}㎡
                                                </Text>
                                            </Paper>
                                            <Paper p="sm" withBorder bg="violet.0">
                                                <Text size="xs" c="dimmed">주용도</Text>
                                                <Text size="md" fw={600}>
                                                    {selectedParcel.buildingLedger.mainPurpsCdNm}
                                                </Text>
                                            </Paper>
                                            <Paper p="sm" withBorder bg="gray.0">
                                                <Text size="xs" c="dimmed">층수</Text>
                                                <Text size="md" fw={600}>
                                                    지상{selectedParcel.buildingLedger.grndFlrCnt}층
                                                    {selectedParcel.buildingLedger.ugrndFlrCnt > 0 && ` / 지하${selectedParcel.buildingLedger.ugrndFlrCnt}층`}
                                                </Text>
                                            </Paper>
                                            <Paper p="sm" withBorder bg="teal.0">
                                                <Text size="xs" c="dimmed">건폐율</Text>
                                                <Text size="md" fw={600}>
                                                    {selectedParcel.buildingLedger.bcRat.toFixed(1)}%
                                                </Text>
                                            </Paper>
                                            <Paper p="sm" withBorder bg="teal.0">
                                                <Text size="xs" c="dimmed">용적률</Text>
                                                <Text size="md" fw={600}>
                                                    {selectedParcel.buildingLedger.vlRat.toFixed(1)}%
                                                </Text>
                                            </Paper>
                                            <Paper p="sm" withBorder bg="gray.0">
                                                <Text size="xs" c="dimmed">구조</Text>
                                                <Text size="sm" fw={500}>
                                                    {selectedParcel.buildingLedger.strctCdNm}
                                                </Text>
                                            </Paper>
                                            <Paper p="sm" withBorder bg="gray.0">
                                                <Text size="xs" c="dimmed">높이</Text>
                                                <Text size="md" fw={600}>
                                                    {selectedParcel.buildingLedger.heit}m
                                                </Text>
                                            </Paper>
                                        </SimpleGrid>
                                        {selectedParcel.buildingLedger.useAprDay && (
                                            <Text size="xs" c="dimmed" ta="right">
                                                사용승인일: {selectedParcel.buildingLedger.useAprDay}
                                            </Text>
                                        )}
                                        <Divider />
                                    </>
                                )}

                                <div>
                                    <Text size="sm" c="dimmed" mb={4}>토지 면적</Text>
                                    <Group gap="xs" align="baseline">
                                        <Text size="xl" fw={700} c="blue">
                                            {((selectedParcel.area || 0) / 3.3058).toFixed(1)}
                                        </Text>
                                        <Text size="md" c="dimmed">평</Text>
                                        <Text size="sm" c="dimmed">
                                            ({(selectedParcel.area || 0).toLocaleString()} ㎡)
                                        </Text>
                                    </Group>
                                </div>

                                {selectedParcel.landUseType && (
                                    <div>
                                        <Text size="sm" c="dimmed" mb={4}>용도지역</Text>
                                        <Badge size="lg" color="violet" variant="light">
                                            {selectedParcel.landUseType}
                                        </Badge>
                                    </div>
                                )}

                                {selectedParcel.officialLandPrice && (
                                    <div>
                                        <Text size="sm" c="dimmed" mb={4}>공시지가</Text>
                                        <Group gap="xs" align="baseline">
                                            <Text size="lg" fw={600}>
                                                {(selectedParcel.officialLandPrice / 10000).toFixed(1)}
                                            </Text>
                                            <Text size="sm" c="dimmed">만원/㎡</Text>
                                        </Group>
                                        <Text size="xs" c="dimmed">
                                            총 {((selectedParcel.officialLandPrice * selectedParcel.area) / 100000000).toFixed(2)}억원
                                        </Text>
                                    </div>
                                )}
                            </Stack>
                        </Tabs.Panel>
                    </Tabs>
                )}

                {/* 매물 탭 콘텐츠 */}
                {mainTab === 'listing' && (
                    <Stack gap="md">
                        {hasListing ? (
                            <div style={{
                                background: '#e7f5ff',
                                borderRadius: 12,
                                padding: 16,
                            }}>
                                <Text size="sm" c="dimmed" mb={4}>매물가</Text>
                                <Text size="xl" fw={700} c="green">
                                    {selectedParcel.listingPrice?.toLocaleString()}만원
                                </Text>
                                <Text size="xs" c="dimmed">
                                    ({((selectedParcel.listingPrice || 0) / 10000).toFixed(2)}억원)
                                </Text>
                                <Divider my="sm" />
                                <Text size="sm" c="dimmed" mb={4}>평당 가격</Text>
                                <Text size="md">
                                    {Math.round((selectedParcel.listingPrice || 0) / (selectedParcel.area / 3.3058)).toLocaleString()}만원/평
                                </Text>
                            </div>
                        ) : (
                            <Text size="sm" c="dimmed" ta="center" py="xl">
                                매물 정보가 없습니다.
                            </Text>
                        )}
                    </Stack>
                )}

                {/* 입주기업 탭 콘텐츠 */}
                {mainTab === 'factory' && (
                    <Stack gap="md">
                        {hasFactory ? (
                            <>
                                <Text size="sm" fw={600} mb="xs">
                                    입주 기업 목록 ({selectedParcel.factories?.length || 0}개)
                                </Text>

                                <Stack gap="md">
                                    {selectedParcel.factories?.map((factory, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                padding: '16px',
                                                background: '#f8f9fa',
                                                borderRadius: 8,
                                                border: '1px solid #e9ecef',
                                            }}
                                        >
                                            <Group justify="space-between" mb="xs">
                                                <Text size="md" fw={600}>🏭 {factory.name}</Text>
                                            </Group>

                                            {factory.businessType && (
                                                <Text size="sm" c="dimmed" mb="xs">
                                                    {factory.businessType}
                                                </Text>
                                            )}

                                            <Divider my="xs" />

                                            <Stack gap="xs">
                                                {factory.employeeCount !== undefined && factory.employeeCount > 0 && (
                                                    <Group justify="space-between">
                                                        <Text size="sm" c="dimmed">종업원 수</Text>
                                                        <Text size="sm" fw={600}>{factory.employeeCount}명</Text>
                                                    </Group>
                                                )}
                                                {factory.area && (
                                                    <Group justify="space-between">
                                                        <Text size="sm" c="dimmed">용지면적</Text>
                                                        <Text size="sm">{factory.area.toLocaleString()}㎡</Text>
                                                    </Group>
                                                )}
                                            </Stack>
                                        </div>
                                    ))}
                                </Stack>
                            </>
                        ) : (
                            <div style={{
                                padding: '40px 20px',
                                textAlign: 'center',
                                background: '#f8f9fa',
                                borderRadius: 8,
                            }}>
                                <Text size="sm" c="dimmed">
                                    이 필지에는 입주한 기업이 없습니다
                                </Text>
                            </div>
                        )}
                    </Stack>
                )}

                {/* 지식산업센터 탭 콘텐츠 */}
                {mainTab === 'knowledgeCenter' && (
                    <Stack gap="md">
                        {hasKnowledgeCenter ? (
                            <>
                                <Text size="sm" fw={600} mb="xs">
                                    지식산업센터 ({selectedParcel.knowledgeIndustryCenters?.length || 0}개)
                                </Text>

                                <Stack gap="md">
                                    {selectedParcel.knowledgeIndustryCenters?.map((kc, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                padding: '16px',
                                                background: '#f3f0ff',
                                                borderRadius: 8,
                                                border: '1px solid #e5dbff',
                                            }}
                                        >
                                            <Group justify="space-between" mb="xs">
                                                <Text size="md" fw={600}>🏢 {kc.name}</Text>
                                                <Badge variant="light" color="violet" size="sm">
                                                    {kc.status}
                                                </Badge>
                                            </Group>

                                            {kc.roadAddress && (
                                                <Text size="sm" c="dimmed" mb="xs">
                                                    {kc.roadAddress}
                                                </Text>
                                            )}

                                            <Divider my="xs" />

                                            <Stack gap="xs">
                                                {kc.saleType && (
                                                    <Group justify="space-between">
                                                        <Text size="sm" c="dimmed">분양유형</Text>
                                                        <Text size="sm" fw={600}>{kc.saleType}</Text>
                                                    </Group>
                                                )}
                                                {kc.landArea && (
                                                    <Group justify="space-between">
                                                        <Text size="sm" c="dimmed">대지면적</Text>
                                                        <Text size="sm">{kc.landArea.toLocaleString()}㎡</Text>
                                                    </Group>
                                                )}
                                                {kc.buildingArea && (
                                                    <Group justify="space-between">
                                                        <Text size="sm" c="dimmed">건축면적</Text>
                                                        <Text size="sm">{kc.buildingArea.toLocaleString()}㎡</Text>
                                                    </Group>
                                                )}
                                                {kc.floors && (
                                                    <Group justify="space-between">
                                                        <Text size="sm" c="dimmed">층수</Text>
                                                        <Text size="sm">{kc.floors}층</Text>
                                                    </Group>
                                                )}
                                                {kc.complexName && (
                                                    <Group justify="space-between">
                                                        <Text size="sm" c="dimmed">소속 단지</Text>
                                                        <Text size="sm">{kc.complexName}</Text>
                                                    </Group>
                                                )}
                                            </Stack>
                                        </div>
                                    ))}
                                </Stack>
                            </>
                        ) : (
                            <div style={{
                                padding: '40px 20px',
                                textAlign: 'center',
                                background: '#f8f9fa',
                                borderRadius: 8,
                            }}>
                                <Text size="sm" c="dimmed">
                                    이 필지에는 지식산업센터가 없습니다
                                </Text>
                            </div>
                        )}
                    </Stack>
                )}

                {/* 경매 탭 콘텐츠 */}
                {mainTab === 'auction' && (
                    <Stack gap="md">
                        {hasAuction ? (
                            <div style={{
                                background: '#fff5f5',
                                borderRadius: 12,
                                padding: 16,
                            }}>
                                <Text size="sm" c="dimmed" mb={4}>경매가</Text>
                                <Text size="xl" fw={700} c="red">
                                    {selectedParcel.auctionPrice?.toLocaleString()}만원
                                </Text>
                                <Text size="xs" c="dimmed">
                                    ({((selectedParcel.auctionPrice || 0) / 10000).toFixed(2)}억원)
                                </Text>
                                {selectedParcel.auctionFailCount !== undefined && selectedParcel.auctionFailCount > 0 && (
                                    <Badge size="sm" variant="filled" color="red" mt="xs">
                                        유찰 {selectedParcel.auctionFailCount}회
                                    </Badge>
                                )}
                                <Divider my="sm" />
                                <Text size="sm" c="dimmed" mb={4}>평당 가격</Text>
                                <Text size="md">
                                    {Math.round((selectedParcel.auctionPrice || 0) / (selectedParcel.area / 3.3058)).toLocaleString()}만원/평
                                </Text>
                            </div>
                        ) : (
                            <Text size="sm" c="dimmed" ta="center" py="xl">
                                경매 정보가 없습니다.
                            </Text>
                        )}
                    </Stack>
                )}
            </Box>

            {/* 하단 네비게이션 */}
            <Box
                style={{
                    position: 'sticky',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '70px',
                    backgroundColor: 'white',
                    borderTop: '1px solid #e9ecef',
                    display: 'flex',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                    padding: '0 10px',
                    zIndex: 10,
                    marginTop: 'auto',
                }}
            >
                {/* 지식산업센터 버튼 (있을 때만, 맨 앞에 표시) */}
                {hasKnowledgeCenter && (
                    <UnstyledButton
                        onClick={() => setMainTab('knowledgeCenter')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '8px',
                            color: mainTab === 'knowledgeCenter' ? '#7c3aed' : '#868e96',
                            transition: 'color 0.2s',
                            cursor: 'pointer',
                            position: 'relative',
                        }}
                    >
                        <IconBuilding size={24} stroke={1.5} />
                        <Text size="xs" mt={4} fw={mainTab === 'knowledgeCenter' ? 600 : 400}>
                            지산
                        </Text>
                        {(selectedParcel.knowledgeIndustryCenters?.length || 0) > 0 && (
                            <Badge
                                size="xs"
                                circle
                                color="violet"
                                style={{
                                    position: 'absolute',
                                    top: '5px',
                                    right: '20%',
                                }}
                            >
                                {selectedParcel.knowledgeIndustryCenters?.length}
                            </Badge>
                        )}
                    </UnstyledButton>
                )}

                {/* 기본정보 버튼 */}
                <UnstyledButton
                    onClick={() => setMainTab('basic')}
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '8px',
                        color: mainTab === 'basic' ? '#228be6' : '#868e96',
                        transition: 'color 0.2s',
                        cursor: 'pointer',
                    }}
                >
                    <IconHome size={24} stroke={1.5} />
                    <Text size="xs" mt={4} fw={mainTab === 'basic' ? 600 : 400}>
                        기본정보
                    </Text>
                </UnstyledButton>

                {/* 매물 버튼 */}
                {hasListing && (
                    <UnstyledButton
                        onClick={() => setMainTab('listing')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '8px',
                            color: mainTab === 'listing' ? '#40c057' : '#868e96',
                            transition: 'color 0.2s',
                            cursor: 'pointer',
                            position: 'relative',
                        }}
                    >
                        <IconTag size={24} stroke={1.5} />
                        <Text size="xs" mt={4} fw={mainTab === 'listing' ? 600 : 400}>
                            매물
                        </Text>
                    </UnstyledButton>
                )}

                {/* 입주기업 버튼 */}
                {hasFactory && (
                    <UnstyledButton
                        onClick={() => setMainTab('factory')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '8px',
                            color: mainTab === 'factory' ? '#ff6b35' : '#868e96',
                            transition: 'color 0.2s',
                            cursor: 'pointer',
                            position: 'relative',
                        }}
                    >
                        <IconBuildingFactory size={24} stroke={1.5} />
                        <Text size="xs" mt={4} fw={mainTab === 'factory' ? 600 : 400}>
                            입주기업
                        </Text>
                        {(selectedParcel.factories?.length || 0) > 0 && (
                            <Badge
                                size="xs"
                                circle
                                style={{
                                    position: 'absolute',
                                    top: '5px',
                                    right: '20%',
                                }}
                            >
                                {selectedParcel.factories?.length}
                            </Badge>
                        )}
                    </UnstyledButton>
                )}

                {/* 경매 버튼 */}
                {hasAuction && (
                    <UnstyledButton
                        onClick={() => setMainTab('auction')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '8px',
                            color: mainTab === 'auction' ? '#fa5252' : '#868e96',
                            transition: 'color 0.2s',
                            cursor: 'pointer',
                            position: 'relative',
                        }}
                    >
                        <IconGavel size={24} stroke={1.5} />
                        <Text size="xs" mt={4} fw={mainTab === 'auction' ? 600 : 400}>
                            경매
                        </Text>
                    </UnstyledButton>
                )}
            </Box>
        </Drawer>
    );
}
