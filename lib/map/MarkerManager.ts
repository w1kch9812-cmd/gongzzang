// lib/map/MarkerManager.ts - 마커 풀링 및 생명주기 관리
// DOM 재사용으로 성능 최적화

import { logger } from '@/lib/utils/logger';

// ===== 타입 정의 =====

export type MarkerType =
    | 'transaction'
    | 'listing'
    | 'auction'
    | 'cluster-tx'      // 실거래 클러스터
    | 'cluster-prop'    // 매물/경매 클러스터
    | 'region'          // 행정구역
    | 'kc'              // 지식산업센터
    | 'kc-cluster'      // 지식산업센터 클러스터
    | 'kc-ad'           // 지식산업센터 광고
    | 'ic'              // 산업단지 (Industrial Complex)
    | 'ic-cluster'      // 산업단지 클러스터
    | 'ic-ad'           // 산업단지 광고
    | 'factory'         // 공장
    | 'factory-cluster' // 공장 클러스터
    | 'warehouse'       // 창고
    | 'warehouse-cluster' // 창고 클러스터
    | 'land'            // 토지
    | 'land-cluster';   // 토지 클러스터

export interface PooledMarker {
    marker: naver.maps.Marker;
    container: HTMLDivElement;
    type: MarkerType;
    cleanup?: () => void;
    contentHash?: string;  // 내용 해시 (변경 감지용)
}

interface MarkerPool {
    available: PooledMarker[];   // 사용 가능 (숨겨진 상태)
    inUse: Map<string, PooledMarker>;  // 사용 중 (markerId → marker)
}

// ===== 풀 크기 제한 설정 =====
// 메모리 누수 방지: 타입별 최대 풀 크기
const POOL_SIZE_LIMITS: Record<MarkerType, number> = {
    'transaction': 100,
    'listing': 100,
    'auction': 100,
    'cluster-tx': 50,
    'cluster-prop': 50,
    'region': 30,
    'kc': 50,
    'kc-cluster': 30,
    'kc-ad': 20,
    'ic': 50,
    'ic-cluster': 30,
    'ic-ad': 20,
    'factory': 200,        // 공장이 가장 많음
    'factory-cluster': 50,
    'warehouse': 100,
    'warehouse-cluster': 30,
    'land': 100,
    'land-cluster': 30,
};

// ===== 간단한 해시 함수 (내용 비교용) =====
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
}

// ===== MarkerManager 클래스 =====

export class MarkerManager {
    private pools: Map<MarkerType, MarkerPool> = new Map();
    private map: naver.maps.Map | null = null;
    private hoveredMarkerId: string | null = null;
    private destroyedCount: number = 0;  // 풀 초과로 파괴된 마커 수 (디버깅용)

    // ⚡ 성능 측정용 카운터
    private stats = {
        positionOnlyUpdates: 0,  // 위치만 업데이트 (내용 스킵)
        contentSkipped: 0,       // 해시 일치로 innerHTML 스킵
        contentUpdated: 0,       // innerHTML 실제 업데이트
        newCreated: 0,           // 새로 생성
    };

    constructor() {
        // 타입별 풀 초기화
        const types: MarkerType[] = [
            'transaction', 'listing', 'auction',
            'cluster-tx', 'cluster-prop', 'region', 'kc', 'kc-cluster', 'kc-ad',
            'ic', 'ic-cluster', 'ic-ad',
            'factory', 'factory-cluster', 'warehouse', 'warehouse-cluster', 'land', 'land-cluster',
        ];
        for (const type of types) {
            this.pools.set(type, { available: [], inUse: new Map() });
        }
    }

    /** 지도 인스턴스 설정 */
    setMap(map: naver.maps.Map | null): void {
        this.map = map;
    }

