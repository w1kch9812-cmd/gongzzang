'use client';

import { useState, useEffect, useRef } from 'react';
import { Stack, Text, Badge, Group, Box, Button, Paper, ActionIcon, Divider, SimpleGrid, UnstyledButton, ScrollArea } from '@mantine/core';
import { IconStar, IconScale, IconCopy, IconHome, IconTag, IconGavel, IconBuildingFactory, IconBuilding } from '@tabler/icons-react';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
import { useComparePanelActions, useCompareSelectModalActions, useComparePanelOpen } from '@/lib/stores/ui-store';
import type { ParcelDetail } from '@/types/data';

interface ParcelDetailContentProps {
    parcel: ParcelDetail;
}

// 섹션 타이틀 컴포넌트
function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
    return (
        <Box id={id} py="sm" px="md" bg="gray.0" style={{ borderBottom: '1px solid #e9ecef' }}>
            <Text size="sm" fw={700} c="dark">
                {children}
            </Text>
        </Box>
    );
}

// 정보 행 컴포넌트
function InfoRow({ label, value, badge }: { label: string; value: React.ReactNode; badge?: React.ReactNode }) {
    return (
        <Group justify="space-between" py={6} style={{ borderBottom: '1px solid #f1f3f5' }}>
            <Text size="sm" c="dimmed">{label}</Text>
            <Group gap="xs">
                {badge}
                <Text size="sm" fw={500}>{value}</Text>
            </Group>
        </Group>
    );
}

// 메인 탭 타입
type MainTabType = 'basic' | 'listing' | 'factory' | 'knowledgeCenter' | 'auction';

// 기본정보 탭 내 앵커 섹션
type BasicAnchorType = 'land' | 'building' | 'transaction';

