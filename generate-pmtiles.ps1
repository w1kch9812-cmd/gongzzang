# PowerShell script for generating PMTiles
# Run this in PowerShell: .\generate-pmtiles.ps1

Write-Host "📦 PMTiles 생성 시작..." -ForegroundColor Green
Write-Host ""

# Check if WSL is available
try {
    wsl.exe --list | Out-Null
} catch {
    Write-Host "❌ WSL이 설치되지 않았습니다." -ForegroundColor Red
    exit 1
}

# Get current directory in WSL format
$currentDir = (Get-Location).Path
$wslPath = wsl.exe wslpath -a "`"$currentDir`""

Write-Host "현재 디렉토리: $currentDir" -ForegroundColor Cyan
Write-Host "WSL 경로: $wslPath" -ForegroundColor Cyan
Write-Host ""

# Create directories
Write-Host "디렉토리 생성 중..." -ForegroundColor Yellow
New-Item -Path "temp" -ItemType Directory -Force | Out-Null
New-Item -Path "public\tiles" -ItemType Directory -Force | Out-Null

# Stage 1: Shapefile to GeoJSON
Write-Host "==========================================" -ForegroundColor Blue
Write-Host "1단계: Shapefile → GeoJSON 변환" -ForegroundColor Blue
Write-Host "==========================================" -ForegroundColor Blue
Write-Host ""

# SIDO
if (Test-Path "rawdata\N3A_G0010000.shp") {
    Write-Host "🗺️ 시/도 변환 중..." -ForegroundColor Yellow
    wsl.exe bash -c "cd '$wslPath' && ogr2ogr -f GeoJSON -t_srs EPSG:4326 temp/sido.geojson rawdata/N3A_G0010000.shp"
    Write-Host "   ✅ sido.geojson 생성" -ForegroundColor Green
}

# SIG
if (Test-Path "rawdata\AL_D001_00_20251204(SIG).shp") {
    Write-Host "🏛️ 시군구 변환 중..." -ForegroundColor Yellow
    wsl.exe bash -c "cd '$wslPath' && ogr2ogr -f GeoJSON -t_srs EPSG:4326 'temp/sig.geojson' 'rawdata/AL_D001_00_20251204(SIG).shp'"
    Write-Host "   ✅ sig.geojson 생성" -ForegroundColor Green
}

# EMD
if (Test-Path "rawdata\AL_D001_00_20251204(EMD).shp") {
    Write-Host "🏘️ 읍면동 변환 중..." -ForegroundColor Yellow
    wsl.exe bash -c "cd '$wslPath' && ogr2ogr -f GeoJSON -t_srs EPSG:4326 'temp/emd.geojson' 'rawdata/AL_D001_00_20251204(EMD).shp'"
    Write-Host "   ✅ emd.geojson 생성" -ForegroundColor Green
}

# Parcels
if (Test-Path "rawdata\LSMD_CONT_LDREG_28200_202511.shp") {
    Write-Host "🗺️ 필지 변환 중 (시간 소요)..." -ForegroundColor Yellow
    wsl.exe bash -c "cd '$wslPath' && ogr2ogr -f GeoJSON -t_srs EPSG:4326 temp/parcels.geojson rawdata/LSMD_CONT_LDREG_28200_202511.shp"
    Write-Host "   ✅ parcels.geojson 생성" -ForegroundColor Green
}

# Complex
if (Test-Path "rawdata\dam_dan.shp") {
    Write-Host "🏭 산업단지 변환 중..." -ForegroundColor Yellow
    wsl.exe bash -c "cd '$wslPath' && ogr2ogr -f GeoJSON -t_srs EPSG:4326 temp/complex.geojson rawdata/dam_dan.shp"
    Write-Host "   ✅ complex.geojson 생성" -ForegroundColor Green
}

# Lots
if (Test-Path "rawdata\dam_yoj.shp") {
    Write-Host "📐 용지 변환 중..." -ForegroundColor Yellow
    wsl.exe bash -c "cd '$wslPath' && ogr2ogr -f GeoJSON -t_srs EPSG:4326 temp/lots.geojson rawdata/dam_yoj.shp"
    Write-Host "   ✅ lots.geojson 생성" -ForegroundColor Green
}

# Industries
if (Test-Path "rawdata\dam_yuch.shp") {
    Write-Host "🏢 유치업종 변환 중..." -ForegroundColor Yellow
    wsl.exe bash -c "cd '$wslPath' && ogr2ogr -f GeoJSON -t_srs EPSG:4326 temp/industries.geojson rawdata/dam_yuch.shp"
    Write-Host "   ✅ industries.geojson 생성" -ForegroundColor Green
}

# Stage 2: GeoJSON to PMTiles
Write-Host ""
Write-Host "==========================================" -ForegroundColor Blue
Write-Host "2단계: GeoJSON → PMTiles 변환" -ForegroundColor Blue
Write-Host "==========================================" -ForegroundColor Blue
Write-Host ""

# SIDO
if (Test-Path "temp\sido.geojson") {
    Write-Host "🗺️ 시/도 타일 생성..." -ForegroundColor Yellow
    wsl.exe bash -c "cd '$wslPath' && tippecanoe -o public/tiles/sido.pmtiles -l sido -z 10 -Z 0 --no-feature-limit --no-tile-size-limit --force --coalesce-densest-as-needed temp/sido.geojson"
    Write-Host "   ✅ sido.pmtiles 생성 완료" -ForegroundColor Green
}

# SIG
if (Test-Path "temp\sig.geojson") {
    Write-Host "🏛️ 시군구 타일 생성..." -ForegroundColor Yellow
    wsl.exe bash -c "cd '$wslPath' && tippecanoe -o public/tiles/sig.pmtiles -l sig -z 12 -Z 0 --no-feature-limit --no-tile-size-limit --force --coalesce-densest-as-needed temp/sig.geojson"
    Write-Host "   ✅ sig.pmtiles 생성 완료" -ForegroundColor Green
}

# EMD
if (Test-Path "temp\emd.geojson") {
    Write-Host "🏘️ 읍면동 타일 생성..." -ForegroundColor Yellow
    wsl.exe bash -c "cd '$wslPath' && tippecanoe -o public/tiles/emd.pmtiles -l emd -z 14 -Z 8 --no-feature-limit --no-tile-size-limit --force --coalesce-densest-as-needed temp/emd.geojson"
    Write-Host "   ✅ emd.pmtiles 생성 완료" -ForegroundColor Green
}

# Parcels
if (Test-Path "temp\parcels.geojson") {
    Write-Host "🗺️ 필지 타일 생성 (가장 오래 걸림)..." -ForegroundColor Yellow
    wsl.exe bash -c "cd '$wslPath' && tippecanoe -o public/tiles/parcels.pmtiles -l parcels -z 17 -Z 14 --no-feature-limit --no-tile-size-limit --force --coalesce-densest-as-needed --drop-smallest-as-needed temp/parcels.geojson"
    Write-Host "   ✅ parcels.pmtiles 생성 완료" -ForegroundColor Green
}

# Complex
if (Test-Path "temp\complex.geojson") {
    Write-Host "🏭 산업단지 타일 생성..." -ForegroundColor Yellow
    wsl.exe bash -c "cd '$wslPath' && tippecanoe -o public/tiles/complex.pmtiles -l complex -z 16 -Z 8 --no-feature-limit --no-tile-size-limit --force temp/complex.geojson"
    Write-Host "   ✅ complex.pmtiles 생성 완료" -ForegroundColor Green
}

# Lots
if (Test-Path "temp\lots.geojson") {
    Write-Host "📐 용지 타일 생성..." -ForegroundColor Yellow
    wsl.exe bash -c "cd '$wslPath' && tippecanoe -o public/tiles/lots.pmtiles -l lots -z 17 -Z 12 --no-feature-limit --no-tile-size-limit --force temp/lots.geojson"
    Write-Host "   ✅ lots.pmtiles 생성 완료" -ForegroundColor Green
}

# Industries
if (Test-Path "temp\industries.geojson") {
    Write-Host "🏢 유치업종 타일 생성..." -ForegroundColor Yellow
    wsl.exe bash -c "cd '$wslPath' && tippecanoe -o public/tiles/industries.pmtiles -l industries -z 17 -Z 12 --no-feature-limit --no-tile-size-limit --force temp/industries.geojson"
    Write-Host "   ✅ industries.pmtiles 생성 완료" -ForegroundColor Green
}

# Results
Write-Host ""
Write-Host "==========================================" -ForegroundColor Blue
Write-Host "✨ PMTiles 생성 완료!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Blue
Write-Host ""

if (Test-Path "public\tiles\*.pmtiles") {
    Get-ChildItem "public\tiles\*.pmtiles" | Format-Table Name, @{Label="Size";Expression={"{0:N2} MB" -f ($_.Length / 1MB)}}
} else {
    Write-Host "(생성된 파일 없음)" -ForegroundColor Yellow
}
