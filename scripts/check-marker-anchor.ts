// scripts/check-marker-anchor.ts
// 마커 앵커 포인트 검증 - DOM 크기와 앵커가 일치하는지 확인

import { JSDOM } from 'jsdom';

// 산업단지 마커 DOM 생성 (UnifiedMarkerLayer.tsx에서 복사)
function createIndustrialComplexMarkerDOM(
    name: string,
    status: string,
    completionRate: number,
    listingCount: number,
    auctionCount: number,
    salePricePerPyeong?: number
): HTMLDivElement {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const document = dom.window.document;

    const container = document.createElement('div');
    container.style.cssText = `display: inline-flex; flex-direction: column; align-items: center; cursor: pointer; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.2));`;

    // 이름 축약 (최대 8자)
    const displayName = name.length > 8 ? name.substring(0, 8) + '...' : name;
    const isComplete = status === '조성완료';

    // 매물/경매 뱃지 (파란색=매물, 빨간색=경매, 텍스트 포함)
    let statsHTML = '';
    if (isComplete && (listingCount > 0 || auctionCount > 0)) {
        statsHTML = `
            <div style="display: flex; gap: 3px;">
                ${listingCount > 0 ? `<span style="display: flex; align-items: center; gap: 2px; padding: 0 4px; height: 16px; background: #228be6; border-radius: 8px; font-size: 9px; font-weight: 600; color: white;"><span>${listingCount}</span><span style="font-size: 8px;">매물</span></span>` : ''}
                ${auctionCount > 0 ? `<span style="display: flex; align-items: center; gap: 2px; padding: 0 4px; height: 16px; background: #ef4444; border-radius: 8px; font-size: 9px; font-weight: 600; color: white;"><span>${auctionCount}</span><span style="font-size: 8px;">경매</span></span>` : ''}
            </div>
        `;
    } else if (!isComplete) {
        // 미완료: 상태 + 조성률%
        statsHTML = `<span style="font-size: 9px; color: rgba(255,255,255,0.9);">${status} ${completionRate}%</span>`;
    }

    // 분양가 (마커 내부에 작게)
    const priceText = salePricePerPyeong ? `<span style="font-size: 9px; color: rgba(255,255,255,0.8); margin-left: auto;">${salePricePerPyeong}만/평</span>` : '';

    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: #ff6b35; border-radius: 6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
            <span style="font-size: 11px; font-weight: 600; color: white; white-space: nowrap;">${displayName}</span>
            ${statsHTML}
            ${priceText}
        </div>
        <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #ff6b35;"></div>
    `;
    return container;
}

async function main() {
    console.log('🔍 마커 앵커 포인트 분석\n');

    // 예상 마커 크기 분석
    console.log('📏 산업단지 마커 예상 크기:');
    console.log('   메인 박스:');
    console.log('     - padding: 5px 8px (상하 5px, 좌우 8px)');
    console.log('     - SVG 아이콘: 12x12px');
    console.log('     - gap: 6px');
    console.log('     - 텍스트: 11px font → 약 15px line-height');
    console.log('     - 예상 높이: 5 + 15 + 5 = 25px');
    console.log('     - 예상 너비: 8 + 12 + 6 + (텍스트) + 8 = 34 + 텍스트');
    console.log('   화살표: 5px 높이');
    console.log('   총 높이: 25 + 5 = 30px\n');

    console.log('📍 현재 앵커 설정:');
    console.log('   개별 마커: Point(60, 35)');
    console.log('   클러스터:  Point(50, 35)\n');

    console.log('⚠️  문제점:');
    console.log('   - 앵커 Y값이 35인데 실제 마커 높이가 ~30px');
    console.log('   - 5px 차이로 마커가 아래로 이동됨');
    console.log('   - 이것만으로는 큰 오프셋을 설명할 수 없음\n');

    // 테스트 케이스
    const testCases = [
        { name: '남동', status: '조성중', rate: 93, listing: 0, auction: 0, price: 1073 },
        { name: '인천가좌지구', status: '조성완료', rate: 100, listing: 5, auction: 2 },
        { name: '시화MTV', status: '조성완료', rate: 100, listing: 0, auction: 0 },
    ];

    console.log('📊 예상 마커 너비:');
    for (const tc of testCases) {
        // 이름 부분: 아이콘(12) + gap(6) + 텍스트(~8chars * 6px) + padding(16)
        const displayName = tc.name.length > 8 ? tc.name.substring(0, 8) + '...' : tc.name;
        const textWidth = displayName.length * 7; // 대략적인 글자 너비

        let statsWidth = 0;
        if (tc.status === '조성완료' && (tc.listing > 0 || tc.auction > 0)) {
            // 뱃지들
            statsWidth = (tc.listing > 0 ? 40 : 0) + (tc.auction > 0 ? 40 : 0) + 3;
        } else if (tc.status !== '조성완료') {
            // 상태 텍스트
            statsWidth = 60;
        }

        const priceWidth = tc.price ? 60 : 0;
        const totalWidth = 8 + 12 + 6 + textWidth + 6 + statsWidth + priceWidth + 8;

        console.log(`   [${tc.name}] ~${totalWidth}px (앵커 X는 ${Math.round(totalWidth/2)}이어야 함)`);
    }

    console.log('\n✅ 권장 앵커 설정:');
    console.log('   - 동적으로 마커 크기를 계산하거나');
    console.log('   - CSS transform을 사용하여 중앙 정렬');
}

main().catch(console.error);
