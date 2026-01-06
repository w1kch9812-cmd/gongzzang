// components/debug/PerformanceMonitor.tsx - 실시간 성능 모니터링

'use client';

import { useEffect, useState, useRef } from 'react';
import { Paper, Text, Group, Stack, Progress, Badge, Divider, Accordion, Tooltip } from '@mantine/core';
import { useDataStore } from '@/lib/stores/data-store';
import { logger } from '@/lib/utils/logger';

interface PerformanceMetrics {
    fps: number;
    memoryUsed: number;
    memoryTotal: number;
    markerCount: number;
    renderTime: number;
    clusterTime: number;
}

interface MemoryBreakdown {
    storeData: number;
    domNodes: number;
    other: number;
    detailed: {
        react: number;
        mapEngine: number;
        uiLibs: number;
        other: number;
        utilities: {
            clustering: number;
            eventListeners: number;
            deckgl: number;
            other: number;
        };
    };
}

interface NetworkMetrics {
    totalTransferred: number;
    requestCount: number;
    dataTypes: {
        json: number;
        tiles: number;
        scripts: number;
        other: number;
    };
}

export function PerformanceMonitor() {
    const [metrics, setMetrics] = useState<PerformanceMetrics>({
        fps: 0,
        memoryUsed: 0,
        memoryTotal: 0,
        markerCount: 0,
        renderTime: 0,
        clusterTime: 0,
    });

    const frameCountRef = useRef(0);
    const lastTimeRef = useRef(performance.now());
    const parcels = useDataStore((state) => state.parcels);
    const factories = useDataStore((state) => state.factories);
    const knowledgeCenters = useDataStore((state) => state.knowledgeCenters);
    const industrialComplexes = useDataStore((state) => state.industrialComplexes);

    const [memoryBreakdown, setMemoryBreakdown] = useState<MemoryBreakdown>({
        storeData: 0,
        domNodes: 0,
        other: 0,
        detailed: {
            react: 0,
            mapEngine: 0,
            uiLibs: 0,
            other: 0,
            utilities: {
                clustering: 0,
                eventListeners: 0,
                deckgl: 0,
                other: 0,
            },
        },
    });

    const [networkMetrics, setNetworkMetrics] = useState<NetworkMetrics>({
        totalTransferred: 0,
        requestCount: 0,
        dataTypes: {
            json: 0,
            tiles: 0,
            scripts: 0,
            other: 0,
        },
    });

    // FPS 측정
    useEffect(() => {
        let animationId: number;

        const measureFps = () => {
            frameCountRef.current++;
            const now = performance.now();
            const elapsed = now - lastTimeRef.current;

            if (elapsed >= 1000) {
                const fps = Math.round((frameCountRef.current * 1000) / elapsed);
                setMetrics((prev) => ({ ...prev, fps }));
                frameCountRef.current = 0;
                lastTimeRef.current = now;
            }

            animationId = requestAnimationFrame(measureFps);
        };

        animationId = requestAnimationFrame(measureFps);
        return () => cancelAnimationFrame(animationId);
    }, []);

    // 메모리 측정 (Chrome only)
    useEffect(() => {
        const updateMemory = () => {
            const perf = (performance as any);
            if (perf.memory) {
                setMetrics((prev) => ({
                    ...prev,
                    memoryUsed: Math.round(perf.memory.usedJSHeapSize / 1024 / 1024),
                    memoryTotal: Math.round(perf.memory.totalJSHeapSize / 1024 / 1024),
                }));
            }
        };

        updateMemory();
        const intervalId = setInterval(updateMemory, 2000);
        return () => clearInterval(intervalId);
    }, []);

    // 마커 수 측정
    useEffect(() => {
        setMetrics((prev) => ({
            ...prev,
            markerCount: parcels.length,
        }));
    }, [parcels]);

    // 렌더링 시간 측정 (간단한 측정)
    useEffect(() => {
        const startTime = performance.now();
        return () => {
            const renderTime = performance.now() - startTime;
            if (renderTime > 0 && renderTime < 1000) {
                setMetrics((prev) => ({
                    ...prev,
                    renderTime: Math.round(renderTime),
                }));
            }
        };
    }, []); // 의존성 배열 추가 - 마운트 시 한 번만 실행

    // 메모리 분석 (스토어 데이터 크기 추정)
    useEffect(() => {
        const updateMemoryBreakdown = () => {
            // JSON.stringify로 대략적인 메모리 크기 측정 (bytes)
            const parcelsSize = JSON.stringify(parcels).length / 1024 / 1024;
            const factoriesSize = JSON.stringify(factories).length / 1024 / 1024;
            const kcSize = JSON.stringify(knowledgeCenters).length / 1024 / 1024;
            const complexSize = JSON.stringify(industrialComplexes).length / 1024 / 1024;
            const storeDataSize = parcelsSize + factoriesSize + kcSize + complexSize;

            // DOM 노드 크기 추정 (더 정확하게)
            const domNodesCount = document.querySelectorAll('*').length;
            const domNodesSize = domNodesCount * 0.005; // 노드당 ~5KB로 수정 (더 현실적)

            const perf = (performance as any);
            const totalMemory = perf.memory ? perf.memory.usedJSHeapSize / 1024 / 1024 : 0;

            // 기타 = 프레임워크 + 라이브러리 + 지도 엔진 + WebGL + 타일 캐시
            const otherMemory = Math.max(0, totalMemory - storeDataSize - domNodesSize);

            // 세밀한 기타 메모리 breakdown 추정
            // React Fiber 노드 수 추정 (실제 React 내부 구조)
            const fiberNodes = document.querySelectorAll('[data-reactroot], [data-reactid]').length || domNodesCount * 0.3;
            const reactMemory = Math.max(5, fiberNodes * 0.01); // React overhead: 최소 5MB

            // 지도 엔진 메모리 (naver.maps 전역 객체 + WebGL 컨텍스트)
            const hasMapCanvas = document.querySelectorAll('canvas').length;
            const mapEngineMemory = hasMapCanvas > 0 ? Math.max(15, hasMapCanvas * 8) : 0; // WebGL 캔버스당 ~8MB

            // UI 라이브러리 (Mantine Portal 수 + Recharts SVG)
            const portalNodes = document.querySelectorAll('[data-portal], .recharts-wrapper, .mantine-').length;
            const uiLibsMemory = Math.max(3, portalNodes * 0.05); // UI 라이브러리: 최소 3MB

            // 나머지 (타일 캐시, 이벤트 리스너, 클로저 등)
            const detailedOther = Math.max(0, otherMemory - reactMemory - mapEngineMemory - uiLibsMemory);

            // 유틸리티 메모리 상세 분석
            // Supercluster 클러스터링 인덱스 (마커 수 기반)
            const markerCount = parcels.length + factories.length + knowledgeCenters.length;
            const clusteringMemory = Math.max(2, (markerCount / 1000) * 0.5); // 1000개당 0.5MB

            // 이벤트 리스너 (실제 개수 추정)
            const eventTargets = document.querySelectorAll('[onclick], [onmouseenter], button, a, input').length;
            const eventListenersMemory = Math.max(1, eventTargets * 0.001); // 리스너당 ~1KB

            // Deck.gl WebGL 레이어 메모리 (캔버스 제외)
            const deckglLayers = hasMapCanvas > 0 ? Math.max(3, hasMapCanvas * 2) : 0; // 레이어당 ~2MB

            // 진짜 기타 (Zustand, 타일 캐시, 클로저 등)
            const utilsOther = Math.max(0, detailedOther - clusteringMemory - eventListenersMemory - deckglLayers);

            setMemoryBreakdown({
                storeData: Math.round(storeDataSize * 10) / 10,
                domNodes: Math.round(domNodesSize * 10) / 10,
                other: Math.round(otherMemory * 10) / 10,
                detailed: {
                    react: Math.round(reactMemory * 10) / 10,
                    mapEngine: Math.round(mapEngineMemory * 10) / 10,
                    uiLibs: Math.round(uiLibsMemory * 10) / 10,
                    other: Math.round(detailedOther * 10) / 10,
                    utilities: {
                        clustering: Math.round(clusteringMemory * 10) / 10,
                        eventListeners: Math.round(eventListenersMemory * 10) / 10,
                        deckgl: Math.round(deckglLayers * 10) / 10,
                        other: Math.round(utilsOther * 10) / 10,
                    },
                },
            });
        };

        updateMemoryBreakdown();
        const intervalId = setInterval(updateMemoryBreakdown, 5000);
        return () => clearInterval(intervalId);
    }, [parcels, factories, knowledgeCenters, industrialComplexes]);

    // 네트워크 모니터링
    useEffect(() => {
        if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

        try {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries() as PerformanceResourceTiming[];

                let totalTransferred = 0;
                let requestCount = 0;
                const dataTypes = { json: 0, tiles: 0, scripts: 0, other: 0 };

                entries.forEach((entry) => {
                    if (entry.transferSize) {
                        totalTransferred += entry.transferSize;
                        requestCount++;

                        // 리소스 타입 분류
                        if (entry.name.includes('.json')) {
                            dataTypes.json += entry.transferSize;
                        } else if (entry.name.includes('.pbf') || entry.name.includes('tiles') || entry.name.includes('.pmtiles')) {
                            dataTypes.tiles += entry.transferSize;
                        } else if (entry.name.includes('.js')) {
                            dataTypes.scripts += entry.transferSize;
                        } else {
                            dataTypes.other += entry.transferSize;
                        }
                    }
                });

                setNetworkMetrics((prev) => ({
                    totalTransferred: prev.totalTransferred + totalTransferred,
                    requestCount: prev.requestCount + requestCount,
                    dataTypes: {
                        json: prev.dataTypes.json + dataTypes.json,
                        tiles: prev.dataTypes.tiles + dataTypes.tiles,
                        scripts: prev.dataTypes.scripts + dataTypes.scripts,
                        other: prev.dataTypes.other + dataTypes.other,
                    },
                }));
            });

            observer.observe({ entryTypes: ['resource'] });
            return () => observer.disconnect();
        } catch (error) {
            logger.warn('PerformanceObserver not supported:', error);
        }
    }, []);

    // FPS 색상
    const getFpsColor = (fps: number) => {
        if (fps >= 55) return 'green';
        if (fps >= 30) return 'yellow';
        return 'red';
    };

    // 메모리 비율
    const memoryPercentage = metrics.memoryTotal > 0
        ? (metrics.memoryUsed / metrics.memoryTotal) * 100
        : 0;

    const getMemoryColor = (percentage: number) => {
        if (percentage < 60) return 'green';
        if (percentage < 80) return 'yellow';
        return 'red';
    };

    // 네트워크 부하 점수 계산 (0-100)
    const getNetworkScore = () => {
        const totalMB = networkMetrics.totalTransferred / 1024 / 1024;

        // 점수 기준: 0-10MB = 100점, 10-50MB = 80점, 50-100MB = 60점, 100MB+ = 40점
        if (totalMB < 10) return 100;
        if (totalMB < 50) return Math.round(100 - ((totalMB - 10) / 40) * 20);
        if (totalMB < 100) return Math.round(80 - ((totalMB - 50) / 50) * 20);
        return Math.max(40, Math.round(60 - ((totalMB - 100) / 100) * 20));
    };

    const getNetworkScoreColor = (score: number) => {
        if (score >= 80) return 'green';
        if (score >= 60) return 'yellow';
        return 'red';
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${Math.round(bytes / Math.pow(k, i) * 10) / 10} ${sizes[i]}`;
    };

    const networkScore = getNetworkScore();

    return (
        <Paper
            p="md"
            radius="md"
            withBorder
            style={{
                position: 'fixed',
                top: '80px',
                left: '16px',
                zIndex: 10000,
                minWidth: 280,
                backdropFilter: 'blur(8px)',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
            }}
        >
            <Stack gap="sm">
                <Text size="sm" fw={700}>⚡ 성능 모니터</Text>

                <Divider />

                {/* FPS */}
                <Group justify="space-between">
                    <Text size="xs" c="dimmed">FPS</Text>
                    <Badge color={getFpsColor(metrics.fps)} size="lg">
                        {metrics.fps}
                    </Badge>
                </Group>

                {/* 메모리 */}
                <div>
                    <Group justify="space-between" mb={4}>
                        <Text size="xs" c="dimmed">메모리</Text>
                        <Text size="xs" fw={600}>
                            {metrics.memoryUsed}MB / {metrics.memoryTotal}MB
                        </Text>
                    </Group>
                    <Progress
                        value={memoryPercentage}
                        color={getMemoryColor(memoryPercentage)}
                        size="sm"
                        radius="xl"
                    />
                </div>

                {/* 데이터 */}
                <Group justify="space-between">
                    <Text size="xs" c="dimmed">필지 수</Text>
                    <Text size="xs" fw={600}>
                        {metrics.markerCount.toLocaleString()}개
                    </Text>
                </Group>

                {/* 렌더링 시간 */}
                <Group justify="space-between">
                    <Text size="xs" c="dimmed">렌더링</Text>
                    <Text size="xs" fw={600} c={metrics.renderTime < 16 ? 'green' : 'yellow'}>
                        {metrics.renderTime}ms
                    </Text>
                </Group>

                <Divider />

                {/* 성능 점수 */}
                <div>
                    <Text size="xs" c="dimmed" mb={4}>성능 점수</Text>
                    <Group gap="xs">
                        {metrics.fps >= 55 && <Badge size="xs" color="green">우수</Badge>}
                        {metrics.fps >= 30 && metrics.fps < 55 && <Badge size="xs" color="yellow">보통</Badge>}
                        {metrics.fps < 30 && <Badge size="xs" color="red">개선 필요</Badge>}

                        {memoryPercentage < 60 && <Badge size="xs" color="green">메모리 양호</Badge>}
                        {memoryPercentage >= 80 && <Badge size="xs" color="red">메모리 부족</Badge>}
                    </Group>
                </div>

                {/* 권장 사항 */}
                {(metrics.fps < 30 || memoryPercentage >= 80) && (
                    <>
                        <Divider />
                        <Text size="xs" c="dimmed">
                            💡 성능 개선 팁:
                            <br />
                            {metrics.fps < 30 && '• 필터를 사용하여 마커 수 줄이기\n'}
                            {memoryPercentage >= 80 && '• 브라우저 탭 정리하기'}
                        </Text>
                    </>
                )}

                <Divider />

                {/* 상세 정보 (접을 수 있는) */}
                <Accordion variant="separated" radius="sm">
                    {/* 메모리 분석 */}
                    <Accordion.Item value="memory">
                        <Accordion.Control>
                            <Group justify="space-between" wrap="wrap">
                                <Text size="xs" fw={600}>메모리 분석</Text>
                                <Group gap={4}>
                                    <Badge size="sm" color="blue">데이터 {memoryBreakdown.storeData}MB</Badge>
                                    <Badge size="sm" color="teal">지도 {memoryBreakdown.detailed.mapEngine}MB</Badge>
                                    <Badge size="sm" color="orange">클러스터 {memoryBreakdown.detailed.utilities.clustering}MB</Badge>
                                </Group>
                            </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                            <Stack gap="xs">
                                <Group justify="space-between">
                                    <Text size="xs" c="dimmed">스토어 데이터</Text>
                                    <Text size="xs" fw={600}>{memoryBreakdown.storeData}MB</Text>
                                </Group>
                                <Progress
                                    value={(memoryBreakdown.storeData / metrics.memoryUsed) * 100}
                                    color="blue"
                                    size="xs"
                                />

                                <Group justify="space-between">
                                    <Text size="xs" c="dimmed">DOM 노드</Text>
                                    <Text size="xs" fw={600}>{memoryBreakdown.domNodes}MB</Text>
                                </Group>
                                <Progress
                                    value={(memoryBreakdown.domNodes / metrics.memoryUsed) * 100}
                                    color="cyan"
                                    size="xs"
                                />

                                <Divider my={6} />
                                <Text size="xs" c="dimmed" fw={600} mb={4}>기타 메모리 상세 ({memoryBreakdown.other}MB)</Text>

                                <Group justify="space-between">
                                    <Tooltip label="React Fiber 트리 + Virtual DOM + 이벤트 시스템">
                                        <Text size="xs" c="dimmed">React/Next.js</Text>
                                    </Tooltip>
                                    <Text size="xs" fw={600}>{memoryBreakdown.detailed.react}MB</Text>
                                </Group>
                                <Progress
                                    value={(memoryBreakdown.detailed.react / memoryBreakdown.other) * 100}
                                    color="indigo"
                                    size="xs"
                                />

                                <Group justify="space-between">
                                    <Tooltip label="Naver Maps GL + Mapbox GL + WebGL 컨텍스트 + 타일 캐시">
                                        <Text size="xs" c="dimmed">지도 엔진</Text>
                                    </Tooltip>
                                    <Text size="xs" fw={600}>{memoryBreakdown.detailed.mapEngine}MB</Text>
                                </Group>
                                <Progress
                                    value={(memoryBreakdown.detailed.mapEngine / memoryBreakdown.other) * 100}
                                    color="teal"
                                    size="xs"
                                />

                                <Group justify="space-between">
                                    <Tooltip label="Mantine UI + Recharts + 아이콘 라이브러리">
                                        <Text size="xs" c="dimmed">UI 라이브러리</Text>
                                    </Tooltip>
                                    <Text size="xs" fw={600}>{memoryBreakdown.detailed.uiLibs}MB</Text>
                                </Group>
                                <Progress
                                    value={(memoryBreakdown.detailed.uiLibs / memoryBreakdown.other) * 100}
                                    color="violet"
                                    size="xs"
                                />

                                <Divider my={6} />
                                <Text size="xs" c="dimmed" fw={600} mb={4}>유틸리티 상세 ({memoryBreakdown.detailed.other}MB)</Text>

                                <Group justify="space-between">
                                    <Tooltip label="Supercluster R-tree 인덱스 (마커 클러스터링)">
                                        <Text size="xs" c="dimmed">클러스터링</Text>
                                    </Tooltip>
                                    <Text size="xs" fw={600}>{memoryBreakdown.detailed.utilities.clustering}MB</Text>
                                </Group>
                                <Progress
                                    value={(memoryBreakdown.detailed.utilities.clustering / memoryBreakdown.detailed.other) * 100}
                                    color="orange"
                                    size="xs"
                                />

                                <Group justify="space-between">
                                    <Tooltip label="Deck.gl WebGL 레이어 (IconLayer, ScatterplotLayer)">
                                        <Text size="xs" c="dimmed">Deck.gl 레이어</Text>
                                    </Tooltip>
                                    <Text size="xs" fw={600}>{memoryBreakdown.detailed.utilities.deckgl}MB</Text>
                                </Group>
                                <Progress
                                    value={(memoryBreakdown.detailed.utilities.deckgl / memoryBreakdown.detailed.other) * 100}
                                    color="lime"
                                    size="xs"
                                />

                                <Group justify="space-between">
                                    <Tooltip label="DOM 이벤트 리스너 (click, hover 등)">
                                        <Text size="xs" c="dimmed">이벤트 리스너</Text>
                                    </Tooltip>
                                    <Text size="xs" fw={600}>{memoryBreakdown.detailed.utilities.eventListeners}MB</Text>
                                </Group>
                                <Progress
                                    value={(memoryBreakdown.detailed.utilities.eventListeners / memoryBreakdown.detailed.other) * 100}
                                    color="yellow"
                                    size="xs"
                                />

                                <Group justify="space-between">
                                    <Tooltip label="Zustand, 타일 캐시, 클로저, 기타 라이브러리">
                                        <Text size="xs" c="dimmed">기타</Text>
                                    </Tooltip>
                                    <Text size="xs" fw={600}>{memoryBreakdown.detailed.utilities.other}MB</Text>
                                </Group>
                                <Progress
                                    value={(memoryBreakdown.detailed.utilities.other / memoryBreakdown.detailed.other) * 100}
                                    color="gray"
                                    size="xs"
                                />
                            </Stack>
                        </Accordion.Panel>
                    </Accordion.Item>

                    {/* 네트워크 부하 */}
                    <Accordion.Item value="network">
                        <Accordion.Control>
                            <Group justify="space-between">
                                <Text size="xs" fw={600}>네트워크 부하</Text>
                                <Badge size="sm" color={getNetworkScoreColor(networkScore)}>
                                    {networkScore}점
                                </Badge>
                            </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                            <Stack gap="xs">
                                <Group justify="space-between">
                                    <Text size="xs" c="dimmed">총 전송량</Text>
                                    <Text size="xs" fw={600}>
                                        {formatBytes(networkMetrics.totalTransferred)}
                                    </Text>
                                </Group>

                                <Group justify="space-between">
                                    <Text size="xs" c="dimmed">요청 수</Text>
                                    <Text size="xs" fw={600}>{networkMetrics.requestCount}건</Text>
                                </Group>

                                <Divider my={4} />

                                <Text size="xs" c="dimmed" fw={600}>데이터 타입 분포</Text>

                                <Group justify="space-between">
                                    <Tooltip label="JSON 데이터 파일">
                                        <Text size="xs" c="dimmed">JSON</Text>
                                    </Tooltip>
                                    <Text size="xs">{formatBytes(networkMetrics.dataTypes.json)}</Text>
                                </Group>

                                <Group justify="space-between">
                                    <Tooltip label="지도 타일 (PMTiles, MVT)">
                                        <Text size="xs" c="dimmed">타일</Text>
                                    </Tooltip>
                                    <Text size="xs">{formatBytes(networkMetrics.dataTypes.tiles)}</Text>
                                </Group>

                                <Group justify="space-between">
                                    <Tooltip label="JavaScript 번들">
                                        <Text size="xs" c="dimmed">스크립트</Text>
                                    </Tooltip>
                                    <Text size="xs">{formatBytes(networkMetrics.dataTypes.scripts)}</Text>
                                </Group>

                                <Group justify="space-between">
                                    <Text size="xs" c="dimmed">기타</Text>
                                    <Text size="xs">{formatBytes(networkMetrics.dataTypes.other)}</Text>
                                </Group>
                            </Stack>
                        </Accordion.Panel>
                    </Accordion.Item>
                </Accordion>
            </Stack>
        </Paper>
    );
}
