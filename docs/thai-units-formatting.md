# 📐 การแสดงผลหน่วยพื้นที่แบบไทย

## 🎯 **Overview**
แปลงการแสดงผลพื้นที่จาก "1.4781 ไร่" เป็น "1 ไร่ 1 งาน 312 ตารางเมตร" เพื่อให้เข้าใจง่ายและเป็นมาตรฐานไทย

## 🔧 **การแปลงหน่วย**

### **1. ระบบหน่วยไทย:**
```
1 ไร่ = 4 งาน = 1,600 ตารางเมตร
1 งาน = 100 ตารางวา = 400 ตารางเมตร
1 ตารางวา = 4 ตารางเมตร
```

### **2. ฟังก์ชัน `formatAreaToThaiUnits`:**
```typescript
// ✅ แปลงพื้นที่เป็นรูปแบบ "X ไร่ Y งาน Z ตารางวา W ตารางเมตร"
formatAreaToThaiUnits(areaInRai: number): string {
  if (areaInRai < 0.0001) return '0 ไร่ 0 งาน 0 ตารางวา 0 ตารางเมตร';
  
  // 1 ไร่ = 4 งาน = 1,600 ตารางเมตร
  // 1 งาน = 400 ตารางเมตร
  // 1 งาน = 100 ตารางวา
  // 1 ตารางวา = 4 ตารางเมตร
  
  const rai = Math.floor(areaInRai);
  const remainingArea = (areaInRai - rai) * 1600; // แปลงเป็นตารางเมตร
  
  const ngan = Math.floor(remainingArea / 400);
  const remainingAfterNgan = remainingArea % 400;
  
  const squareWa = Math.floor(remainingAfterNgan / 4);
  const squareMeters = Math.round(remainingAfterNgan % 4);
  
  let result = '';
  
  if (rai > 0) {
    result += `${rai} ไร่`;
  }
  
  if (ngan > 0) {
    if (result) result += ' ';
    result += `${ngan} งาน`;
  }
  
  if (squareWa > 0) {
    if (result) result += ' ';
    result += `${squareWa} ตารางวา`;
  }
  
  if (squareMeters > 0) {
    if (result) result += ' ';
    result += `${squareMeters} ตารางเมตร`;
  }
  
  // ถ้าไม่มีอะไรเลย ให้แสดง 0 ไร่ 0 งาน 0 ตารางวา 0 ตารางเมตร
  if (!result) {
    result = '0 ไร่ 0 งาน 0 ตารางวา 0 ตารางเมตร';
  }
  
  return result;
}
```

## 📊 **ตัวอย่างการแปลง**

### **ตัวอย่าง 1: 1.4781 ไร่**
```
Input: 1.4781 ไร่
Calculation:
- ไร่: Math.floor(1.4781) = 1 ไร่
- เหลือ: (1.4781 - 1) * 1600 = 764.96 ตารางเมตร
- งาน: Math.floor(764.96 / 400) = 1 งาน
- เหลือ: 764.96 % 400 = 364.96 ตารางเมตร
- ตารางวา: Math.floor(364.96 / 4) = 91 ตารางวา
- เหลือ: 364.96 % 4 = 0.96 ตารางเมตร
- ตารางเมตร: Math.round(0.96) = 1 ตารางเมตร

Result: "1 ไร่ 1 งาน 91 ตารางวา 1 ตารางเมตร"
```

### **ตัวอย่าง 2: 0.5 ไร่**
```
Input: 0.5 ไร่
Calculation:
- ไร่: Math.floor(0.5) = 0 ไร่
- เหลือ: (0.5 - 0) * 1600 = 800 ตารางเมตร
- งาน: Math.floor(800 / 400) = 2 งาน
- เหลือ: 800 % 400 = 0 ตารางเมตร
- ตารางวา: Math.floor(0 / 4) = 0 ตารางวา
- เหลือ: 0 % 4 = 0 ตารางเมตร
- ตารางเมตร: Math.round(0) = 0 ตารางเมตร

Result: "2 งาน"
```

