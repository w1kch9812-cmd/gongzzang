'use client';

import { useState } from 'react';
import { Box, Image, Group, ActionIcon, Text, Modal, UnstyledButton } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconMap2, IconPhoto, IconMaximize } from '@tabler/icons-react';

interface ImageGalleryProps {
    images?: string[];
    roadviewCoord?: [number, number]; // [lng, lat]
    satelliteUrl?: string;
    address?: string;
}

export default function ImageGallery({ images = [], roadviewCoord, satelliteUrl, address }: ImageGalleryProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'image' | 'roadview' | 'satellite'>('image');
    const [fullscreenOpen, setFullscreenOpen] = useState(false);

    // 기본 플레이스홀더 이미지
    const defaultImages = [
        'https://via.placeholder.com/400x260/dee2e6/868e96?text=No+Image',
    ];
    const displayImages = images.length > 0 ? images : defaultImages;

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1));
    };

    // 네이버 로드뷰 URL 생성
    const getRoadviewUrl = () => {
        if (!roadviewCoord) return null;
        const [lng, lat] = roadviewCoord;
        return `https://map.naver.com/p/entry/address/${encodeURIComponent(address || '')}?c=${lng},${lat},15,0,0,0,dh`;
    };

    // 네이버 위성사진 URL
    const getSatelliteUrl = () => {
        if (!roadviewCoord) return satelliteUrl || null;
        const [lng, lat] = roadviewCoord;
        // 네이버 Static Map API (위성)
        return `https://naveropenapi.apigw.ntruss.com/map-static/v2/raster?w=400&h=260&center=${lng},${lat}&level=18&maptype=satellite`;
    };

    return (
        <>
            <Box style={{ position: 'relative', height: 200, background: '#dee2e6', overflow: 'hidden' }}>
                {/* 메인 이미지/로드뷰/위성 영역 */}
                {viewMode === 'image' && (
                    <Image
                        src={displayImages[currentIndex]}
                        alt={`이미지 ${currentIndex + 1}`}
                        height={200}
                        fit="cover"
                        fallbackSrc="https://via.placeholder.com/400x200/dee2e6/868e96?text=No+Image"
                    />
                )}

                {viewMode === 'roadview' && roadviewCoord && (
                    <Box
                        style={{
                            height: 200,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#f1f3f5',
                            cursor: 'pointer',
                        }}
                        onClick={() => {
                            const url = getRoadviewUrl();
                            if (url) window.open(url, '_blank');
                        }}
                    >
                        <Box ta="center">
                            <IconMap2 size={48} color="#868e96" />
                            <Text size="sm" c="dimmed" mt="xs">클릭하여 로드뷰 보기</Text>
                        </Box>
                    </Box>
                )}

                {viewMode === 'satellite' && (
                    <Box
                        style={{
                            height: 200,
                            background: `url(${getSatelliteUrl() || ''}) center/cover`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {!getSatelliteUrl() && (
                            <Text size="sm" c="dimmed">위성사진 없음</Text>
                        )}
                    </Box>
                )}

                {/* 이미지 네비게이션 (이미지 모드일 때만) */}
                {viewMode === 'image' && displayImages.length > 1 && (
                    <>
                        <ActionIcon
                            variant="filled"
                            color="dark"
                            radius="xl"
                            size="sm"
                            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}
                            onClick={handlePrev}
                        >
                            <IconChevronLeft size={14} />
                        </ActionIcon>
                        <ActionIcon
                            variant="filled"
                            color="dark"
                            radius="xl"
                            size="sm"
                            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
                            onClick={handleNext}
                        >
                            <IconChevronRight size={14} />
                        </ActionIcon>

                        {/* 인디케이터 */}
                        <Group
                            gap={4}
                            style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)' }}
                        >
                            {displayImages.map((_, idx) => (
                                <Box
                                    key={idx}
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: idx === currentIndex ? 'white' : 'rgba(255,255,255,0.5)',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => setCurrentIndex(idx)}
                                />
                            ))}
                        </Group>
                    </>
                )}

                {/* 전체화면 버튼 */}
                <ActionIcon
                    variant="filled"
                    color="dark"
                    radius="md"
                    size="sm"
                    style={{ position: 'absolute', right: 8, top: 8 }}
                    onClick={() => setFullscreenOpen(true)}
                >
                    <IconMaximize size={14} />
                </ActionIcon>

                {/* 하단 뷰 모드 선택 */}
                <Group
                    gap={0}
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'rgba(0,0,0,0.6)',
                    }}
                >
                    <UnstyledButton
                        onClick={() => setViewMode('image')}
                        style={{
                            flex: 1,
                            padding: '8px 0',
                            textAlign: 'center',
                            background: viewMode === 'image' ? 'rgba(255,255,255,0.1)' : 'transparent',
                        }}
                    >
                        <Group gap={4} justify="center">
                            <IconPhoto size={14} color="white" />
                            <Text size="xs" c="white">사진</Text>
                        </Group>
                    </UnstyledButton>
                    {roadviewCoord && (
                        <UnstyledButton
                            onClick={() => setViewMode('roadview')}
                            style={{
                                flex: 1,
                                padding: '8px 0',
                                textAlign: 'center',
                                background: viewMode === 'roadview' ? 'rgba(255,255,255,0.1)' : 'transparent',
                            }}
                        >
                            <Group gap={4} justify="center">
                                <IconMap2 size={14} color="white" />
                                <Text size="xs" c="white">로드뷰</Text>
                            </Group>
                        </UnstyledButton>
                    )}
                    <UnstyledButton
                        onClick={() => setViewMode('satellite')}
                        style={{
                            flex: 1,
                            padding: '8px 0',
                            textAlign: 'center',
                            background: viewMode === 'satellite' ? 'rgba(255,255,255,0.1)' : 'transparent',
                        }}
                    >
                        <Group gap={4} justify="center">
                            <IconMap2 size={14} color="white" />
                            <Text size="xs" c="white">위성</Text>
                        </Group>
                    </UnstyledButton>
                </Group>
            </Box>

            {/* 전체화면 모달 */}
            <Modal
                opened={fullscreenOpen}
                onClose={() => setFullscreenOpen(false)}
                fullScreen
                padding={0}
                withCloseButton={false}
            >
                <Box
                    style={{ height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setFullscreenOpen(false)}
                >
                    <Image
                        src={displayImages[currentIndex]}
                        alt="전체화면"
                        fit="contain"
                        style={{ maxHeight: '90vh' }}
                    />
                </Box>
            </Modal>
        </>
    );
}
