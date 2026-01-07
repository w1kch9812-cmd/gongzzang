#!/bin/bash
# scripts/generate-pmtiles.sh
# GeoJSON → PMTiles 변환 (줌 레벨 최적화 + 오버줌 활용)
#
# 줌 레벨 상수 (lib/map/zoomConfig.ts 기준):
#   ZOOM_SIDO:   0-8   (시/도)
#   ZOOM_SIG:    8-12  (시/군/구)
#   ZOOM_EMD:    12-14 (읍/면/동)
#   ZOOM_PARCEL: 14-22 (개별 필지) → 오버줌: 17에서 생성 중단, 18-22는 확대 표시
#
# 오버줌 전략:
#   - 폴리곤은 벡터 기반이므로 확대해도 깨지지 않음
#   - maxzoom 17까지 생성 후 minzoom/maxzoom 레이어 설정으로 22까지 표시

set -e

# Windows 경로를 WSL에서 접근
WS_DIR="/mnt/c/Users/admin/Desktop/gongzzang"
TEMP_DIR="$WS_DIR/temp"
TILES_DIR="$WS_DIR/public/data/geometry"

echo "📦 PMTiles 생성 시작 (줌 레벨 최적화)..."
echo "   임시폴더: $TEMP_DIR"
echo "   출력폴더: $TILES_DIR"

mkdir -p "$TILES_DIR"

# tippecanoe 확인
if ! command -v tippecanoe &> /dev/null; then
    echo "❌ tippecanoe가 설치되지 않았습니다."
    echo "   설치: sudo apt update && sudo apt install -y tippecanoe"
    exit 1
fi

# === 시도 (SIDO) ===
# 표시: 0-8, 생성: 0-8 (오버줌 불필요 - 줌 8+ 에서 SIG로 전환)
if [ -f "$TEMP_DIR/sido.geojson" ]; then
    echo ""
    echo "🗺️ 시도 타일 생성 (줌 0-8)..."
    tippecanoe \
        -o "$TILES_DIR/sido.pmtiles" \
        -l sido \
        -Z 0 \
        -z 8 \
        --no-feature-limit \
        --no-tile-size-limit \
        --force \
        --coalesce-densest-as-needed \
        --extend-zooms-if-still-dropping \
        "$TEMP_DIR/sido.geojson"
    echo "   ✅ sido.pmtiles 생성 완료"
fi

# === 시군구 (SIG) ===
# 표시: 8-12, 생성: 0-12 (낮은 줌에서도 오버뷰용으로 필요)
if [ -f "$TEMP_DIR/sig.geojson" ]; then
    echo ""
    echo "🏛️ 시군구 타일 생성 (줌 0-12)..."
    tippecanoe \
        -o "$TILES_DIR/sig.pmtiles" \
        -l sig \
        -Z 0 \
        -z 12 \
        --no-feature-limit \
        --no-tile-size-limit \
        --force \
        --coalesce-densest-as-needed \
        --extend-zooms-if-still-dropping \
        "$TEMP_DIR/sig.geojson"
    echo "   ✅ sig.pmtiles 생성 완료"
fi

# === 읍면동 (EMD) ===
# 표시: 12-14, 생성: 0-14 (낮은 줌에서도 오버뷰용으로 필요)
if [ -f "$TEMP_DIR/emd.geojson" ]; then
    echo ""
    echo "🏘️ 읍면동 타일 생성 (줌 0-14)..."
    tippecanoe \
        -o "$TILES_DIR/emd.pmtiles" \
        -l emd \
        -Z 0 \
        -z 14 \
        --no-feature-limit \
        --no-tile-size-limit \
        --force \
        --coalesce-densest-as-needed \
        --extend-zooms-if-still-dropping \
        "$TEMP_DIR/emd.geojson"
    echo "   ✅ emd.pmtiles 생성 완료"
fi

# === 리 (LI) ===
# 표시: 14+, 생성: 12-17 (오버줌: 17→22)
if [ -f "$TEMP_DIR/li.geojson" ]; then
    echo ""
    echo "🏡 리 타일 생성 (줌 12-17, 오버줌으로 22까지)..."
    tippecanoe \
        -o "$TILES_DIR/li.pmtiles" \
        -l li \
        -Z 12 \
        -z 17 \
        --no-feature-limit \
        --no-tile-size-limit \
        --force \
        --coalesce-densest-as-needed \
        --extend-zooms-if-still-dropping \
        "$TEMP_DIR/li.geojson"
    echo "   ✅ li.pmtiles 생성 완료"
fi

