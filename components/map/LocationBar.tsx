'use client';

import { useMemo, useState } from 'react';
import { Box, Text, Button, ActionIcon, UnstyledButton } from '@mantine/core';
import { IconCurrentLocation, IconChevronRight, IconChartBar, IconChevronDown } from '@tabler/icons-react';
import { useMapStore, useCurrentLocation } from '@/lib/stores/map-store';
import { useDataStore } from '@/lib/stores/data-store';
import { useAnalysisModalActions } from '@/lib/stores/ui-store';
import { ZOOM_LEVELS } from '@/lib/config/map.config';
import { RegionDrilldownPopover } from '@/components/common/RegionDrilldown';
import { logger } from '@/lib/utils/logger';

export default function LocationBar() {
    const location = useCurrentLocation() || {
        sido: '인천광역시',
        sig: '남동구',
        emd: '구월동',
    };
    const currentZoom = useMapStore((state) => state.currentZoom);
    const districts = useDataStore((state) => state.districts);
    const mapInstance = useMapStore((state) => state.mapInstance);
    const { openModal } = useAnalysisModalActions();

    // 드릴다운 팝오버 상태
    const [drilldownOpened, setDrilldownOpened] = useState(false);

    // 현재 위치의 지역 코드 찾기
    const regionInfo = useMemo(() => {
        if (!location) return null;

        // 시군구 코드 찾기
        const sigDistrict = districts.find(
            (d) => d.level === 'sig' && d.name === location.sig
        );
        const sigCode = sigDistrict?.code?.substring(0, 5) || '';

        // 읍면동 코드 찾기
        const emdDistrict = districts.find(
            (d) => d.level === 'emd' && d.name === location.emd
        );
        const emdCode = emdDistrict?.code?.substring(0, 10) || '';

        return { sigCode, emdCode };
    }, [location, districts]);

    // 지역으로 이동하는 함수
    const moveToRegion = (coord: [number, number], zoomLevel: number) => {
        if (!mapInstance || !window.naver?.maps) return;

        const latlng = new window.naver.maps.LatLng(coord[1], coord[0]);
        mapInstance.setCenter(latlng);
        mapInstance.setZoom(zoomLevel);
    };

    // 드릴다운에서 지역 선택 시
    const handleRegionSelect = (level: 'sig' | 'emd', code: string, name: string, coord: [number, number]) => {
        const zoomLevel = level === 'sig' ? ZOOM_LEVELS.SIG.min + 1 : ZOOM_LEVELS.PARCEL.min;
        moveToRegion(coord, zoomLevel);
    };

    // 내 위치로 이동
    const handleMyLocation = () => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    if (mapInstance && window.naver?.maps) {
                        const latlng = new window.naver.maps.LatLng(latitude, longitude);
                        mapInstance.setCenter(latlng);
                        mapInstance.setZoom(ZOOM_LEVELS.PARCEL.min);
                    }
                },
                (error) => {
                    logger.error('위치 정보를 가져올 수 없습니다:', error);
                    alert('위치 정보를 가져올 수 없습니다. 위치 권한을 확인해주세요.');
                }
            );
        } else {
            alert('이 브라우저는 위치 정보를 지원하지 않습니다.');
        }
    };

    // 분석 버튼 클릭
    const handleAnalysis = () => {
        if (!regionInfo) return;

        // 줌 레벨에 따라 시군구 또는 읍면동 분석
        if (currentZoom >= ZOOM_LEVELS.EMD.min && location.emd && regionInfo.emdCode) {
            openModal('emd', regionInfo.emdCode, location.emd);
        } else if (currentZoom >= ZOOM_LEVELS.SIG.min && location.sig && regionInfo.sigCode) {
            openModal('sig', regionInfo.sigCode, location.sig);
        } else if (location.sig && regionInfo.sigCode) {
            // 기본적으로 시군구 분석
            openModal('sig', regionInfo.sigCode, location.sig);
        }
    };

    // 위치 표시 텍스트 생성
    const locationText = useMemo(() => {
        const parts = [location.sido];
        if (currentZoom >= ZOOM_LEVELS.SIG.min && location.sig) {
            parts.push(location.sig);
        }
        if (currentZoom >= ZOOM_LEVELS.EMD.min && location.emd) {
            parts.push(location.emd);
        }
        return parts;
    }, [location, currentZoom]);

    return (
        <Box
            style={{
                position: 'fixed',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                background: 'white',
                borderRadius: 12,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
            }}
        >
            {/* 내 위치 아이콘 버튼 */}
            <ActionIcon
                variant="light"
                color="blue"
                size="md"
                radius="md"
                onClick={handleMyLocation}
                title="내 위치로 이동"
            >
                <IconCurrentLocation size={16} />
            </ActionIcon>

            {/* 위치 드릴다운 */}
            <RegionDrilldownPopover
                opened={drilldownOpened}
                onChange={setDrilldownOpened}
                selectedSig={location.sig}
                selectedEmd={location.emd}
                onSelect={handleRegionSelect}
                position="top"
            >
                <UnstyledButton
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: drilldownOpened ? '#f1f3f5' : 'transparent',
                        transition: 'background 0.15s',
                    }}
                    onClick={() => setDrilldownOpened(!drilldownOpened)}
                >
                    {locationText.map((text, index) => (
                        <Box key={index} style={{ display: 'flex', alignItems: 'center' }}>
                            {index > 0 && <IconChevronRight size={12} color="#868e96" style={{ marginRight: 4 }} />}
                            <Text
                                size="xs"
                                c={index === locationText.length - 1 ? 'dark' : 'dimmed'}
                                fw={index === locationText.length - 1 ? 600 : 500}
                            >
                                {text}
                            </Text>
                        </Box>
                    ))}
                    <IconChevronDown
                        size={14}
                        color="#868e96"
                        style={{
                            marginLeft: 4,
                            transform: drilldownOpened ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                        }}
                    />
                </UnstyledButton>
            </RegionDrilldownPopover>

            {/* 이 지역 분석 버튼 */}
            <Button
                variant="light"
                color="blue"
                size="xs"
                leftSection={<IconChartBar size={14} />}
                onClick={handleAnalysis}
            >
                분석
            </Button>
        </Box>
    );
}