export default function ParcelDetailContent({ parcel }: ParcelDetailContentProps) {
    const [mainTab, setMainTab] = useState<MainTabType>('basic');
    const [activeAnchor, setActiveAnchor] = useState<BasicAnchorType>('land');
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // 관심/비교 상태
    const addToFavorites = usePreferencesStore((s) => s.addToFavorites);
    const removeFromFavorites = usePreferencesStore((s) => s.removeFromFavorites);
    const isFavorite = usePreferencesStore((s) => s.isFavorite);
    const addToCompare = usePreferencesStore((s) => s.addToCompare);
    const isInCompare = usePreferencesStore((s) => s.isInCompare);
    const compareListCount = usePreferencesStore((s) => s.compareList.length);
    const favoritesCount = usePreferencesStore((s) => s.favorites.length);

    const { toggleComparePanel } = useComparePanelActions();
    const { openCompareSelectModal } = useCompareSelectModalActions();
    const comparePanelOpen = useComparePanelOpen();

    // 데이터 체크
    const hasTransaction = parcel.transactionPrice && parcel.transactionPrice > 0;
    const hasListing = parcel.listingPrice && parcel.listingPrice > 0;
    const hasAuction = parcel.auctionPrice && parcel.auctionPrice > 0;
    const hasBuilding = parcel.buildingLedger;
    const hasLand = parcel.landLedger;
    const hasFactory = parcel.factories && parcel.factories.length > 0;
    const hasKnowledgeCenter = parcel.knowledgeIndustryCenters && parcel.knowledgeIndustryCenters.length > 0;

    // 면적 계산
    const areaPyeong = parcel.area ? (parcel.area / 3.3058).toFixed(1) : '-';

    // 앵커 스크롤 함수
    const scrollToSection = (sectionId: BasicAnchorType) => {
        setActiveAnchor(sectionId);
        const element = document.getElementById(`section-${sectionId}`);
        if (element && scrollAreaRef.current) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // 필지 변경 시 지산이 있으면 먼저 표시
    useEffect(() => {
        if (hasKnowledgeCenter) {
            setMainTab('knowledgeCenter');
        } else {
            setMainTab('basic');
        }
        setActiveAnchor('land');
    }, [parcel.id, hasKnowledgeCenter]);

    return (
        <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* 스크롤 가능한 메인 콘텐츠 */}
            <Box style={{ flex: 1, overflow: 'auto', paddingBottom: '80px' }}>
                {/* 헤더 - 주소 및 액션 */}
                <Box p="md" style={{ borderBottom: '1px solid #e9ecef' }}>
                    <Group justify="space-between" mb="xs">
                        <Badge size="sm" variant="light" color="blue">
                            {parcel.landLedger?.lndcgrCodeNm || '토지'}
                        </Badge>
                        <Group gap={4}>
                            <ActionIcon
                                variant={isFavorite(parcel.id) ? 'filled' : 'light'}
                                color="yellow"
                                size="sm"
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
                                variant={isInCompare(parcel.id) ? 'filled' : 'light'}
                                color="blue"
                                size="sm"
                                onClick={() => {
                                    if (!isInCompare(parcel.id)) {
                                        addToCompare({ id: parcel.id, type: 'parcel', data: parcel });
                                    }
                                }}
                                disabled={isInCompare(parcel.id)}
                            >
                                <IconScale size={14} />
                            </ActionIcon>
                            <ActionIcon
                                variant="light"
                                color="gray"
                                size="sm"
                                onClick={() => {
                                    const addr = parcel.roadAddress || parcel.address || parcel.jibun;
                                    if (addr) navigator.clipboard.writeText(addr);
                                }}
                            >
                                <IconCopy size={14} />
                            </ActionIcon>
                        </Group>
                    </Group>

                    <Text size="lg" fw={700} mb={4}>
                        {parcel.roadAddress || parcel.address || parcel.jibun}
                    </Text>
                    <Text size="xs" c="dimmed">
                        PNU: {parcel.pnu || parcel.id}
                    </Text>

                    {/* 비교하기 버튼 */}
                    {favoritesCount > 0 && (
                        <Button
                            variant="light"
                            color="cyan"
                            size="xs"
                            mt="sm"
                            fullWidth
                            leftSection={<IconScale size={14} />}
                            onClick={compareListCount > 0 ? toggleComparePanel : openCompareSelectModal}
                        >
                            {compareListCount > 0
                                ? `비교 결과 보기 (${compareListCount}/3)`
                                : `관심매물 비교하기 (${favoritesCount}개)`}
                        </Button>
                    )}
                </Box>

                {/* 기본정보 탭 */}
                {mainTab === 'basic' && (
                    <Box>
                        {/* 상단 앵커 탭 */}
                        <Box
                            style={{
                                position: 'sticky',
                                top: 0,
                                zIndex: 5,
                                backgroundColor: 'white',
                                borderBottom: '1px solid #e9ecef',
                            }}
                        >
                            <Group gap={0}>
                                <UnstyledButton
                                    onClick={() => scrollToSection('land')}
                                    style={{
                                        flex: 1,
                                        padding: '12px 8px',
                                        textAlign: 'center',
                                        borderBottom: activeAnchor === 'land' ? '2px solid #228be6' : '2px solid transparent',
                                        color: activeAnchor === 'land' ? '#228be6' : '#868e96',
                                        fontWeight: activeAnchor === 'land' ? 600 : 400,
                                        fontSize: '14px',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    토지정보
                                </UnstyledButton>
                                {hasBuilding && (
                                    <UnstyledButton
                                        onClick={() => scrollToSection('building')}
                                        style={{
                                            flex: 1,
                                            padding: '12px 8px',
                                            textAlign: 'center',
                                            borderBottom: activeAnchor === 'building' ? '2px solid #228be6' : '2px solid transparent',
                                            color: activeAnchor === 'building' ? '#228be6' : '#868e96',
                                            fontWeight: activeAnchor === 'building' ? 600 : 400,
                                            fontSize: '14px',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        건축물
                                    </UnstyledButton>
                                )}
                                {hasTransaction && (
                                    <UnstyledButton
                                        onClick={() => scrollToSection('transaction')}
                                        style={{
                                            flex: 1,
                                            padding: '12px 8px',
                                            textAlign: 'center',
                                            borderBottom: activeAnchor === 'transaction' ? '2px solid #228be6' : '2px solid transparent',
                                            color: activeAnchor === 'transaction' ? '#228be6' : '#868e96',
                                            fontWeight: activeAnchor === 'transaction' ? 600 : 400,
                                            fontSize: '14px',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        실거래가
                                    </UnstyledButton>
                                )}
                            </Group>
                        </Box>

                        {/* 토지 정보 섹션 */}
                        <SectionTitle id="section-land">토지정보</SectionTitle>
                        <Box px="md" py="sm">
                            <Stack gap={0}>
                                <InfoRow label="면적" value={`${areaPyeong}평 (${parcel.area?.toLocaleString()}㎡)`} />
                                {hasLand && (
                                    <>
                                        <InfoRow label="지목" value={parcel.landLedger!.lndcgrCodeNm} />
                                        <InfoRow label="소유구분" value={parcel.landLedger!.posesnSeCodeNm} />
                                        <InfoRow label="공부면적" value={`${parcel.landLedger!.lndpclAr.toLocaleString()}㎡`} />
                                    </>
                                )}
                                {parcel.landUseType && (
                                    <InfoRow
                                        label="용도지역"
                                        value={parcel.landUseType}
                                        badge={<Badge size="xs" color="violet" variant="light">{parcel.landUseType}</Badge>}
                                    />
                                )}
                                {parcel.officialLandPrice && (
                                    <InfoRow
                                        label="공시지가"
                                        value={`${(parcel.officialLandPrice / 10000).toFixed(1)}만원/㎡`}
                                    />
                                )}
                            </Stack>
                            {parcel.officialLandPrice && parcel.area && (
                                <Paper p="sm" mt="md" radius="md" bg="blue.0">
                                    <Text size="xs" c="dimmed">공시지가 총액</Text>
                                    <Text size="lg" fw={700} c="blue">
                                        {((parcel.officialLandPrice * parcel.area) / 100000000).toFixed(2)}억원
                                    </Text>
                                </Paper>
                            )}
                        </Box>

                        {/* 건축물 정보 섹션 */}
                        {hasBuilding && (
                            <>
                                <SectionTitle id="section-building">건축물</SectionTitle>
                                <Box px="md" py="sm">
                                    <Stack gap={0}>
                                        <InfoRow label="주용도" value={parcel.buildingLedger!.mainPurpsCdNm} />
                                        <InfoRow
                                            label="층수"
                                            value={`지상${parcel.buildingLedger!.grndFlrCnt}층${parcel.buildingLedger!.ugrndFlrCnt > 0 ? ` / 지하${parcel.buildingLedger!.ugrndFlrCnt}층` : ''}`}
                                        />
                                        <InfoRow label="건축면적" value={`${parcel.buildingLedger!.archArea.toLocaleString()}㎡`} />
                                        <InfoRow label="연면적" value={`${parcel.buildingLedger!.totArea.toLocaleString()}㎡`} />
                                        <InfoRow label="구조" value={parcel.buildingLedger!.strctCdNm} />
                                        <InfoRow label="높이" value={`${parcel.buildingLedger!.heit}m`} />
                                    </Stack>
                                    <SimpleGrid cols={2} spacing="xs" mt="md">
                                        <Paper p="sm" radius="md" bg="teal.0">
                                            <Text size="xs" c="dimmed">건폐율</Text>
                                            <Text size="lg" fw={700}>{parcel.buildingLedger!.bcRat.toFixed(1)}%</Text>
                                        </Paper>
                                        <Paper p="sm" radius="md" bg="teal.0">
                                            <Text size="xs" c="dimmed">용적률</Text>
                                            <Text size="lg" fw={700}>{parcel.buildingLedger!.vlRat.toFixed(1)}%</Text>
                                        </Paper>
                                    </SimpleGrid>
                                    {parcel.buildingLedger!.useAprDay && (
                                        <Text size="xs" c="dimmed" mt="sm" ta="right">
                                            사용승인일: {parcel.buildingLedger!.useAprDay}
                                        </Text>
                                    )}
                                </Box>
                            </>
                        )}

                        {/* 실거래가 정보 섹션 */}
                        {hasTransaction && (
                            <>
                                <SectionTitle id="section-transaction">실거래가</SectionTitle>
                                <Box px="md" py="sm">
                                    <Paper p="md" radius="md" bg="blue.0" mb="md">
                                        <Group justify="space-between" align="flex-start">
                                            <div>
                                                <Text size="xs" c="dimmed">최근 실거래가</Text>
                                                <Text size="xl" fw={700} c="blue">
                                                    {(parcel.transactionPrice! / 10000).toFixed(2)}억원
                                                </Text>
                                                <Text size="sm" c="dimmed">
                                                    {parcel.transactionPrice!.toLocaleString()}만원
                                                </Text>
                                            </div>
                                            {parcel.transactionDate && (
                                                <Badge size="sm" variant="light" color="gray">
                                                    {parcel.transactionDate}
                                                </Badge>
                                            )}
                                        </Group>
                                        {parcel.area && (
                                            <>
                                                <Divider my="sm" />
                                                <Group justify="space-between">
                                                    <Text size="sm" c="dimmed">평당가</Text>
                                                    <Text size="sm" fw={600}>
                                                        {Math.round(parcel.transactionPrice! / (parcel.area / 3.3058)).toLocaleString()}만원/평
                                                    </Text>
                                                </Group>
                                            </>
                                        )}
                                    </Paper>

                                    {/* 거래 이력 */}
                                    {parcel.transactions && parcel.transactions.length > 0 && (
                                        <>
                                            <Text size="sm" fw={600} mb="xs">거래 이력 ({parcel.transactions.length}건)</Text>
                                            <Stack gap="xs">
                                                {[...parcel.transactions]
                                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                    .slice(0, 5)
                                                    .map((tx, idx) => (
                                                        <Paper key={idx} p="sm" radius="md" withBorder>
                                                            <Group justify="space-between">
                                                                <Text size="xs" c="dimmed">{tx.date}</Text>
                                                                {tx.dealType && <Badge size="xs" variant="light">{tx.dealType}</Badge>}
                                                            </Group>
                                                            <Text size="md" fw={600} mt={4}>
                                                                {tx.price.toLocaleString()}만원
                                                            </Text>
                                                        </Paper>
                                                    ))}
                                            </Stack>
                                        </>
                                    )}
                                </Box>
                            </>
                        )}
                    </Box>
                )}

                {/* 매물 탭 */}
                {mainTab === 'listing' && (
                    <Box p="md">
                        {hasListing ? (
                            <>
                                <Paper p="md" radius="md" style={{ border: '2px solid #40c057', background: '#f8fff8' }} mb="md">
                                    <Text size="xs" c="dimmed">매물가</Text>
                                    <Text size="xl" fw={700} c="green">
                                        {(parcel.listingPrice! / 10000).toFixed(2)}억원
                                    </Text>
                                    <Text size="sm" c="dimmed">
                                        {parcel.listingPrice!.toLocaleString()}만원
                                    </Text>

                                    {hasTransaction && (
                                        <Group gap={4} mt="sm">
                                            {parcel.listingPrice! < parcel.transactionPrice! ? (
                                                <Badge color="green" variant="light">
                                                    실거래가 대비 {Math.abs(Math.round((1 - parcel.listingPrice! / parcel.transactionPrice!) * 100))}% 저렴
                                                </Badge>
                                            ) : (
                                                <Badge color="red" variant="light">
                                                    실거래가 대비 {Math.abs(Math.round((parcel.listingPrice! / parcel.transactionPrice! - 1) * 100))}% 비쌈
                                                </Badge>
                                            )}
                                        </Group>
                                    )}
                                </Paper>

                                {parcel.area && (
                                    <SimpleGrid cols={2} spacing="xs">
                                        <Paper p="sm" radius="md" bg="gray.0">
                                            <Text size="xs" c="dimmed">평당 매물가</Text>
                                            <Text size="md" fw={600}>
                                                {Math.round(parcel.listingPrice! / (parcel.area / 3.3058)).toLocaleString()}만원
                                            </Text>
                                        </Paper>
                                        {hasTransaction && (
                                            <Paper p="sm" radius="md" bg="gray.0">
                                                <Text size="xs" c="dimmed">평당 실거래가</Text>
                                                <Text size="md" fw={600}>
                                                    {Math.round(parcel.transactionPrice! / (parcel.area / 3.3058)).toLocaleString()}만원
                                                </Text>
                                            </Paper>
                                        )}
                                    </SimpleGrid>
                                )}
                            </>
                        ) : (
                            <Text size="sm" c="dimmed" ta="center" py="xl">
                                매물 정보가 없습니다.
                            </Text>
                        )}
                    </Box>
                )}

                {/* 입주기업 탭 */}
                {mainTab === 'factory' && (
                    <Box p="md">
                        {hasFactory ? (
                            <>
                                <Text size="sm" fw={600} mb="xs">
                                    입주 기업 목록 ({parcel.factories?.length || 0}개)
                                </Text>
                                <Stack gap="md">
                                    {parcel.factories?.map((factory, index) => (
                                        <Paper key={index} p="md" radius="md" withBorder>
                                            <Group justify="space-between" mb="xs">
                                                <Text size="md" fw={600}>{factory.name}</Text>
                                            </Group>
                                            {factory.businessType && (
                                                <Badge size="sm" variant="light" color="orange" mb="xs">
                                                    {factory.businessType}
                                                </Badge>
                                            )}
                                            <Divider my="xs" />
                                            <Stack gap="xs">
                                                {factory.employeeCount !== undefined && factory.employeeCount > 0 && (
                                                    <InfoRow label="종업원 수" value={`${factory.employeeCount}명`} />
                                                )}
                                                {factory.area && (
                                                    <InfoRow label="용지면적" value={`${factory.area.toLocaleString()}㎡`} />
                                                )}
                                            </Stack>
                                        </Paper>
                                    ))}
                                </Stack>
                            </>
                        ) : (
                            <Text size="sm" c="dimmed" ta="center" py="xl">
                                이 필지에는 입주한 기업이 없습니다.
                            </Text>
                        )}
                    </Box>
                )}

                {/* 지식산업센터 탭 */}
                {mainTab === 'knowledgeCenter' && (
                    <Box p="md">
                        {hasKnowledgeCenter ? (
                            <>
                                <Text size="sm" fw={600} mb="xs">
                                    지식산업센터 ({parcel.knowledgeIndustryCenters?.length || 0}개)
                                </Text>
                                <Stack gap="md">
                                    {parcel.knowledgeIndustryCenters?.map((kc, index) => (
                                        <Paper key={index} p="md" radius="md" style={{ background: '#f3f0ff', border: '1px solid #e5dbff' }}>
                                            <Group justify="space-between" mb="xs">
                                                <Text size="md" fw={600}>{kc.name}</Text>
                                                <Badge variant="light" color="violet" size="sm">
                                                    {kc.status}
                                                </Badge>
                                            </Group>
                                            {kc.roadAddress && (
                                                <Text size="sm" c="dimmed" mb="xs">
                                                    {kc.roadAddress}
                                                </Text>
                                            )}
                                            <Divider my="xs" />
                                            <Stack gap="xs">
                                                {kc.saleType && <InfoRow label="분양유형" value={kc.saleType} />}
                                                {kc.landArea && <InfoRow label="대지면적" value={`${kc.landArea.toLocaleString()}㎡`} />}
                                                {kc.buildingArea && <InfoRow label="건축면적" value={`${kc.buildingArea.toLocaleString()}㎡`} />}
                                                {kc.floors && <InfoRow label="층수" value={`${kc.floors}층`} />}
                                                {kc.complexName && <InfoRow label="소속 단지" value={kc.complexName} />}
                                            </Stack>
                                        </Paper>
                                    ))}
                                </Stack>
                            </>
                        ) : (
                            <Text size="sm" c="dimmed" ta="center" py="xl">
                                이 필지에는 지식산업센터가 없습니다.
                            </Text>
                        )}
                    </Box>
                )}

                {/* 경매 탭 */}
                {mainTab === 'auction' && (
                    <Box p="md">
                        {hasAuction ? (
                            <>
                                <Paper p="md" radius="md" style={{ border: '2px solid #fa5252', background: '#fff5f5' }} mb="md">
                                    <Group justify="space-between" align="flex-start" mb="sm">
                                        <div>
                                            <Text size="xs" c="dimmed">최저가</Text>
                                            <Text size="xl" fw={700} c="red">
                                                {(parcel.auctionPrice! / 10000).toFixed(2)}억원
                                            </Text>
                                        </div>
                                        {parcel.auctionFailCount !== undefined && parcel.auctionFailCount > 0 && (
                                            <Badge size="lg" color="red" variant="filled">
                                                유찰 {parcel.auctionFailCount}회
                                            </Badge>
                                        )}
                                    </Group>

                                    <Divider my="sm" />

                                    {(() => {
                                        const failCount = parcel.auctionFailCount || 0;
                                        const estimatedAppraisal = parcel.auctionPrice! / Math.pow(0.8, failCount);
                                        const bidRate = (parcel.auctionPrice! / estimatedAppraisal * 100).toFixed(0);

                                        return (
                                            <SimpleGrid cols={3} spacing="xs">
                                                <div>
                                                    <Text size="xs" c="dimmed">감정가</Text>
                                                    <Text size="sm" fw={600}>
                                                        {(estimatedAppraisal / 10000).toFixed(1)}억원
                                                    </Text>
                                                </div>
                                                <div>
                                                    <Text size="xs" c="dimmed">최저가</Text>
                                                    <Text size="sm" fw={600} c="red">
                                                        {(parcel.auctionPrice! / 10000).toFixed(1)}억원
                                                    </Text>
                                                </div>
                                                <div>
                                                    <Text size="xs" c="dimmed">입찰가율</Text>
                                                    <Badge color="red" variant="light" size="lg">
                                                        {bidRate}%
                                                    </Badge>
                                                </div>
                                            </SimpleGrid>
                                        );
                                    })()}
                                </Paper>

                                {parcel.area && (
                                    <Paper p="sm" radius="md" bg="gray.0" mb="md">
                                        <Group justify="space-between">
                                            <Text size="sm" c="dimmed">평당 경매가</Text>
                                            <Text size="md" fw={600}>
                                                {Math.round(parcel.auctionPrice! / (parcel.area / 3.3058)).toLocaleString()}만원/평
                                            </Text>
                                        </Group>
                                    </Paper>
                                )}

                                {hasTransaction && (
                                    <Paper p="sm" radius="md" bg="green.0">
                                        <Text size="xs" c="dimmed" mb={4}>실거래가 대비</Text>
                                        <Badge color="green" size="lg">
                                            {Math.round((1 - parcel.auctionPrice! / parcel.transactionPrice!) * 100)}% 저렴
                                        </Badge>
                                    </Paper>
                                )}
                            </>
                        ) : (
                            <Text size="sm" c="dimmed" ta="center" py="xl">
                                경매 정보가 없습니다.
                            </Text>
                        )}
                    </Box>
                )}
            </Box>

            {/* 하단 네비게이션 바 */}
            <Box
                style={{
                    position: 'sticky',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '70px',
                    backgroundColor: 'white',
                    borderTop: '1px solid #e9ecef',
                    display: 'flex',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                    padding: '0 10px',
                    zIndex: 10,
                }}
            >
                {/* 지식산업센터 버튼 (있을 때만, 맨 앞에 표시) */}
                {hasKnowledgeCenter && (
                    <UnstyledButton
                        onClick={() => setMainTab('knowledgeCenter')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '8px',
                            color: mainTab === 'knowledgeCenter' ? '#7c3aed' : '#868e96',
                            transition: 'color 0.2s',
                            cursor: 'pointer',
                            position: 'relative',
                        }}
                    >
                        <IconBuilding size={24} stroke={1.5} />
                        <Text size="xs" mt={4} fw={mainTab === 'knowledgeCenter' ? 600 : 400}>
                            지산
                        </Text>
                        {(parcel.knowledgeIndustryCenters?.length || 0) > 0 && (
                            <Badge
                                size="xs"
                                circle
                                color="violet"
                                style={{ position: 'absolute', top: '5px', right: '20%' }}
                            >
                                {parcel.knowledgeIndustryCenters?.length}
                            </Badge>
                        )}
                    </UnstyledButton>
                )}

                {/* 기본정보 버튼 */}
                <UnstyledButton
                    onClick={() => setMainTab('basic')}
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '8px',
                        color: mainTab === 'basic' ? '#228be6' : '#868e96',
                        transition: 'color 0.2s',
                        cursor: 'pointer',
                    }}
                >
                    <IconHome size={24} stroke={1.5} />
                    <Text size="xs" mt={4} fw={mainTab === 'basic' ? 600 : 400}>
                        기본정보
                    </Text>
                </UnstyledButton>

                {/* 매물 버튼 */}
                {hasListing && (
                    <UnstyledButton
                        onClick={() => setMainTab('listing')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '8px',
                            color: mainTab === 'listing' ? '#40c057' : '#868e96',
                            transition: 'color 0.2s',
                            cursor: 'pointer',
                        }}
                    >
                        <IconTag size={24} stroke={1.5} />
                        <Text size="xs" mt={4} fw={mainTab === 'listing' ? 600 : 400}>
                            매물
                        </Text>
                    </UnstyledButton>
                )}

                {/* 입주기업 버튼 */}
                {hasFactory && (
                    <UnstyledButton
                        onClick={() => setMainTab('factory')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '8px',
                            color: mainTab === 'factory' ? '#ff6b35' : '#868e96',
                            transition: 'color 0.2s',
                            cursor: 'pointer',
                            position: 'relative',
                        }}
                    >
                        <IconBuildingFactory size={24} stroke={1.5} />
                        <Text size="xs" mt={4} fw={mainTab === 'factory' ? 600 : 400}>
                            입주기업
                        </Text>
                        {(parcel.factories?.length || 0) > 0 && (
                            <Badge
                                size="xs"
                                circle
                                style={{ position: 'absolute', top: '5px', right: '20%' }}
                            >
                                {parcel.factories?.length}
                            </Badge>
                        )}
                    </UnstyledButton>
                )}

                {/* 경매 버튼 */}
                {hasAuction && (
                    <UnstyledButton
                        onClick={() => setMainTab('auction')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '8px',
                            color: mainTab === 'auction' ? '#fa5252' : '#868e96',
                            transition: 'color 0.2s',
                            cursor: 'pointer',
                        }}
                    >
                        <IconGavel size={24} stroke={1.5} />
                        <Text size="xs" mt={4} fw={mainTab === 'auction' ? 600 : 400}>
                            경매
                        </Text>
                    </UnstyledButton>
                )}
            </Box>
        </Box>
    );
}