    /**
     * 마커 획득 (풀에서 가져오거나 새로 생성)
     * @param markerId 고유 마커 ID
     * @param type 마커 타입
     * @param position 위치
     * @param createContent 컨텐츠 생성 함수
     * @param anchor 앵커 포인트
     * @param baseZIndex z-index
     */
    acquire(
        markerId: string,
        type: MarkerType,
        position: naver.maps.LatLng,
        createContent: () => HTMLDivElement,
        anchor: naver.maps.Point,
        baseZIndex: number
    ): PooledMarker | null {
        if (!this.map) return null;

        const pool = this.pools.get(type);
        if (!pool) return null;

        // 이미 사용 중인 마커가 있으면 위치만 업데이트 (내용은 변경된 경우에만)
        const existing = pool.inUse.get(markerId);
        if (existing) {
            existing.marker.setPosition(position);
            // ⚡ 성능 최적화: markerId가 같으면 내용도 같음 (위치만 변경)
            // createContent() 호출 자체를 스킵!
            this.stats.positionOnlyUpdates++;
            return existing;
        }

        let pooledMarker: PooledMarker;

        // 새 컨텐츠 생성 (풀에서 가져오든 새로 만들든 필요)
        const newContent = createContent();
        const newHash = simpleHash(newContent.innerHTML);

        // 풀에서 가져오기
        if (pool.available.length > 0) {
            pooledMarker = pool.available.pop()!;

            // 위치 업데이트
            pooledMarker.marker.setPosition(position);

            // ⚡ 성능 최적화: 내용이 변경된 경우에만 innerHTML 업데이트
            if (pooledMarker.contentHash !== newHash) {
                pooledMarker.container.innerHTML = newContent.innerHTML;
                pooledMarker.container.style.cssText = newContent.style.cssText;
                pooledMarker.contentHash = newHash;
                this.stats.contentUpdated++;
            } else {
                this.stats.contentSkipped++;
            }

            pooledMarker.marker.setVisible(true);
            pooledMarker.marker.setZIndex(baseZIndex);
        } else {
            // 새로 생성
            const marker = new window.naver.maps.Marker({
                position,
                map: this.map,
                icon: { content: newContent, anchor },
                zIndex: baseZIndex,
            });

            pooledMarker = { marker, container: newContent, type, contentHash: newHash };
            this.stats.newCreated++;
        }

        // 사용 중으로 등록
        pool.inUse.set(markerId, pooledMarker);

        return pooledMarker;
    }

    /**
     * 마커 완전 파괴 (DOM 제거, 메모리 해제)
     */
    private destroyMarker(pooledMarker: PooledMarker): void {
        // cleanup 함수 호출
        if (pooledMarker.cleanup) {
            try {
                pooledMarker.cleanup();
            } catch (e) {
                logger.warn('[MarkerManager] destroy cleanup 실패:', e);
            }
            pooledMarker.cleanup = undefined;
        }

        // DOM 내용 비우기 (이벤트 리스너 자동 해제)
        if (pooledMarker.container) {
            pooledMarker.container.innerHTML = '';
        }

        // 지도에서 완전 제거
        pooledMarker.marker.setMap(null);
    }

    /**
     * 마커 반납 (풀로 돌려보냄, DOM 유지)
     * 풀이 가득 찬 경우 마커를 파괴하여 메모리 누수 방지
     * @param markerId 마커 ID
     * @param type 마커 타입
     */
    release(markerId: string, type: MarkerType): void {
        const pool = this.pools.get(type);
        if (!pool) return;

        const pooledMarker = pool.inUse.get(markerId);
        if (!pooledMarker) return;

        // 사용 중에서 제거
        pool.inUse.delete(markerId);

        // 메모리 누수 방지: cleanup 함수 안전하게 호출
        if (pooledMarker.cleanup) {
            try {
                pooledMarker.cleanup();
            } catch (e) {
                logger.warn(`[MarkerManager] cleanup 실패 (${markerId}):`, e);
            }
            pooledMarker.cleanup = undefined;
        }

        // 풀 크기 제한 확인
        const maxSize = POOL_SIZE_LIMITS[type] || 50;

        if (pool.available.length >= maxSize) {
            // 풀이 가득 찬 경우: 마커 완전 파괴 (메모리 해제)
            this.destroyMarker(pooledMarker);
            this.destroyedCount++;
        } else {
            // 풀에 여유 있음: 숨기고 풀에 반납
            pooledMarker.marker.setVisible(false);
            pool.available.push(pooledMarker);
        }

        // 호버 상태 초기화
        if (this.hoveredMarkerId === markerId) {
            this.hoveredMarkerId = null;
        }
    }

