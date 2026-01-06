import * as shapefile from 'shapefile';

async function main() {
    const files = [
        'rawdata/N3A_G0010000.shp',
        'rawdata/AL_D001_00_20251204(LIO).shp',
        'rawdata/AL_D010_28_20251204.shp',
    ];

    for (const file of files) {
        try {
            console.log(`\n=== ${file} ===`);
            const source = await shapefile.open(file);
            const result = await source.read();
            console.log('Properties:', Object.keys(result.value?.properties || {}));
            console.log('Sample:', JSON.stringify(result.value?.properties));
            console.log('Geometry:', result.value?.geometry?.type);
        } catch (e: any) {
            console.log('Error:', e.message);
        }
    }
}

main();
