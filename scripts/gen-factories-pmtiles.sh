#!/bin/bash
# 공장 PMTiles 생성

TILES_DIR="/mnt/e/gongzzang/public/tiles"
TEMP_DIR="/mnt/e/gongzzang/temp"

echo "🏭 공장 PMTiles 생성..."
tippecanoe \
    -o "$TILES_DIR/factories.pmtiles" \
    -l factories \
    -z 20 \
    -Z 0 \
    --no-feature-limit \
    --no-tile-size-limit \
    --force \
    --coalesce-densest-as-needed \
    --extend-zooms-if-still-dropping \
    "$TEMP_DIR/factories.geojson"

echo "✅ factories.pmtiles 생성 완료"
ls -lh "$TILES_DIR/factories.pmtiles"
