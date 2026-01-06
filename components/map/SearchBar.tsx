'use client';

import { useState, useCallback } from 'react';
import { TextInput, ActionIcon, Paper, Stack, Text, Group, Loader } from '@mantine/core';
import { IconSearch, IconX, IconMapPin } from '@tabler/icons-react';
import { useMapStore } from '@/lib/stores/map-store';
import { useDataStore } from '@/lib/stores/data-store';

interface SearchResult {
    type: 'parcel' | 'complex' | 'factory' | 'address';
    id: string;
    name: string;
    address?: string;
    coord: { lat: number; lng: number };
}

export default function SearchBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const map = useMapStore((state) => state.mapInstance);
    const { parcels, complexes, factories } = useDataStore();

    const handleSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults([]);
            return;
        }

        setLoading(true);
        const searchResults: SearchResult[] = [];

        // 1. 산업단지 검색
        if (complexes) {
            complexes
                .filter(c => c.name.includes(searchQuery))
                .slice(0, 5)
                .forEach(c => {
                    if (c.coord) {
                        searchResults.push({
                            type: 'complex',
                            id: c.id,
                            name: c.name,
                            address: c.address,
                            coord: c.coord,
                        });
                    }
                });
        }

        // 2. 공장 검색
        if (factories) {
            factories
                .filter(f => f.name.includes(searchQuery) || f.address?.includes(searchQuery))
                .slice(0, 5)
                .forEach(f => {
                    if (f.coord) {
                        searchResults.push({
                            type: 'factory',
                            id: f.id,
                            name: f.name,
                            address: f.address,
                            coord: f.coord,
                        });
                    }
                });
        }

        // 3. 주소 검색 (Kakao Geocoding API)
        if (searchQuery.length > 2) {
            try {
                const response = await fetch(`/api/geocoding?query=${encodeURIComponent(searchQuery)}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.documents && data.documents.length > 0) {
                        data.documents.slice(0, 3).forEach((doc: any) => {
                            searchResults.push({
                                type: 'address',
                                id: `addr_${doc.x}_${doc.y}`,
                                name: doc.address_name || doc.road_address_name,
                                coord: { lat: parseFloat(doc.y), lng: parseFloat(doc.x) },
                            });
                        });
                    }
                }
            } catch (error) {
                console.error('주소 검색 실패:', error);
            }
        }

        setResults(searchResults);
        setLoading(false);
    }, [complexes, factories]);

    const handleResultClick = useCallback((result: SearchResult) => {
        if (!map) return;

        // 지도 이동
        const naverMap = map as naver.maps.Map;
        naverMap.setCenter(new naver.maps.LatLng(result.coord.lat, result.coord.lng));
        naverMap.setZoom(result.type === 'complex' ? 14 : 16);

        // 검색 결과 닫기
        setShowResults(false);
        setQuery('');
        setResults([]);
    }, [map]);

    return (
        <Paper shadow="md" p="xs" style={{ position: 'relative', width: 400 }}>
            <TextInput
                placeholder="주소, 산업단지, 공장명 검색..."
                value={query}
                onChange={(e) => {
                    setQuery(e.currentTarget.value);
                    handleSearch(e.currentTarget.value);
                    setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                leftSection={<IconSearch size={16} />}
                rightSection={
                    loading ? (
                        <Loader size="xs" />
                    ) : query ? (
                        <ActionIcon
                            variant="subtle"
                            onClick={() => {
                                setQuery('');
                                setResults([]);
                                setShowResults(false);
                            }}
                        >
                            <IconX size={16} />
                        </ActionIcon>
                    ) : null
                }
            />

            {showResults && results.length > 0 && (
                <Paper
                    shadow="lg"
                    p="xs"
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        maxHeight: 300,
                        overflowY: 'auto',
                        zIndex: 1000,
                    }}
                >
                    <Stack gap="xs">
                        {results.map((result) => (
                            <Paper
                                key={result.id}
                                p="xs"
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleResultClick(result)}
                            >
                                <Group gap="xs">
                                    <IconMapPin size={16} color={
                                        result.type === 'complex' ? '#228be6' :
                                        result.type === 'factory' ? '#0d9488' : '#868e96'
                                    } />
                                    <div style={{ flex: 1 }}>
                                        <Text size="sm" fw={500}>{result.name}</Text>
                                        {result.address && (
                                            <Text size="xs" c="dimmed">{result.address}</Text>
                                        )}
                                    </div>
                                </Group>
                            </Paper>
                        ))}
                    </Stack>
                </Paper>
            )}
        </Paper>
    );
}
