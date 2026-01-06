'use client';

import { useMemo, useState, useEffect } from 'react';
import {
    Drawer,
    Box,
    Group,
    Text,
    ThemeIcon,
    Title,
    ScrollArea,
    UnstyledButton,
    Tabs,
    Badge,
} from '@mantine/core';
import {
    IconBuildingFactory2,
    IconCurrencyWon,
    IconChartBar,
    IconChevronDown,
    IconChevronRight,
    IconShoppingCart,
    IconRoad,
} from '@tabler/icons-react';
import { useAnalysisModal, useAnalysisModalActions, useActiveSidePanel, useSidePanelActions } from '@/lib/stores/ui-store';
import { useMapStore } from '@/lib/stores/map-store';
import { useDataStore } from '@/lib/stores/data-store';
import { ZOOM_SIG, ZOOM_PARCEL } from '@/lib/map/zoomConfig';
import { SIDE_PANEL_WIDTH, SIDE_PANEL_Z_INDEX } from '@/lib/constants/ui';
import { RegionDrilldownPopover } from '@/components/common/RegionDrilldown';
import { PriceAnalysis } from '@/components/analysis/PriceAnalysis';
import { IndustryAnalysis } from '@/components/analysis/IndustryAnalysis';
import { MarketAnalysis } from '@/components/analysis/MarketAnalysis';
import { InfraAnalysis } from '@/components/analysis/InfraAnalysis';

