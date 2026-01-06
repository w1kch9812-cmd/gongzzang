'use client';

import { useState } from 'react';
import {
    Box,
    Group,
    Button,
    Popover,
    Stack,
    Text,
    NumberInput,
    Divider,
    ActionIcon,
    Paper,
} from '@mantine/core';
import {
    IconRefresh,
    IconChevronDown,
    IconCurrencyWon,
    IconRuler,
    IconAdjustments,
    IconBuilding,
    IconBuildingFactory2,
    IconBuildingWarehouse,
    IconMapPin,
} from '@tabler/icons-react';
import { useFilter, useFilterActions } from '@/lib/stores/filter-store';
import type { PropertyType } from '@/lib/stores/types';
import dynamic from 'next/dynamic';

const DetailedFilterModal = dynamic(() => import('./DetailedFilterModal'), { ssr: false });

// 가격 프리셋 (만원)
const PRICE_PRESETS = [
    { label: '5억 이하', min: 0, max: 50000 },
    { label: '5~10억', min: 50000, max: 100000 },
    { label: '10~20억', min: 100000, max: 200000 },
    { label: '20억 이상', min: 200000, max: null },
];

// 면적 프리셋 (평)
const AREA_PRESETS = [
    { label: '100평 이하', min: 0, max: 100 },
    { label: '100~300평', min: 100, max: 300 },
    { label: '300~500평', min: 300, max: 500 },
    { label: '500평 이상', min: 500, max: null },
];

// 매물유형 옵션
const PROPERTY_TYPES = [
    { value: 'all' as const, label: '전체', icon: IconMapPin, color: 'gray' },
    { value: 'knowledge-center' as const, label: '지식산업센터', icon: IconBuilding, color: 'violet' },
    { value: 'factory' as const, label: '공장', icon: IconBuildingFactory2, color: 'teal' },
    { value: 'warehouse' as const, label: '창고', icon: IconBuildingWarehouse, color: 'orange' },
    { value: 'land' as const, label: '토지', icon: IconMapPin, color: 'green' },
];

