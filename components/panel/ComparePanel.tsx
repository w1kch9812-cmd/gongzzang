'use client';

import { Drawer, Stack, Paper, Text, Button, Group, ActionIcon, Table, Badge, Alert, Title, Box, ScrollArea, SimpleGrid } from '@mantine/core';
import { IconX, IconAlertCircle, IconScale, IconTrash } from '@tabler/icons-react';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
import { useComparePanelOpen, useComparePanelActions } from '@/lib/stores/ui-store';
import { SIDE_PANEL_WIDTH, COMPARE_PANEL_WIDTH, SIDE_PANEL_Z_INDEX } from '@/lib/constants/ui';
import type { ParcelDetail, IndustrialComplexDetail, Factory, KnowledgeIndustryCenter } from '@/types/data';

// 비교 항목에서 표시할 데이터 추출
function extractCompareData(item: any) {
    const data = item.data;
    const type = item.type;

    // 공통 필드
    const result: Record<string, any> = {
        id: item.id,
        type: type,
        name: '-',
        address: '-',
        area: null,
        price: null,
        pricePerPyeong: null,
    };

    if (type === 'parcel') {
        const parcel = data as ParcelDetail;
        result.name = parcel.jibun || parcel.address || parcel.pnu || item.id;
        result.address = parcel.roadAddress || parcel.address || '-';
        result.area = parcel.area;
        result.price = parcel.listingPrice || parcel.transactionPrice || parcel.auctionPrice;
        result.landUseType = parcel.landUseType;
        result.officialLandPrice = parcel.officialLandPrice;
        // 건축물 정보
        if (parcel.buildingLedger) {
            result.buildingArea = parcel.buildingLedger.archArea;
            result.totalArea = parcel.buildingLedger.totArea;
            result.floors = `지상${parcel.buildingLedger.grndFlrCnt}층` +
                (parcel.buildingLedger.ugrndFlrCnt > 0 ? ` / 지하${parcel.buildingLedger.ugrndFlrCnt}층` : '');
            result.bcRat = parcel.buildingLedger.bcRat;
            result.vlRat = parcel.buildingLedger.vlRat;
            result.mainPurpose = parcel.buildingLedger.mainPurpsCdNm;
            result.useAprDay = parcel.buildingLedger.useAprDay;
        }
        // 토지 정보
        if (parcel.landLedger) {
            result.landCategory = parcel.landLedger.lndcgrCodeNm;
        }
        // 거래 정보
        if (parcel.transactionPrice) result.transactionPrice = parcel.transactionPrice;
        if (parcel.listingPrice) result.listingPrice = parcel.listingPrice;
        if (parcel.auctionPrice) {
            result.auctionPrice = parcel.auctionPrice;
            result.auctionFailCount = parcel.auctionFailCount;
        }
    } else if (type === 'complex') {
        const complex = data as IndustrialComplexDetail;
        result.name = complex.name;
        result.address = '-';
        result.area = complex.area;
        result.complexType = complex.type;
        result.status = complex.status;
        result.lots = complex.lots?.length || 0;
        result.industries = complex.industries?.length || 0;
    } else if (type === 'factory') {
        const factory = data as Factory;
        result.name = factory.name;
        result.address = factory.address || '-';
        result.area = factory.area;
        result.businessType = factory.businessType;
        result.employeeCount = factory.employeeCount;
        result.buildingArea = factory.buildingArea;
    } else if (type === 'knowledge') {
        const kc = data as KnowledgeIndustryCenter;
        result.name = kc.name;
        result.address = kc.roadAddress || kc.jibunAddress || '-';
        result.area = kc.landArea;
        result.buildingArea = kc.buildingArea;
        result.floors = kc.floors ? `${kc.floors}층` : '-';
        result.status = kc.status;
        result.saleType = kc.saleType;
    }

    // 평당가 계산
    if (result.area && result.price) {
        result.pricePerPyeong = Math.round(result.price / (result.area / 3.3058));
    }

    return result;
}

// 타입별 색상
const TYPE_COLORS: Record<string, string> = {
    parcel: 'blue',
    complex: 'orange',
    factory: 'green',
    knowledge: 'violet',
};

const TYPE_LABELS: Record<string, string> = {
    parcel: '필지',
    complex: '산업단지',
    factory: '공장',
    knowledge: '지산센터',
};