# === 인천 전체 필지 (allParcels) ===
# 표시: 14-22, 생성: 12-17 (오버줌: 17→22)
if [ -f "$TEMP_DIR/all-parcels.geojson" ]; then
    echo ""
    echo "🗺️ 인천 전체 필지 타일 생성 (줌 12-17, 오버줌으로 22까지)..."
    tippecanoe \
        -o "$TILES_DIR/all-parcels.pmtiles" \
        -l allParcels \
        -Z 12 \
        -z 17 \
        --no-feature-limit \
        --no-tile-size-limit \
        --force \
        --coalesce-densest-as-needed \
        --drop-smallest-as-needed \
        --extend-zooms-if-still-dropping \
        "$TEMP_DIR/all-parcels.geojson"
    echo "   ✅ all-parcels.pmtiles 생성 완료"
fi

# === 필지 (남동구) ===
# 표시: 14-22, 생성: 12-17 (오버줌: 17→22)
if [ -f "$TEMP_DIR/parcels.geojson" ]; then
    echo ""
    echo "🗺️ 남동구 필지 타일 생성 (줌 12-17, 오버줌으로 22까지)..."
    tippecanoe \
        -o "$TILES_DIR/parcels.pmtiles" \
        -l parcels \
        -Z 12 \
        -z 17 \
        --no-feature-limit \
        --no-tile-size-limit \
        --force \
        --coalesce-densest-as-needed \
        --drop-smallest-as-needed \
        --extend-zooms-if-still-dropping \
        "$TEMP_DIR/parcels.geojson"
    echo "   ✅ parcels.pmtiles 생성 완료"
fi

# === 산업단지 (Complex) ===
# 표시: 0-22 (모든 줌에서 표시), 생성: 0-16 (오버줌: 16→22)
if [ -f "$TEMP_DIR/complex.geojson" ]; then
    echo ""
    echo "🏭 산업단지 타일 생성 (줌 0-16, 오버줌으로 22까지 - 전체 줌 표시)..."
    tippecanoe \
        -o "$TILES_DIR/complex.pmtiles" \
        -l complex \
        -Z 0 \
        -z 16 \
        --no-feature-limit \
        --no-tile-size-limit \
        --force \
        --coalesce-densest-as-needed \
        --extend-zooms-if-still-dropping \
        "$TEMP_DIR/complex.geojson"
    echo "   ✅ complex.pmtiles 생성 완료"
fi

# === 용지 (Lots) ===
# 표시: 12-22, 생성: 12-17 (오버줌: 17→22)
if [ -f "$TEMP_DIR/lots.geojson" ]; then
    echo ""
    echo "📐 용지 타일 생성 (줌 12-17, 오버줌으로 22까지)..."
    tippecanoe \
        -o "$TILES_DIR/lots.pmtiles" \
        -l lots \
        -Z 12 \
        -z 17 \
        --no-feature-limit \
        --no-tile-size-limit \
        --force \
        --coalesce-densest-as-needed \
        --extend-zooms-if-still-dropping \
        "$TEMP_DIR/lots.geojson"
    echo "   ✅ lots.pmtiles 생성 완료"
fi

# === 유치업종 (Industries) ===
# 표시: 12-22, 생성: 12-17 (오버줌: 17→22)
if [ -f "$TEMP_DIR/industries.geojson" ]; then
    echo ""
    echo "🏢 유치업종 타일 생성 (줌 12-17, 오버줌으로 22까지)..."
    tippecanoe \
        -o "$TILES_DIR/industries.pmtiles" \
        -l industries \
        -Z 12 \
        -z 17 \
        --no-feature-limit \
        --no-tile-size-limit \
        --force \
        --coalesce-densest-as-needed \
        --extend-zooms-if-still-dropping \
        "$TEMP_DIR/industries.geojson"
    echo "   ✅ industries.pmtiles 생성 완료"
fi

# 결과 출력
echo ""
echo "=========================================="
echo "✨ PMTiles 생성 완료!"
echo "=========================================="
echo ""
echo "📊 줌 레벨 설정 요약:"
echo "   sido.pmtiles:        줌 0-8  (표시: 0-8)"
echo "   sig.pmtiles:         줌 0-12 (표시: 8-12)"
echo "   emd.pmtiles:         줌 0-14 (표시: 12-14)"
echo "   parcels.pmtiles:     줌 12-17 → 오버줌 22 (표시: 14-22)"
echo "   all-parcels.pmtiles: 줌 12-17 → 오버줌 22 (표시: 14-22)"
echo "   complex.pmtiles:     줌 0-16 → 오버줌 22 (표시: 0-22, 전체)"
echo "   lots.pmtiles:        줌 12-17 → 오버줌 22 (표시: 12-22)"
echo "   industries.pmtiles:  줌 12-17 → 오버줌 22 (표시: 12-22)"
echo ""
echo "📁 생성된 파일:"
ls -lh "$TILES_DIR"/*.pmtiles 2>/dev/null || echo "(생성된 파일 없음)"
echo ""
echo "💡 참고: 공장 데이터는 PMTiles가 아닌 JSON + Deck.gl 마커로 표현"
echo "   파일: public/data/factories.json"
echo ""
