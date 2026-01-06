'use client';

import React, { memo } from 'react';

export type OffscreenTargetType = 'industrial-complex' | 'knowledge-center';

interface OffscreenIndicatorProps {
    name: string;
    type: OffscreenTargetType;
    edge: 'top' | 'right' | 'bottom' | 'left';
    position: number;
    distance: number;
    distanceRatio: number;
    angle: number;
    subInfo?: string;
    thumbnailUrl?: string;
    phoneNumber?: string;
    onClick: () => void;
}

// 거리 포맷팅 (m -> km 변환)
function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
}

// 타입별 색상 (기존 광고 마커 스타일과 일치 - 다크 테마)
const TYPE_COLORS: Record<OffscreenTargetType, { primary: string; glow: string }> = {
    'industrial-complex': {
        primary: '#ff6b35',
        glow: 'rgba(255, 107, 53, 0.4)',
    },
    'knowledge-center': {
        primary: '#0066FF',
        glow: 'rgba(0, 102, 255, 0.4)',
    },
};

function OffscreenIndicatorInner({
    name,
    type,
    edge,
    position,
    distance,
    distanceRatio,
    angle,
    subInfo,
    thumbnailUrl,
    phoneNumber,
    onClick,
}: OffscreenIndicatorProps) {
    const colors = TYPE_COLORS[type];

    // 거리에 따른 투명도 (가까울수록 불투명)
    const opacity = Math.max(0.6, 1 - distanceRatio * 0.4);

    // 거리에 따른 크기 (가까울수록 큼)
    const scale = Math.max(0.75, 1 - distanceRatio * 0.25);

    // 위치 스타일 계산
    const positionStyle: React.CSSProperties = {
        position: 'absolute',
    };

    const offset = 8;

    switch (edge) {
        case 'top':
            positionStyle.top = offset;
            positionStyle.left = `${position}%`;
            positionStyle.transform = `translateX(-50%) scale(${scale})`;
            break;
        case 'bottom':
            positionStyle.bottom = offset;
            positionStyle.left = `${position}%`;
            positionStyle.transform = `translateX(-50%) scale(${scale})`;
            break;
        case 'left':
            positionStyle.left = offset;
            positionStyle.top = `${position}%`;
            positionStyle.transform = `translateY(-50%) scale(${scale})`;
            break;
        case 'right':
            positionStyle.right = offset;
            positionStyle.top = `${position}%`;
            positionStyle.transform = `translateY(-50%) scale(${scale})`;
            break;
    }

    const displayName = name.length > 10 ? name.substring(0, 10) + '...' : name;

    return (
        <div
            style={{
                ...positionStyle,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                opacity,
                transition: 'opacity 0.2s, transform 0.2s',
                zIndex: Math.round((1 - distanceRatio) * 100),
            }}
            onClick={onClick}
        >
            {/* 방향 화살표 */}
            <div
                style={{
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderBottom: `10px solid ${colors.primary}`,
                    transform: `rotate(${angle}deg)`,
                    transformOrigin: 'center center',
                    filter: `drop-shadow(0 0 4px ${colors.glow})`,
                }}
            />

            {/* 정보 카드 - 다크 테마 (기존 광고 마커 스타일) */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    background: '#222',
                    borderRadius: 10,
                    border: `1px solid ${colors.primary}80`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    overflow: 'hidden',
                    maxWidth: 180,
                }}
            >
                {/* 썸네일 */}
                {thumbnailUrl && (
                    <div
                        style={{
                            width: 48,
                            flexShrink: 0,
                            overflow: 'hidden',
                            borderRadius: '10px 0 0 10px',
                            alignSelf: 'stretch',
                        }}
                    >
                        <img
                            src={thumbnailUrl}
                            alt={name}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                            }}
                        />
                    </div>
                )}

                {/* 텍스트 정보 */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '6px 10px',
                        gap: 2,
                        justifyContent: 'center',
                    }}
                >
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#ffffff',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {displayName}
                    </span>
                    <div
                        style={{
                            display: 'flex',
                            gap: 6,
                            fontSize: 9,
                            color: '#9ca3af',
                        }}
                    >
                        <span style={{ color: colors.primary }}>{formatDistance(distance)}</span>
                        {subInfo && <span>· {subInfo}</span>}
                    </div>
                    {phoneNumber && (
                        <span
                            style={{
                                fontSize: 9,
                                color: '#9ca3af',
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                window.open(`tel:${phoneNumber}`);
                            }}
                        >
                            📞 {phoneNumber}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export const OffscreenIndicator = memo(OffscreenIndicatorInner);

export default OffscreenIndicator;