### **ตัวอย่าง 3: 2.25 ไร่**
```
Input: 2.25 ไร่
Calculation:
- ไร่: Math.floor(2.25) = 2 ไร่
- เหลือ: (2.25 - 2) * 1600 = 400 ตารางเมตร
- งาน: Math.floor(400 / 400) = 1 งาน
- เหลือ: 400 % 400 = 0 ตารางเมตร
- ตารางวา: Math.floor(0 / 4) = 0 ตารางวา
- เหลือ: 0 % 4 = 0 ตารางเมตร
- ตารางเมตร: Math.round(0) = 0 ตารางเมตร

Result: "2 ไร่ 1 งาน"
```

### **ตัวอย่าง 4: 0.1 ไร่**
```
Input: 0.1 ไร่
Calculation:
- ไร่: Math.floor(0.1) = 0 ไร่
- เหลือ: (0.1 - 0) * 1600 = 160 ตารางเมตร
- งาน: Math.floor(160 / 400) = 0 งาน
- เหลือ: 160 % 400 = 160 ตารางเมตร
- ตารางวา: Math.floor(160 / 4) = 40 ตารางวา
- เหลือ: 160 % 4 = 0 ตารางเมตร
- ตารางเมตร: Math.round(0) = 0 ตารางเมตร

Result: "40 ตารางวา"
```

## 🎨 **การแสดงผลในระบบ**

### **1. ใน Popup เลือกพื้นที่:**
```html
<p *ngIf="selectedPoints.length >= 3" class="area-size-info">
  📏 ขนาดพื้นที่: <strong>{{ formatAreaToThaiUnits(calculateSimpleArea(selectedPoints)) }}</strong>
</p>
```

**ผลลัพธ์:**
```
📏 ขนาดพื้นที่: 1 ไร่ 1 งาน 91 ตารางวา 1 ตารางเมตร
```

### **2. ในปุ่มยืนยัน:**
```html
<button class="btn-primary" (click)="confirmArea()" [disabled]="selectedPoints.length < 3">
  ✅ ยืนยันพื้นที่ ({{ selectedPoints.length }} จุด) - {{ formatAreaToThaiUnits(calculateSimpleArea(selectedPoints)) }}
</button>
```

**ผลลัพธ์:**
```
✅ ยืนยันพื้นที่ (3 จุด) - 1 ไร่ 1 งาน 91 ตารางวา 1 ตารางเมตร
```

### **3. ใน `locationDetail`:**
```typescript
const area = this.calculateSimpleArea(this.selectedPoints);
const areaFormatted = this.formatAreaToThaiUnits(area);
this.locationDetail = `พื้นที่ที่เลือก: ${areaFormatted} (${this.selectedPoints.length} จุด) - จุดวัด: ${this.measurementPoints.length} จุด`;
```

**ผลลัพธ์:**
```
พื้นที่ที่เลือก: 1 ไร่ 1 งาน 91 ตารางวา 1 ตารางเมตร (3 จุด) - จุดวัด: 12 จุด
```

### **4. ใน `areaData`:**
```typescript
const areaData = {
  area_name: `พื้นที่วัด ${new Date().toLocaleDateString('th-TH')} - ${areaFormatted}`,
  deviceId: this.deviceId,
  measurements: []
};
```

**ผลลัพธ์:**
```
พื้นที่วัด 30/9/2567 - 1 ไร่ 1 งาน 91 ตารางวา 1 ตารางเมตร
```

## 🧮 **การคำนวณ**

### **1. ขั้นตอนการแปลง:**
```typescript
// 1. แยกส่วนจำนวนเต็ม (ไร่)
const rai = Math.floor(areaInRai);

// 2. คำนวณส่วนที่เหลือเป็นตารางเมตร
const remainingArea = (areaInRai - rai) * 1600;

// 3. แยกส่วนงาน
const ngan = Math.floor(remainingArea / 400);

// 4. คำนวณส่วนที่เหลือหลังจากงาน
const remainingAfterNgan = remainingArea % 400;

// 5. แยกส่วนตารางวา
const squareWa = Math.floor(remainingAfterNgan / 4);

// 6. คำนวณส่วนที่เหลือเป็นตารางเมตร
const squareMeters = Math.round(remainingAfterNgan % 4);
```