    /**
     * 현재 사용 중이 아닌 마커들 반납
     * @param type 마커 타입
     * @param currentIds 현재 사용 중인 ID 집합
     */
    releaseUnused(type: MarkerType, currentIds: Set<string>): void {
        const pool = this.pools.get(type);
        if (!pool) return;

        const toRelease: string[] = [];
        pool.inUse.forEach((_, id) => {
            if (!currentIds.has(id)) {
                toRelease.push(id);
            }
        });

        for (const id of toRelease) {
            this.release(id, type);
        }
    }

    /**
     * 모든 타입의 미사용 마커 반납
     * @param currentIdsByType 타입별 현재 사용 중인 ID
     */
    releaseAllUnused(currentIdsByType: Map<MarkerType, Set<string>>): void {
        for (const [type, pool] of this.pools) {
            const currentIds = currentIdsByType.get(type) || new Set();
            const toRelease: string[] = [];

            pool.inUse.forEach((_, id) => {
                if (!currentIds.has(id)) {
                    toRelease.push(id);
                }
            });

            for (const id of toRelease) {
                this.release(id, type);
            }
        }
    }

    /**
     * 호버 효과 설정 (z-index 올리기)
     * @param onHoverEnter 선택적 호버 진입 콜백
     * @param onHoverLeave 선택적 호버 이탈 콜백
     */
    setupHoverEffect(
        markerId: string,
        pooledMarker: PooledMarker,
        baseZIndex: number,
        clickHandler: (e: Event) => void,
        onHoverEnter?: () => void,
        onHoverLeave?: () => void
    ): void {
        const { marker, container } = pooledMarker;

        const handleEnter = () => {
            // 이전 호버 마커 z-index 복원
            if (this.hoveredMarkerId && this.hoveredMarkerId !== markerId) {
                // 이전 마커 찾아서 z-index 복원 (모든 풀에서)
                for (const pool of this.pools.values()) {
                    const prev = pool.inUse.get(this.hoveredMarkerId);
                    if (prev) {
                        prev.marker.setZIndex(baseZIndex);
                        break;
                    }
                }
            }
            marker.setZIndex(10000);
            this.hoveredMarkerId = markerId;
            // 커스텀 콜백 호출
            onHoverEnter?.();
        };

        const handleLeave = () => {
            marker.setZIndex(baseZIndex);
            if (this.hoveredMarkerId === markerId) {
                this.hoveredMarkerId = null;
            }
            // 커스텀 콜백 호출
            onHoverLeave?.();
        };

        // mousedown 이벤트도 차단하여 Mapbox GL 폴리곤 클릭과 충돌 방지
        const handleMouseDown = (e: Event) => {
            e.stopPropagation();
            // 전역 플래그 설정 (폴리곤 클릭 무시용)
            window.__markerClicking = true;
            setTimeout(() => { window.__markerClicking = false; }, 100);
        };

        container.addEventListener('mousedown', handleMouseDown);
        container.addEventListener('click', clickHandler);
        container.addEventListener('mouseenter', handleEnter);
        container.addEventListener('mouseleave', handleLeave);

        // cleanup 함수 저장
        pooledMarker.cleanup = () => {
            container.removeEventListener('mousedown', handleMouseDown);
            container.removeEventListener('click', clickHandler);
            container.removeEventListener('mouseenter', handleEnter);
            container.removeEventListener('mouseleave', handleLeave);
        };
    }

