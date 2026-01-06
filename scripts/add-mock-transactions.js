// scripts/add-mock-transactions.js
// 필지 데이터에 실거래 mock 데이터 추가

const fs = require('fs');
const path = require('path');

const parcelsPath = path.join(__dirname, '../public/data/properties/parcels.json');
const markersPath = path.join(__dirname, '../public/data/properties/parcel-markers.json');

// 파일 읽기
const parcels = JSON.parse(fs.readFileSync(parcelsPath, 'utf-8'));
const markers = JSON.parse(fs.readFileSync(markersPath, 'utf-8'));

let updatedCount = 0;

// parcels.json 업데이트
parcels.forEach(p => {
    // type이 0인 필지에 실거래 데이터 추가 (약 40%)
    if (p.type === 0 && Math.random() < 0.4) {
        p.type = 1;
        p.transactionPrice = Math.floor(Math.random() * 90000) + 10000; // 1억 ~ 10억
        const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
        const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
        p.transactionDate = `2024-${month}-${day}`;
        p.transactions = [
            {
                date: p.transactionDate,
                price: p.transactionPrice,
                type: '토지'
            }
        ];
        updatedCount++;
    }
});

// parcel-markers.json도 업데이트
const parcelMap = new Map(parcels.map(p => [p.id || p.PNU, p]));

markers.forEach(m => {
    const parcel = parcelMap.get(m.id);
    if (parcel && parcel.type === 1 && m.type === 0) {
        m.type = 1;
        m.transactionPrice = parcel.transactionPrice;
    }
});

// 파일 저장
fs.writeFileSync(parcelsPath, JSON.stringify(parcels, null, 2), 'utf-8');
fs.writeFileSync(markersPath, JSON.stringify(markers), 'utf-8');

console.log(`✅ Updated ${updatedCount} parcels with mock transaction data`);
console.log(`   - parcels.json: ${parcels.length} items`);
console.log(`   - parcel-markers.json: ${markers.length} items`);
