'use client';

import { useState, useEffect } from 'react';
import {
    Modal,
    Stack,
    Group,
    Text,
    Button,
    NumberInput,
    Divider,
    ActionIcon,
    Box,
    Checkbox,
    Paper,
    ScrollArea,
    UnstyledButton,
    TextInput,
    Switch,
    Collapse,
    Badge,
    Accordion,
    Tabs,
    Input,
} from '@mantine/core';
import {
    IconX,
    IconRefresh,
    IconDeviceFloppy,
    IconBuilding,
    IconBuildingFactory2,
    IconBuildingWarehouse,
    IconMapPin,
    IconInfoCircle,
    IconGavel,
    IconBell,
    IconChevronRight,
    IconChevronDown,
    IconHome,
    IconSearch,
    IconCurrencyWon,
    IconTool,
    IconCalendar,
} from '@tabler/icons-react';
import {
    useFilter,
    useFilterActions,
    useFilteredCount,
    useFilterPresetActions,
    useSavedFilters,
    useActiveFilterId,
} from '@/lib/stores/filter-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { FILTER_PRESETS, type PropertyType, type DealTypePrice } from '@/lib/stores/types';
import RegionDrilldown from '@/components/common/RegionDrilldown';

// ========================================
// KSIC 업종 코드 데이터
// ========================================

interface IndustryCategory {
    code: string;
    label: string;
    description?: string;
    children?: IndustryCategory[];
}

const KSIC_INDUSTRIES: IndustryCategory[] = [
    {
        code: 'C',
        label: '제조업',
        children: [
            { code: 'C10', label: '식료품', description: '식품가공, 음료' },
            { code: 'C13', label: '섬유', description: '직물, 편조' },
            { code: 'C14', label: '의복/의류', description: '봉제의복' },
            { code: 'C20', label: '화학물질', description: '화합물, 화학제품' },
            { code: 'C21', label: '의약품', description: '의약품, 의료기기' },
            { code: 'C22', label: '고무/플라스틱', description: '고무, 플라스틱 제품' },
            { code: 'C23', label: '비금속광물', description: '유리, 세라믹' },
            { code: 'C24', label: '1차금속', description: '철강, 비철금속' },
            { code: 'C25', label: '금속가공', description: '금형, 절삭, 열처리' },
            { code: 'C26', label: '전자부품/컴퓨터', description: '반도체, PCB' },
            { code: 'C27', label: '의료/광학기기', description: '의료기기, 광학기기' },
            { code: 'C28', label: '전기장비', description: '전기장비 제조' },
            { code: 'C29', label: '기계장비', description: '기타 기계장비' },
            { code: 'C30', label: '자동차/트레일러', description: '자동차 부품' },
            { code: 'C31', label: '운송장비', description: '선박, 항공기' },
            { code: 'C32', label: '가구', description: '가구 제조' },
            { code: 'C33', label: '기타제조업', description: '귀금속, 악기 등' },
        ],
    },
    {
        code: 'J',
        label: '정보통신업',
        children: [
            { code: 'J58', label: '출판', description: '서적, 잡지' },
            { code: 'J59', label: '영상/오디오', description: '영화, 음악' },
            { code: 'J61', label: '통신업', description: '유무선 통신' },
            { code: 'J62', label: 'SW개발/공급', description: '시스템SW, 응용SW' },
            { code: 'J63', label: '정보서비스', description: '데이터처리, 포털' },
        ],
    },
    {
        code: 'M',
        label: '전문/과학/기술',
        children: [
            { code: 'M70', label: '연구개발', description: 'R&D 서비스' },
            { code: 'M71', label: '전문서비스', description: '설계, 엔지니어링' },
            { code: 'M72', label: '과학기술서비스', description: '시험, 분석' },
            { code: 'M73', label: '기타과학기술', description: '전문디자인' },
        ],
    },
    {
        code: 'H',
        label: '운수/창고업',
        children: [
            { code: 'H49', label: '육상운송', description: '화물운송' },
            { code: 'H52', label: '창고/운송관련', description: '창고, 물류' },
        ],
    },
];

// ========================================
// 필터 옵션 데이터
// ========================================

const PROPERTY_TYPE_OPTIONS = [
    { value: 'factory' as PropertyType, label: '공장', icon: IconBuildingFactory2, color: 'teal' },
    { value: 'knowledge-center' as PropertyType, label: '지식산업센터', icon: IconBuilding, color: 'violet' },
    { value: 'warehouse' as PropertyType, label: '창고', icon: IconBuildingWarehouse, color: 'orange' },
    { value: 'land' as PropertyType, label: '토지', icon: IconMapPin, color: 'green' },
] as const;

const FACTORY_APPROVAL_OPTIONS = [
    { value: 'registered', label: '등록공장' },
    { value: 'unregistered', label: '미등록공장' },
    { value: 'manufacturing', label: '제조업 등록' },
];

const WAREHOUSE_TYPE_OPTIONS = [
    { value: 'general', label: '일반창고' },
    { value: 'cold', label: '냉동/냉장창고' },
    { value: 'dangerous', label: '위험물창고' },
];

const LAND_CATEGORY_OPTIONS = [
    { value: 'dae', label: '대' },
    { value: 'factory', label: '공장용지' },
    { value: 'warehouse', label: '창고용지' },
    { value: 'misc', label: '잡종지' },
    { value: 'field', label: '전' },
    { value: 'paddy', label: '답' },
];

const ZONING_OPTIONS = [
    { value: 'exclusive_industrial', label: '전용공업지역' },
    { value: 'general_industrial', label: '일반공업지역' },
    { value: 'semi_industrial', label: '준공업지역' },
    { value: 'general_commercial', label: '일반상업지역' },
    { value: 'semi_residential', label: '준주거지역' },
    { value: 'planned_management', label: '계획관리지역' },
];

const TERRAIN_SHAPE_OPTIONS = [
    { value: 'square', label: '정방형' },
    { value: 'rectangular', label: '가장형' },
    { value: 'narrow', label: '세장형' },
    { value: 'trapezoid', label: '사다리형' },
    { value: 'triangle', label: '삼각형' },
    { value: 'irregular', label: '부정형' },
];

const TERRAIN_HEIGHT_OPTIONS = [
    { value: 'flat', label: '평지' },
    { value: 'gentle_slope', label: '완경사' },
    { value: 'steep_slope', label: '급경사' },
    { value: 'highland', label: '고지' },
    { value: 'lowland', label: '저지' },
];

const ROAD_SIDE_OPTIONS = [
    { value: 'wide', label: '광대한면' },
    { value: 'medium', label: '중로한면' },
    { value: 'small', label: '소로한면' },
    { value: 'narrow_a', label: '세로(가)' },
    { value: 'blind', label: '맹지' },
];

const MAIN_STRUCTURE_OPTIONS = [
    { value: 'rc', label: '철근콘크리트구조' },
    { value: 'steel', label: '철골구조' },
    { value: 'src', label: '철골철근콘크리트구조' },
    { value: 'brick', label: '조적구조' },
];

const AUCTION_STATUS_OPTIONS = [
    { value: 'ongoing', label: '진행중' },
    { value: 'changed', label: '변경/연기' },
    { value: 'sold', label: '낙찰' },
    { value: 'ended', label: '종료' },
];

const AUCTION_SPECIAL_NOTE_OPTIONS = [
    { value: 'lien', label: '유치권 신고' },
    { value: 'statutory', label: '법정지상권' },
    { value: 'partial', label: '지분경매' },
    { value: 'land_separate', label: '토지별도등기' },
];

const AUCTION_OCCUPANCY_OPTIONS = [
    { value: 'counter_force', label: '대항력 있음' },
    { value: 'no_counter_force', label: '대항력 없음' },
    { value: 'tenant_exists', label: '임차인 있음' },
    { value: 'no_tenant', label: '임차인 없음 (공실)' },
    { value: 'owner_occupied', label: '소유자 점유' },
    { value: 'third_party', label: '제3자 점유' },
];

// ========================================
// 탭 및 메뉴 설정
// ========================================

interface MenuItem {
    key: string;
    label: string;
}

interface MenuSection {
    label: string;
    items: MenuItem[];
}

interface TabConfig {
    id: string;
    label: string;
    icon: React.ReactNode;
    sections: MenuSection[];
}

