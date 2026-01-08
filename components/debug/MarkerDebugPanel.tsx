// components/debug/MarkerDebugPanel.tsx
// DOM 마커 vs Canvas 마커 비교 디버그 패널

'use client';

import { useState } from 'react';

export function MarkerDebugPanel() {
    const [isOpen, setIsOpen] = useState(true);

    // 테스트 데이터 (CanvasMarkerRenderer의 getTypeLabel()과 동일한 색상)
    // TYPE_INFO: factory=#8B5CF6, warehouse=#F59E0B, land=#10B981, knowledge-center=#3B82F6
    // 기본값 (propertyType 없을 때): #6B7280
    const testMarkers = [
        { typeLabel: '공장', typeColor: '#8B5CF6', price: '1.2억/평', dateStr: '24.03', areaPyeong: '150', isRecent: true, isSelected: false },
        { typeLabel: '창고', typeColor: '#F59E0B', price: '8,500만/평', dateStr: '24.01', areaPyeong: '80', isRecent: false, isSelected: false },
        { typeLabel: '토지', typeColor: '#10B981', price: '2.5억/평', dateStr: '23.12', areaPyeong: '200', isRecent: false, isSelected: false },
        { typeLabel: '토지', typeColor: '#6B7280', price: '1.8억/평', dateStr: '23.11', areaPyeong: '120', isRecent: false, isSelected: false, note: '(기본값)' },
        { typeLabel: '지산', typeColor: '#3B82F6', price: '3.8억/평', dateStr: '24.02', areaPyeong: '45', isRecent: true, isSelected: false },
        { typeLabel: '공장', typeColor: '#8B5CF6', price: '5.2억/평', dateStr: '24.03', areaPyeong: '300', isRecent: false, isSelected: true },
    ];

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: 20,
                    right: 20,
                    zIndex: 10000,
                    padding: '8px 16px',
                    background: '#3B82F6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: 14,
                    fontWeight: 500,
                }}
            >
                마커 디버그 열기
            </button>
        );
    }

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 20,
                right: 20,
                zIndex: 10000,
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                padding: 20,
                maxWidth: 400,
                maxHeight: '80vh',
                overflow: 'auto',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>DOM 마커 디자인 확인</h3>
                <button
                    onClick={() => setIsOpen(false)}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 20,
                        color: '#666',
                    }}
                >
                    ×
                </button>
            </div>

            <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
                아래는 실제 DOM으로 렌더링된 마커입니다.<br />
                Canvas 마커와 동일해야 합니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {testMarkers.map((marker, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 11, color: '#999', width: 80 }}>
                            {marker.isSelected ? '선택됨' : marker.isRecent ? 'N뱃지' : (marker as any).note || '일반'}
                        </span>
                        {/* 실제 DOM 마커 */}
                        <DOMMarker {...marker} />
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 20, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
                <p style={{ fontSize: 11, color: '#666', margin: 0 }}>
                    <strong>확인 방법:</strong><br />
                    1. 위 DOM 마커와 지도의 Canvas 마커 비교<br />
                    2. 폰트, 색상, 그림자, 테두리 확인<br />
                    3. N 뱃지 위치 및 스타일 확인
                </p>
            </div>
        </div>
    );
}

// 실제 DOM 마커 컴포넌트 (CanvasMarkerRenderer의 HTML과 동일)
function DOMMarker({
    typeLabel,
    typeColor,
    price,
    dateStr,
    areaPyeong,
    isRecent,
    isSelected,
}: {
    typeLabel: string;
    typeColor: string;
    price: string;
    dateStr: string;
    areaPyeong: string;
    isRecent: boolean;
    isSelected: boolean;
}) {
    const markerStyle: React.CSSProperties = isSelected ? {
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 10px',
        background: '#ffffff',
        borderRadius: 6,
        border: '2px solid #3B82F6',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
        position: 'relative',
        lineHeight: 1.2,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } : {
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '4px 10px',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 100,
        border: '1px solid rgba(200, 200, 200, 0.8)',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
        position: 'relative',
        lineHeight: 1.2,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    };

    const priceStyle: React.CSSProperties = isSelected
        ? { fontWeight: 600, fontSize: 15, color: '#1F2937', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
        : { fontWeight: 500, fontSize: 12, color: '#374151', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' };

    return (
        <div style={markerStyle}>
            {/* N 뱃지 */}
            {isRecent && !isSelected && (
                <span style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    background: '#EF4444',
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 4px',
                    borderRadius: 3,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    border: '1.5px solid #fff',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}>
                    N
                </span>
            )}

            {/* 첫째 줄: 유형 + 가격 */}
            <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                <span style={{
                    fontSize: 10,
                    color: typeColor,
                    fontWeight: 500,
                    marginRight: 4,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}>
                    {typeLabel}
                </span>
                <span style={priceStyle}>{price}</span>
            </div>

            {/* 둘째 줄: 날짜 + 평수 */}
            {(dateStr || areaPyeong) && (
                <div style={{
                    fontSize: 9,
                    color: '#9CA3AF',
                    marginTop: 1,
                    display: 'flex',
                    gap: 4,
                    justifyContent: 'center',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}>
                    {dateStr && <span>{dateStr}</span>}
                    {areaPyeong && <span>{areaPyeong}평</span>}
                </div>
            )}
        </div>
    );
}

export default MarkerDebugPanel;
