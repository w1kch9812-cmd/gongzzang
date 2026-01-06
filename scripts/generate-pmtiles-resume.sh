#!/bin/bash
# scripts/generate-pmtiles-resume.sh
# 중단된 지점부터 이어서 PMTiles 생성 (이미 존재하는 파일은 스킵)

set -e

WS_DIR="/mnt/e/gongzzang"
TEMP_DIR="$WS_DIR/temp"
TILES_DIR="$WS_DIR/public/tiles"

echo "📦 PMTiles 생성 (재개 모드)..."
echo "   이미 존재하는 파일은 스킵합니다."
echo ""

# 디렉토리 생성
mkdir -p "$TILES_DIR"

# 도구 확인
if ! command -v tippecanoe &> /dev/null; then
    echo "❌ tippecanoe가 설치되지 않았습니다."
    exit 1
fi

generate_pmtiles() {
    local name=$1
    local layer=$2
    local geojson="$TEMP_DIR/${name}.geojson"
    local pmtiles="$TILES_DIR/${name}.pmtiles"
    local extra_opts="${3:-}"

    if [ ! -f "$geojson" ]; then
        echo "⚠️  $geojson 없음 - 스킵"
        return
    fi

    if [ -f "$pmtiles" ]; then
        local geojson_time=$(stat -c %Y "$geojson" 2>/dev/null || echo 0)
        local pmtiles_time=$(stat -c %Y "$pmtiles" 2>/dev/null || echo 0)

        if [ "$pmtiles_time" -gt "$geojson_time" ]; then
            echo "✅ $pmtiles 이미 최신 - 스킵"
            return
        fi
    fi

    echo ""
    echo "🔄 $name 타일 생성 중..."
    tippecanoe \
        -o "$pmtiles" \
        -l "$layer" \
        -z 20 \
        -Z 0 \
        --no-feature-limit \
        --no-tile-size-limit \
        --force \
        --coalesce-densest-as-needed \
        $extra_opts \
        "$geojson"
    echo "   ✅ $pmtiles 완료"
}

# 순서대로 생성 (이미 있는 것은 스킵)
generate_pmtiles "sido" "sido"
generate_pmtiles "sig" "sig"
generate_pmtiles "emd" "emd"
generate_pmtiles "parcels" "parcels" "--drop-smallest-as-needed"
generate_pmtiles "complex" "complex"
generate_pmtiles "lots" "lots"
generate_pmtiles "industries" "industries"

echo ""
echo "=========================================="
echo "✨ PMTiles 생성 완료!"
echo "=========================================="
ls -lh "$TILES_DIR"/*.pmtiles 2>/dev/null || echo "(생성된 파일 없음)"