const TAB_CONFIG: TabConfig[] = [
    {
        id: 'basic',
        label: '기본',
        icon: <IconInfoCircle size={16} />,
        sections: [
            {
                label: '매물정보',
                items: [
                    { key: 'propertyType', label: '매물유형' },
                    { key: 'dealType', label: '거래유형' },
                ],
            },
            {
                label: '면적',
                items: [
                    { key: 'landArea', label: '대지면적' },
                    { key: 'totalFloorArea', label: '연면적' },
                    { key: 'exclusiveArea', label: '전용면적' },
                ],
            },
        ],
    },
    {
        id: 'building',
        label: '건물',
        icon: <IconHome size={16} />,
        sections: [
            {
                label: '구조',
                items: [
                    { key: 'mainStructure', label: '주구조' },
                    { key: 'floorsAbove', label: '지상층수' },
                    { key: 'floorsBelow', label: '지하층수' },
                ],
            },
            {
                label: '건축정보',
                items: [
                    { key: 'completionYear', label: '준공연도' },
                    { key: 'buildingAge', label: '건축연한' },
                    { key: 'buildingCoverage', label: '건폐율' },
                    { key: 'floorAreaRatio', label: '용적률' },
                    { key: 'seismicDesign', label: '내진설계' },
                ],
            },
        ],
    },
    {
        id: 'land',
        label: '토지',
        icon: <IconMapPin size={16} />,
        sections: [
            {
                label: '토지정보',
                items: [
                    { key: 'landCategory', label: '지목' },
                    { key: 'zoning', label: '용도지역' },
                    { key: 'officialPrice', label: '공시지가' },
                ],
            },
            {
                label: '지형',
                items: [
                    { key: 'terrainShape', label: '지형형상' },
                    { key: 'terrainHeight', label: '지형고저' },
                    { key: 'roadSide', label: '도로접면' },
                ],
            },
        ],
    },
    {
        id: 'facility',
        label: '시설',
        icon: <IconTool size={16} />,
        sections: [
            {
                label: '공장',
                items: [
                    { key: 'factoryBusinessType', label: '업종' },
                    { key: 'allowedIndustry', label: '입주가능업종' },
                    { key: 'factoryApproval', label: '공장설립인허가' },
                    { key: 'industrialComplex', label: '산업단지' },
                ],
            },
            {
                label: '설비',
                items: [
                    { key: 'powerCapacity', label: '전력용량' },
                    { key: 'ceilingHeight', label: '층고' },
                    { key: 'floorLoad', label: '바닥하중' },
                    { key: 'crane', label: '크레인' },
                    { key: 'dockLeveler', label: '도크레벨러' },
                    { key: 'hoist', label: '호이스트' },
                ],
            },
            {
                label: '지식산업센터',
                items: [
                    { key: 'kcBuildingName', label: '건물명' },
                    { key: 'kcAllowedIndustry', label: '입주가능업종' },
                    { key: 'kcOccupancyRate', label: '입주율' },
                    { key: 'kcManagementFee', label: '관리비' },
                ],
            },
            {
                label: '창고',
                items: [
                    { key: 'warehouseType', label: '창고유형' },
                ],
            },
        ],
    },
    {
        id: 'auction',
        label: '경매',
        icon: <IconGavel size={16} />,
        sections: [
            {
                label: '경매정보',
                items: [
                    { key: 'auctionStatus', label: '진행상태' },
                    { key: 'auctionAppraisal', label: '감정가' },
                    { key: 'auctionMinPriceRate', label: '최저가율' },
                    { key: 'auctionFailCount', label: '유찰횟수' },
                    { key: 'auctionSpecialNote', label: '특이사항' },
                ],
            },
            {
                label: '권리분석',
                items: [
                    { key: 'auctionOccupancy', label: '점유상태' },
                    { key: 'auctionAssumption', label: '인수조건' },
                ],
            },
            {
                label: '일정',
                items: [
                    { key: 'auctionDate', label: '매각기일' },
                    { key: 'auctionWinningBidRate', label: '낙찰가율' },
                ],
            },
        ],
    },
];

// ========================================
// 저장 다이얼로그 컴포넌트
// ========================================

interface SaveFilterDialogProps {
    opened: boolean;
    onClose: () => void;
    onSave: (name: string, notifyEnabled: boolean, notifyRegions: string[]) => void;
}

function SaveFilterDialog({ opened, onClose, onSave }: SaveFilterDialogProps) {
    const [filterName, setFilterName] = useState('');
    const [notifyEnabled, setNotifyEnabled] = useState(false);
    const [selectedRegions, setSelectedRegions] = useState<{ code: string; name: string }[]>([]);
    const [showRegionPicker, setShowRegionPicker] = useState(false);

    const handleSave = () => {
        if (!filterName.trim()) return;
        onSave(filterName.trim(), notifyEnabled, selectedRegions.map(r => r.code));
        setFilterName('');
        setNotifyEnabled(false);
        setSelectedRegions([]);
        setShowRegionPicker(false);
        onClose();
    };

    const handleRegionSelect = (level: 'sig' | 'emd', code: string, name: string) => {
        if (!selectedRegions.find(r => r.code === code)) {
            setSelectedRegions([...selectedRegions, { code, name }]);
        }
        setShowRegionPicker(false);
    };

    const removeRegion = (code: string) => {
        setSelectedRegions(selectedRegions.filter(r => r.code !== code));
    };

    if (!opened) return null;

    return (
        <Box
            style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10003,
            }}
            onClick={onClose}
        >
            <Paper
                shadow="xl"
                radius="lg"
                p="lg"
                style={{ width: 400, maxHeight: '80%', overflow: 'visible', zIndex: 10004 }}
                onClick={(e) => e.stopPropagation()}
            >
                <Group justify="space-between" mb="md">
                    <Text size="lg" fw={700}>필터 저장</Text>
                    <ActionIcon variant="subtle" color="gray" onClick={onClose}>
                        <IconX size={18} />
                    </ActionIcon>
                </Group>

                <Stack gap="md">
                    <TextInput
                        label="필터 이름"
                        placeholder="예: 남동공단 공장 50평 이상"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        required
                    />
                    <Divider />
                    <Group justify="space-between">
                        <Group gap="xs">
                            <IconBell size={18} color="#228be6" />
                            <Box>
                                <Text size="sm" fw={500}>매물알림 받기</Text>
                                <Text size="xs" c="dimmed">새 매물이 등록되면 알림을 받습니다</Text>
                            </Box>
                        </Group>
                        <Switch
                            checked={notifyEnabled}
                            onChange={(e) => {
                                setNotifyEnabled(e.currentTarget.checked);
                                if (!e.currentTarget.checked) {
                                    setShowRegionPicker(false);
                                    setSelectedRegions([]);
                                }
                            }}
                        />
                    </Group>
                    <Collapse in={notifyEnabled}>
                        <Stack gap="sm" mt="xs">
                            <Text size="xs" c="dimmed">알림 받을 지역을 선택하세요</Text>
                            {selectedRegions.length > 0 && (
                                <Group gap="xs">
                                    {selectedRegions.map((region) => (
                                        <Paper
                                            key={region.code}
                                            px="sm" py={4} radius="xl" withBorder
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                        >
                                            <Text size="xs">{region.name}</Text>
                                            <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => removeRegion(region.code)}>
                                                <IconX size={12} />
                                            </ActionIcon>
                                        </Paper>
                                    ))}
                                </Group>
                            )}
                            <UnstyledButton
                                onClick={() => setShowRegionPicker(!showRegionPicker)}
                                style={{
                                    padding: '10px 14px', borderRadius: 8, border: '1px dashed #ced4da',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}
                            >
                                <Group gap="xs">
                                    <IconMapPin size={16} color="#868e96" />
                                    <Text size="sm" c="dimmed">지역 추가</Text>
                                </Group>
                                {showRegionPicker ? <IconChevronDown size={16} color="#868e96" /> : <IconChevronRight size={16} color="#868e96" />}
                            </UnstyledButton>
                            <Collapse in={showRegionPicker}>
                                <Box style={{ border: '1px solid #e9ecef', borderRadius: 8, overflow: 'hidden', position: 'relative', zIndex: 10005 }}>
                                    <RegionDrilldown onSelect={handleRegionSelect} onClose={() => setShowRegionPicker(false)} />
                                </Box>
                            </Collapse>
                        </Stack>
                    </Collapse>
                </Stack>

                <Group justify="flex-end" mt="xl">
                    <Button variant="subtle" color="gray" onClick={onClose}>취소</Button>
                    <Button onClick={handleSave} disabled={!filterName.trim()} leftSection={<IconDeviceFloppy size={16} />}>저장</Button>
                </Group>
            </Paper>
        </Box>
    );
}

// ========================================
// 메인 컴포넌트
// ========================================

interface DetailedFilterModalProps {
    opened: boolean;
    onClose: () => void;
}