export default function AnalysisPanel() {
    const { open, target } = useAnalysisModal();
    const { setOpen, openModal } = useAnalysisModalActions();

    // 통합 패널 상태
    const activeSidePanel = useActiveSidePanel();
    const { openSidePanel, closeSidePanel } = useSidePanelActions();

    // DataStore - 데이터
    const districts = useDataStore((state) => state.districts);

    // MapStore - 지도 인스턴스
    const mapInstance = useMapStore((state) => state.mapInstance);

    // 드릴다운 팝오버 상태
    const [drilldownOpened, setDrilldownOpened] = useState(false);

    // 분석 모달이 열릴 때 통합 패널 열기
    useEffect(() => {
        if (open && target) {
            openSidePanel('analysis');
        }
    }, [open, target, openSidePanel]);

    const isOpen = activeSidePanel === 'analysis';

    const handleClose = () => {
        setOpen(false);
        closeSidePanel();
    };

    // 지역으로 이동하는 함수
    const moveToRegion = (coord: [number, number], zoomLevel: number) => {
        if (!mapInstance || !window.naver?.maps) return;

        const latlng = new window.naver.maps.LatLng(coord[1], coord[0]);
        mapInstance.setCenter(latlng);
        mapInstance.setZoom(zoomLevel);
    };

    // 드릴다운에서 지역 선택 시
    const handleRegionSelect = (level: 'sig' | 'emd', code: string, name: string, coord: [number, number]) => {
        const zoomLevel = level === 'sig' ? ZOOM_SIG.min + 1 : ZOOM_PARCEL.min;
        moveToRegion(coord, zoomLevel);
        // 분석 대상 변경
        openModal(level, code, name);
    };

    // 현재 시군구 이름 찾기 (emd인 경우)
    const currentSigName = useMemo(() => {
        if (!target) return '';
        if (target.level === 'sig') return target.name;

        // emd인 경우, 해당 읍면동이 속한 시군구 찾기
        const emdDistrict = districts.find(
            (d) => d.level === 'emd' && d.name === target.name
        );
        if (!emdDistrict?.code) return '';

        const sigCode = emdDistrict.code.substring(0, 5);
        const sigDistrict = districts.find(
            (d) => d.level === 'sig' && d.code?.startsWith(sigCode)
        );
        return sigDistrict?.name || '';
    }, [target, districts]);

    if (!target) return null;

    return (
        <Drawer
            opened={isOpen}
            onClose={handleClose}
            position="left"
            size={SIDE_PANEL_WIDTH}
            title={
                <Group gap="sm">
                    <ThemeIcon size="lg" variant="light" color="blue" radius="md">
                        <IconChartBar size={20} />
                    </ThemeIcon>
                    <Box>
                        {/* 지역 선택 드릴다운 */}
                        <RegionDrilldownPopover
                            opened={drilldownOpened}
                            onChange={setDrilldownOpened}
                            selectedSig={target.level === 'sig' ? target.name : currentSigName}
                            selectedEmd={target.level === 'emd' ? target.name : undefined}
                            onSelect={handleRegionSelect}
                            position="bottom-start"
                        >
                            <UnstyledButton
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    background: drilldownOpened ? '#f1f3f5' : 'transparent',
                                    transition: 'background 0.15s',
                                }}
                                onClick={() => setDrilldownOpened(!drilldownOpened)}
                            >
                                {target.level === 'emd' && (
                                    <>
                                        <Text size="sm" c="dimmed" fw={500}>{currentSigName}</Text>
                                        <IconChevronRight size={14} color="#868e96" />
                                    </>
                                )}
                                <Title order={4} style={{ lineHeight: 1.2 }}>{target.name}</Title>
                                <IconChevronDown
                                    size={16}
                                    color="#868e96"
                                    style={{
                                        transform: drilldownOpened ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s',
                                    }}
                                />
                            </UnstyledButton>
                        </RegionDrilldownPopover>
                        <Badge size="sm" variant="light" color="blue" mt={4}>
                            {target.level === 'sig' ? '시군구 분석' : '읍면동 분석'}
                        </Badge>
                    </Box>
                </Group>
            }
            styles={{
                header: {
                    paddingBottom: 16,
                    borderBottom: '1px solid #e9ecef',
                },
                body: { padding: 0 },
            }}
            withCloseButton
            withOverlay={false}
            lockScroll={false}
            trapFocus={false}
            zIndex={SIDE_PANEL_Z_INDEX}
        >
            <Tabs defaultValue="price" variant="pills" pt="md" px="md">
                <Tabs.List mb="lg" style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1, paddingBottom: 8 }}>
                    <Tabs.Tab value="price" leftSection={<IconCurrencyWon size={16} />}>
                        시세
                    </Tabs.Tab>
                    <Tabs.Tab value="market" leftSection={<IconShoppingCart size={16} />}>
                        시장
                    </Tabs.Tab>
                    <Tabs.Tab value="industry" leftSection={<IconBuildingFactory2 size={16} />}>
                        산업
                    </Tabs.Tab>
                    <Tabs.Tab value="infra" leftSection={<IconRoad size={16} />}>
                        인프라
                    </Tabs.Tab>
                </Tabs.List>

                {/* 시세 분석 탭 */}
                <Tabs.Panel value="price">
                    <ScrollArea h="calc(100vh - 180px)" px="md" pb="md">
                        <PriceAnalysis regionCode={target.code} regionLevel={target.level} />
                    </ScrollArea>
                </Tabs.Panel>

                {/* 시장 분석 탭 */}
                <Tabs.Panel value="market">
                    <ScrollArea h="calc(100vh - 180px)" px="md" pb="md">
                        <MarketAnalysis regionCode={target.code} regionLevel={target.level} />
                    </ScrollArea>
                </Tabs.Panel>

                {/* 산업 분석 탭 */}
                <Tabs.Panel value="industry">
                    <ScrollArea h="calc(100vh - 180px)" px="md" pb="md">
                        <IndustryAnalysis regionCode={target.code} regionLevel={target.level} />
                    </ScrollArea>
                </Tabs.Panel>

                {/* 인프라 분석 탭 */}
                <Tabs.Panel value="infra">
                    <ScrollArea h="calc(100vh - 180px)" px="md" pb="md">
                        <InfraAnalysis regionCode={target.code} regionLevel={target.level} />
                    </ScrollArea>
                </Tabs.Panel>
            </Tabs>
        </Drawer>
    );
}
