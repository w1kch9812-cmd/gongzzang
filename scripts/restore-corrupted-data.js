const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'public', 'data', 'properties');
const tempDir = path.join(__dirname, '..', 'temp');

// 1. Generate knowledge-centers-index.json from knowledge-centers.json
console.log('1. Generating knowledge-centers-index.json...');
const kcFullPath = path.join(dataDir, 'knowledge-centers.json');
const kcIndexPath = path.join(dataDir, 'knowledge-centers-index.json');

if (fs.existsSync(kcFullPath)) {
    const kcFull = JSON.parse(fs.readFileSync(kcFullPath, 'utf8'));
    const kcIndex = kcFull.map(kc => ({
        id: kc.id,
        name: kc.name,
        coord: kc.coord,
        status: kc.status,
        pnu: kc.pnu,
        // 광고 속성 (있는 경우)
        ...(kc.isAd && { isAd: kc.isAd }),
        ...(kc.phoneNumber && { phoneNumber: kc.phoneNumber }),
        ...(kc.thumbnailUrl && { thumbnailUrl: kc.thumbnailUrl }),
    }));
    fs.writeFileSync(kcIndexPath, JSON.stringify(kcIndex), 'utf8');
    console.log(`   Created: ${kcIndex.length} knowledge centers`);
} else {
    console.log('   ERROR: knowledge-centers.json not found');
}

// 2. Generate complexes.json from temp/complex.geojson
console.log('2. Generating complexes.json from GeoJSON...');
const complexGeoPath = path.join(tempDir, 'complex.geojson');
const complexesPath = path.join(dataDir, 'complexes.json');

if (fs.existsSync(complexGeoPath)) {
    const geojson = JSON.parse(fs.readFileSync(complexGeoPath, 'utf8'));
    const complexes = geojson.features.map(f => {
        const props = f.properties;
        // 중심점 계산
        let coord = null;
        if (f.geometry) {
            if (f.geometry.type === 'Polygon') {
                // Polygon의 첫 번째 좌표 배열의 중심점 계산
                const coords = f.geometry.coordinates[0];
                const lngs = coords.map(c => c[0]);
                const lats = coords.map(c => c[1]);
                coord = [
                    (Math.min(...lngs) + Math.max(...lngs)) / 2,
                    (Math.min(...lats) + Math.max(...lats)) / 2
                ];
            } else if (f.geometry.type === 'MultiPolygon') {
                // MultiPolygon의 첫 번째 폴리곤 사용
                const coords = f.geometry.coordinates[0][0];
                const lngs = coords.map(c => c[0]);
                const lats = coords.map(c => c[1]);
                coord = [
                    (Math.min(...lngs) + Math.max(...lngs)) / 2,
                    (Math.min(...lats) + Math.max(...lats)) / 2
                ];
            }
        }

        return {
            id: props.id || props.DAN_ID,
            name: props.name || props.DAN_NAME,
            type: props.type || props.DANJI_TYPE,
            coord: coord,
            ...(props.area && { area: props.area }),
            ...(props.sigCode && { sigCode: props.sigCode }),
            ...(props.status && { status: props.status }),
            ...(props.completionRate !== undefined && { completionRate: props.completionRate }),
            // 광고 속성
            ...(props.isAd && { isAd: props.isAd }),
            ...(props.phoneNumber && { phoneNumber: props.phoneNumber }),
            ...(props.thumbnailUrl && { thumbnailUrl: props.thumbnailUrl }),
        };
    });
    fs.writeFileSync(complexesPath, JSON.stringify(complexes), 'utf8');
    console.log(`   Created: ${complexes.length} industrial complexes`);
} else {
    console.log('   ERROR: temp/complex.geojson not found');
}

console.log('\nDone!');