    /**
     * 특정 마커가 사용 중인지 확인
     */
    isInUse(markerId: string, type: MarkerType): boolean {
        const pool = this.pools.get(type);
        return pool?.inUse.has(markerId) ?? false;
    }

    /**
     * 사용 중인 마커 가져오기
     */
    getInUse(markerId: string, type: MarkerType): PooledMarker | undefined {
        const pool = this.pools.get(type);
        return pool?.inUse.get(markerId);
    }

    /**
     * 모든 마커 정리 (컴포넌트 언마운트 시)
     * 메모리 누수 방지: 모든 이벤트 리스너와 DOM 참조 완전 해제
     */
    dispose(): void {
        let cleanedCount = 0;

        for (const pool of this.pools.values()) {
            // 사용 중인 마커 정리
            pool.inUse.forEach((pm) => {
                // cleanup 함수 안전하게 호출
                if (pm.cleanup) {
                    try {
                        pm.cleanup();
                    } catch (e) {
                        logger.warn('[MarkerManager] dispose cleanup 실패:', e);
                    }
                    pm.cleanup = undefined;
                }

                // DOM 내용 비우기 (이벤트 리스너 자동 해제)
                if (pm.container) {
                    pm.container.innerHTML = '';
                }

                // 지도에서 제거
                pm.marker.setMap(null);
                cleanedCount++;
            });
            pool.inUse.clear();

            // 풀에 있는 마커 정리
            for (const pm of pool.available) {
                if (pm.cleanup) {
                    try {
                        pm.cleanup();
                    } catch (e) {
                        logger.warn('[MarkerManager] dispose cleanup 실패:', e);
                    }
                    pm.cleanup = undefined;
                }

                if (pm.container) {
                    pm.container.innerHTML = '';
                }

                pm.marker.setMap(null);
                cleanedCount++;
            }
            pool.available = [];
        }

        this.hoveredMarkerId = null;
        this.map = null; // 지도 참조도 해제
        logger.log(`[MarkerManager] disposed: ${cleanedCount}개 마커 정리됨`);
    }

    /**
     * 통계 로그
     */
    logStats(): void {
        const poolStats: Record<string, { available: number; inUse: number }> = {};

        for (const [type, pool] of this.pools) {
            poolStats[type] = {
                available: pool.available.length,
                inUse: pool.inUse.size,
            };
        }

        const totalAvailable = Object.values(poolStats).reduce((s, v) => s + v.available, 0);
        const totalInUse = Object.values(poolStats).reduce((s, v) => s + v.inUse, 0);

        // ⚡ 성능 최적화 효과 표시
        const { positionOnlyUpdates, contentSkipped, contentUpdated, newCreated } = this.stats;
        const totalOps = positionOnlyUpdates + contentSkipped + contentUpdated + newCreated;
        const savedOps = positionOnlyUpdates + contentSkipped;
        const savedPercent = totalOps > 0 ? Math.round((savedOps / totalOps) * 100) : 0;

        logger.log(`📊 [MarkerManager] 사용중: ${totalInUse}, 풀: ${totalAvailable} | 최적화: ${savedPercent}% 스킵 (위치만: ${positionOnlyUpdates}, 해시일치: ${contentSkipped}, 갱신: ${contentUpdated}, 신규: ${newCreated})`);

        // 통계 리셋 (다음 측정을 위해)
        this.stats = { positionOnlyUpdates: 0, contentSkipped: 0, contentUpdated: 0, newCreated: 0 };
    }
}

// 싱글톤 인스턴스 (선택적)
let instance: MarkerManager | null = null;

export function getMarkerManager(): MarkerManager {
    if (!instance) {
        instance = new MarkerManager();
    }
    return instance;
}

export function resetMarkerManager(): void {
    if (instance) {
        instance.dispose();
        instance = null;
    }
}
