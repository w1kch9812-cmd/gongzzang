'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { Box, Group, Text, Paper, ScrollArea, UnstyledButton, Popover } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { useDataStore } from '@/lib/stores/data-store';

interface RegionDrilldownProps {
    // 선택된 지역 (초기값)
    selectedSig?: string;
    selectedEmd?: string;
    // 선택 콜백
    onSelect: (level: 'sig' | 'emd', code: string, name: string, coord: [number, number]) => void;
    // 드릴다운 닫기 콜백
    onClose?: () => void;
}

export default function RegionDrilldown({
    selectedSig,
    selectedEmd,
    onSelect,
    onClose,
}: RegionDrilldownProps) {
    const districts = useDataStore((state) => state.districts);

    // 현재 선택된 시군구 코드
    const [activeSigCode, setActiveSigCode] = useState<string | null>(null);

    // 스크롤 영역 ref
    const sigScrollRef = useRef<HTMLDivElement>(null);
    const emdScrollRef = useRef<HTMLDivElement>(null);

    // 시군구 목록
    const sigList = useMemo(() => {
        return districts
            .filter((d) => d.level === 'sig')
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }, [districts]);

    // 선택된 시군구의 읍면동 목록
    const emdList = useMemo(() => {
        if (!activeSigCode) return [];

        return districts
            .filter((d) => d.level === 'emd' && d.code?.startsWith(activeSigCode))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }, [districts, activeSigCode]);

    // 초기 선택값 설정
    useEffect(() => {
        if (selectedSig) {
            const sigDistrict = districts.find(
                (d) => d.level === 'sig' && d.name === selectedSig
            );
            if (sigDistrict?.code) {
                setActiveSigCode(sigDistrict.code.substring(0, 5));
            }
        }
    }, [selectedSig, districts]);

    // 선택된 항목으로 스크롤
    useEffect(() => {
        // 시군구 스크롤
        if (selectedSig && sigScrollRef.current) {
            const sigIndex = sigList.findIndex(d => d.name === selectedSig);
            if (sigIndex >= 0) {
                const itemHeight = 37; // 대략적인 아이템 높이
                sigScrollRef.current.scrollTop = Math.max(0, sigIndex * itemHeight - 100);
            }
        }
    }, [selectedSig, sigList]);

    // 읍면동 스크롤 (activeSigCode 변경 시)
    useEffect(() => {
        if (selectedEmd && emdScrollRef.current && activeSigCode) {
            const emdIndex = emdList.findIndex(d => d.name === selectedEmd);
            if (emdIndex >= 0) {
                const itemHeight = 37;
                // +1 for "전체" option
                emdScrollRef.current.scrollTop = Math.max(0, (emdIndex + 1) * itemHeight - 100);
            }
        }
    }, [selectedEmd, emdList, activeSigCode]);

    // 시군구 클릭 (읍면동 목록 표시)
    const handleSigClick = (district: typeof sigList[0]) => {
        const code = district.code?.substring(0, 5) || '';
        setActiveSigCode(code);
    };

    // 시군구 선택 확정 (버튼 클릭)
    const handleSigSelect = (district: typeof sigList[0]) => {
        if (district.coord) {
            onSelect('sig', district.code?.substring(0, 5) || '', district.name, district.coord);
            onClose?.();
        }
    };

    // 읍면동 클릭 (바로 선택)
    const handleEmdClick = (district: typeof emdList[0]) => {
        if (district.coord) {
            onSelect('emd', district.code?.substring(0, 10) || '', district.name, district.coord);
            onClose?.();
        }
    };

    // 시군구 전체 선택 여부 (읍면동이 선택되지 않은 경우)
    const isFullSigSelected = selectedSig && !selectedEmd;

    const itemStyle = (isActive: boolean, isSelected: boolean) => ({
        padding: '8px 12px',
        cursor: 'pointer',
        background: isSelected ? '#e7f5ff' : isActive ? '#f1f3f5' : 'transparent',
        borderLeft: isSelected ? '3px solid #228be6' : '3px solid transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'background 0.1s',
    });

    return (
        <Paper
            shadow="md"
            radius="md"
            style={{
                width: 500,
                overflow: 'hidden',
            }}
        >
            {/* 헤더 */}
            <Box
                p="xs"
                style={{
                    background: '#f8f9fa',
                    borderBottom: '1px solid #e9ecef',
                }}
            >
                <Text size="sm" fw={600}>지역 선택</Text>
            </Box>

            {/* 드릴다운 본문 */}
            <Group gap={0} align="stretch" style={{ height: 280 }}>
                {/* 시군구 컬럼 */}
                <Box style={{ width: '50%', borderRight: '1px solid #e9ecef' }}>
                    <Box
                        p="xs"
                        style={{
                            borderBottom: '1px solid #e9ecef',
                            background: '#f8f9fa',
                        }}
                    >
                        <Text size="xs" c="red" fw={600}>시군구</Text>
                    </Box>
                    <ScrollArea h={240} viewportRef={sigScrollRef}>
                        {sigList.map((district) => {
                            const code = district.code?.substring(0, 5) || '';
                            const isActive = code === activeSigCode;
                            const isSelected = district.name === selectedSig;

                            return (
                                <UnstyledButton
                                    key={district.code || district.id}
                                    w="100%"
                                    style={itemStyle(isActive, isSelected)}
                                    onClick={() => handleSigClick(district)}
                                >
                                    <Text size="sm" fw={isSelected ? 600 : 400}>{district.name}</Text>
                                    <IconChevronRight size={14} color={isActive ? '#228be6' : '#adb5bd'} />
                                </UnstyledButton>
                            );
                        })}
                    </ScrollArea>
                </Box>

                {/* 읍면동 컬럼 */}
                <Box style={{ width: '50%' }}>
                    <Box
                        p="xs"
                        style={{
                            borderBottom: '1px solid #e9ecef',
                            background: '#f8f9fa',
                        }}
                    >
                        <Text size="xs" c="red" fw={600}>읍면동</Text>
                    </Box>
                    <ScrollArea h={240} viewportRef={emdScrollRef}>
                        {activeSigCode ? (
                            <>
                                {/* 시군구 전체 선택 옵션 */}
                                {(() => {
                                    const activeSig = sigList.find(d => d.code?.substring(0, 5) === activeSigCode);
                                    if (!activeSig) return null;
                                    // 현재 시군구가 선택되어 있고 읍면동이 선택되지 않은 경우 강조
                                    const isThisFullSelected = isFullSigSelected && activeSig.name === selectedSig;
                                    return (
                                        <UnstyledButton
                                            w="100%"
                                            style={itemStyle(false, !!isThisFullSelected)}
                                            onClick={() => handleSigSelect(activeSig)}
                                        >
                                            <Text size="sm" fw={isThisFullSelected ? 600 : 400}>
                                                {activeSig.name} 전체
                                            </Text>
                                        </UnstyledButton>
                                    );
                                })()}
                                {/* 읍면동 목록 */}
                                {emdList.map((district) => {
                                    const isSelected = district.name === selectedEmd;
                                    return (
                                        <UnstyledButton
                                            key={district.code || district.id}
                                            w="100%"
                                            style={itemStyle(false, isSelected)}
                                            onClick={() => handleEmdClick(district)}
                                        >
                                            <Text size="sm" fw={isSelected ? 600 : 400}>{district.name}</Text>
                                        </UnstyledButton>
                                    );
                                })}
                            </>
                        ) : (
                            <Box p="md">
                                <Text size="xs" c="dimmed" ta="center">
                                    시군구를 선택하세요
                                </Text>
                            </Box>
                        )}
                    </ScrollArea>
                </Box>
            </Group>

            {/* 하단 안내 */}
            <Box
                p="xs"
                style={{
                    background: '#f8f9fa',
                    borderTop: '1px solid #e9ecef',
                }}
            >
                <Text size="xs" c="dimmed">
                    시군구 선택 후 "전체" 또는 읍면동 선택
                </Text>
            </Box>
        </Paper>
    );
}

// Popover 래퍼 컴포넌트
interface RegionDrilldownPopoverProps {
    children: React.ReactNode;
    selectedSig?: string;
    selectedEmd?: string;
    onSelect: (level: 'sig' | 'emd', code: string, name: string, coord: [number, number]) => void;
    opened: boolean;
    onChange: (opened: boolean) => void;
    position?: 'top' | 'bottom' | 'bottom-start' | 'top-start';
}

export function RegionDrilldownPopover({
    children,
    selectedSig,
    selectedEmd,
    onSelect,
    opened,
    onChange,
    position = 'bottom-start',
    zIndex = 10020,
}: RegionDrilldownPopoverProps & { zIndex?: number }) {
    return (
        <Popover
            opened={opened}
            onChange={onChange}
            position={position}
            shadow="md"
            width="auto"
            zIndex={zIndex}
        >
            <Popover.Target>
                {children}
            </Popover.Target>
            <Popover.Dropdown p={0}>
                <RegionDrilldown
                    selectedSig={selectedSig}
                    selectedEmd={selectedEmd}
                    onSelect={onSelect}
                    onClose={() => onChange(false)}
                />
            </Popover.Dropdown>
        </Popover>
    );
}
