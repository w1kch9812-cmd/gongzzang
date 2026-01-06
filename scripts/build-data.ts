// scripts/build-data.ts
// 전체 데이터 빌드 오케스트레이션

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { DATA_SOURCES, OUTPUT_DIRS } from './data.config';

// ANSI 색상
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset): void {
    console.log(`${color}${message}${colors.reset}`);
}

function logStep(step: number, total: number, message: string): void {
    log(`\n[${step}/${total}] ${message}`, colors.cyan);
}

function logSuccess(message: string): void {
    log(`✅ ${message}`, colors.green);
}

function logWarning(message: string): void {
    log(`⚠️  ${message}`, colors.yellow);
}

function logError(message: string): void {
    log(`❌ ${message}`, colors.red);
}

// 디렉토리 확인 및 생성
function ensureDirectories(): void {
    const dirs = [
        OUTPUT_DIRS.temp,
        OUTPUT_DIRS.properties,
        OUTPUT_DIRS.tiles,
    ];

    for (const dir of dirs) {
        const fullPath = path.join(process.cwd(), dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            log(`  디렉토리 생성: ${dir}`);
        }
    }
}

// rawdata 확인
function checkRawData(): boolean {
    const rawDir = path.join(process.cwd(), 'rawdata');

    if (!fs.existsSync(rawDir)) {
        logError('rawdata 디렉토리가 없습니다.');
        log('  rawdata/ 폴더를 만들고 SHP 파일들을 넣어주세요.');
        return false;
    }

    const files = fs.readdirSync(rawDir);
    const shpFiles = files.filter(f => f.endsWith('.shp'));

    if (shpFiles.length === 0) {
        logWarning('rawdata에 SHP 파일이 없습니다.');
        return false;
    }

    log(`\n📂 rawdata 파일 목록:`);
    for (const file of shpFiles) {
        const stats = fs.statSync(path.join(rawDir, file));
        const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
        log(`  - ${file} (${sizeMB}MB)`);
    }

    return true;
}

// 스크립트 실행
function runScript(scriptName: string, args: string[] = []): boolean {
    try {
        const cmd = `npx tsx scripts/${scriptName}.ts ${args.join(' ')}`;
        log(`  실행: ${cmd}`, colors.blue);
        execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
        return true;
    } catch (e) {
        logError(`스크립트 실행 실패: ${scriptName}`);
        return false;
    }
}

// 빌드 상태 저장
interface BuildState {
    lastBuild: string;
    steps: Record<string, { completed: boolean; timestamp: string }>;
}

function loadBuildState(): BuildState {
    const statePath = path.join(process.cwd(), OUTPUT_DIRS.temp, 'build-state.json');
    if (fs.existsSync(statePath)) {
        return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    }
    return { lastBuild: '', steps: {} };
}

function saveBuildState(state: BuildState): void {
    const statePath = path.join(process.cwd(), OUTPUT_DIRS.temp, 'build-state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// 메인 빌드 프로세스
async function build(options: { force?: boolean; only?: string[] } = {}): Promise<void> {
    const startTime = Date.now();

    log(`
╔══════════════════════════════════════════════════════════╗
║                   🚀 데이터 빌드 시작                      ║
╚══════════════════════════════════════════════════════════╝
    `, colors.bright);

    // 1. 환경 확인
    logStep(1, 6, '환경 확인');
    ensureDirectories();

    if (!checkRawData()) {
        logWarning('rawdata가 없어 기존 데이터만 처리합니다.');
    }

    const state = loadBuildState();
    const timestamp = new Date().toISOString();

    // 2. SHP → GeoJSON 변환
    if (!options.only || options.only.includes('shp')) {
        logStep(2, 7, 'SHP → GeoJSON 변환');
        if (runScript('shp-to-geojson')) {
            state.steps['shp-to-geojson'] = { completed: true, timestamp };
        }
    }

    // 2.5. Polylabel 적용 (GeoJSON coord를 폴리곤 중심으로 업데이트)
    if (!options.only || options.only.includes('polylabel') || options.only.includes('shp')) {
        logStep(3, 7, 'Polylabel 적용 (마커 좌표 최적화)');
        if (runScript('update-geojson-coords')) {
            state.steps['polylabel'] = { completed: true, timestamp };
        }
    }

    // 4. Properties JSON 추출
    if (!options.only || options.only.includes('properties')) {
        logStep(4, 7, 'Properties JSON 추출');
        if (runScript('extract-properties')) {
            state.steps['extract-properties'] = { completed: true, timestamp };
        }
    }

    // 5. Excel/CSV 파싱
    if (!options.only || options.only.includes('excel')) {
        logStep(5, 7, 'Excel/CSV 파싱');
        if (runScript('parse-excel-csv')) {
            state.steps['parse-excel-csv'] = { completed: true, timestamp };
        }
    }

    // 6. 타일 생성
    if (!options.only || options.only.includes('tiles')) {
        logStep(6, 7, '벡터 타일 생성');
        if (runScript('generate-tiles')) {
            state.steps['generate-tiles'] = { completed: true, timestamp };
        }
    }

    // 7. 정리
    logStep(7, 7, '빌드 완료');
    state.lastBuild = timestamp;
    saveBuildState(state);

    // 결과 요약
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`
╔══════════════════════════════════════════════════════════╗
║                   ✨ 빌드 완료                             ║
╠══════════════════════════════════════════════════════════╣
║  소요 시간: ${elapsed.padStart(6)}초                               ║
╠══════════════════════════════════════════════════════════╣
║  출력 디렉토리:                                            ║
║    - ${OUTPUT_DIRS.properties.padEnd(45)}║
║    - ${OUTPUT_DIRS.tiles.padEnd(45)}║
╚══════════════════════════════════════════════════════════╝
    `, colors.green);

    // 생성된 파일 목록
    log('\n📦 생성된 파일:');

    const propsDir = path.join(process.cwd(), OUTPUT_DIRS.properties);
    if (fs.existsSync(propsDir)) {
        const files = fs.readdirSync(propsDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            const stats = fs.statSync(path.join(propsDir, file));
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            log(`  ${OUTPUT_DIRS.properties}/${file} (${sizeMB}MB)`);
        }
    }

    const tilesDir = path.join(process.cwd(), OUTPUT_DIRS.tiles);
    if (fs.existsSync(tilesDir)) {
        const dirs = fs.readdirSync(tilesDir).filter(f =>
            fs.statSync(path.join(tilesDir, f)).isDirectory()
        );
        for (const dir of dirs) {
            log(`  ${OUTPUT_DIRS.tiles}/${dir}/`);
        }
    }
}

// CLI 처리
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const options: { force?: boolean; only?: string[] } = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--force' || arg === '-f') {
            options.force = true;
        } else if (arg === '--only' || arg === '-o') {
            options.only = args[i + 1]?.split(',') || [];
            i++;
        } else if (arg === '--help' || arg === '-h') {
            log(`
사용법: npx tsx scripts/build-data.ts [옵션]

옵션:
  --force, -f     강제 재빌드 (캐시 무시)
  --only, -o      특정 단계만 실행
                  shp,properties,excel,tiles

예시:
  npx tsx scripts/build-data.ts              # 전체 빌드
  npx tsx scripts/build-data.ts -o shp       # SHP 변환만
  npx tsx scripts/build-data.ts -o tiles     # 타일 생성만
  npx tsx scripts/build-data.ts -f           # 강제 재빌드
            `);
            return;
        }
    }

    await build(options);
}

main().catch(console.error);