export default function DetailedFilterModal({ opened, onClose }: DetailedFilterModalProps) {
    const filter = useFilter();
    const { setFilter, resetFilter } = useFilterActions();
    const { total, filtered } = useFilteredCount();
    const { loadPreset, loadFilter, saveFilter, deleteFilter } = useFilterPresetActions();
    const savedFilters = useSavedFilters();
    const activeFilterId = useActiveFilterId();
    const visibleLayers = useUIStore((state) => state.visibleLayers);
    const toggleLayer = useUIStore((state) => state.toggleLayer);

    const [activeTab, setActiveTab] = useState<string>('basic');
    const [selectedFilter, setSelectedFilter] = useState<string>('propertyType');
    const [saveDialogOpened, setSaveDialogOpened] = useState(false);
    const [industrySearch, setIndustrySearch] = useState('');

    // 선택된 필터를 칩으로 변환
    const getFilterChips = () => {
        const chips: { id: string; label: string; category: string }[] = [];

        // 매물유형
        if (filter.propertyTypes.length > 0) {
            filter.propertyTypes.forEach(type => {
                const typeLabel = PROPERTY_TYPE_OPTIONS.find(t => t.value === type)?.label || type;
                chips.push({ id: `propertyType-${type}`, label: typeLabel, category: '매물유형' });
            });
        }

        // 거래유형 - 매매
        if (filter.dealTypes.sale.enabled) {
            const min = filter.dealTypes.sale.priceMin ? `${(filter.dealTypes.sale.priceMin / 10000).toFixed(0)}억` : '최소';
            const max = filter.dealTypes.sale.priceMax ? `${(filter.dealTypes.sale.priceMax / 10000).toFixed(0)}억` : '최대';
            chips.push({ id: 'dealType-sale', label: `매매 ${min}~${max}`, category: '거래유형' });
        }

        // 거래유형 - 전세
        if (filter.dealTypes.jeonse.enabled) {
            const min = filter.dealTypes.jeonse.depositMin ? `${(filter.dealTypes.jeonse.depositMin / 10000).toFixed(0)}억` : '최소';
            const max = filter.dealTypes.jeonse.depositMax ? `${(filter.dealTypes.jeonse.depositMax / 10000).toFixed(0)}억` : '최대';
            chips.push({ id: 'dealType-jeonse', label: `전세 ${min}~${max}`, category: '거래유형' });
        }

        // 거래유형 - 월세
        if (filter.dealTypes.monthly.enabled) {
            const deposit = filter.dealTypes.monthly.depositMin || filter.dealTypes.monthly.depositMax
                ? `보증금 ${filter.dealTypes.monthly.depositMin || 0}~${filter.dealTypes.monthly.depositMax || '∞'}만원`
                : '';
            const monthly = filter.dealTypes.monthly.monthlyMin || filter.dealTypes.monthly.monthlyMax
                ? `월세 ${filter.dealTypes.monthly.monthlyMin || 0}~${filter.dealTypes.monthly.monthlyMax || '∞'}만원`
                : '';
            chips.push({ id: 'dealType-monthly', label: `월세 ${deposit} ${monthly}`.trim(), category: '거래유형' });
        }

        // 면적 필터
        if (filter.landAreaMin !== null || filter.landAreaMax !== null) {
            chips.push({
                id: 'landArea',
                label: `대지면적 ${filter.landAreaMin || 0}~${filter.landAreaMax || '∞'}㎡`,
                category: '면적'
            });
        }
        if (filter.totalFloorAreaMin !== null || filter.totalFloorAreaMax !== null) {
            chips.push({
                id: 'totalFloorArea',
                label: `연면적 ${filter.totalFloorAreaMin || 0}~${filter.totalFloorAreaMax || '∞'}㎡`,
                category: '면적'
            });
        }
        if (filter.exclusiveAreaMin !== null || filter.exclusiveAreaMax !== null) {
            chips.push({
                id: 'exclusiveArea',
                label: `전용면적 ${filter.exclusiveAreaMin || 0}~${filter.exclusiveAreaMax || '∞'}㎡`,
                category: '면적'
            });
        }

        // 건물 - 구조
        if (filter.mainStructures && filter.mainStructures.length > 0) {
            filter.mainStructures.forEach(s => {
                const label = MAIN_STRUCTURE_OPTIONS.find(o => o.value === s)?.label || s;
                chips.push({ id: `mainStructure-${s}`, label: `주구조: ${label}`, category: '건물' });
            });
        }

        // 지목
        if (filter.landCategories && filter.landCategories.length > 0) {
            filter.landCategories.forEach(c => {
                const label = LAND_CATEGORY_OPTIONS.find(o => o.value === c)?.label || c;
                chips.push({ id: `landCategory-${c}`, label: `지목: ${label}`, category: '토지' });
            });
        }

        // 용도지역
        if (filter.zoningTypes && filter.zoningTypes.length > 0) {
            filter.zoningTypes.forEach(z => {
                const label = ZONING_OPTIONS.find(o => o.value === z)?.label || z;
                chips.push({ id: `zoning-${z}`, label: label, category: '용도지역' });
            });
        }

        // 업종
        if (filter.factoryBusinessTypes && filter.factoryBusinessTypes.length > 0) {
            filter.factoryBusinessTypes.slice(0, 3).forEach(code => {
                const industry = KSIC_INDUSTRIES.flatMap(c => c.children || []).find(i => i.code === code);
                chips.push({ id: `businessType-${code}`, label: `${code} ${industry?.label || ''}`, category: '업종' });
            });
            if (filter.factoryBusinessTypes.length > 3) {
                chips.push({ id: 'businessType-more', label: `외 ${filter.factoryBusinessTypes.length - 3}개`, category: '업종' });
            }
        }

        // 경매
        if (filter.auctionStatuses && filter.auctionStatuses.length > 0) {
            filter.auctionStatuses.forEach(s => {
                const label = AUCTION_STATUS_OPTIONS.find(o => o.value === s)?.label || s;
                chips.push({ id: `auction-${s}`, label: label, category: '경매' });
            });
        }

        return chips;
    };

    // 칩 제거 핸들러
    const removeChip = (chipId: string) => {
        const [category, value] = chipId.split('-');

        switch (category) {
            case 'propertyType':
                setFilter({
                    propertyTypes: filter.propertyTypes.filter(t => t !== value)
                });
                break;

            case 'dealType':
                setFilter({
                    dealTypes: {
                        ...filter.dealTypes,
                        [value]: { ...filter.dealTypes[value as 'sale' | 'jeonse' | 'monthly'], enabled: false }
                    }
                });
                break;

            case 'landArea':
                setFilter({ landAreaMin: null, landAreaMax: null });
                break;

            case 'totalFloorArea':
                setFilter({ totalFloorAreaMin: null, totalFloorAreaMax: null });
                break;

            case 'exclusiveArea':
                setFilter({ exclusiveAreaMin: null, exclusiveAreaMax: null });
                break;

            case 'mainStructure':
                setFilter({
                    mainStructures: (filter.mainStructures || []).filter(s => s !== value)
                });
                break;

            case 'landCategory':
                setFilter({
                    landCategories: (filter.landCategories || []).filter(c => c !== value)
                });
                break;

            case 'zoning':
                setFilter({
                    zoningTypes: (filter.zoningTypes || []).filter(z => z !== value)
                });
                break;

            case 'businessType':
                if (value !== 'more') {
                    setFilter({
                        factoryBusinessTypes: filter.factoryBusinessTypes.filter(t => t !== value)
                    });
                }
                break;

            case 'auction':
                setFilter({
                    auctionStatuses: (filter.auctionStatuses || []).filter(s => s !== value)
                });
                break;

            default:
                break;
        }
    };

    const filterChips = getFilterChips();

    // 탭 변경 시 첫 번째 필터 아이템 선택
    useEffect(() => {
        const tabConfig = TAB_CONFIG.find(t => t.id === activeTab);
        if (tabConfig && tabConfig.sections.length > 0 && tabConfig.sections[0].items.length > 0) {
            setSelectedFilter(tabConfig.sections[0].items[0].key);
        }
    }, [activeTab]);

    // 경매 탭 선택 시 자동으로 경매 레이어 활성화
    useEffect(() => {
        if (activeTab === 'auction' && !visibleLayers.has('auction-marker')) {
            toggleLayer('auction-marker');
        }
    }, [activeTab, visibleLayers, toggleLayer]);

    const handleSaveFilter = (name: string, notifyEnabled: boolean, notifyRegions: string[]) => {
        saveFilter(name, notifyEnabled ? `알림: ${notifyRegions.join(', ')}` : '');
    };

    // 매물유형 토글
    const togglePropertyType = (type: PropertyType) => {
        const current = filter.propertyTypes;
        if (current.includes(type)) {
            setFilter({ propertyTypes: current.filter(t => t !== type) });
        } else {
            setFilter({ propertyTypes: [...current, type] });
        }
    };

    // 거래유형 토글
    const toggleDealType = (dealType: 'sale' | 'jeonse' | 'monthly') => {
        const current = filter.dealTypes[dealType];
        setFilter({
            dealTypes: {
                ...filter.dealTypes,
                [dealType]: { ...current, enabled: !current.enabled },
            },
        });
    };

    // 거래유형 가격 업데이트
    const updateDealTypePrice = (
        dealType: 'sale' | 'jeonse' | 'monthly',
        field: keyof DealTypePrice,
        value: number | null
    ) => {
        setFilter({
            dealTypes: {
                ...filter.dealTypes,
                [dealType]: { ...filter.dealTypes[dealType], [field]: value },
            },
        });
    };

    // 업종 토글
    const toggleIndustry = (code: string, field: 'allowedIndustries' | 'kcAllowedIndustries' | 'factoryBusinessTypes') => {
        const current = filter[field];
        if (current.includes(code)) {
            setFilter({ [field]: current.filter((c: string) => c !== code) });
        } else {
            setFilter({ [field]: [...current, code] });
        }
    };

    // 체크박스 그룹 토글
    const toggleCheckboxValue = (field: string, value: string) => {
        const current = (filter as any)[field] || [];
        if (current.includes(value)) {
            setFilter({ [field]: current.filter((v: string) => v !== value) });
        } else {
            setFilter({ [field]: [...current, value] });
        }
    };

    // 필터 항목별 필요한 매물유형 매핑
    const filterToPropertyType: Record<string, { types: PropertyType[]; label: string }> = {
        // 공장 관련
        factoryBusinessType: { types: ['factory'], label: '공장' },
        allowedIndustry: { types: ['factory'], label: '공장' },
        factoryApproval: { types: ['factory'], label: '공장' },
        industrialComplex: { types: ['factory'], label: '공장' },
        // 설비 관련 (공장, 창고)
        powerCapacity: { types: ['factory', 'warehouse'], label: '공장 또는 창고' },
        ceilingHeight: { types: ['factory', 'warehouse'], label: '공장 또는 창고' },
        floorLoad: { types: ['factory', 'warehouse'], label: '공장 또는 창고' },
        crane: { types: ['factory'], label: '공장' },
        dockLeveler: { types: ['factory', 'warehouse'], label: '공장 또는 창고' },
        hoist: { types: ['factory'], label: '공장' },
        // 지식산업센터 관련
        kcBuildingName: { types: ['knowledge-center'], label: '지식산업센터' },
        kcAllowedIndustry: { types: ['knowledge-center'], label: '지식산업센터' },
        kcOccupancyRate: { types: ['knowledge-center'], label: '지식산업센터' },
        kcManagementFee: { types: ['knowledge-center'], label: '지식산업센터' },
        // 창고 관련
        warehouseType: { types: ['warehouse'], label: '창고' },
    };

    // 특정 필터가 비활성화되어야 하는지 확인
    const isFilterDisabled = (filterKey: string): { disabled: boolean; requiredLabel?: string } => {
        // 매물유형이 선택되지 않았으면 모든 필터 활성화 (전체 검색)
        if (filter.propertyTypes.length === 0) return { disabled: false };

        const requirement = filterToPropertyType[filterKey];
        if (!requirement) return { disabled: false };  // 매핑 없으면 항상 활성화

        // 필요한 매물유형 중 하나라도 선택되어 있으면 활성화
        const isEnabled = requirement.types.some(type => filter.propertyTypes.includes(type));
        return { disabled: !isEnabled, requiredLabel: requirement.label };
    };

    // 섹션이 비활성화되어야 하는지 확인 (매물유형 미선택 시)
    const isSectionDisabled = (sectionLabel: string): boolean => {
        // 매물유형이 선택되지 않았으면 모든 시설 섹션 활성화 (전체 검색)
        if (filter.propertyTypes.length === 0) return false;

        // 시설 탭의 특정 섹션들은 매물유형 선택에 따라 비활성화
        const sectionToPropertyType: Record<string, PropertyType[]> = {
            '공장': ['factory'],
            '설비': ['factory', 'warehouse'],  // 공장과 창고 모두 설비 관련
            '지식산업센터': ['knowledge-center'],
            '창고': ['warehouse'],
        };

        const requiredTypes = sectionToPropertyType[sectionLabel];
        if (!requiredTypes) return false;  // 매핑 없으면 항상 활성화

        // 필요한 매물유형 중 하나라도 선택되어 있으면 활성화
        return !requiredTypes.some(type => filter.propertyTypes.includes(type));
    };

    // 비활성화된 필터 안내 메시지 렌더러
    const renderDisabledFilterMessage = (requiredLabel: string) => (
        <Stack gap="md" align="center" justify="center" style={{ minHeight: 200 }}>
            <IconInfoCircle size={48} color="#adb5bd" />
            <Text size="sm" c="dimmed" ta="center">
                이 필터를 사용하려면<br />
                <Text component="span" fw={600} c="blue">기본 탭 → 매물유형</Text>에서<br />
                <Text component="span" fw={600}>"{requiredLabel}"</Text>을(를) 선택하세요
            </Text>
            <Button
                variant="light"
                size="sm"
                onClick={() => {
                    setActiveTab('basic');
                    setSelectedFilter('propertyType');
                }}
            >
                매물유형 선택하러 가기
            </Button>
        </Stack>
    );

    // 메뉴 섹션 렌더링 (스크린샷 디자인)
    const renderMenuSections = () => {
        const tabConfig = TAB_CONFIG.find(t => t.id === activeTab);
        if (!tabConfig) return null;

        return tabConfig.sections.map((section, idx) => {
            const isDisabled = isSectionDisabled(section.label);

            return (
                <Box key={idx} mb="sm" style={{ opacity: isDisabled ? 0.5 : 1 }}>
                    <Text size="xs" c="dimmed" fw={500} px="md" py={6} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {section.label}
                        {isDisabled && ' (매물유형 선택 필요)'}
                    </Text>
                    <Stack gap={0}>
                        {section.items.map((item) => {
                            const isSelected = selectedFilter === item.key;
                            return (
                                <UnstyledButton
                                    key={item.key}
                                    w="100%"
                                    px="md"
                                    py={10}
                                    style={{
                                        borderLeft: isSelected ? '3px solid #228be6' : '3px solid transparent',
                                        backgroundColor: isSelected ? '#f8f9fa' : 'transparent',
                                        cursor: 'pointer',
                                    }}
                                    styles={{
                                        root: {
                                            '&:hover': {
                                                backgroundColor: '#f8f9fa',
                                            },
                                        },
                                    }}
                                    onClick={() => setSelectedFilter(item.key)}
                                >
                                    <Text size="sm" fw={isSelected ? 600 : 400} c={isDisabled ? 'dimmed' : undefined} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {item.label}
                                    </Text>
                                </UnstyledButton>
                            );
                        })}
                    </Stack>
                </Box>
            );
        });
    };

    // ========================================
    // 렌더러 함수들
    // ========================================

    // 매물유형 렌더러
    const renderPropertyTypeFilter = () => (
        <Stack gap="md">
            <Box>
                <Text size="md" fw={600} mb={4}>매물유형</Text>
                <Text size="xs" c="dimmed">원하는 매물 유형을 선택하세요 (복수 선택 가능)</Text>
            </Box>
            <Group gap="md">
                {PROPERTY_TYPE_OPTIONS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = filter.propertyTypes.includes(item.value);
                    return (
                        <Paper
                            key={item.value}
                            p="md"
                            radius="md"
                            withBorder
                            style={{
                                cursor: 'pointer',
                                borderColor: isSelected ? `var(--mantine-color-${item.color}-5)` : undefined,
                                backgroundColor: isSelected ? `var(--mantine-color-${item.color}-0)` : undefined,
                                flex: 1, minWidth: 100, textAlign: 'center',
                            }}
                            onClick={() => togglePropertyType(item.value)}
                        >
                            <Stack align="center" gap="xs">
                                <Icon size={24} color={isSelected ? `var(--mantine-color-${item.color}-6)` : '#868e96'} />
                                <Text size="xs" fw={isSelected ? 600 : 400}>{item.label}</Text>
                            </Stack>
                        </Paper>
                    );
                })}
            </Group>
            {filter.propertyTypes.length === 0 && (
                <Text size="xs" c="dimmed" ta="center">선택하지 않으면 전체 유형을 검색합니다</Text>
            )}
        </Stack>
    );

    // 거래유형 + 가격 렌더러
    const renderDealTypeFilter = () => (
        <Stack gap="md">
            <Box>
                <Text size="md" fw={600} mb={4}>거래유형</Text>
                <Text size="xs" c="dimmed">원하는 거래 유형과 가격 조건을 설정하세요</Text>
            </Box>

            {/* 매매 */}
            <Paper p="md" radius="md" withBorder>
                <Group justify="space-between" mb={filter.dealTypes.sale.enabled ? 'md' : 0}>
                    <Checkbox
                        checked={filter.dealTypes.sale.enabled}
                        onChange={() => toggleDealType('sale')}
                        label={<Text fw={500}>매매</Text>}
                    />
                    <IconCurrencyWon size={18} color="#868e96" />
                </Group>
                <Collapse in={filter.dealTypes.sale.enabled}>
                    <Group gap="sm" align="flex-end">
                        <NumberInput
                            placeholder="최소"
                            value={filter.dealTypes.sale.priceMin ?? ''}
                            onChange={(v) => updateDealTypePrice('sale', 'priceMin', v === '' ? null : Number(v))}
                            min={0} hideControls size="sm" style={{ flex: 1 }}
                            rightSection={<Text size="xs" c="dimmed">만원</Text>}
                        />
                        <Text c="dimmed" size="sm">~</Text>
                        <NumberInput
                            placeholder="최대"
                            value={filter.dealTypes.sale.priceMax ?? ''}
                            onChange={(v) => updateDealTypePrice('sale', 'priceMax', v === '' ? null : Number(v))}
                            min={0} hideControls size="sm" style={{ flex: 1 }}
                            rightSection={<Text size="xs" c="dimmed">만원</Text>}
                        />
                    </Group>
                </Collapse>
            </Paper>

            {/* 전세 */}
            <Paper p="md" radius="md" withBorder>
                <Group justify="space-between" mb={filter.dealTypes.jeonse.enabled ? 'md' : 0}>
                    <Checkbox
                        checked={filter.dealTypes.jeonse.enabled}
                        onChange={() => toggleDealType('jeonse')}
                        label={<Text fw={500}>전세</Text>}
                    />
                    <IconCurrencyWon size={18} color="#868e96" />
                </Group>
                <Collapse in={filter.dealTypes.jeonse.enabled}>
                    <Group gap="sm" align="flex-end">
                        <NumberInput
                            label="보증금"
                            placeholder="최소"
                            value={filter.dealTypes.jeonse.depositMin ?? ''}
                            onChange={(v) => updateDealTypePrice('jeonse', 'depositMin', v === '' ? null : Number(v))}
                            min={0} hideControls size="sm" style={{ flex: 1 }}
                        />
                        <Text c="dimmed" size="sm" pb={8}>~</Text>
                        <NumberInput
                            placeholder="최대"
                            value={filter.dealTypes.jeonse.depositMax ?? ''}
                            onChange={(v) => updateDealTypePrice('jeonse', 'depositMax', v === '' ? null : Number(v))}
                            min={0} hideControls size="sm" style={{ flex: 1 }}
                            rightSection={<Text size="xs" c="dimmed">만원</Text>}
                        />
                    </Group>
                </Collapse>
            </Paper>

            {/* 월세 */}
            <Paper p="md" radius="md" withBorder>
                <Group justify="space-between" mb={filter.dealTypes.monthly.enabled ? 'md' : 0}>
                    <Checkbox
                        checked={filter.dealTypes.monthly.enabled}
                        onChange={() => toggleDealType('monthly')}
                        label={<Text fw={500}>월세</Text>}
                    />
                    <IconCurrencyWon size={18} color="#868e96" />
                </Group>
                <Collapse in={filter.dealTypes.monthly.enabled}>
                    <Stack gap="sm">
                        <Group gap="sm" align="flex-end">
                            <NumberInput
                                label="보증금"
                                placeholder="최소"
                                value={filter.dealTypes.monthly.depositMin ?? ''}
                                onChange={(v) => updateDealTypePrice('monthly', 'depositMin', v === '' ? null : Number(v))}
                                min={0} hideControls size="sm" style={{ flex: 1 }}
                            />
                            <Text c="dimmed" size="sm" pb={8}>~</Text>
                            <NumberInput
                                placeholder="최대"
                                value={filter.dealTypes.monthly.depositMax ?? ''}
                                onChange={(v) => updateDealTypePrice('monthly', 'depositMax', v === '' ? null : Number(v))}
                                min={0} hideControls size="sm" style={{ flex: 1 }}
                                rightSection={<Text size="xs" c="dimmed">만원</Text>}
                            />
                        </Group>
                        <Group gap="sm" align="flex-end">
                            <NumberInput
                                label="월세"
                                placeholder="최소"
                                value={filter.dealTypes.monthly.monthlyMin ?? ''}
                                onChange={(v) => updateDealTypePrice('monthly', 'monthlyMin', v === '' ? null : Number(v))}
                                min={0} hideControls size="sm" style={{ flex: 1 }}
                            />
                            <Text c="dimmed" size="sm" pb={8}>~</Text>
                            <NumberInput
                                placeholder="최대"
                                value={filter.dealTypes.monthly.monthlyMax ?? ''}
                                onChange={(v) => updateDealTypePrice('monthly', 'monthlyMax', v === '' ? null : Number(v))}
                                min={0} hideControls size="sm" style={{ flex: 1 }}
                                rightSection={<Text size="xs" c="dimmed">만원</Text>}
                            />
                        </Group>
                    </Stack>
                </Collapse>
            </Paper>

            {!filter.dealTypes.sale.enabled && !filter.dealTypes.jeonse.enabled && !filter.dealTypes.monthly.enabled && (
                <Text size="xs" c="dimmed" ta="center">선택하지 않으면 전체 거래유형을 검색합니다</Text>
            )}
        </Stack>
    );

    // 범위 입력 렌더러
    const renderRangeInput = (_title: string, _description: string, minField: string, maxField: string, suffix: string) => (
        <Group gap="sm" align="flex-end">
            <NumberInput
                placeholder="최소"
                value={(filter as any)[minField] ?? ''}
                onChange={(v) => setFilter({ [minField]: v === '' ? null : Number(v) })}
                min={0} hideControls size="sm" style={{ flex: 1 }}
            />
            <Text c="dimmed" size="sm">~</Text>
            <NumberInput
                placeholder="최대"
                value={(filter as any)[maxField] ?? ''}
                onChange={(v) => setFilter({ [maxField]: v === '' ? null : Number(v) })}
                min={0} hideControls size="sm" style={{ flex: 1 }}
                rightSection={<Text size="xs" c="dimmed">{suffix}</Text>}
            />
        </Group>
    );

    // 체크박스 그룹 렌더러
    const renderCheckboxGroup = (_title: string, _description: string, options: { value: string; label: string }[], field: string) => (
        <Stack gap="xs">
            {options.map(opt => (
                <Checkbox
                    key={opt.value}
                    label={opt.label}
                    checked={((filter as any)[field] || []).includes(opt.value)}
                    onChange={() => toggleCheckboxValue(field, opt.value)}
                />
            ))}
        </Stack>
    );

    // 예/아니오 렌더러
    const renderBooleanFilter = (_title: string, _description: string, field: string, options: { yes: string; no: string }) => (
        <Group gap="md">
                {[
                    { value: true, label: options.yes },
                    { value: false, label: options.no },
                    { value: null, label: '상관없음' },
                ].map(item => (
                    <Paper
                        key={String(item.value)}
                        p="md" radius="md" withBorder
                        style={{
                            cursor: 'pointer', flex: 1, textAlign: 'center',
                            borderColor: (filter as any)[field] === item.value ? 'var(--mantine-color-blue-5)' : undefined,
                            backgroundColor: (filter as any)[field] === item.value ? 'var(--mantine-color-blue-0)' : undefined,
                        }}
                        onClick={() => setFilter({ [field]: item.value })}
                    >
                        <Text size="sm">{item.label}</Text>
                    </Paper>
                ))}
        </Group>
    );

    // 업종 선택 렌더러 (KSIC 코드)
    const renderIndustryFilter = (field: 'allowedIndustries' | 'kcAllowedIndustries' | 'factoryBusinessTypes', _title: string) => {
        const selectedCodes = filter[field];
        const filteredIndustries = industrySearch
            ? KSIC_INDUSTRIES.map(cat => ({
                ...cat,
                children: cat.children?.filter(
                    child =>
                        child.code.toLowerCase().includes(industrySearch.toLowerCase()) ||
                        child.label.includes(industrySearch) ||
                        child.description?.includes(industrySearch)
                ),
            })).filter(cat => cat.children && cat.children.length > 0)
            : KSIC_INDUSTRIES;

        return (
            <Stack gap="md">
                <TextInput
                    placeholder="업종 검색..."
                    leftSection={<IconSearch size={16} />}
                    value={industrySearch}
                    onChange={(e) => setIndustrySearch(e.target.value)}
                />

                {selectedCodes.length > 0 && (
                    <Group gap="xs">
                        {selectedCodes.map(code => {
                            const industry = KSIC_INDUSTRIES.flatMap(c => c.children || []).find(i => i.code === code);
                            return (
                                <Badge
                                    key={code}
                                    variant="light"
                                    rightSection={
                                        <ActionIcon size="xs" variant="subtle" onClick={() => toggleIndustry(code, field)}>
                                            <IconX size={12} />
                                        </ActionIcon>
                                    }
                                >
                                    {code} {industry?.label || ''}
                                </Badge>
                            );
                        })}
                    </Group>
                )}

                <ScrollArea h={300}>
                    <Accordion variant="contained" radius="md">
                        {filteredIndustries.map(category => (
                            <Accordion.Item key={category.code} value={category.code}>
                                <Accordion.Control>
                                    <Group gap="xs">
                                        <Badge size="sm" variant="outline">{category.code}</Badge>
                                        <Text size="sm" fw={500}>{category.label}</Text>
                                    </Group>
                                </Accordion.Control>
                                <Accordion.Panel>
                                    <Stack gap="xs">
                                        {category.children?.map(child => (
                                            <UnstyledButton
                                                key={child.code}
                                                onClick={() => toggleIndustry(child.code, field)}
                                                style={{
                                                    padding: '8px 12px', borderRadius: 6,
                                                    backgroundColor: selectedCodes.includes(child.code) ? 'var(--mantine-color-blue-0)' : 'transparent',
                                                    border: selectedCodes.includes(child.code) ? '1px solid var(--mantine-color-blue-3)' : '1px solid transparent',
                                                }}
                                            >
                                                <Group gap="xs" justify="space-between">
                                                    <Group gap="xs">
                                                        <Badge size="xs" variant="light" color="gray">{child.code}</Badge>
                                                        <Text size="sm">{child.label}</Text>
                                                    </Group>
                                                    {child.description && <Text size="xs" c="dimmed">{child.description}</Text>}
                                                </Group>
                                            </UnstyledButton>
                                        ))}
                                    </Stack>
                                </Accordion.Panel>
                            </Accordion.Item>
                        ))}
                    </Accordion>
                </ScrollArea>
            </Stack>
        );
    };

    // 상세 패널 렌더링
    const renderDetailPanel = () => {
        // 비활성화된 필터인지 확인
        const { disabled, requiredLabel } = isFilterDisabled(selectedFilter);
        if (disabled && requiredLabel) {
            return renderDisabledFilterMessage(requiredLabel);
        }

        switch (selectedFilter) {
            // 기본 탭
            case 'propertyType':
                return renderPropertyTypeFilter();
            case 'dealType':
                return renderDealTypeFilter();
            case 'landArea':
                return renderRangeInput('대지면적', '대지면적 범위를 설정하세요', 'landAreaMin', 'landAreaMax', '㎡');
            case 'totalFloorArea':
                return renderRangeInput('연면적', '연면적 범위를 설정하세요', 'totalFloorAreaMin', 'totalFloorAreaMax', '㎡');
            case 'exclusiveArea':
                return renderRangeInput('전용면적', '전용면적 범위를 설정하세요', 'exclusiveAreaMin', 'exclusiveAreaMax', '㎡');

            // 건물 탭
            case 'mainStructure':
                return renderCheckboxGroup('주구조', '건물의 구조를 선택하세요', MAIN_STRUCTURE_OPTIONS, 'mainStructures');
            case 'floorsAbove':
                return renderRangeInput('지상층수', '지상 층수 범위를 설정하세요', 'floorsAboveMin', 'floorsAboveMax', '층');
            case 'floorsBelow':
                return renderRangeInput('지하층수', '지하 층수 범위를 설정하세요', 'floorsBelowMin', 'floorsBelowMax', '층');
            case 'completionYear':
                return renderRangeInput('준공연도', '준공 연도 범위를 설정하세요', 'completionYearMin', 'completionYearMax', '년');
            case 'buildingAge':
                return renderRangeInput('건축연한', '건물 노후 정도를 설정하세요', 'buildingAgeMin', 'buildingAgeMax', '년');
            case 'buildingCoverage':
                return renderRangeInput('건폐율', '건폐율 범위를 설정하세요', 'buildingCoverageMin', 'buildingCoverageMax', '%');
            case 'floorAreaRatio':
                return renderRangeInput('용적률', '용적률 범위를 설정하세요', 'floorAreaRatioMin', 'floorAreaRatioMax', '%');
            case 'seismicDesign':
                return renderBooleanFilter('내진설계', '내진설계 적용 여부를 선택하세요', 'hasSeismicDesign', { yes: '적용', no: '미적용' });

            // 토지 탭
            case 'landCategory':
                return renderCheckboxGroup('지목', '토지의 지목을 선택하세요', LAND_CATEGORY_OPTIONS, 'landCategories');
            case 'zoning':
                return renderCheckboxGroup('용도지역', '용도지역을 선택하세요', ZONING_OPTIONS, 'zoningTypes');
            case 'officialPrice':
                return renderRangeInput('공시지가', '공시지가 범위를 설정하세요', 'officialPriceMin', 'officialPriceMax', '원/㎡');
            case 'terrainShape':
                return renderCheckboxGroup('지형형상', '토지의 형상을 선택하세요', TERRAIN_SHAPE_OPTIONS, 'terrainShapes');
            case 'terrainHeight':
                return renderCheckboxGroup('지형고저', '토지의 고저를 선택하세요', TERRAIN_HEIGHT_OPTIONS, 'terrainHeights');
            case 'roadSide':
                return renderCheckboxGroup('도로접면', '도로 접면 조건을 선택하세요', ROAD_SIDE_OPTIONS, 'roadSides');

            // 시설 탭 - 공장
            case 'factoryBusinessType':
                return renderIndustryFilter('factoryBusinessTypes', '업종');
            case 'allowedIndustry':
                return renderIndustryFilter('allowedIndustries', '입주가능업종');
            case 'factoryApproval':
                return renderCheckboxGroup('공장설립인허가', '인허가 유형을 선택하세요', FACTORY_APPROVAL_OPTIONS, 'factoryApprovalTypes');
            case 'industrialComplex':
                return renderBooleanFilter('산업단지', '산업단지 포함 여부를 선택하세요', 'inIndustrialComplex', { yes: '단지 내', no: '단지 외' });

            // 시설 탭 - 설비
            case 'powerCapacity':
                return renderRangeInput('전력용량', '전력 용량 범위를 설정하세요', 'powerCapacityMin', 'powerCapacityMax', 'kW');
            case 'ceilingHeight':
                return renderRangeInput('층고', '층고 범위를 설정하세요', 'ceilingHeightMin', 'ceilingHeightMax', 'm');
            case 'floorLoad':
                return renderRangeInput('바닥하중', '바닥 하중 범위를 설정하세요', 'floorLoadMin', 'floorLoadMax', 'ton/㎡');
            case 'crane':
                return renderBooleanFilter('크레인', '크레인 유무를 선택하세요', 'hasCrane', { yes: '있음', no: '없음' });
            case 'dockLeveler':
                return renderBooleanFilter('도크레벨러', '도크레벨러 유무를 선택하세요', 'hasDockLeveler', { yes: '있음', no: '없음' });
            case 'hoist':
                return renderBooleanFilter('호이스트', '호이스트 유무를 선택하세요', 'hasHoist', { yes: '있음', no: '없음' });

            // 시설 탭 - 지식산업센터
            case 'kcBuildingName':
                return (
                    <Stack gap="md">
                        <Box>
                            <Text size="md" fw={600} mb={4}>건물명</Text>
                            <Text size="xs" c="dimmed">지식산업센터 이름으로 검색하세요</Text>
                        </Box>
                        <TextInput
                            placeholder="건물명 입력..."
                            value={filter.kcBuildingName}
                            onChange={(e) => setFilter({ kcBuildingName: e.target.value })}
                        />
                    </Stack>
                );
            case 'kcAllowedIndustry':
                return renderIndustryFilter('kcAllowedIndustries', '입주가능업종');
            case 'kcOccupancyRate':
                return renderRangeInput('입주율', '입주율 범위를 설정하세요', 'kcOccupancyRateMin', 'kcOccupancyRateMax', '%');
            case 'kcManagementFee':
                return renderRangeInput('관리비', '월 관리비 범위를 설정하세요', 'kcManagementFeeMin', 'kcManagementFeeMax', '원/㎡');

            // 시설 탭 - 창고
            case 'warehouseType':
                return renderCheckboxGroup('창고유형', '창고 유형을 선택하세요', WAREHOUSE_TYPE_OPTIONS, 'warehouseTypes');

            // 경매 탭
            case 'auctionStatus':
                return renderCheckboxGroup('진행상태', '경매 진행 상태를 선택하세요', AUCTION_STATUS_OPTIONS, 'auctionStatuses');
            case 'auctionAppraisal':
                return renderRangeInput('감정가', '감정평가액 범위를 설정하세요', 'auctionAppraisalMin', 'auctionAppraisalMax', '만원');
            case 'auctionMinPriceRate':
                return renderRangeInput('최저가율', '감정가 대비 최저가 비율을 설정하세요', 'auctionMinPriceRateMin', 'auctionMinPriceRateMax', '%');
            case 'auctionFailCount':
                return renderRangeInput('유찰횟수', '유찰 횟수 범위를 설정하세요', 'auctionFailCountMin', 'auctionFailCountMax', '회');
            case 'auctionSpecialNote':
                return renderCheckboxGroup('특이사항', '특이사항을 선택하세요', AUCTION_SPECIAL_NOTE_OPTIONS, 'auctionSpecialNotes');

            // 경매 - 권리분석
            case 'auctionOccupancy':
                return renderCheckboxGroup('점유상태', '점유 상태를 선택하세요 (복수 선택 가능)', AUCTION_OCCUPANCY_OPTIONS, 'auctionOccupancyStatuses');
            case 'auctionAssumption':
                return renderBooleanFilter('인수조건', '낙찰 시 인수해야 할 권리 유무', 'auctionHasAssumption', { yes: '인수조건 있음', no: '인수조건 없음' });

            // 경매 - 일정
            case 'auctionDate':
                return (
                    <Stack gap="md">
                        <Box>
                            <Text size="md" fw={600} mb={4}>매각기일</Text>
                            <Text size="xs" c="dimmed">경매가 진행되는 날짜 범위를 설정하세요</Text>
                        </Box>
                        <Group gap="sm" align="flex-end">
                            <Box style={{ flex: 1 }}>
                                <Text size="xs" c="dimmed" mb={4}>시작일</Text>
                                <Input
                                    type="date"
                                    value={filter.auctionDateMin || ''}
                                    onChange={(e) => setFilter({ auctionDateMin: e.target.value || null })}
                                    leftSection={<IconCalendar size={16} />}
                                />
                            </Box>
                            <Text c="dimmed" size="sm" pb={8}>~</Text>
                            <Box style={{ flex: 1 }}>
                                <Text size="xs" c="dimmed" mb={4}>종료일</Text>
                                <Input
                                    type="date"
                                    value={filter.auctionDateMax || ''}
                                    onChange={(e) => setFilter({ auctionDateMax: e.target.value || null })}
                                    leftSection={<IconCalendar size={16} />}
                                />
                            </Box>
                        </Group>
                        <Group gap="xs">
                            <Button
                                variant="light"
                                size="xs"
                                onClick={() => {
                                    const today = new Date();
                                    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                                    setFilter({
                                        auctionDateMin: today.toISOString().split('T')[0],
                                        auctionDateMax: nextWeek.toISOString().split('T')[0],
                                    });
                                }}
                            >
                                1주일 이내
                            </Button>
                            <Button
                                variant="light"
                                size="xs"
                                onClick={() => {
                                    const today = new Date();
                                    const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                                    setFilter({
                                        auctionDateMin: today.toISOString().split('T')[0],
                                        auctionDateMax: nextMonth.toISOString().split('T')[0],
                                    });
                                }}
                            >
                                1개월 이내
                            </Button>
                            <Button
                                variant="subtle"
                                size="xs"
                                color="gray"
                                onClick={() => setFilter({ auctionDateMin: null, auctionDateMax: null })}
                            >
                                초기화
                            </Button>
                        </Group>
                    </Stack>
                );
            case 'auctionWinningBidRate':
                return (
                    <Stack gap="md">
                        <Box>
                            <Text size="md" fw={600} mb={4}>낙찰가율</Text>
                            <Text size="xs" c="dimmed">감정가 대비 낙찰가 비율을 설정하세요 (낙찰된 경매 기준)</Text>
                        </Box>
                        {renderRangeInput('낙찰가율', '', 'auctionWinningBidRateMin', 'auctionWinningBidRateMax', '%')}
                        <Group gap="xs">
                            <Button variant="light" size="xs" onClick={() => setFilter({ auctionWinningBidRateMin: null, auctionWinningBidRateMax: 70 })}>
                                70% 이하
                            </Button>
                            <Button variant="light" size="xs" onClick={() => setFilter({ auctionWinningBidRateMin: 70, auctionWinningBidRateMax: 80 })}>
                                70-80%
                            </Button>
                            <Button variant="light" size="xs" onClick={() => setFilter({ auctionWinningBidRateMin: 80, auctionWinningBidRateMax: null })}>
                                80% 이상
                            </Button>
                        </Group>
                    </Stack>
                );

            default:
                return (
                    <Stack gap="md">
                        <Text size="md" fw={600}>{selectedFilter}</Text>
                        <Text size="xs" c="dimmed">필터 옵션 준비중</Text>
                    </Stack>
                );
        }
    };

    // 선택된 필터의 제목 찾기
    const getSelectedFilterTitle = () => {
        for (const tab of TAB_CONFIG) {
            for (const section of tab.sections) {
                const item = section.items.find(i => i.key === selectedFilter);
                if (item) return item.label;
            }
        }
        return '';
    };

    // 선택된 필터의 설명 찾기
    const getSelectedFilterDescription = () => {
        const descriptions: Record<string, string> = {
            propertyType: '원하는 매물 유형을 선택하세요. 복수 선택이 가능해요.',
            dealType: '원하는 거래 유형과 가격 조건을 설정하세요.',
            landArea: '대지면적 범위를 설정하세요. (단위: ㎡)',
            totalFloorArea: '연면적 범위를 설정하세요. (단위: ㎡)',
            exclusiveArea: '전용면적 범위를 설정하세요. (단위: ㎡)',
            mainStructure: '건물의 구조를 선택하세요. 복수 선택이 가능해요.',
            floorsAbove: '지상 층수 범위를 설정하세요.',
            floorsBelow: '지하 층수 범위를 설정하세요.',
            completionYear: '준공 연도 범위를 설정하세요.',
            buildingAge: '건물 노후 정도를 설정하세요.',
            buildingCoverage: '건폐율 범위를 설정하세요. (단위: %)',
            floorAreaRatio: '용적률 범위를 설정하세요. (단위: %)',
            seismicDesign: '내진설계 적용 여부를 선택하세요.',
            landCategory: '토지의 지목을 선택하세요. 복수 선택이 가능해요.',
            zoning: '용도지역을 선택하세요. 복수 선택이 가능해요.',
            officialPrice: '공시지가 범위를 설정하세요. (단위: 원/㎡)',
            terrainShape: '토지의 형상을 선택하세요.',
            terrainHeight: '토지의 고저를 선택하세요.',
            roadSide: '도로 접면 조건을 선택하세요.',
            factoryBusinessType: '공장의 업종을 선택하세요.',
            allowedIndustry: '입주 가능한 업종을 선택하세요.',
            factoryApproval: '인허가 유형을 선택하세요.',
            industrialComplex: '산업단지 포함 여부를 선택하세요.',
            powerCapacity: '전력 용량 범위를 설정하세요. (단위: kW)',
            ceilingHeight: '층고 범위를 설정하세요. (단위: m)',
            floorLoad: '바닥 하중 범위를 설정하세요. (단위: ton/㎡)',
            crane: '크레인 유무를 선택하세요.',
            dockLeveler: '도크레벨러 유무를 선택하세요.',
            hoist: '호이스트 유무를 선택하세요.',
            kcBuildingName: '지식산업센터 이름으로 검색하세요.',
            kcAllowedIndustry: '입주 가능한 업종을 선택하세요.',
            kcOccupancyRate: '입주율 범위를 설정하세요. (단위: %)',
            kcManagementFee: '월 관리비 범위를 설정하세요. (단위: 원/㎡)',
            warehouseType: '창고 유형을 선택하세요.',
            auctionStatus: '경매 진행 상태를 선택하세요.',
            auctionAppraisal: '감정평가액 범위를 설정하세요.',
            auctionMinPriceRate: '감정가 대비 최저가 비율을 설정하세요.',
            auctionFailCount: '유찰 횟수 범위를 설정하세요.',
            auctionSpecialNote: '특이사항을 선택하세요.',
            auctionOccupancy: '점유 상태를 선택하세요. 대항력, 임차인 유무 등으로 리스크를 판단할 수 있어요.',
            auctionAssumption: '낙찰 시 인수해야 할 권리(임차권, 유치권 등) 유무를 선택하세요.',
            auctionDate: '경매가 진행되는 날짜 범위를 설정하세요.',
            auctionWinningBidRate: '낙찰된 경매의 감정가 대비 낙찰가 비율을 설정하세요.',
        };
        return descriptions[selectedFilter] || '';
    };

    // ========================================
    // 메인 렌더링
    // ========================================

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            size={1000}
            padding={0}
            withCloseButton={false}
            centered
            zIndex={10001}
            styles={{
                body: { padding: 0 },
                content: { borderRadius: 16, overflow: 'hidden' },
            }}
        >
            <style>{`
                .saved-filter-item:hover:not([data-active="true"]) {
                    background-color: #fff4e6 !important;
                }
                .saved-filter-item[data-active="true"]:hover {
                    background-color: #f76707 !important;
                }
                .saved-filter-item:active:not([data-active="true"]) {
                    background-color: #ffe8cc !important;
                    transform: scale(0.98);
                }
                .saved-filter-item[data-active="true"]:active {
                    background-color: #e8590c !important;
                    transform: scale(0.98);
                }
            `}</style>
            <Box style={{ display: 'flex', height: 620 }}>
                {/* 1열: 프리셋 */}
                <Box style={{
                    width: 200,
                    minWidth: 200,
                    borderRight: '1px solid #dee2e6',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'white',
                }}>
                    <ScrollArea style={{ flex: 1 }}>
                        <Stack gap={2} py="xs" px={8}>
                            {FILTER_PRESETS.map((preset, index) => (
                                <UnstyledButton
                                    key={preset.id}
                                    w="100%"
                                    px="sm"
                                    py={8}
                                    style={{
                                        borderRadius: 6,
                                        transition: 'all 0.15s ease',
                                        backgroundColor: activeFilterId === preset.id ? '#339af0' : undefined,
                                        color: activeFilterId === preset.id ? '#fff' : undefined,
                                    }}
                                    styles={{
                                        root: {
                                            '&:hover': {
                                                backgroundColor: activeFilterId === preset.id ? '#228be6' : '#e7f5ff',
                                            },
                                            '&:focus': {
                                                outline: '2px solid #339af0',
                                                outlineOffset: -2,
                                                backgroundColor: activeFilterId === preset.id ? '#228be6' : '#e7f5ff',
                                            },
                                            '&:active': {
                                                backgroundColor: activeFilterId === preset.id ? '#1c7ed6' : '#d0ebff',
                                                transform: 'scale(0.98)',
                                            },
                                        },
                                    }}
                                    onClick={() => loadPreset(preset.id)}
                                >
                                    <Group justify="space-between" gap="xs" wrap="nowrap">
                                        <Text size="sm" fw={500} c={activeFilterId === preset.id ? 'white' : undefined} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{preset.name}</Text>
                                        {index < 2 && (
                                            <Badge size="xs" variant="light" color="blue" style={{ flexShrink: 0 }}>인기</Badge>
                                        )}
                                    </Group>
                                </UnstyledButton>
                            ))}
                            {savedFilters.length > 0 && (
                                <>
                                    <Divider my="xs" mx={-8} />
                                    {savedFilters.map((sf) => (
                                        <Box
                                            key={sf.id}
                                            w="100%"
                                            px="sm"
                                            py={8}
                                            style={{
                                                borderRadius: 6,
                                                transition: 'all 0.15s ease',
                                                backgroundColor: activeFilterId === sf.id ? '#fd7e14' : undefined,
                                                color: activeFilterId === sf.id ? '#fff' : undefined,
                                                cursor: 'pointer',
                                            }}
                                            className="saved-filter-item"
                                            data-active={activeFilterId === sf.id ? 'true' : undefined}
                                            onClick={() => loadFilter(sf.id)}
                                        >
                                            <Group justify="space-between" gap="xs" wrap="nowrap">
                                                <Text size="sm" fw={500} c={activeFilterId === sf.id ? 'white' : undefined} style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sf.name}</Text>
                                                <ActionIcon
                                                    size="xs"
                                                    variant="subtle"
                                                    color={activeFilterId === sf.id ? 'gray' : 'red'}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteFilter(sf.id);
                                                    }}
                                                >
                                                    <IconX size={12} />
                                                </ActionIcon>
                                            </Group>
                                        </Box>
                                    ))}
                                </>
                            )}
                        </Stack>
                    </ScrollArea>
                    <Box p="sm" style={{ borderTop: '1px solid #dee2e6' }}>
                        <Button
                            variant="subtle"
                            color="blue"
                            size="xs"
                            onClick={() => setSaveDialogOpened(true)}
                            fullWidth
                        >
                            + 필터 저장
                        </Button>
                    </Box>
                </Box>

                {/* 2열: 탭 + 메뉴 (스크린샷 디자인) */}
                <Box style={{
                    width: 200,
                    minWidth: 200,
                    borderRight: '1px solid #dee2e6',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'white',
                }}>
                    {/* 탭 (가로 - 스크린샷 디자인) */}
                    <Group gap={0} px="sm" py="sm" wrap="nowrap" style={{ borderBottom: '1px solid #dee2e6' }}>
                        {TAB_CONFIG.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <UnstyledButton
                                    key={tab.id}
                                    px={8}
                                    py={4}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{ whiteSpace: 'nowrap' }}
                                    styles={{
                                        root: {
                                            '&:hover': {
                                                backgroundColor: '#f8f9fa',
                                                borderRadius: 4,
                                            },
                                        },
                                    }}
                                >
                                    <Text size="xs" fw={isActive ? 600 : 400} c={isActive ? 'blue' : 'dimmed'}>
                                        {tab.label}
                                    </Text>
                                </UnstyledButton>
                            );
                        })}
                    </Group>

                    {/* 메뉴 항목 */}
                    <ScrollArea style={{ flex: 1 }}>
                        <Box py="xs">
                            {renderMenuSections()}
                        </Box>
                    </ScrollArea>
                </Box>

                {/* 우측: 컨텐츠 영역 */}
                <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', minWidth: 0 }}>
                    {/* 헤더 - 토스 스타일 */}
                    <Box px="lg" py="md" style={{ borderBottom: '1px solid #f1f3f5' }}>
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                            <Box style={{ flex: 1 }}>
                                <Text size="xl" fw={700} c="dark" style={{ lineHeight: 1.45 }}>
                                    {getSelectedFilterTitle()}
                                </Text>
                                <Text size="sm" c="dimmed" mt={2} style={{ lineHeight: 1.45 }}>
                                    {getSelectedFilterDescription()}
                                </Text>
                            </Box>
                            <ActionIcon
                                variant="subtle"
                                color="gray"
                                onClick={onClose}
                                size="md"
                            >
                                <IconX size={18} />
                            </ActionIcon>
                        </Group>
                    </Box>

                    {/* 필터 내용 스크롤 영역 */}
                    <ScrollArea style={{ flex: 1 }}>
                        <Box px="lg" py="md">
                            {renderDetailPanel()}
                        </Box>
                    </ScrollArea>

                    {/* 하단 바 - 토스 스타일 */}
                    <Box
                        px="lg"
                        py="md"
                        style={{
                            borderTop: '1px solid #f1f3f5',
                            background: 'white',
                        }}
                    >
                        <Group justify="space-between" align="center" wrap="nowrap">
                            {/* 선택된 필터 칩 */}
                            <Group gap={6} style={{ flex: 1, flexWrap: 'wrap', overflow: 'hidden' }}>
                                {filterChips.slice(0, 5).map((chip) => (
                                    <Box
                                        key={chip.id}
                                        px={12}
                                        py={6}
                                        style={{
                                            background: '#e7f5ff',
                                            borderRadius: 16,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                        }}
                                    >
                                        <Text size="sm" c="blue" fw={500}>{chip.label}</Text>
                                        <ActionIcon
                                            size={16}
                                            variant="transparent"
                                            color="blue"
                                            onClick={() => removeChip(chip.id)}
                                        >
                                            <IconX size={12} />
                                        </ActionIcon>
                                    </Box>
                                ))}
                                {filterChips.length > 5 && (
                                    <Text size="sm" c="dimmed">+{filterChips.length - 5}</Text>
                                )}
                            </Group>

                            {/* 버튼 영역 */}
                            <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
                                <Button
                                    variant="light"
                                    color="gray"
                                    size="sm"
                                    leftSection={<IconRefresh size={14} />}
                                    onClick={resetFilter}
                                    styles={{
                                        root: { fontWeight: 500 },
                                    }}
                                >
                                    초기화
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={onClose}
                                    styles={{
                                        root: { fontWeight: 500 },
                                    }}
                                >
                                    {filtered.toLocaleString()}개 매물보기
                                </Button>
                            </Group>
                        </Group>
                    </Box>
                </Box>

                {/* 저장 다이얼로그 */}
                <SaveFilterDialog
                    opened={saveDialogOpened}
                    onClose={() => setSaveDialogOpened(false)}
                    onSave={handleSaveFilter}
                />
            </Box>
        </Modal>
    );
}
