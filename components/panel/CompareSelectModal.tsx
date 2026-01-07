'use client';

import { Modal, Stack, Text, Button, Group, Paper, Badge, Checkbox, Alert, ScrollArea, SimpleGrid } from '@mantine/core';
import { IconScale, IconAlertCircle, IconStar, IconCheck } from '@tabler/icons-react';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
import { useCompareSelectModalOpen, useCompareSelectModalActions, useComparePanelActions } from '@/lib/stores/ui-store';
import { useState, useEffect } from 'react';
import type { ParcelDetail, IndustrialComplexDetail, Factory, KnowledgeIndustryCenter } from '@/types/data';

// 타입별 라벨과 색상
const TYPE_LABELS: Record<string, string> = {
    parcel: '필지',
    complex: '산업단지',
    factory: '공장',
    knowledge: '지산센터',
};

const TYPE_COLORS: Record<string, string> = {
    parcel: 'blue',
    complex: 'orange',
    factory: 'green',
    knowledge: 'violet',
};

// 아이템 정보 추출
function getItemInfo(item: any) {
    const data = item.data;
    const type = item.type;

    let name = '-';
    let address = '-';
    let price: number | null = null;
    let area: number | null = null;

    if (type === 'parcel') {
        const parcel = data as ParcelDetail;
        name = parcel.jibun || parcel.address || parcel.pnu || item.id;
        address = parcel.roadAddress || parcel.address || '-';
        price = parcel.listingPrice || parcel.transactionPrice || parcel.auctionPrice || null;
        area = parcel.area || null;
    } else if (type === 'complex') {
        const complex = data as IndustrialComplexDetail;
        name = complex.name;
        area = complex.area;
    } else if (type === 'factory') {
        const factory = data as Factory;
        name = factory.name;
        address = factory.address || '-';
        area = factory.area || null;
    } else if (type === 'knowledge') {
        const kc = data as KnowledgeIndustryCenter;
        name = kc.name;
        address = kc.roadAddress || kc.jibunAddress || '-';
        area = kc.landArea || null;
    }

    return { id: item.id, type, name, address, price, area };
}

interface CompareSelectModalProps {
    currentItemId?: string;  // 현재 선택된 필지 ID (비교 대상에서 제외)
}

export default function CompareSelectModal({ currentItemId }: CompareSelectModalProps) {
    const isOpen = useCompareSelectModalOpen();
    const { closeCompareSelectModal } = useCompareSelectModalActions();
    const { openComparePanel } = useComparePanelActions();

    const favorites = usePreferencesStore((state) => state.favorites);
    const compareList = usePreferencesStore((state) => state.compareList);
    const addToCompare = usePreferencesStore((state) => state.addToCompare);
    const removeFromCompare = usePreferencesStore((state) => state.removeFromCompare);
    const clearCompare = usePreferencesStore((state) => state.clearCompare);

    // 선택된 항목 ID 목록
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // 모달 열릴 때 이미 비교함에 있는 항목들로 초기화
    useEffect(() => {
        if (isOpen) {
            setSelectedIds(compareList.map(item => item.id));
        }
    }, [isOpen, compareList]);

    // 관심매물 목록 (현재 선택된 항목 제외)
    const availableItems = favorites.filter(item => item.id !== currentItemId);

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(i => i !== id);
            } else {
                if (prev.length >= 3) {
                    return prev;  // 최대 3개
                }
                return [...prev, id];
            }
        });
    };

    const handleConfirm = () => {
        // 기존 비교함 초기화
        clearCompare();

        // 선택된 항목들 비교함에 추가
        selectedIds.forEach(id => {
            const item = favorites.find(f => f.id === id);
            if (item) {
                addToCompare({
                    id: item.id,
                    type: item.type,
                    data: item.data,
                });
            }
        });

        closeCompareSelectModal();
        openComparePanel();
    };

    return (
        <Modal
            opened={isOpen}
            onClose={closeCompareSelectModal}
            title={
                <Group gap="xs">
                    <IconScale size={20} />
                    <Text fw={600}>비교할 매물 선택</Text>
                    <Badge size="sm" variant="light" color="blue">
                        {selectedIds.length}/3
                    </Badge>
                </Group>
            }
            size="lg"
            centered
        >
            <Stack gap="md">
                {availableItems.length === 0 ? (
                    <Stack align="center" py="xl">
                        <IconStar size={48} color="#adb5bd" />
                        <Text c="dimmed" ta="center">
                            관심매물이 없습니다
                        </Text>
                        <Text size="xs" c="dimmed" ta="center">
                            먼저 관심 버튼을 눌러 매물을 추가해주세요
                        </Text>
                    </Stack>
                ) : (
                    <>
                        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light" py="xs">
                            <Text size="xs">관심매물 중 최대 3개까지 선택하여 비교할 수 있습니다</Text>
                        </Alert>

                        <ScrollArea h={400}>
                            <Stack gap="xs">
                                {availableItems.map(item => {
                                    const info = getItemInfo(item);
                                    const isSelected = selectedIds.includes(item.id);
                                    const isDisabled = !isSelected && selectedIds.length >= 3;

                                    return (
                                        <Paper
                                            key={item.id}
                                            p="sm"
                                            withBorder
                                            radius="md"
                                            style={{
                                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                opacity: isDisabled ? 0.5 : 1,
                                                borderColor: isSelected ? '#228be6' : undefined,
                                                backgroundColor: isSelected ? '#f0f9ff' : undefined,
                                            }}
                                            onClick={() => !isDisabled && handleToggleSelect(item.id)}
                                        >
                                            <Group justify="space-between" wrap="nowrap">
                                                <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onChange={() => {}}
                                                        disabled={isDisabled}
                                                        style={{ pointerEvents: 'none' }}
                                                    />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <Group gap="xs" mb={4}>
                                                            <Badge size="xs" color={TYPE_COLORS[info.type]} variant="light">
                                                                {TYPE_LABELS[info.type]}
                                                            </Badge>
                                                            {isSelected && (
                                                                <Badge size="xs" color="blue" variant="filled">
                                                                    선택됨
                                                                </Badge>
                                                            )}
                                                        </Group>
                                                        <Text size="sm" fw={600} lineClamp={1}>
                                                            {info.name}
                                                        </Text>
                                                        <Text size="xs" c="dimmed" lineClamp={1}>
                                                            {info.address}
                                                        </Text>
                                                    </div>
                                                </Group>
                                                <Stack gap={2} align="flex-end">
                                                    {info.price && (
                                                        <Text size="sm" fw={600} c="blue">
                                                            {info.price.toLocaleString()}만원
                                                        </Text>
                                                    )}
                                                    {info.area && (
                                                        <Text size="xs" c="dimmed">
                                                            {(info.area / 3.3058).toFixed(0)}평
                                                        </Text>
                                                    )}
                                                </Stack>
                                            </Group>
                                        </Paper>
                                    );
                                })}
                            </Stack>
                        </ScrollArea>

                        <Group justify="space-between">
                            <Button
                                variant="subtle"
                                color="gray"
                                onClick={() => setSelectedIds([])}
                                disabled={selectedIds.length === 0}
                            >
                                선택 초기화
                            </Button>
                            <Group gap="xs">
                                <Button variant="light" onClick={closeCompareSelectModal}>
                                    취소
                                </Button>
                                <Button
                                    leftSection={<IconCheck size={16} />}
                                    onClick={handleConfirm}
                                    disabled={selectedIds.length < 2}
                                >
                                    비교하기 ({selectedIds.length}개)
                                </Button>
                            </Group>
                        </Group>
                    </>
                )}
            </Stack>
        </Modal>
    );
}
