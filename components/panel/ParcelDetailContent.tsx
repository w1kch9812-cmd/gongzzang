'use client';

import { useState, useEffect, useMemo } from 'react';
import { Stack, Text, Badge, Group, Box, Button, Paper, ActionIcon, Divider, SimpleGrid, UnstyledButton, Tooltip, ScrollArea } from '@mantine/core';
import { IconStar, IconCopy, IconScale, IconMap, IconHome, IconGavel, IconBuildingFactory2, IconBuilding, IconCalendar, IconExternalLink, IconArrowsExchange, IconInfoCircle, IconX } from '@tabler/icons-react';
import { useHotkeys } from '@mantine/hooks';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
import { useComparePanelActions, useCompareSelectModalActions } from '@/lib/stores/ui-store';
import { useSelectionStore } from '@/lib/stores/selection-store';
import { useDataStore } from '@/lib/stores/data-store';
import type { ParcelDetail } from '@/types/data';
import ImageGallery from './ImageGallery';
import PriceChart from './PriceChart';

interface ParcelDetailContentProps {
    parcel: ParcelDetail;
    onClose?: () => void;
}

// 탭 타입
type TabType = 'land' | 'building' | 'transaction';
type MainTabType = 'basic' | 'listing' | 'factory' | 'knowledgeCenter' | 'auction';

// 정보 카드 아이템
function InfoCard({ label, value, subValue, highlight = false }: {
    label: string;
    value: string;
    subValue?: string;
    highlight?: boolean;
}) {
    return (
        <Paper p="sm" radius="md" withBorder style={{
            borderColor: highlight ? 'var(--mantine-color-blue-3)' : undefined,
            backgroundColor: highlight ? 'var(--mantine-color-blue-0)' : undefined,
        }}>
            <Text size="xs" c="dimmed" mb={4}>{label}</Text>
            <Text size="sm" fw={600}>{value}</Text>
            {subValue && <Text size="xs" c="dimmed">{subValue}</Text>}
        </Paper>
    );
}

