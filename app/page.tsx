// app/page.tsx

'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// SSR 비활성화 (네이버 지도 API는 클라이언트에서만 동작)
const NaverMap = dynamic(
    () => import('@/components/map/NaverMap'),
    { ssr: false }
);

// DetailPanel 일반 import (상태 업데이트 구독을 위해)
import DetailPanel from '@/components/panel/DetailPanel';

// 상단 필터 바 (토스 인베스트 스타일)
const TopFilterBar = dynamic(
    () => import('@/components/panel/TopFilterBar'),
    { ssr: false }
);

// LayerControlPanel 동적 로드
const LayerControlPanel = dynamic(
    () => import('@/components/panel/LayerControlPanel'),
    { ssr: false }
);

// 위치 표시 바
const LocationBar = dynamic(
    () => import('@/components/map/LocationBar'),
    { ssr: false }
);

// 우측 사이드바 (관심 매물, 비교함, 최근 본)
const RightSidebar = dynamic(
    () => import('@/components/panel/RightSidebar'),
    { ssr: false }
);

// 지역 분석 패널
const AnalysisPanel = dynamic(
    () => import('@/components/panel/AnalysisPanel'),
    { ssr: false }
);

// 비교 패널
const ComparePanel = dynamic(
    () => import('@/components/panel/ComparePanel'),
    { ssr: false }
);

// 비교 선택 모달
const CompareSelectModal = dynamic(
    () => import('@/components/panel/CompareSelectModal'),
    { ssr: false }
);

// 숨겨진 마커 토스트
const HiddenMarkerToast = dynamic(
    () => import('@/components/map/HiddenMarkerToast'),
    { ssr: false }
);

// 검색 바
const SearchBar = dynamic(
    () => import('@/components/map/SearchBar'),
    { ssr: false }
);

function HomePageContent() {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
                    <p className="text-gray-600">지도 로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <main className="h-screen w-screen flex">
            {/* 메인 컨텐츠 영역 (지도 + 오버레이) */}
            <div className="flex-1 relative">
                {/* 상단 검색 바 (플로팅) */}
                <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 100 }}>
                    <SearchBar />
                </div>

                {/* 상단 필터 바 (플로팅) */}
                <TopFilterBar />

                {/* 지도 */}
                <NaverMap />

                {/* 패널들 */}
                <DetailPanel />
                <LayerControlPanel />

                {/* 숨겨진 마커 토스트 */}
                <HiddenMarkerToast />

                {/* 하단 위치 바 */}
                <LocationBar />
            </div>

            {/* 우측 사이드바 (레이아웃 일부) */}
            <RightSidebar />

            {/* 지역 분석 패널 */}
            <AnalysisPanel />

            {/* 비교 패널 */}
            <ComparePanel />

            {/* 비교 선택 모달 */}
            <CompareSelectModal />
        </main>
    );
}

export default function HomePage() {
    return <HomePageContent />;
}