export default function ComparePanel() {
    const comparePanelOpen = useComparePanelOpen();
    const { closeComparePanel } = useComparePanelActions();
    const compareList = usePreferencesStore((state) => state.compareList);
    const removeFromCompare = usePreferencesStore((state) => state.removeFromCompare);
    const clearCompare = usePreferencesStore((state) => state.clearCompare);

    const items = compareList.map(extractCompareData);

    // 최저값 찾기 (비교용)
    const findMin = (key: string) => {
        const values = items.map(i => i[key]).filter(v => v !== null && v !== undefined && v !== '-');
        return values.length > 0 ? Math.min(...values) : null;
    };

    const findMax = (key: string) => {
        const values = items.map(i => i[key]).filter(v => v !== null && v !== undefined && v !== '-');
        return values.length > 0 ? Math.max(...values) : null;
    };

    const minPrice = findMin('price');
    const minPricePerPyeong = findMin('pricePerPyeong');
    const maxArea = findMax('area');

    // 비교 행 렌더링 헬퍼
    const renderRow = (label: string, key: string, formatter?: (val: any, item: any) => React.ReactNode, highlight?: 'min' | 'max') => {
        const compareValue = highlight === 'min' ? findMin(key) : highlight === 'max' ? findMax(key) : null;

        return (
            <Table.Tr>
                <Table.Td style={{ fontWeight: 500, background: '#f8f9fa' }}>{label}</Table.Td>
                {items.map((item) => {
                    const value = item[key];
                    const isHighlighted = highlight && compareValue !== null && value === compareValue;
                    return (
                        <Table.Td key={item.id}>
                            <Text
                                size="xs"
                                c={isHighlighted ? (highlight === 'min' ? 'green' : 'blue') : undefined}
                                fw={isHighlighted ? 700 : undefined}
                            >
                                {formatter ? formatter(value, item) : (value ?? '-')}
                            </Text>
                            {isHighlighted && (
                                <Badge size="xs" color={highlight === 'min' ? 'green' : 'blue'} variant="light" mt={2}>
                                    {highlight === 'min' ? '최저' : '최대'}
                                </Badge>
                            )}
                        </Table.Td>
                    );
                })}
            </Table.Tr>
        );
    };

    return (
        <Drawer
            opened={comparePanelOpen}
            onClose={closeComparePanel}
            position="left"
            size={COMPARE_PANEL_WIDTH}
            offset={SIDE_PANEL_WIDTH}
            title={
                <Group gap="xs">
                    <IconScale size={20} />
                    <Title order={4}>매물 비교</Title>
                    <Badge size="sm" variant="light" color="blue">
                        {compareList.length}/3
                    </Badge>
                </Group>
            }
            styles={{
                root: { zIndex: SIDE_PANEL_Z_INDEX - 1 },
                header: { padding: '16px 20px' },
                body: { padding: 0 },
                content: { pointerEvents: 'auto' }
            }}
            withCloseButton
            withOverlay={false}
            lockScroll={false}
            trapFocus={false}
        >
            <ScrollArea style={{ height: 'calc(100vh - 60px)' }}>
                <Stack p="md" gap="md">
                    {compareList.length === 0 ? (
                        <Stack align="center" justify="center" py="xl">
                            <IconScale size={48} color="#adb5bd" />
                            <Text size="sm" c="dimmed" ta="center">
                                비교할 매물이 없습니다
                            </Text>
                            <Text size="xs" c="dimmed" ta="center">
                                상세 패널에서 "비교" 버튼을 눌러<br />
                                최대 3개까지 비교할 수 있습니다
                            </Text>
                        </Stack>
                    ) : (
                        <>
                            {/* 상단 카드 - 비교 항목 요약 */}
                            <SimpleGrid cols={Math.min(items.length, 3)} spacing="xs">
                                {items.map((item, idx) => (
                                    <Paper key={item.id} p="sm" withBorder radius="md" style={{ position: 'relative' }}>
                                        <ActionIcon
                                            size="xs"
                                            variant="subtle"
                                            color="red"
                                            style={{ position: 'absolute', top: 4, right: 4 }}
                                            onClick={() => removeFromCompare(item.id)}
                                        >
                                            <IconX size={12} />
                                        </ActionIcon>
                                        <Badge size="xs" color={TYPE_COLORS[item.type]} variant="light" mb={4}>
                                            {TYPE_LABELS[item.type]}
                                        </Badge>
                                        <Text size="xs" fw={600} lineClamp={2} mb={4}>
                                            {item.name}
                                        </Text>
                                        {item.price && (
                                            <Text size="sm" fw={700} c={item.price === minPrice ? 'green' : 'blue'}>
                                                {item.price.toLocaleString()}만원
                                            </Text>
                                        )}
                                        {item.area && (
                                            <Text size="xs" c="dimmed">
                                                {(item.area / 3.3058).toFixed(0)}평
                                            </Text>
                                        )}
                                    </Paper>
                                ))}
                            </SimpleGrid>

                            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light" py="xs">
                                <Text size="xs">최저가/최대값이 강조 표시됩니다</Text>
                            </Alert>

                            {/* 비교 테이블 */}
                            <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                                <Table striped highlightOnHover fz="xs" verticalSpacing="xs">
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th style={{ minWidth: 70, background: '#f1f3f5' }}>항목</Table.Th>
                                            {items.map((item, idx) => (
                                                <Table.Th key={item.id} style={{ minWidth: 90, background: '#f1f3f5' }}>
                                                    <Text size="xs" fw={600}>매물 {idx + 1}</Text>
                                                </Table.Th>
                                            ))}
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {/* 기본 정보 */}
                                        {renderRow('유형', 'type', (v) => TYPE_LABELS[v] || v)}
                                        {renderRow('면적', 'area', (v) => v ? `${(v / 3.3058).toFixed(0)}평` : '-', 'max')}
                                        {renderRow('가격', 'price', (v) => v ? `${v.toLocaleString()}만원` : '-', 'min')}
                                        {renderRow('평당가', 'pricePerPyeong', (v) => v ? `${v.toLocaleString()}만원` : '-', 'min')}

                                        {/* 건물 정보 (있는 경우) */}
                                        {items.some(i => i.buildingArea) &&
                                            renderRow('건축면적', 'buildingArea', (v) => v ? `${v.toLocaleString()}㎡` : '-')}
                                        {items.some(i => i.totalArea) &&
                                            renderRow('연면적', 'totalArea', (v) => v ? `${v.toLocaleString()}㎡` : '-')}
                                        {items.some(i => i.floors) &&
                                            renderRow('층수', 'floors')}
                                        {items.some(i => i.bcRat) &&
                                            renderRow('건폐율', 'bcRat', (v) => v ? `${v.toFixed(1)}%` : '-')}
                                        {items.some(i => i.vlRat) &&
                                            renderRow('용적률', 'vlRat', (v) => v ? `${v.toFixed(1)}%` : '-')}
                                        {items.some(i => i.mainPurpose) &&
                                            renderRow('용도', 'mainPurpose')}
                                        {items.some(i => i.useAprDay) &&
                                            renderRow('사용승인일', 'useAprDay')}

                                        {/* 토지 정보 */}
                                        {items.some(i => i.landUseType) &&
                                            renderRow('용도지역', 'landUseType')}
                                        {items.some(i => i.landCategory) &&
                                            renderRow('지목', 'landCategory')}
                                        {items.some(i => i.officialLandPrice) &&
                                            renderRow('공시지가', 'officialLandPrice', (v) => v ? `${(v/10000).toFixed(1)}만원/㎡` : '-')}

                                        {/* 거래 정보 */}
                                        {items.some(i => i.transactionPrice) &&
                                            renderRow('실거래가', 'transactionPrice', (v) => v ? `${v.toLocaleString()}만원` : '-', 'min')}
                                        {items.some(i => i.listingPrice) &&
                                            renderRow('매물가', 'listingPrice', (v) => v ? `${v.toLocaleString()}만원` : '-', 'min')}
                                        {items.some(i => i.auctionPrice) &&
                                            renderRow('경매가', 'auctionPrice', (v) => v ? `${v.toLocaleString()}만원` : '-', 'min')}
                                        {items.some(i => i.auctionFailCount !== undefined) &&
                                            renderRow('유찰횟수', 'auctionFailCount', (v) => v !== undefined ? `${v}회` : '-')}

                                        {/* 산업단지 정보 */}
                                        {items.some(i => i.complexType) &&
                                            renderRow('단지유형', 'complexType')}
                                        {items.some(i => i.status) &&
                                            renderRow('상태', 'status')}
                                        {items.some(i => i.lots) &&
                                            renderRow('용지 수', 'lots')}
                                        {items.some(i => i.industries) &&
                                            renderRow('업종 수', 'industries')}

                                        {/* 공장 정보 */}
                                        {items.some(i => i.businessType) &&
                                            renderRow('업종', 'businessType')}
                                        {items.some(i => i.employeeCount) &&
                                            renderRow('종업원', 'employeeCount', (v) => v ? `${v}명` : '-')}

                                        {/* 지산센터 정보 */}
                                        {items.some(i => i.saleType) &&
                                            renderRow('분양유형', 'saleType')}
                                    </Table.Tbody>
                                </Table>
                            </Paper>

                            {/* 전체 삭제 버튼 */}
                            <Button
                                variant="light"
                                color="red"
                                size="sm"
                                leftSection={<IconTrash size={16} />}
                                onClick={() => clearCompare()}
                                fullWidth
                            >
                                비교 목록 전체 삭제
                            </Button>
                        </>
                    )}
                </Stack>
            </ScrollArea>
        </Drawer>
    );
}
