'use client';

import { useState } from 'react';
import { Stack, Paper, Text, Button, Textarea, Group, ActionIcon, Badge } from '@mantine/core';
import { IconX, IconScale, IconMapPin } from '@tabler/icons-react';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
import { useSelectionStore } from '@/lib/stores/selection-store';

export default function FavoritesPanel() {
    const favorites = usePreferencesStore((state) => state.favorites);
    const removeFromFavorites = usePreferencesStore((state) => state.removeFromFavorites);
    const updateFavoriteMemo = usePreferencesStore((state) => state.updateFavoriteMemo);
    const addToCompare = usePreferencesStore((state) => state.addToCompare);
    const isInCompare = usePreferencesStore((state) => state.isInCompare);
    const setSelection = useSelectionStore((state) => state.setSelection);

    const [editingMemo, setEditingMemo] = useState<string | null>(null);
    const [memoText, setMemoText] = useState('');

    const handleSaveMemo = (id: string) => {
        updateFavoriteMemo(id, memoText);
        setEditingMemo(null);
        setMemoText('');
    };

    const handleRemove = (id: string) => {
        if (confirm('관심 매물에서 삭제하시겠습니까?')) {
            removeFromFavorites(id);
        }
    };

    const handleAddToCompare = (item: typeof favorites[0]) => {
        if (isInCompare(item.id)) {
            alert('이미 비교함에 추가된 매물입니다.');
            return;
        }
        addToCompare({
            id: item.id,
            type: item.type,
            data: item.data,
        });
    };

    const handleViewOnMap = (item: typeof favorites[0]) => {
        setSelection({
            type: item.type,
            data: item.data as any,
        });
    };

    if (favorites.length === 0) {
        return (
            <Stack p="lg" align="center" justify="center" style={{ height: '100%' }}>
                <Text size="sm" c="dimmed" ta="center">
                    관심 매물이 없습니다
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                    매물을 클릭하고 ⭐ 버튼을 눌러보세요
                </Text>
            </Stack>
        );
    }

    return (
        <Stack p="md" gap="md">
            {favorites.map((item) => {
                const data = item.data as any;
                const name = data.name || data.id || item.id;
                const location = data.emd || data.sig || data.address || '';
                const area = data.area ? `${(data.area / 3.3058).toFixed(0)}평` : '';

                return (
                    <Paper key={item.id} p="sm" withBorder style={{ position: 'relative' }}>
                        {/* 삭제 버튼 */}
                        <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            style={{ position: 'absolute', top: 8, right: 8 }}
                            onClick={() => handleRemove(item.id)}
                        >
                            <IconX size={14} />
                        </ActionIcon>

                        {/* 제목 */}
                        <Text size="sm" fw={600} pr={24} lineClamp={1}>
                            {name}
                        </Text>

                        {/* 위치/면적 */}
                        <Group gap={4} mt={4}>
                            {location && (
                                <Badge size="xs" variant="light" color="gray">
                                    {location}
                                </Badge>
                            )}
                            {area && (
                                <Badge size="xs" variant="light" color="blue">
                                    {area}
                                </Badge>
                            )}
                        </Group>

                        {/* 메모 */}
                        {editingMemo === item.id ? (
                            <Stack gap="xs" mt="sm">
                                <Textarea
                                    placeholder="메모를 입력하세요 (왜 관심있는지...)"
                                    value={memoText}
                                    onChange={(e) => setMemoText(e.target.value)}
                                    size="xs"
                                    minRows={2}
                                    autoFocus
                                />
                                <Group gap="xs" justify="flex-end">
                                    <Button size="xs" variant="subtle" onClick={() => setEditingMemo(null)}>
                                        취소
                                    </Button>
                                    <Button size="xs" onClick={() => handleSaveMemo(item.id)}>
                                        저장
                                    </Button>
                                </Group>
                            </Stack>
                        ) : (
                            <div>
                                {item.memo ? (
                                    <Text
                                        size="xs"
                                        c="dimmed"
                                        mt="xs"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => {
                                            setEditingMemo(item.id);
                                            setMemoText(item.memo || '');
                                        }}
                                    >
                                        {item.memo}
                                    </Text>
                                ) : (
                                    <Button
                                        size="xs"
                                        variant="subtle"
                                        color="gray"
                                        mt="xs"
                                        onClick={() => {
                                            setEditingMemo(item.id);
                                            setMemoText('');
                                        }}
                                    >
                                        + 메모 추가
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* 액션 버튼 */}
                        <Group gap="xs" mt="sm">
                            <Button
                                size="xs"
                                variant="light"
                                color="blue"
                                leftSection={<IconMapPin size={14} />}
                                onClick={() => handleViewOnMap(item)}
                                style={{ flex: 1 }}
                            >
                                지도에서 보기
                            </Button>
                            <Button
                                size="xs"
                                variant="light"
                                color="gray"
                                leftSection={<IconScale size={14} />}
                                onClick={() => handleAddToCompare(item)}
                                disabled={isInCompare(item.id)}
                                style={{ flex: 1 }}
                            >
                                {isInCompare(item.id) ? '비교 중' : '비교함에 추가'}
                            </Button>
                        </Group>

                        {/* 추가 날짜 */}
                        <Text size="xs" c="dimmed" mt="xs">
                            추가: {new Date(item.addedAt).toLocaleDateString('ko-KR')}
                        </Text>
                    </Paper>
                );
            })}
        </Stack>
    );
}
