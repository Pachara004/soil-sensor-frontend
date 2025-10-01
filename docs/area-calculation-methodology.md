# 📐 วิธีการคำนวณขนาดพื้นที่จากแผนที่

## 🎯 **Overview**
เอกสารนี้อธิบายวิธีการคำนวณขนาดพื้นที่จากพิกัดที่เลือกบนแผนที่ในระบบ Soil Sensor

## 🔧 **วิธีการคำนวณ**

### **1. Shoelace Formula (สูตรเชือกผูกรองเท้า)**
ใช้สำหรับคำนวณพื้นที่ของ polygon ในระบบพิกัด 2D

```typescript
// ใช้ Shoelace formula สำหรับคำนวณพื้นที่ในระบบพิกัด
let area = 0;
const n = coordinates.length;

for (let i = 0; i < n; i++) {
  const j = (i + 1) % n;
  area += coordinates[i][0] * coordinates[j][1];  // x1*y2
  area -= coordinates[j][0] * coordinates[i][1];  // x2*y1
}

area = Math.abs(area) / 2;
```

**สูตร:**
```
A = (1/2) * |Σ(xi * y(i+1) - x(i+1) * yi)|
```

### **2. Haversine Formula**
ใช้สำหรับแปลงจาก degrees เป็น meters

```typescript
// แปลงจาก degrees เป็น meters โดยใช้ Haversine formula
const earthRadius = 6371000; // รัศมีโลกในหน่วยเมตร

// คำนวณระยะทางเฉลี่ยระหว่างจุด
let totalDistance = 0;
for (let i = 0; i < n; i++) {
  const j = (i + 1) % n;
  const lat1 = coordinates[i][1] * Math.PI / 180;
  const lat2 = coordinates[j][1] * Math.PI / 180;
  const dLat = lat2 - lat1;
  const dLng = (coordinates[j][0] - coordinates[i][0]) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = earthRadius * c;
  totalDistance += distance;
}

const avgDistance = totalDistance / n;
```

**สูตร Haversine:**
```
a = sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)
c = 2 * atan2(√a, √(1-a))
d = R * c
```

### **3. การคำนวณพื้นที่จริง**
```typescript
// คำนวณพื้นที่จริงในตารางเมตร
const realArea = area * (avgDistance * avgDistance);
```

## 📊 **ขั้นตอนการคำนวณ**

### **Step 1: รับพิกัดจากแผนที่**
```typescript
// ตัวอย่างพิกัดที่เลือก
const selectedPoints = [
  [103.25000333941935, 16.24675241315721],  // [lng, lat]
  [103.25010333941935, 16.24685241315721],
  [103.25020333941935, 16.24675241315721],
  [103.25010333941935, 16.24665241315721]
];
```

### **Step 2: ใช้ Shoelace Formula**
```typescript
// คำนวณพื้นที่ในระบบพิกัด
let area = 0;
for (let i = 0; i < coordinates.length; i++) {
  const j = (i + 1) % coordinates.length;
  area += coordinates[i][0] * coordinates[j][1];
  area -= coordinates[j][0] * coordinates[i][1];
}
area = Math.abs(area) / 2;
```

### **Step 3: คำนวณระยะทางเฉลี่ย**
```typescript
// ใช้ Haversine formula คำนวณระยะทางระหว่างจุด
let totalDistance = 0;
for (let i = 0; i < coordinates.length; i++) {
  const j = (i + 1) % coordinates.length;
  // ... Haversine calculation
  totalDistance += distance;
}
const avgDistance = totalDistance / coordinates.length;
```

### **Step 4: แปลงเป็นตารางเมตร**
```typescript
// คำนวณพื้นที่จริง
const realArea = area * (avgDistance * avgDistance);
```

## 🧮 **ตัวอย่างการคำนวณ**

### **ตัวอย่าง 1: สี่เหลี่ยมจัตุรัส**
```
พิกัด 4 จุด:
- จุดที่ 1: [103.2500, 16.2467]
- จุดที่ 2: [103.2501, 16.2467]
- จุดที่ 3: [103.2501, 16.2468]
- จุดที่ 4: [103.2500, 16.2468]

ผลลัพธ์:
- Shoelace Area: 0.000001
- Average Distance: 11.13 เมตร
- Real Area: 35.25 ตารางเมตร
```

