'use client';

import { Stack, Paper, Text, Button, Group, ActionIcon, Table, Badge, Alert } from '@mantine/core';
import { IconX, IconAlertCircle } from '@tabler/icons-react';
import { usePreferencesStore } from '@/lib/stores/preferences-store';

export default function ComparePanel() {
    const compareList = usePreferencesStore((state) => state.compareList);
    const removeFromCompare = usePreferencesStore((state) => state.removeFromCompare);
    const clearCompare = usePreferencesStore((state) => state.clearCompare);

    if (compareList.length === 0) {
        return (
            <Stack p="lg" align="center" justify="center" style={{ height: '100%' }}>
                <Text size="sm" c="dimmed" ta="center">
                    비교할 매물이 없습니다
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                    최대 3개까지 비교할 수 있습니다
                </Text>
            </Stack>
        );
    }

    const items = compareList.map((item) => {
        const data = item.data as any;
        return {
            id: item.id,
            name: data.name || item.id,
            location: data.emd || data.sig || data.address || '-',
            area: data.area ? (data.area / 3.3058).toFixed(0) : '-',
            price: data.transactionPrice || data.listingPrice || data.salePrice || '-',
            pricePerPyeong: data.area && (data.transactionPrice || data.listingPrice || data.salePrice)
                ? ((data.transactionPrice || data.listingPrice || data.salePrice) / (data.area / 3.3058)).toFixed(0)
                : '-',
            completionYear: data.completionYear || '-',
            floors: data.totalFloors ? `${data.totalFloors}층` : '-',
            parking: data.parkingSpaces ? `${data.parkingSpaces}대` : '-',
            cargoElevator: data.cargoElevator || 0,
            powerCapacity: data.powerCapacity ? `${data.powerCapacity}kW` : '-',
        };
    });

    return (
        <Stack p="md" gap="md">
            {/* 안내 & 초기화 */}
            <Group justify="space-between">
                <Badge size="sm" variant="light" color="blue">
                    {compareList.length}/3 비교 중
                </Badge>
                <Button size="xs" variant="subtle" color="red" onClick={() => clearCompare()}>
                    전체 삭제
                </Button>
            </Group>

            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                <Text size="xs">좌우로 스크롤하여 항목을 비교하세요</Text>
            </Alert>

            {/* 비교 테이블 */}
            <div style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover fz="xs">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th style={{ minWidth: 80 }}>항목</Table.Th>
                            {items.map((item, idx) => (
                                <Table.Th key={item.id} style={{ minWidth: 120 }}>
                                    <Group gap={4} wrap="nowrap">
                                        <Text size="xs" fw={600} lineClamp={1}>
                                            매물 {idx + 1}
                                        </Text>
                                        <ActionIcon
                                            size="xs"
                                            variant="subtle"
                                            color="red"
                                            onClick={() => removeFromCompare(item.id)}
                                        >
                                            <IconX size={12} />
                                        </ActionIcon>
                                    </Group>
                                </Table.Th>
                            ))}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        <Table.Tr>
                            <Table.Td>이름</Table.Td>
                            {items.map((item) => (
                                <Table.Td key={item.id}>
                                    <Text size="xs" lineClamp={2}>
                                        {item.name}
                                    </Text>
                                </Table.Td>
                            ))}
                        </Table.Tr>

                        <Table.Tr>
                            <Table.Td>위치</Table.Td>
                            {items.map((item) => (
                                <Table.Td key={item.id}>{item.location}</Table.Td>
                            ))}
                        </Table.Tr>

                        <Table.Tr>
                            <Table.Td>면적</Table.Td>
                            {items.map((item) => (
                                <Table.Td key={item.id}>
                                    <Text size="xs">{item.area}평</Text>
                                </Table.Td>
                            ))}
                        </Table.Tr>

                        <Table.Tr>
                            <Table.Td>가격</Table.Td>
                            {items.map((item) => {
                                const minPrice =
                                    item.price !== '-' ? Math.min(...items.map((i) => (i.price !== '-' ? i.price : Infinity))) : Infinity;
                                const isLowest = item.price !== '-' && item.price === minPrice;
                                return (
                                    <Table.Td key={item.id}>
                                        <Text size="xs" c={isLowest ? 'green' : undefined} fw={isLowest ? 700 : undefined}>
                                            {item.price !== '-' ? `${Number(item.price).toLocaleString()}만원` : '-'}
                                        </Text>
                                        {isLowest && (
                                            <Badge size="xs" color="green" variant="light">
                                                최저가
                                            </Badge>
                                        )}
                                    </Table.Td>
                                );
                            })}
                        </Table.Tr>

                        <Table.Tr>
                            <Table.Td>평당가</Table.Td>
                            {items.map((item) => {
                                const minPricePerPyeong =
                                    item.pricePerPyeong !== '-'
                                        ? Math.min(...items.map((i) => (i.pricePerPyeong !== '-' ? Number(i.pricePerPyeong) : Infinity)))
                                        : Infinity;
                                const isLowest = item.pricePerPyeong !== '-' && Number(item.pricePerPyeong) === minPricePerPyeong;
                                return (
                                    <Table.Td key={item.id}>
                                        <Text size="xs" c={isLowest ? 'green' : undefined} fw={isLowest ? 700 : undefined}>
                                            {item.pricePerPyeong !== '-' ? `${Number(item.pricePerPyeong).toLocaleString()}만원` : '-'}
                                        </Text>
                                    </Table.Td>
                                );
                            })}
                        </Table.Tr>

                        <Table.Tr>
                            <Table.Td>준공연도</Table.Td>
                            {items.map((item) => {
                                const maxYear =
                                    item.completionYear !== '-'
                                        ? Math.max(...items.map((i) => (i.completionYear !== '-' ? Number(i.completionYear) : -Infinity)))
                                        : -Infinity;
                                const isNewest = item.completionYear !== '-' && Number(item.completionYear) === maxYear;
                                return (
                                    <Table.Td key={item.id}>
                                        <Text size="xs" c={isNewest ? 'blue' : undefined} fw={isNewest ? 700 : undefined}>
                                            {item.completionYear}
                                        </Text>
                                        {isNewest && item.completionYear !== '-' && (
                                            <Badge size="xs" color="blue" variant="light">
                                                최신
                                            </Badge>
                                        )}
                                    </Table.Td>
                                );
                            })}
                        </Table.Tr>

                        <Table.Tr>
                            <Table.Td>층수</Table.Td>
                            {items.map((item) => (
                                <Table.Td key={item.id}>{item.floors}</Table.Td>
                            ))}
                        </Table.Tr>

                        <Table.Tr>
                            <Table.Td>주차</Table.Td>
                            {items.map((item) => (
                                <Table.Td key={item.id}>{item.parking}</Table.Td>
                            ))}
                        </Table.Tr>

                        <Table.Tr>
                            <Table.Td>화물엘베</Table.Td>
                            {items.map((item) => (
                                <Table.Td key={item.id}>
                                    {item.cargoElevator > 0 ? (
                                        <Badge size="xs" color="green" variant="light">
                                            {item.cargoElevator}대
                                        </Badge>
                                    ) : (
                                        <Text size="xs" c="dimmed">
                                            없음
                                        </Text>
                                    )}
                                </Table.Td>
                            ))}
                        </Table.Tr>

                        <Table.Tr>
                            <Table.Td>전력용량</Table.Td>
                            {items.map((item) => (
                                <Table.Td key={item.id}>{item.powerCapacity}</Table.Td>
                            ))}
                        </Table.Tr>
                    </Table.Tbody>
                </Table>
            </div>

            {/* 안내 텍스트 */}
            <Text size="xs" c="dimmed" ta="center">
                💡 가격/평당가는 최저가가 녹색으로 표시됩니다
            </Text>
        </Stack>
    );
}