export default function TopFilterBar() {
    const filter = useFilter();
    const { setFilter, resetFilter } = useFilterActions();

    // Popover 상태
    const [propertyTypeOpen, setPropertyTypeOpen] = useState(false);
    const [priceOpen, setPriceOpen] = useState(false);
    const [areaOpen, setAreaOpen] = useState(false);
    const [detailedFilterOpen, setDetailedFilterOpen] = useState(false);

    // 각 필터의 활성화 상태
    const isPropertyTypeActive = filter.propertyTypes.length > 0;
    const isPriceActive = filter.priceMin !== null || filter.priceMax !== null;
    const isAreaActive = filter.areaMin !== null || filter.areaMax !== null;

    // 필터 활성화 여부
    const isFilterActive = isPropertyTypeActive || isPriceActive || isAreaActive;

    // 현재 선택된 매물유형 라벨
    const selectedPropertyType = filter.propertyTypes.length === 1
        ? PROPERTY_TYPES.find(t => t.value === filter.propertyTypes[0])
        : null;
    const propertyTypeLabel = filter.propertyTypes.length === 0
        ? '전체'
        : filter.propertyTypes.length === 1
            ? (selectedPropertyType?.label || '전체')
            : `${filter.propertyTypes.length}개 선택`;

    return (
        <Box
            style={{
                position: 'fixed',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10000,
                background: 'white',
                borderRadius: 12,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
                padding: '8px 12px',
                maxWidth: 'fit-content',
            }}
        >
            <Group gap="xs">
                {/* 매물유형 필터 */}
                <Popover
                    opened={propertyTypeOpen}
                    onChange={setPropertyTypeOpen}
                    position="bottom-start"
                    withArrow
                    shadow="md"
                >
                    <Popover.Target>
                        <Button
                            variant={isPropertyTypeActive ? 'filled' : 'light'}
                            color={isPropertyTypeActive ? 'blue' : 'gray'}
                            size="xs"
                            leftSection={<IconBuilding size={16} />}
                            rightSection={<IconChevronDown size={12} />}
                            onClick={() => setPropertyTypeOpen(!propertyTypeOpen)}
                        >
                            {isPropertyTypeActive ? propertyTypeLabel : '매물유형'}
                        </Button>
                    </Popover.Target>
                    <Popover.Dropdown>
                        <Stack gap="sm" style={{ minWidth: 320 }}>
                            <Text size="sm" fw={600}>매물유형 선택</Text>
                            <Group gap="xs">
                                {PROPERTY_TYPES.map((item) => {
                                    const Icon = item.icon;
                                    const isSelected = item.value === 'all'
                                        ? filter.propertyTypes.length === 0
                                        : filter.propertyTypes.includes(item.value as PropertyType);
                                    return (
                                        <Paper
                                            key={item.value}
                                            p="sm"
                                            radius="md"
                                            withBorder
                                            style={{
                                                cursor: 'pointer',
                                                borderColor: isSelected ? `var(--mantine-color-${item.color}-5)` : undefined,
                                                backgroundColor: isSelected ? `var(--mantine-color-${item.color}-0)` : undefined,
                                                flex: 1,
                                                minWidth: 80,
                                                textAlign: 'center',
                                            }}
                                            onClick={() => {
                                                // 'all' 선택 시 빈 배열, 그 외에는 단일 선택
                                                const newTypes = item.value === 'all'
                                                    ? []
                                                    : [item.value as PropertyType];
                                                setFilter({ propertyTypes: newTypes });
                                                setPropertyTypeOpen(false);
                                            }}
                                        >
                                            <Stack align="center" gap={4}>
                                                <Icon size={20} color={isSelected ? `var(--mantine-color-${item.color}-6)` : '#868e96'} />
                                                <Text size="xs" fw={isSelected ? 600 : 400}>{item.label}</Text>
                                            </Stack>
                                        </Paper>
                                    );
                                })}
                            </Group>
                        </Stack>
                    </Popover.Dropdown>
                </Popover>

                {/* 가격 필터 */}
                <Popover
                    opened={priceOpen}
                    onChange={setPriceOpen}
                    position="bottom-start"
                    withArrow
                    shadow="md"
                >
                    <Popover.Target>
                        <Button
                            variant={isPriceActive ? 'filled' : 'light'}
                            color={isPriceActive ? 'blue' : 'gray'}
                            size="xs"
                            leftSection={<IconCurrencyWon size={16} />}
                            rightSection={<IconChevronDown size={12} />}
                            onClick={() => setPriceOpen(!priceOpen)}
                        >
                            가격
                        </Button>
                    </Popover.Target>
                    <Popover.Dropdown>
                        <Stack gap="sm" style={{ minWidth: 320 }}>
                            <Text size="sm" fw={600}>가격 범위 (만원)</Text>

                            {/* 빠른 선택 */}
                            <Group gap="xs">
                                {PRICE_PRESETS.map((preset) => (
                                    <Button
                                        key={preset.label}
                                        size="xs"
                                        variant={
                                            filter.priceMin === preset.min && filter.priceMax === preset.max
                                                ? 'filled'
                                                : 'light'
                                        }
                                        onClick={() => {
                                            setFilter({ priceMin: preset.min, priceMax: preset.max });
                                        }}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                            </Group>

                            <Divider label="또는 직접 입력" labelPosition="center" />

                            {/* 직접 입력 */}
                            <Group gap="xs" grow>
                                <NumberInput
                                    placeholder="최소"
                                    value={filter.priceMin ?? ''}
                                    onChange={(value) =>
                                        setFilter({ priceMin: value === '' ? null : Number(value) })
                                    }
                                    min={0}
                                    step={1000}
                                    suffix=" 만원"
                                    size="sm"
                                    hideControls
                                />
                                <Text size="sm" c="dimmed" ta="center" mt={6}>~</Text>
                                <NumberInput
                                    placeholder="최대"
                                    value={filter.priceMax ?? ''}
                                    onChange={(value) =>
                                        setFilter({ priceMax: value === '' ? null : Number(value) })
                                    }
                                    min={0}
                                    step={1000}
                                    suffix=" 만원"
                                    size="sm"
                                    hideControls
                                />
                            </Group>
                        </Stack>
                    </Popover.Dropdown>
                </Popover>

                {/* 면적 필터 */}
                <Popover
                    opened={areaOpen}
                    onChange={setAreaOpen}
                    position="bottom-start"
                    withArrow
                    shadow="md"
                >
                    <Popover.Target>
                        <Button
                            variant={isAreaActive ? 'filled' : 'light'}
                            color={isAreaActive ? 'blue' : 'gray'}
                            size="xs"
                            leftSection={<IconRuler size={16} />}
                            rightSection={<IconChevronDown size={12} />}
                            onClick={() => setAreaOpen(!areaOpen)}
                        >
                            면적
                        </Button>
                    </Popover.Target>
                    <Popover.Dropdown>
                        <Stack gap="sm" style={{ minWidth: 320 }}>
                            <Text size="sm" fw={600}>면적 범위 (평)</Text>

                            {/* 빠른 선택 */}
                            <Group gap="xs">
                                {AREA_PRESETS.map((preset) => (
                                    <Button
                                        key={preset.label}
                                        size="xs"
                                        variant={
                                            filter.areaMin === preset.min && filter.areaMax === preset.max
                                                ? 'filled'
                                                : 'light'
                                        }
                                        onClick={() => {
                                            setFilter({ areaMin: preset.min, areaMax: preset.max });
                                        }}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                            </Group>

                            <Divider label="또는 직접 입력" labelPosition="center" />

                            {/* 직접 입력 */}
                            <Group gap="xs" grow>
                                <NumberInput
                                    placeholder="최소"
                                    value={filter.areaMin ?? ''}
                                    onChange={(value) =>
                                        setFilter({ areaMin: value === '' ? null : Number(value) })
                                    }
                                    min={0}
                                    suffix=" 평"
                                    size="sm"
                                    hideControls
                                />
                                <Text size="sm" c="dimmed" ta="center" mt={6}>~</Text>
                                <NumberInput
                                    placeholder="최대"
                                    value={filter.areaMax ?? ''}
                                    onChange={(value) =>
                                        setFilter({ areaMax: value === '' ? null : Number(value) })
                                    }
                                    min={0}
                                    suffix=" 평"
                                    size="sm"
                                    hideControls
                                />
                            </Group>
                        </Stack>
                    </Popover.Dropdown>
                </Popover>

                {/* 상세 필터 버튼 */}
                <Button
                    variant="light"
                    color="gray"
                    size="xs"
                    leftSection={<IconAdjustments size={14} />}
                    onClick={() => setDetailedFilterOpen(true)}
                >
                    상세
                </Button>

                {/* 초기화 버튼 */}
                {isFilterActive && (
                    <>
                        <Divider orientation="vertical" />
                        <ActionIcon
                            variant="light"
                            color="gray"
                            size="md"
                            onClick={resetFilter}
                            title="필터 초기화"
                        >
                            <IconRefresh size={16} />
                        </ActionIcon>
                    </>
                )}
            </Group>

            {/* 상세 필터 모달 */}
            <DetailedFilterModal opened={detailedFilterOpen} onClose={() => setDetailedFilterOpen(false)} />
        </Box>
    );
}