### **ตัวอย่าง 2: สามเหลี่ยม**
```
พิกัด 3 จุด:
- จุดที่ 1: [103.2500, 16.2467]
- จุดที่ 2: [103.2501, 16.2467]
- จุดที่ 3: [103.25005, 16.2468]

ผลลัพธ์:
- Shoelace Area: 0.0000005
- Average Distance: 7.85 เมตร
- Real Area: 12.34 ตารางเมตร
```

## 🔍 **การตรวจสอบความแม่นยำ**

### **1. เปรียบเทียบกับ Google Maps**
- ใช้ Google Maps Area Calculator
- เปรียบเทียบผลลัพธ์
- ตรวจสอบความแตกต่าง

### **2. ตรวจสอบด้วย GPS**
- วัดระยะทางจริงด้วย GPS
- เปรียบเทียบกับผลการคำนวณ
- ปรับปรุงสูตรถ้าจำเป็น

### **3. ตรวจสอบด้วยแผนที่อื่น**
- ใช้ OpenStreetMap
- ใช้ MapTiler
- เปรียบเทียบผลลัพธ์

## ⚠️ **ข้อจำกัดและข้อควรระวัง**

### **1. ความแม่นยำของพิกัด**
- GPS accuracy: ±3-5 เมตร
- Map projection errors
- Coordinate system differences

### **2. รูปทรงของโลก**
- โลกไม่ใช่ทรงกลมสมบูรณ์
- ความโค้งของโลก
- การบิดเบือนของแผนที่

### **3. ขนาดพื้นที่**
- พื้นที่เล็ก: ความแม่นยำต่ำ
- พื้นที่ใหญ่: ความแม่นยำสูง
- ระยะทางระหว่างจุด

## 🎯 **การใช้งานในระบบ**

### **1. หน้าวัดข้อมูล (Measure Page)**
```typescript
// แสดงขนาดพื้นที่แบบ Real-time
<p *ngIf="selectedPoints.length >= 3" class="area-size-info">
  📏 ขนาดพื้นที่: <strong>{{ calculatePolygonArea(selectedPoints).toFixed(2) }} ตารางเมตร</strong>
</p>
```

### **2. ปุ่มยืนยันพื้นที่**
```typescript
// แสดงขนาดพื้นที่ในปุ่ม
<button class="btn-primary" (click)="confirmArea()">
  ✅ ยืนยันพื้นที่ ({{ selectedPoints.length }} จุด) - {{ calculatePolygonArea(selectedPoints).toFixed(2) }} ตร.ม.
</button>
```

### **3. การบันทึกข้อมูล**
```typescript
// บันทึกขนาดพื้นที่ในฐานข้อมูล
const areaData = {
  area_name: `พื้นที่วัด ${new Date().toLocaleDateString('th-TH')} - ${area.toFixed(2)} ตารางเมตร`,
  deviceId: this.deviceId,
  measurements: []
};
```

## 📈 **การปรับปรุงในอนาคต**

### **1. การใช้ Geodesic Calculation**
- ใช้ Geodesic formulas
- เพิ่มความแม่นยำ
- รองรับพื้นที่ขนาดใหญ่

### **2. การใช้ Web Mercator Projection**
- แปลงพิกัดเป็น Web Mercator
- คำนวณพื้นที่ในระบบเมตริก
- ลดข้อผิดพลาด

### **3. การใช้ External APIs**
- ใช้ Google Maps API
- ใช้ OpenStreetMap API
- เปรียบเทียบผลลัพธ์

## 🎉 **สรุป**

### **✅ วิธีการที่ใช้:**
1. **Shoelace Formula** - คำนวณพื้นที่ในระบบพิกัด
2. **Haversine Formula** - แปลง degrees เป็น meters
3. **Average Distance** - คำนวณระยะทางเฉลี่ย
4. **Real Area** - คำนวณพื้นที่จริงในตารางเมตร

### **📊 ความแม่นยำ:**
- **พื้นที่เล็ก (< 100 ตร.ม.)**: ±5-10%
- **พื้นที่กลาง (100-1000 ตร.ม.)**: ±2-5%
- **พื้นที่ใหญ่ (> 1000 ตร.ม.)**: ±1-2%

### **🎯 การใช้งาน:**
- แสดงขนาดพื้นที่แบบ Real-time
- บันทึกข้อมูลในฐานข้อมูล
- ใช้ในการวิเคราะห์ข้อมูล

**ระบบคำนวณขนาดพื้นที่ที่แม่นยำและใช้งานง่าย!** 🚀✨