export default function ParcelDetailContent({ parcel, onClose }: ParcelDetailContentProps) {
    const [activeTab, setActiveTab] = useState<TabType>('land');
    const [mainTab, setMainTab] = useState<MainTabType>('basic');

    // 마커 클릭으로 설정된 초기 탭 가져오기
    const parcelInitialTab = useSelectionStore((s) => s.parcelInitialTab);

    // ESC 키로 닫기
    useHotkeys([
        ['Escape', () => onClose?.()],
    ]);

    // 관심/비교 상태
    const addToFavorites = usePreferencesStore((s) => s.addToFavorites);
    const removeFromFavorites = usePreferencesStore((s) => s.removeFromFavorites);
    const isFavorite = usePreferencesStore((s) => s.isFavorite);
    const addToCompare = usePreferencesStore((s) => s.addToCompare);
    const isInCompare = usePreferencesStore((s) => s.isInCompare);

    const { toggleComparePanel } = useComparePanelActions();
    const { openCompareSelectModal } = useCompareSelectModalActions();

    // 필지 데이터 (주변 유사매물 비교용)
    const parcels = useDataStore((s) => s.parcels);

    // 주변 유사매물 찾기 (같은 지목, 비슷한 면적)
    const similarParcels = useMemo(() => {
        if (!parcel.area || !parcel.landLedger?.lndcgrCodeNm) return [];

        const areaMin = parcel.area * 0.7;
        const areaMax = parcel.area * 1.3;
        const landType = parcel.landLedger.lndcgrCodeNm;

        return parcels
            .filter(p =>
                p.id !== parcel.id &&
                p.area &&
                p.area >= areaMin &&
                p.area <= areaMax &&
                (p.transactionPrice || p.listingPrice || p.auctionPrice)
            )
            .slice(0, 3);
    }, [parcel, parcels]);

    // 데이터 체크
    const hasTransaction = parcel.transactionPrice && parcel.transactionPrice > 0;
    const hasListing = parcel.listingPrice && parcel.listingPrice > 0;
    const hasAuction = parcel.auctionPrice && parcel.auctionPrice > 0;
    const hasBuilding = parcel.buildingLedger;
    const hasLand = parcel.landLedger;
    const hasFactory = parcel.factories && parcel.factories.length > 0;
    const hasKnowledgeCenter = parcel.knowledgeIndustryCenters && parcel.knowledgeIndustryCenters.length > 0;

    const areaPyeong = parcel.area ? (parcel.area / 3.3058).toFixed(0) : '-';

    // 필지 변경 시 초기 탭 설정
    useEffect(() => {
        // 마커 클릭으로 설정된 초기 탭이 있으면 해당 탭으로 이동
        // (마커를 클릭해서 왔다면 해당 데이터가 있다고 가정)
        if (parcelInitialTab) {
            setMainTab(parcelInitialTab);
            return;
        }

        // 기본 로직: 지식산업센터가 있으면 해당 탭으로
        if (hasKnowledgeCenter) {
            setMainTab('knowledgeCenter');
        } else {
            setMainTab('basic');
        }
    }, [parcel.id, parcelInitialTab, hasKnowledgeCenter]);

    return (
        <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
            {/* 닫기 버튼 (이미지 위에 오버레이) */}
            {onClose && (
                <ActionIcon
                    variant="filled"
                    color="dark"
                    size="md"
                    radius="xl"
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        zIndex: 100,
                        opacity: 0.8,
                    }}
                    title="닫기 (ESC)"
                >
                    <IconX size={16} />
                </ActionIcon>
            )}

            <Box style={{ flex: 1, overflow: 'auto', paddingBottom: 60 }}>
                {/* 이미지 갤러리 (로드뷰/위성 포함) */}
                <ImageGallery
                    images={parcel.images}
                    roadviewCoord={parcel.coord}
                    address={parcel.roadAddress || parcel.address}
                />

                {/* 기본정보 탭 */}
                {mainTab === 'basic' && (
                    <>
                        {/* 헤더 정보 */}
                        <Box px="md" py="md">
                            {/* 배지 + 액션 */}
                            <Group justify="space-between" mb="sm">
                                <Group gap={6}>
                                    <Badge size="sm" variant="light" color="blue">
                                        {parcel.landLedger?.lndcgrCodeNm || '토지'}
                                    </Badge>
                                    {hasAuction && (
                                        <Badge size="sm" variant="light" color="red">경매중</Badge>
                                    )}
                                </Group>
                                <Group gap={6}>
                                    <ActionIcon
                                        variant={isFavorite(parcel.id) ? 'filled' : 'light'}
                                        color="yellow"
                                        size="sm"
                                        radius="md"
                                        onClick={() => {
                                            if (isFavorite(parcel.id)) {
                                                removeFromFavorites(parcel.id);
                                            } else {
                                                addToFavorites({ id: parcel.id, type: 'parcel', data: parcel });
                                            }
                                        }}
                                    >
                                        <IconStar size={14} />
                                    </ActionIcon>
                                    <ActionIcon
                                        variant="light"
                                        color="gray"
                                        size="sm"
                                        radius="md"
                                        onClick={() => {
                                            const addr = parcel.roadAddress || parcel.address || parcel.jibun;
                                            if (addr) navigator.clipboard.writeText(addr);
                                        }}
                                    >
                                        <IconCopy size={14} />
                                    </ActionIcon>
                                </Group>
                            </Group>

                            {/* 주소 */}
                            <Text size="md" fw={600} lh={1.4} mb="xs">
                                {parcel.roadAddress || parcel.address || parcel.jibun}
                            </Text>

                            {/* 부가 정보 */}
                            {parcel.transactionDate && (
                                <Group gap={4} mb="sm">
                                    <IconCalendar size={12} color="#868e96" />
                                    <Text size="xs" c="dimmed">최근거래 {parcel.transactionDate}</Text>
                                </Group>
                            )}

                        </Box>

                        {/* 탭 바 */}
                        <Box px="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                            <Group gap="md">
                                {['land', 'building', 'transaction'].map((tab) => {
                                    const isActive = activeTab === tab;
                                    const label = tab === 'land' ? '토지정보' : tab === 'building' ? '건축물' : '실거래가';
                                    const show = tab === 'land' || (tab === 'building' && hasBuilding) || (tab === 'transaction' && hasTransaction);
                                    if (!show) return null;
                                    return (
                                        <UnstyledButton
                                            key={tab}
                                            onClick={() => setActiveTab(tab as TabType)}
                                            style={{
                                                paddingBottom: 10,
                                                borderBottom: isActive ? '2px solid var(--mantine-color-blue-6)' : '2px solid transparent',
                                                marginBottom: -1,
                                            }}
                                        >
                                            <Text size="sm" fw={isActive ? 600 : 400} c={isActive ? 'blue' : 'dimmed'}>
                                                {label}
                                            </Text>
                                        </UnstyledButton>
                                    );
                                })}
                            </Group>
                        </Box>

                        {/* 토지정보 탭 */}
                        {activeTab === 'land' && (
                            <Box px="md" py="md">
                                {/* 주소 정보 */}
                                <Paper p="sm" radius="md" withBorder mb="md">
                                    <Text size="xs" c="dimmed" mb={2}>도로명주소</Text>
                                    <Text size="sm" fw={500} mb="sm">
                                        {parcel.roadAddress || '정보 없음'}
                                    </Text>
                                    <Text size="xs" c="dimmed" mb={2}>지번주소</Text>
                                    <Text size="sm" c="dimmed">
                                        {parcel.address || parcel.jibun || '정보 없음'}
                                    </Text>
                                </Paper>

                                {/* PNU */}
                                {parcel.pnu && (
                                    <Box mb="md">
                                        <Text size="xs" c="dimmed" mb={4}>PNU (필지고유번호)</Text>
                                        <Text size="xs" ff="monospace" style={{
                                            background: 'var(--mantine-color-gray-1)',
                                            padding: '6px 10px',
                                            borderRadius: 6,
                                            display: 'inline-block',
                                        }}>
                                            {parcel.pnu}
                                        </Text>
                                    </Box>
                                )}

                                {/* 토지대장 정보 */}
                                {hasLand && (
                                    <>
                                        <Divider mb="md" />
                                        <Text size="sm" fw={600} mb="sm">토지대장</Text>
                                        <SimpleGrid cols={2} spacing="xs" mb="md">
                                            <InfoCard
                                                label="공부상 면적"
                                                value={`${parcel.landLedger!.lndpclAr.toLocaleString()}㎡`}
                                                subValue={`(${(parcel.landLedger!.lndpclAr / 3.3058).toFixed(1)}평)`}
                                                highlight
                                            />
                                            <InfoCard
                                                label="지목"
                                                value={parcel.landLedger!.lndcgrCodeNm}
                                            />
                                            <InfoCard
                                                label="소유구분"
                                                value={parcel.landLedger!.posesnSeCodeNm}
                                            />
                                            <InfoCard
                                                label="기준일자"
                                                value={parcel.landLedger!.lastUpdtDt}
                                            />
                                        </SimpleGrid>
                                    </>
                                )}

                                {/* 토지 면적 요약 */}
                                <Paper p="md" radius="md" withBorder style={{
                                    borderColor: 'var(--mantine-color-blue-3)',
                                    backgroundColor: 'var(--mantine-color-blue-0)',
                                }}>
                                    <Text size="xs" c="dimmed" mb={4}>토지 면적</Text>
                                    <Group gap={6} align="baseline">
                                        <Text size="xl" fw={700} c="blue">{areaPyeong}</Text>
                                        <Text size="sm" c="dimmed">평</Text>
                                        <Text size="xs" c="dimmed">({parcel.area?.toLocaleString() || '-'}㎡)</Text>
                                    </Group>
                                </Paper>
                            </Box>
                        )}

                        {/* 건축물 탭 */}
                        {activeTab === 'building' && hasBuilding && (
                            <Box px="md" py="md">
                                <Text size="sm" fw={600} mb="sm">건축물대장 (총괄표제부)</Text>

                                <SimpleGrid cols={2} spacing="xs" mb="sm">
                                    <InfoCard
                                        label="건축면적"
                                        value={`${parcel.buildingLedger!.archArea.toLocaleString()}㎡`}
                                        subValue={`(${(parcel.buildingLedger!.archArea / 3.3058).toFixed(1)}평)`}
                                    />
                                    <InfoCard
                                        label="연면적"
                                        value={`${parcel.buildingLedger!.totArea.toLocaleString()}㎡`}
                                        subValue={`(${(parcel.buildingLedger!.totArea / 3.3058).toFixed(1)}평)`}
                                    />
                                </SimpleGrid>

                                <SimpleGrid cols={2} spacing="xs" mb="sm">
                                    <InfoCard
                                        label="주용도"
                                        value={parcel.buildingLedger!.mainPurpsCdNm}
                                    />
                                    <InfoCard
                                        label="층수"
                                        value={`지상${parcel.buildingLedger!.grndFlrCnt}층${parcel.buildingLedger!.ugrndFlrCnt > 0 ? ` / 지하${parcel.buildingLedger!.ugrndFlrCnt}층` : ''}`}
                                    />
                                </SimpleGrid>

                                <SimpleGrid cols={2} spacing="xs" mb="sm">
                                    <InfoCard label="건폐율" value={`${parcel.buildingLedger!.bcRat.toFixed(1)}%`} />
                                    <InfoCard label="용적률" value={`${parcel.buildingLedger!.vlRat.toFixed(1)}%`} />
                                </SimpleGrid>

                                <SimpleGrid cols={2} spacing="xs" mb="sm">
                                    <InfoCard label="구조" value={parcel.buildingLedger!.strctCdNm} />
                                    <InfoCard label="높이" value={`${parcel.buildingLedger!.heit}m`} />
                                </SimpleGrid>

                                {parcel.buildingLedger!.parkingLotCnt !== undefined && parcel.buildingLedger!.parkingLotCnt > 0 && (
                                    <InfoCard
                                        label="주차정보"
                                        value={`자주식 주차 ${parcel.buildingLedger!.parkingLotCnt}대`}
                                    />
                                )}

                                {parcel.buildingLedger!.useAprDay && (
                                    <Text size="xs" c="dimmed" ta="right" mt="sm">
                                        사용승인일: {parcel.buildingLedger!.useAprDay}
                                    </Text>
                                )}
                            </Box>
                        )}

                        {/* 실거래가 탭 */}
                        {activeTab === 'transaction' && hasTransaction && (
                            <Box px="md" py="md">
                                {/* 가격 카드 */}
                                <Paper p="md" radius="md" withBorder mb="md" style={{
                                    borderColor: 'var(--mantine-color-blue-3)',
                                    backgroundColor: 'var(--mantine-color-blue-0)',
                                }}>
                                    <Group justify="space-between" align="flex-start" mb="xs">
                                        <Text size="xs" c="dimmed">최근 실거래가</Text>
                                        {parcel.transactionDate && (
                                            <Badge size="xs" variant="light" color="gray">{parcel.transactionDate}</Badge>
                                        )}
                                    </Group>
                                    <Text size="xl" fw={700} c="blue" mb="xs">
                                        {(parcel.transactionPrice! / 10000).toFixed(1)}억원
                                    </Text>
                                    {parcel.area && (
                                        <>
                                            <Divider my="xs" />
                                            <Group justify="space-between">
                                                <Text size="xs" c="dimmed">평당가</Text>
                                                <Text size="sm" fw={600}>
                                                    {Math.round(parcel.transactionPrice! / (parcel.area / 3.3058)).toLocaleString()}만원/평
                                                </Text>
                                            </Group>
                                        </>
                                    )}
                                </Paper>

                                {/* 가격 추이 차트 */}
                                <Box mb="md">
                                    <PriceChart
                                        transactions={parcel.transactions}
                                        currentPrice={parcel.transactionPrice}
                                        listingPrice={parcel.listingPrice}
                                        auctionPrice={parcel.auctionPrice}
                                    />
                                </Box>

                                {/* 거래 이력 */}
                                {parcel.transactions && parcel.transactions.length > 0 && (
                                    <>
                                        <Text size="sm" fw={600} mb="xs">거래이력 ({parcel.transactions.length}건)</Text>
                                        <Stack gap="xs">
                                            {[...parcel.transactions]
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                .slice(0, 5)
                                                .map((tx, idx) => (
                                                    <Paper key={idx} p="sm" radius="md" withBorder>
                                                        <Group justify="space-between">
                                                            <Text size="xs" c="dimmed">{tx.date}</Text>
                                                            <Text size="sm" fw={600}>{tx.price.toLocaleString()}만원</Text>
                                                        </Group>
                                                    </Paper>
                                                ))}
                                        </Stack>
                                    </>
                                )}
                            </Box>
                        )}

                        {/* 주변 유사매물 비교 */}
                        {similarParcels.length > 0 && (
                            <Box px="md" py="sm">
                                <Divider mb="sm" />
                                <Group justify="space-between" mb="xs">
                                    <Text size="sm" fw={600}>주변 유사매물</Text>
                                    <Text size="xs" c="dimmed">비슷한 면적 기준</Text>
                                </Group>
                                <Stack gap="xs">
                                    {similarParcels.map((sp) => {
                                        const price = sp.listingPrice || sp.transactionPrice || sp.auctionPrice || 0;
                                        const priceType = sp.listingPrice ? '매물' : sp.transactionPrice ? '실거래' : '경매';
                                        const areaPy = sp.area ? (sp.area / 3.3058).toFixed(0) : '-';

                                        return (
                                            <Paper key={sp.id} p="sm" radius="md" withBorder>
                                                <Group justify="space-between" mb={4}>
                                                    <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                                                        {sp.jibun || sp.address}
                                                    </Text>
                                                    <Badge size="xs" variant="light" color={
                                                        priceType === '매물' ? 'green' : priceType === '경매' ? 'red' : 'blue'
                                                    }>
                                                        {priceType}
                                                    </Badge>
                                                </Group>
                                                <Group justify="space-between">
                                                    <Text size="xs" c="dimmed">{areaPy}평</Text>
                                                    <Text size="sm" fw={600}>{(price / 10000).toFixed(1)}억</Text>
                                                </Group>
                                            </Paper>
                                        );
                                    })}
                                </Stack>
                                <Button
                                    fullWidth
                                    variant="light"
                                    color="gray"
                                    size="xs"
                                    mt="xs"
                                    onClick={() => openCompareSelectModal()}
                                >
                                    더 많은 매물 비교하기
                                </Button>
                            </Box>
                        )}
                    </>
                )}

                {/* 매물 탭 */}
                {mainTab === 'listing' && (
                    <Box px="md" py="md">
                        {hasListing ? (
                            <Stack gap="md">
                                {/* 매물 배지 */}
                                <Badge size="sm" variant="light" color="blue">
                                    {parcel.landLedger?.lndcgrCodeNm || '매물'}
                                </Badge>

                                {/* 매매가 헤더 */}
                                <Box>
                                    <Text size="xl" fw={700}>
                                        매매가 {(parcel.listingPrice! / 10000).toFixed(1)}억원
                                    </Text>

                                    {/* 실거래가 대비 */}
                                    {hasTransaction && (
                                        <Text size="sm" c="dimmed" mt={4}>
                                            최근 실거래가 보다{' '}
                                            <Text span c={parcel.listingPrice! < parcel.transactionPrice! ? 'red' : 'blue'}>
                                                {parcel.listingPrice! < parcel.transactionPrice!
                                                    ? `${Math.round(parcel.transactionPrice! - parcel.listingPrice!).toLocaleString()}만원 저렴`
                                                    : `${Math.round(parcel.listingPrice! - parcel.transactionPrice!).toLocaleString()}만원 비쌈`
                                                }
                                            </Text>
                                        </Text>
                                    )}
                                </Box>

                                {/* 매물 비교하기 + 건물정보 버튼 (피그마: 2개 나란히) */}
                                <Group grow>
                                    <Button
                                        color="dark"
                                        rightSection={<IconExternalLink size={14} />}
                                        onClick={() => {
                                            if (!isInCompare(parcel.id)) {
                                                addToCompare({ id: parcel.id, type: 'parcel', data: parcel });
                                            }
                                            toggleComparePanel();
                                        }}
                                        style={{ justifyContent: 'space-between' }}
                                    >
                                        매물 비교하기
                                    </Button>
                                    {hasBuilding && (
                                        <Button
                                            variant="default"
                                            rightSection={<IconExternalLink size={14} />}
                                            onClick={() => {
                                                setMainTab('basic');
                                                setActiveTab('building');
                                            }}
                                            style={{ justifyContent: 'space-between' }}
                                        >
                                            건물정보
                                        </Button>
                                    )}
                                </Group>

                                {/* 가격 비교 카드 */}
                                <Group grow>
                                    <Paper p="md" radius={0} style={{ backgroundColor: '#fafafa', textAlign: 'center' }}>
                                        <Text size="sm" c="dimmed" mb={4}>실거래가</Text>
                                        <Text size="md" fw={600}>
                                            {hasTransaction ? `${(parcel.transactionPrice! / 10000).toFixed(1)}억` : '-'}
                                        </Text>
                                        {parcel.transactionDate && (
                                            <Text size="xs" c="dimmed">{parcel.transactionDate}</Text>
                                        )}
                                    </Paper>
                                    <Paper p="md" radius={0} style={{ backgroundColor: '#fafafa', textAlign: 'center' }}>
                                        <Text size="sm" c="dimmed" mb={4}>주변 평균 실거래가</Text>
                                        <Text size="md" fw={600}>
                                            {hasTransaction ? `${((parcel.transactionPrice! * 1.1) / 10000).toFixed(1)}억` : '-'}
                                        </Text>
                                    </Paper>
                                </Group>
                            </Stack>
                        ) : (
                            <Box ta="center" py="xl">
                                <Text size="sm" c="dimmed">매물 정보가 없습니다.</Text>
                            </Box>
                        )}
                    </Box>
                )}

                {/* 경매 탭 */}
                {mainTab === 'auction' && (
                    <Box px="md" py="md">
                        {hasAuction ? (
                            <Stack gap="md">
                                {/* 사건번호 배지 */}
                                <Badge size="sm" variant="light" color="blue" rightSection={<IconExternalLink size={10} />}>
                                    {parcel.auctionCaseNo || '2025타경00000'}
                                </Badge>

                                {/* 주소 */}
                                <Text size="lg" fw={600} lh={1.3}>
                                    {parcel.roadAddress || parcel.address || parcel.jibun}
                                </Text>

                                {/* 상태 배지들 */}
                                <Group gap={8}>
                                    {parcel.auctionFailCount !== undefined && parcel.auctionFailCount > 0 && (
                                        <Badge size="sm" variant="light" color="blue">유찰 {parcel.auctionFailCount}회</Badge>
                                    )}
                                    <Badge size="sm" variant="light" color="blue">일정 미정</Badge>
                                </Group>

                                {/* 매각기일 */}
                                <Text size="sm" c="dimmed">
                                    매각기일 {parcel.auctionDate || '미정'}
                                </Text>

                                {/* 법원경매이동 + 건물정보 버튼 (피그마: 2개 나란히) */}
                                <Group grow>
                                    <Button
                                        variant="default"
                                        rightSection={<IconExternalLink size={14} />}
                                        onClick={() => {
                                            // 법원경매 사이트로 이동
                                            window.open('https://www.courtauction.go.kr/', '_blank');
                                        }}
                                        style={{ justifyContent: 'space-between' }}
                                    >
                                        법원경매이동
                                    </Button>
                                    {hasBuilding && (
                                        <Button
                                            variant="default"
                                            rightSection={<IconExternalLink size={14} />}
                                            onClick={() => {
                                                setMainTab('basic');
                                                setActiveTab('building');
                                            }}
                                            style={{ justifyContent: 'space-between' }}
                                        >
                                            건물정보
                                        </Button>
                                    )}
                                </Group>

                                {/* 가격 정보 */}
                                {(() => {
                                    const failCount = parcel.auctionFailCount || 0;
                                    const estimatedAppraisal = parcel.auctionPrice! / Math.pow(0.8, failCount);
                                    const bidRate = (parcel.auctionPrice! / estimatedAppraisal * 100).toFixed(0);
                                    const deposit = parcel.auctionPrice! * 0.1;

                                    return (
                                        <>
                                            <Paper p="md" radius={0} style={{ backgroundColor: '#fafafa' }}>
                                                <Stack gap="sm">
                                                    <Group justify="space-between">
                                                        <Text size="sm" c="dimmed">감정가</Text>
                                                        <Text size="md" fw={600}>{(estimatedAppraisal / 10000).toFixed(1)}억</Text>
                                                    </Group>
                                                    <Group justify="space-between">
                                                        <Group gap={4}>
                                                            <Text size="sm" c="dimmed">최저매각가</Text>
                                                            <Badge size="xs" variant="light" color="blue">감정가 대비 {bidRate}%</Badge>
                                                        </Group>
                                                        <Text size="md" fw={600}>{(parcel.auctionPrice! / 10000).toFixed(1)}억</Text>
                                                    </Group>
                                                    <Group justify="space-between">
                                                        <Group gap={4}>
                                                            <Text size="sm" c="dimmed">입찰보증금</Text>
                                                            <Badge size="xs" variant="light" color="gray">10%</Badge>
                                                        </Group>
                                                        <Text size="md" fw={600}>{(deposit / 10000).toFixed(1)}억</Text>
                                                    </Group>
                                                </Stack>
                                            </Paper>

                                            {/* 실거래가 vs 주변 비교 */}
                                            <Group grow>
                                                <Paper p="md" radius={0} style={{ backgroundColor: '#fafafa', textAlign: 'center' }}>
                                                    <Text size="sm" c="dimmed" mb={4}>실거래가</Text>
                                                    <Text size="md" fw={600}>
                                                        {hasTransaction ? `${(parcel.transactionPrice! / 10000).toFixed(1)}억` : '-'}
                                                    </Text>
                                                    {hasTransaction && parcel.auctionPrice! < parcel.transactionPrice! && (
                                                        <Badge size="xs" variant="light" color="red" mt={4}>
                                                            {Math.round((1 - parcel.auctionPrice! / parcel.transactionPrice!) * 100)}% 저렴
                                                        </Badge>
                                                    )}
                                                </Paper>
                                                <Paper p="md" radius={0} style={{ backgroundColor: '#fafafa', textAlign: 'center' }}>
                                                    <Text size="sm" c="dimmed" mb={4}>주변 평균 실거래가</Text>
                                                    <Text size="md" fw={600}>
                                                        {hasTransaction ? `${((parcel.transactionPrice! * 1.1) / 10000).toFixed(1)}억` : '-'}
                                                    </Text>
                                                </Paper>
                                            </Group>

                                            {/* 사건정보 */}
                                            <Text size="sm" fw={600}>사건정보</Text>
                                            <SimpleGrid cols={3} spacing="xs">
                                                <Paper p="md" radius={0} style={{ backgroundColor: '#fafafa', textAlign: 'center' }}>
                                                    <Text size="sm" c="dimmed" mb={4}>감정가</Text>
                                                    <Text size="md" fw={600}>{(estimatedAppraisal / 10000).toFixed(1)}억</Text>
                                                </Paper>
                                                <Paper p="md" radius={0} style={{ backgroundColor: '#fafafa', textAlign: 'center' }}>
                                                    <Text size="sm" c="dimmed" mb={4}>최저가</Text>
                                                    <Text size="md" fw={600}>{(parcel.auctionPrice! / 10000).toFixed(1)}억</Text>
                                                </Paper>
                                                <Paper p="md" radius={0} style={{ backgroundColor: '#fafafa', textAlign: 'center' }}>
                                                    <Text size="sm" c="dimmed" mb={4}>입찰가율</Text>
                                                    <Text size="md" fw={600}>{bidRate}%</Text>
                                                </Paper>
                                                <Paper p="md" radius={0} style={{ backgroundColor: '#fafafa', textAlign: 'center' }}>
                                                    <Text size="sm" c="dimmed" mb={4}>유찰횟수</Text>
                                                    <Text size="md" fw={600}>{failCount}회</Text>
                                                </Paper>
                                            </SimpleGrid>
                                        </>
                                    );
                                })()}
                            </Stack>
                        ) : (
                            <Box ta="center" py="xl">
                                <Text size="sm" c="dimmed">경매 정보가 없습니다.</Text>
                            </Box>
                        )}
                    </Box>
                )}

                {/* 공장 탭 */}
                {mainTab === 'factory' && (
                    <Box px="md" py="md">
                        {hasFactory ? (
                            <Stack gap="sm">
                                <Text size="sm" fw={600}>입주 기업 ({parcel.factories?.length}개)</Text>
                                {parcel.factories?.map((factory, idx) => (
                                    <Paper key={idx} p="sm" radius="md" withBorder>
                                        <Text size="sm" fw={600} mb="xs">{factory.name}</Text>
                                        {factory.businessType && (
                                            <Badge size="sm" variant="light" color="orange" mb="xs">{factory.businessType}</Badge>
                                        )}
                                        <SimpleGrid cols={2} spacing="xs">
                                            {factory.employeeCount !== undefined && factory.employeeCount > 0 && (
                                                <InfoCard label="종업원" value={`${factory.employeeCount}명`} />
                                            )}
                                            {factory.area && (
                                                <InfoCard label="면적" value={`${factory.area.toLocaleString()}㎡`} />
                                            )}
                                        </SimpleGrid>
                                    </Paper>
                                ))}
                            </Stack>
                        ) : (
                            <Box ta="center" py="xl">
                                <Text size="sm" c="dimmed">입주한 기업이 없습니다.</Text>
                            </Box>
                        )}
                    </Box>
                )}

                {/* 지식산업센터 탭 */}
                {mainTab === 'knowledgeCenter' && (
                    <Box px="md" py="md">
                        {hasKnowledgeCenter ? (
                            <Stack gap="sm">
                                <Text size="sm" fw={600}>지식산업센터 ({parcel.knowledgeIndustryCenters?.length}개)</Text>
                                {parcel.knowledgeIndustryCenters?.map((kc, idx) => (
                                    <Paper key={idx} p="sm" radius="md" withBorder style={{
                                        borderColor: 'var(--mantine-color-violet-3)',
                                        backgroundColor: 'var(--mantine-color-violet-0)',
                                    }}>
                                        <Group justify="space-between" mb="xs">
                                            <Text size="sm" fw={600}>{kc.name}</Text>
                                            <Badge variant="light" color="violet" size="sm">{kc.status}</Badge>
                                        </Group>
                                        {kc.roadAddress && <Text size="xs" c="dimmed" mb="xs">{kc.roadAddress}</Text>}
                                        <SimpleGrid cols={2} spacing="xs">
                                            {kc.landArea && <InfoCard label="대지면적" value={`${kc.landArea.toLocaleString()}㎡`} />}
                                            {kc.floors && <InfoCard label="층수" value={`${kc.floors}층`} />}
                                        </SimpleGrid>
                                    </Paper>
                                ))}
                            </Stack>
                        ) : (
                            <Box ta="center" py="xl">
                                <Text size="sm" c="dimmed">지식산업센터가 없습니다.</Text>
                            </Box>
                        )}
                    </Box>
                )}
            </Box>

            {/* 경매 진행중 배너 (피그마: 검정 배경, 하단 네비게이션 위 플로팅) */}
            {hasAuction && mainTab !== 'auction' && (
                <Box
                    px="md"
                    style={{
                        position: 'sticky',
                        bottom: 60,
                        zIndex: 10,
                    }}
                >
                    <Paper
                        p="sm"
                        radius="md"
                        onClick={() => setMainTab('auction')}
                        style={{
                            background: 'rgba(0, 0, 0, 0.85)',
                            backdropFilter: 'blur(4px)',
                            cursor: 'pointer',
                        }}
                    >
                        <Group justify="center" gap="sm">
                            <IconGavel size={18} color="white" />
                            <Text size="sm" fw={500} c="white">경매가 진행중인 매물이에요</Text>
                            {hasTransaction && parcel.auctionPrice! < parcel.transactionPrice! && (
                                <Badge
                                    size="sm"
                                    variant="filled"
                                    color="red"
                                    style={{ backgroundColor: 'rgba(235, 37, 40, 0.3)' }}
                                >
                                    {((parcel.transactionPrice! - parcel.auctionPrice!) / 10000).toFixed(1)}억 저렴
                                </Badge>
                            )}
                        </Group>
                    </Paper>
                </Box>
            )}

            {/* 하단 네비게이션 */}
            {(hasListing || hasAuction || hasFactory || hasKnowledgeCenter) && (
                <Box
                    style={{
                        position: 'sticky',
                        bottom: 0,
                        background: '#fff',
                        borderTop: '1px solid var(--mantine-color-gray-3)',
                        display: 'flex',
                        padding: '8px 0',
                    }}
                >
                    <UnstyledButton
                        onClick={() => setMainTab('basic')}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                    >
                        <IconMap size={20} color={mainTab === 'basic' ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-5)'} />
                        <Text size="xs" c={mainTab === 'basic' ? 'blue' : 'dimmed'} fw={mainTab === 'basic' ? 600 : 400}>필지정보</Text>
                    </UnstyledButton>
                    {hasListing && (
                        <UnstyledButton
                            onClick={() => setMainTab('listing')}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                        >
                            <IconHome size={20} color={mainTab === 'listing' ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-gray-5)'} />
                            <Text size="xs" c={mainTab === 'listing' ? 'green' : 'dimmed'} fw={mainTab === 'listing' ? 600 : 400}>매물</Text>
                        </UnstyledButton>
                    )}
                    {hasAuction && (
                        <UnstyledButton
                            onClick={() => setMainTab('auction')}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                        >
                            <IconGavel size={20} color={mainTab === 'auction' ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-gray-5)'} />
                            <Text size="xs" c={mainTab === 'auction' ? 'red' : 'dimmed'} fw={mainTab === 'auction' ? 600 : 400}>경매</Text>
                        </UnstyledButton>
                    )}
                    {hasFactory && (
                        <UnstyledButton
                            onClick={() => setMainTab('factory')}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                        >
                            <IconBuildingFactory2 size={20} color={mainTab === 'factory' ? 'var(--mantine-color-orange-6)' : 'var(--mantine-color-gray-5)'} />
                            <Text size="xs" c={mainTab === 'factory' ? 'orange' : 'dimmed'} fw={mainTab === 'factory' ? 600 : 400}>공장</Text>
                        </UnstyledButton>
                    )}
                    {hasKnowledgeCenter && (
                        <UnstyledButton
                            onClick={() => setMainTab('knowledgeCenter')}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                        >
                            <IconBuilding size={20} color={mainTab === 'knowledgeCenter' ? 'var(--mantine-color-violet-6)' : 'var(--mantine-color-gray-5)'} />
                            <Text size="xs" c={mainTab === 'knowledgeCenter' ? 'violet' : 'dimmed'} fw={mainTab === 'knowledgeCenter' ? 600 : 400}>지산</Text>
                        </UnstyledButton>
                    )}
                </Box>
            )}
        </Box>
    );
}