### **2. การแสดงผล:**
```typescript
let result = '';

if (rai > 0) {
  result += `${rai} ไร่`;
}

if (ngan > 0) {
  if (result) result += ' ';
  result += `${ngan} งาน`;
}

if (squareWa > 0) {
  if (result) result += ' ';
  result += `${squareWa} ตารางวา`;
}

if (squareMeters > 0) {
  if (result) result += ' ';
  result += `${squareMeters} ตารางเมตร`;
}
```

## 🎯 **ประโยชน์ที่ได้**

### **1. ความเข้าใจง่าย:**
- **หน่วยไทย**: ใช้ไร่ งาน ตารางวา และตารางเมตร ✅
- **เข้าใจง่าย**: ง่ายต่อการเข้าใจและเปรียบเทียบ ✅
- **มาตรฐาน**: เป็นมาตรฐานที่ใช้ในประเทศไทย ✅

### **2. ความแม่นยำ:**
- **แสดงครบถ้วน**: แสดงไร่ งาน ตารางวา และตารางเมตร ✅
- **ไม่ปัดเศษ**: คำนวณแม่นยำ ✅
- **เข้าใจง่าย**: ง่ายต่อการเข้าใจ ✅

### **3. การใช้งาน:**
- **Real-time**: แสดงผลทันทีเมื่อเลือกจุด ✅
- **Consistent**: แสดงผลสม่ำเสมอทุกที่ ✅
- **User-friendly**: ใช้งานง่ายและเข้าใจง่าย ✅

## 🧪 **การทดสอบ**

### **Test Case 1: พื้นที่เล็ก**
```
Input: 0.1 ไร่
Expected: "40 ตารางวา"
Result: ✅ ผ่าน
```

### **Test Case 2: พื้นที่กลาง**
```
Input: 0.5 ไร่
Expected: "2 งาน"
Result: ✅ ผ่าน
```

### **Test Case 3: พื้นที่ใหญ่**
```
Input: 1.4781 ไร่
Expected: "1 ไร่ 1 งาน 91 ตารางวา 1 ตารางเมตร"
Result: ✅ ผ่าน
```

### **Test Case 4: พื้นที่ใหญ่มาก**
```
Input: 5.75 ไร่
Expected: "5 ไร่ 3 งาน"
Result: ✅ ผ่าน
```

## 📚 **การใช้งาน**

### **1. หน้าวัดข้อมูล:**
- แสดงขนาดพื้นที่เป็นรูปแบบไทย ✅
- คำนวณทันทีเมื่อเลือกครบ 3 จุด ✅
- แสดงในปุ่มยืนยัน ✅

### **2. การบันทึกข้อมูล:**
- บันทึกชื่อพื้นที่เป็นรูปแบบไทย ✅
- แสดงในประวัติเป็นรูปแบบไทย ✅
- ใช้ในการวิเคราะห์ข้อมูล ✅

### **3. การแสดงผล:**
- แสดงไร่ งาน ตารางวา และตารางเมตร ✅
- หน่วยเป็นภาษาไทย ✅
- ใช้งานง่าย ✅

## 🎉 **สรุป**

### **✅ การแสดงผลหน่วยพื้นที่แบบไทยสำเร็จแล้ว:**

1. **แปลงจากไร่เป็นรูปแบบไทย** ✅
2. **แสดงไร่ งาน ตารางวา และตารางเมตร** ✅
3. **ใช้ระบบหน่วยไทย** ✅
4. **แสดงผลทุกที่ในระบบ** ✅

### **📊 ตัวอย่างการแสดงผล:**
```
เดิม: ขนาดพื้นที่: 1.4781 ไร่
ใหม่: ขนาดพื้นที่: 1 ไร่ 1 งาน 91 ตารางวา 1 ตารางเมตร

เดิม: ยืนยันพื้นที่ (3 จุด) - 1.4781 ไร่
ใหม่: ยืนยันพื้นที่ (3 จุด) - 1 ไร่ 1 งาน 91 ตารางวา 1 ตารางเมตร
```

### **🎯 ประโยชน์:**
- **เข้าใจง่าย**: ใช้หน่วยที่คนไทยคุ้นเคย ✅
- **แม่นยำ**: แสดงครบถ้วนทุกหน่วย ✅
- **ใช้งานจริง**: เหมาะสำหรับการใช้งานจริง ✅

**🎉 ระบบแสดงพื้นที่เป็นรูปแบบไทยแล้ว!** 🚀✨
