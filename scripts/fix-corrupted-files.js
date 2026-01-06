const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'public', 'data', 'properties');

// Fix knowledge-centers-index.json
const kcIndexPath = path.join(dataDir, 'knowledge-centers-index.json');
if (fs.existsSync(kcIndexPath)) {
    const content = fs.readFileSync(kcIndexPath, 'utf8');
    const startIdx = content.indexOf('[{"id":"kic-');
    if (startIdx >= 0) {
        const jsonData = content.substring(startIdx);
        fs.writeFileSync(kcIndexPath, jsonData, 'utf8');
        console.log('Fixed knowledge-centers-index.json');
    } else {
        console.log('Could not find JSON array in knowledge-centers-index.json');
    }
}

// Check and report other files
const filesToCheck = [
    'complexes.json',
    'factories-index.json',
    'factories.json',
    'parcels.json',
    'parcel-markers.json',
    'districts-emd.json',
    'districts-sig.json',
    'districts-sido.json',
    'knowledge-centers.json',
    'lots.json',
    'industries.json'
];

console.log('\nChecking other files for corruption:');
filesToCheck.forEach(file => {
    const filePath = path.join(dataDir, file);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8').substring(0, 200);
        const isCorrupted = content.includes('use strict') ||
                           content.includes('webpack') ||
                           !content.startsWith('[') && !content.startsWith('{');
        console.log(`  ${file}: ${isCorrupted ? 'CORRUPTED' : 'OK'}`);
    } else {
        console.log(`  ${file}: NOT FOUND`);
    }
});
