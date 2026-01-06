// scripts/regenerate-index.ts
// factories.json과 knowledge-centers.json에서 인덱스 파일 재생성

import fs from 'fs';
import path from 'path';

interface Factory {
    id: string;
    name: string;
    coord: [number, number] | null;
    businessType?: string;
    address?: string;
    employeeCount?: number;
    area?: number;
    sigName?: string;
    knowledgeCenterName?: string;
    pnu?: string;
}

interface KnowledgeCenter {
    id: string;
    name: string;
    coord: [number, number] | null;
    status?: string;
    roadAddress?: string;
    jibunAddress?: string;
    saleType?: string;
    landArea?: number;
    buildingArea?: number;
    sigName?: string;
    complexName?: string;
    pnu?: string;
}

const dataDir = path.join(process.cwd(), 'public/data/properties');

// 공장 인덱스 재생성
function regenerateFactoriesIndex() {
    console.log('🏭 공장 인덱스 재생성 중...');

    const factoriesPath = path.join(dataDir, 'factories.json');
    const indexPath = path.join(dataDir, 'factories-index.json');

    const factories: Factory[] = JSON.parse(fs.readFileSync(factoriesPath, 'utf-8'));

    const index = factories.map(f => ({
        id: f.id,
        name: f.name,
        coord: f.coord,
        businessType: f.businessType,
        pnu: f.pnu,
    }));

    // UTF-8 with BOM 없이 저장
    fs.writeFileSync(indexPath, JSON.stringify(index), 'utf-8');

    const withCoord = index.filter(f => f.coord && f.coord[0]).length;
    console.log(`   ✅ 완료: ${index.length}개 (좌표 있음: ${withCoord}개)`);
}

// 지식산업센터 인덱스 재생성
function regenerateKnowledgeCentersIndex() {
    console.log('🏢 지식산업센터 인덱스 재생성 중...');

    const kcPath = path.join(dataDir, 'knowledge-centers.json');
    const indexPath = path.join(dataDir, 'knowledge-centers-index.json');

    const centers: KnowledgeCenter[] = JSON.parse(fs.readFileSync(kcPath, 'utf-8'));

    const index = centers.map(kc => ({
        id: kc.id,
        name: kc.name,
        coord: kc.coord,
        status: kc.status,
        pnu: kc.pnu,
    }));

    // UTF-8 with BOM 없이 저장
    fs.writeFileSync(indexPath, JSON.stringify(index), 'utf-8');

    const withCoord = index.filter(kc => kc.coord && kc.coord[0]).length;
    console.log(`   ✅ 완료: ${index.length}개 (좌표 있음: ${withCoord}개)`);
}

console.log('\n📦 인덱스 파일 재생성 시작...\n');

regenerateFactoriesIndex();
regenerateKnowledgeCentersIndex();

console.log('\n✨ 완료!\n');
