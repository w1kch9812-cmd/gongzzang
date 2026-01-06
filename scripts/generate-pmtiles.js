// Node.js script for generating PMTiles
// Run: node scripts/generate-pmtiles.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n📦 PMTiles 생성 시작...\n');

// Ensure directories exist
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

ensureDir('temp');
ensureDir('public/tiles');

// Execute WSL command
const wslExec = (cmd, description) => {
    try {
        console.log(`${description}...`);
        const output = execSync(`wsl bash -c "${cmd}"`, {
            encoding: 'utf-8',
            stdio: 'pipe',
            cwd: process.cwd()
        });
        console.log(`   ✅ 완료\n`);
        return true;
    } catch (error) {
        console.error(`   ❌ 실패: ${error.message}\n`);
        return false;
    }
};

// Configuration
const conversions = [
    {
        name: '시/도 (SIDO)',
        icon: '🗺️',
        input: 'rawdata/N3A_G0010000.shp',
        output: 'temp/sido.geojson',
        pmtiles: 'public/tiles/sido.pmtiles',
        layer: 'sido',
        minZoom: 0,
        maxZoom: 10
    },
    {
        name: '시군구 (SIG)',
        icon: '🏛️',
        input: 'rawdata/AL_D001_00_20251204\\(SIG\\).shp',
        output: 'temp/sig.geojson',
        pmtiles: 'public/tiles/sig.pmtiles',
        layer: 'sig',
        minZoom: 0,
        maxZoom: 12
    },
    {
        name: '읍면동 (EMD)',
        icon: '🏘️',
        input: 'rawdata/AL_D001_00_20251204\\(EMD\\).shp',
        output: 'temp/emd.geojson',
        pmtiles: 'public/tiles/emd.pmtiles',
        layer: 'emd',
        minZoom: 8,
        maxZoom: 14
    },
    {
        name: '필지 (Parcels)',
        icon: '🗺️',
        input: 'rawdata/LSMD_CONT_LDREG_28200_202511.shp',
        output: 'temp/parcels.geojson',
        pmtiles: 'public/tiles/parcels.pmtiles',
        layer: 'parcels',
        minZoom: 14,
        maxZoom: 17,
        extraOptions: '--drop-smallest-as-needed'
    },
    {
        name: '산업단지 (Complex)',
        icon: '🏭',
        input: 'rawdata/dam_dan.shp',
        output: 'temp/complex.geojson',
        pmtiles: 'public/tiles/complex.pmtiles',
        layer: 'complex',
        minZoom: 8,
        maxZoom: 16
    },
    {
        name: '용지 (Lots)',
        icon: '📐',
        input: 'rawdata/dam_yoj.shp',
        output: 'temp/lots.geojson',
        pmtiles: 'public/tiles/lots.pmtiles',
        layer: 'lots',
        minZoom: 12,
        maxZoom: 17
    },
    {
        name: '유치업종 (Industries)',
        icon: '🏢',
        input: 'rawdata/dam_yuch.shp',
        output: 'temp/industries.geojson',
        pmtiles: 'public/tiles/industries.pmtiles',
        layer: 'industries',
        minZoom: 12,
        maxZoom: 17
    }
];

console.log('==========================================');
console.log('1단계: Shapefile → GeoJSON 변환');
console.log('==========================================\n');

for (const item of conversions) {
    // Check if shapefile exists (remove escape characters for Windows path check)
    const windowsPath = item.input.replace(/\\/g, '');
    if (!fs.existsSync(windowsPath)) {
        console.log(`${item.icon} ${item.name}: 파일 없음, 건너뛰기\n`);
        continue;
    }

    wslExec(
        `ogr2ogr -f GeoJSON -t_srs EPSG:4326 ${item.output} ${item.input}`,
        `${item.icon} ${item.name} 변환`
    );
}

console.log('\n==========================================');
console.log('2단계: GeoJSON → PMTiles 변환');
console.log('==========================================\n');

for (const item of conversions) {
    if (!fs.existsSync(item.output)) {
        console.log(`${item.icon} ${item.name}: GeoJSON 없음, 건너뛰기\n`);
        continue;
    }

    const extraOpts = item.extraOptions || '';
    wslExec(
        `tippecanoe -o ${item.pmtiles} -l ${item.layer} -z ${item.maxZoom} -Z ${item.minZoom} --no-feature-limit --no-tile-size-limit --force --coalesce-densest-as-needed ${extraOpts} ${item.output}`,
        `${item.icon} ${item.name} 타일 생성`
    );
}

console.log('\n==========================================');
console.log('✨ PMTiles 생성 완료!');
console.log('==========================================\n');

// List generated files
if (fs.existsSync('public/tiles')) {
    const files = fs.readdirSync('public/tiles').filter(f => f.endsWith('.pmtiles'));
    if (files.length > 0) {
        console.log('생성된 파일:\n');
        files.forEach(file => {
            const stat = fs.statSync(path.join('public/tiles', file));
            const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
            console.log(`  - ${file}: ${sizeMB} MB`);
        });
        console.log('');
    } else {
        console.log('(생성된 파일 없음)\n');
    }
}
