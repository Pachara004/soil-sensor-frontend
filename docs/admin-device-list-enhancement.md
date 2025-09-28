# Admin Device List Enhancement

## 🎯 **เป้าหมาย**
ปรับปรุงรายการอุปกรณ์ทั้งหมดให้มีช่องค้นหาและแสดงข้อมูลครบถ้วนแบบเดียวกับรายการผู้ใช้

## 🔧 **การปรับปรุงที่ทำ**

### **1. ปรับปรุง HTML Template:**

#### **เดิม (แบบเก่า):**
```html
<div class="content-section" *ngIf="showDevicesList">
  <div class="section-header">
    <i class="fas fa-microchip"></i>
    <h3>รายการอุปกรณ์ทั้งหมด</h3>
    <span class="user-count">จำนวน: {{ devices.length }} เครื่อง</span>
  </div>
  <div class="content-list">
    <div class="list-item" *ngFor="let device of devices">
      <div class="item-info">
        <div class="item-name">{{ device.display_name || device.name || 'Device ' + (device.id || device.deviceid) }}</div>
        <div class="item-detail">ID: {{ device.id || device.deviceid }}</div>
        <div class="item-detail" *ngIf="device.user_id || device.userid">
          ผู้ใช้: {{ getDeviceUserName(device.user_id || device.userid) }}
        </div>
        <div class="item-detail">
          สถานะ: <span [ngClass]="device.status === 'active' ? 'status-active' : 'status-inactive'">
            {{ device.status || 'ไม่ระบุ' }}
          </span>
        </div>
        <div class="item-detail" *ngIf="device.created_at">
          สร้างเมื่อ: {{ formatDate(device.created_at) }}
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-view" (click)="viewDevice(device)">ดูข้อมูล</button>
        <button class="btn btn-delete" (click)="deleteDevice(device.id || device.deviceid)">ลบ</button>
      </div>
    </div>
  </div>
</div>
```

#### **ใหม่ (แบบใหม่):**
```html
<div class="content-section" *ngIf="showDevicesList">
  <div class="section-header">
    <i class="fas fa-microchip"></i>
    <h3>รายการอุปกรณ์ทั้งหมด ({{ devicesDisplay.length }} เครื่อง)</h3>
    <div class="header-actions">
      <div class="search-box">
        <i class="fas fa-search"></i>
        <input 
          type="text" 
          placeholder="ค้นหาอุปกรณ์..." 
          [(ngModel)]="deviceSearchQuery"
          (input)="onDeviceSearch()"
          class="search-input">
      </div>
      <button class="refresh-btn" (click)="loadDevices()" [disabled]="loadingDevices">
        <i class="fas fa-sync-alt" [class.fa-spin]="loadingDevices"></i>
        <span *ngIf="!loadingDevices">รีเฟรช</span>
        <span *ngIf="loadingDevices">กำลังโหลด...</span>
      </button>
    </div>
  </div>
  <div class="content-list">
    <div class="device-card" *ngFor="let device of devicesDisplay; let i = index">
      <div class="device-header">
        <div class="device-icon">
          <i class="fas fa-microchip"></i>
        </div>
        <div class="device-basic-info">
          <div class="device-name">{{ device.display_name || device.name || 'Device ' + (device.id || device.deviceid) }}</div>
          <div class="device-id">ID: {{ device.id || device.deviceid || 'ไม่ระบุ' }}</div>
        </div>
        <div class="device-status">
          <span class="status-badge" [ngClass]="'status-' + (device.status || 'unknown')">
            {{ device.status === 'active' ? 'Active' : device.status === 'inactive' ? 'Inactive' : 'Unknown' }}
          </span>
        </div>
      </div>
      
      <div class="device-details">
        <div class="detail-row" *ngIf="device.user_id || device.userid">
          <div class="detail-label">
            <i class="fas fa-user"></i>
            <span>ผู้ใช้:</span>
          </div>
          <div class="detail-value">{{ getDeviceUserName(device.user_id || device.userid) }}</div>
        </div>
        
        <div class="detail-row">
          <div class="detail-label">
            <i class="fas fa-info-circle"></i>
            <span>สถานะ:</span>
          </div>
          <div class="detail-value">
            <span [ngClass]="device.status === 'active' ? 'status-active' : 'status-inactive'">
              {{ device.status || 'ไม่ระบุ' }}
            </span>
          </div>
        </div>
        
        <div class="detail-row" *ngIf="device.created_at">
          <div class="detail-label">
            <i class="fas fa-calendar-plus"></i>
            <span>สร้างเมื่อ:</span>
          </div>
          <div class="detail-value">{{ formatDate(device.created_at) }}</div>
        </div>
        
        <div class="detail-row" *ngIf="device.updated_at">
          <div class="detail-label">
            <i class="fas fa-calendar-check"></i>
            <span>อัปเดตล่าสุด:</span>
          </div>
          <div class="detail-value">{{ formatDate(device.updated_at) }}</div>
        </div>
        
        <div class="detail-row" *ngIf="device.description">
          <div class="detail-label">
            <i class="fas fa-align-left"></i>
            <span>คำอธิบาย:</span>
          </div>
          <div class="detail-value">{{ device.description }}</div>
        </div>
      </div>
      
      <div class="device-actions">
        <button class="btn btn-view" (click)="viewDevice(device)" title="ดูข้อมูลอุปกรณ์">
          <i class="fas fa-eye"></i>
          <span>ดูข้อมูล</span>
        </button>
        <button class="btn btn-delete" (click)="deleteDevice(device.id || device.deviceid)" title="ลบอุปกรณ์">
          <i class="fas fa-trash"></i>
          <span>ลบ</span>
        </button>
        <button class="btn btn-edit" (click)="editDevice(device)" title="แก้ไขข้อมูลอุปกรณ์">
          <i class="fas fa-edit"></i>
          <span>แก้ไข</span>
        </button>
      </div>
    </div>
  </div>
</div>
```

### **2. เพิ่ม TypeScript Properties และ Functions:**

#### **เพิ่ม Properties:**
```typescript
// ✅ Device search properties
deviceSearchQuery = '';
devicesDisplay: any[] = [];
loadingDevices = false;
```

#### **ปรับปรุงฟังก์ชัน loadDevices:**
```typescript
async loadDevices() {
  try {
    this.loadingDevices = true;
    const devicesResult = await this.adminService.getDevices();
    
    if (Array.isArray(devicesResult)) {
      this.devices = devicesResult;
    } else {
      console.warn('⚠️ getDevices() returned non-array:', devicesResult);
      this.devices = [];
    }
    
    // ✅ เรียงข้อมูลตาม device id (จากน้อยไปมาก)
    this.devices.sort((a, b) => {
      const aId = a['id'] || a['deviceid'] || 0;
      const bId = b['id'] || b['deviceid'] || 0;
      return aId - bId;
    });
    
    this.devicesDisplay = [...this.devices];
    this.loadingDevices = false;
    this.cdr.detectChanges();
    
    console.log('✅ Devices loaded and sorted by device id:', {
      totalDevices: this.devices.length,
      devices: this.devices.map(d => ({
        id: d['id'] || d['deviceid'],
        name: d['display_name'] || d['name'],
        status: d['status']
      }))
    });
  } catch (error) {
    console.error('❌ Error loading devices:', error);
    this.devices = [];
    this.devicesDisplay = [];
    this.loadingDevices = false;
    this.cdr.detectChanges();
    this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโหลดอุปกรณ์');
  }
}
```

#### **เพิ่มฟังก์ชัน onDeviceSearch:**
```typescript
// ✅ ฟังก์ชันค้นหาอุปกรณ์ในรายการทั้งหมด
onDeviceSearch() {
  const query = this.deviceSearchQuery?.toLowerCase() || '';
  
  if (query.length > 0) {
    this.devicesDisplay = this.devices.filter(device => {
      const name = (device['display_name'] || device['name'] || '').toLowerCase();
      const deviceId = String(device['id'] || device['deviceid'] || '');
      const status = (device['status'] || '').toLowerCase();
      const userName = this.getDeviceUserName(device['user_id'] || device['userid']).toLowerCase();
      const description = (device['description'] || '').toLowerCase();
      
      return name.includes(query) || 
             deviceId.includes(query) || 
             status.includes(query) ||
             userName.includes(query) ||
             description.includes(query);
    });
  } else {
    this.devicesDisplay = [...this.devices];
  }
  
  this.cdr.detectChanges();
}
```

#### **เพิ่มฟังก์ชัน editDevice:**
```typescript
// ✅ ฟังก์ชันแก้ไขข้อมูลอุปกรณ์
editDevice(device: any) {
  const deviceDetails = {
    'Device ID': device['id'] || device['deviceid'] || 'ไม่ระบุ',
    'ชื่ออุปกรณ์': device['display_name'] || device['name'] || 'ไม่ระบุ',
    'สถานะ': device['status'] || 'ไม่ระบุ',
    'ผู้ใช้': this.getDeviceUserName(device['user_id'] || device['userid']),
    'คำอธิบาย': device['description'] || 'ไม่ระบุ',
    'สร้างเมื่อ': this.formatDate(device['created_at']),
    'อัปเดตล่าสุด': this.formatDate(device['updated_at'])
  };

  const detailsText = Object.entries(deviceDetails)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  this.notificationService.showNotification('info', 'รายละเอียดอุปกรณ์', detailsText, true, 'ปิด');
}
```

### **3. เพิ่ม CSS Styling:**

#### **Device Card Styling:**
```scss
// ✅ Enhanced Device Card Styling
.device-card {
  background: $card-bg;
  border: 2px solid rgba(2, 119, 189, 0.1);
  border-radius: $border-radius-lg;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: $shadow-light;
  transition: $transition;
  position: relative;
  overflow: hidden;

  &:hover {
    border-color: rgba(2, 119, 189, 0.3);
    box-shadow: $shadow-medium;
    transform: translateY(-2px);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: $secondary-gradient;
  }

  .device-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);

    .device-icon {
      width: 60px;
      height: 60px;
      background: $secondary-gradient;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      box-shadow: $shadow-blue;
    }

    .device-basic-info {
      flex: 1;

      .device-name {
        font-size: 20px;
        font-weight: 700;
        color: $text-primary;
        margin-bottom: 4px;
      }

      .device-id {
        font-size: 14px;
        color: $text-secondary;
        font-family: 'Courier New', monospace;
        background: rgba(2, 119, 189, 0.1);
        padding: 2px 8px;
        border-radius: 12px;
        display: inline-block;
      }
    }

    .device-status {
      .status-badge {
        display: inline-block;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;

        &.status-active {
          background: linear-gradient(135deg, #4CAF50, #2E7D32);
          color: white;
          box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
        }

        &.status-inactive {
          background: linear-gradient(135deg, #F44336, #D32F2F);
          color: white;
          box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3);
        }

        &.status-unknown {
          background: linear-gradient(135deg, #757575, #424242);
          color: white;
          box-shadow: 0 2px 8px rgba(117, 117, 117, 0.3);
        }
      }
    }
  }

  .device-details {
    margin-bottom: 20px;

    .detail-row {
      display: flex;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);

      &:last-child {
        border-bottom: none;
      }

      .detail-label {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 140px;
        font-weight: 600;
        color: $text-secondary;
        font-size: 14px;

        i {
          width: 16px;
          text-align: center;
          color: $accent-color;
        }
      }

      .detail-value {
        flex: 1;
        color: $text-primary;
        font-size: 14px;
        word-break: break-all;

        .status-active {
          color: #4CAF50;
          font-weight: 600;
        }

        .status-inactive {
          color: #F44336;
          font-weight: 600;
        }
      }
    }
  }

  .device-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding-top: 16px;
    border-top: 1px solid rgba(0, 0, 0, 0.1);

    .btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: $border-radius-md;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: $transition;
      text-decoration: none;

      i {
        font-size: 14px;
      }

      &.btn-edit {
        background: linear-gradient(135deg, #FF9800, #F57C00);
        color: white;

        &:hover {
          background: linear-gradient(135deg, #F57C00, #EF6C00);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
        }
      }

      &.btn-delete {
        background: linear-gradient(135deg, #F44336, #D32F2F);
        color: white;

        &:hover {
          background: linear-gradient(135deg, #D32F2F, #C62828);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
        }
      }

      &.btn-view {
        background: linear-gradient(135deg, #2196F3, #1976D2);
        color: white;

        &:hover {
          background: linear-gradient(135deg, #1976D2, #1565C0);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
        }
      }
    }
  }
}
```

## 🎯 **ฟีเจอร์ที่เพิ่ม**

### **1. Enhanced Device Display:**
- **Device Icon** - ไอคอนอุปกรณ์
- **Device ID** - ID ของอุปกรณ์
- **Status Badge** - แสดงสถานะด้วยสี
- **Complete Information** - ข้อมูลครบถ้วน

### **2. Detailed Information:**
- **Device Name** - ชื่ออุปกรณ์
- **User** - ผู้ใช้ที่ผูกกับอุปกรณ์
- **Status** - สถานะอุปกรณ์
- **Created Date** - วันที่สร้าง
- **Updated Date** - วันที่อัปเดตล่าสุด (ถ้ามี)
- **Description** - คำอธิบาย (ถ้ามี)

### **3. Enhanced Actions:**
- **View Button** - ดูข้อมูลอุปกรณ์
- **Delete Button** - ลบอุปกรณ์
- **Edit Button** - แก้ไขข้อมูลอุปกรณ์

### **4. Search Functionality:**
- **Real-time Search** - ค้นหาแบบ real-time
- **Multi-field Search** - ค้นหาตาม name, deviceId, status, userName, description
- **Case Insensitive** - ไม่สนใจตัวพิมพ์เล็ก-ใหญ่
- **Clear Search** - ล้างการค้นหาเมื่อลบข้อความ

### **5. Sorting & Organization:**
- **Sort by Device ID** - เรียงตาม device id จากน้อยไปมาก
- **Device Count** - แสดงจำนวนอุปกรณ์ทั้งหมด
- **Refresh Button** - ปุ่มรีเฟรชข้อมูล

## 🎨 **Design Features**

### **1. Device Card Layout:**
- **Header Section** - Icon, Name, ID, Status
- **Details Section** - ข้อมูลครบถ้วน
- **Actions Section** - ปุ่มต่างๆ

### **2. Color Scheme:**
- **Active Status** - Green gradient (#4CAF50 → #2E7D32)
- **Inactive Status** - Red gradient (#F44336 → #D32F2F)
- **Unknown Status** - Gray gradient (#757575 → #424242)
- **Edit Button** - Orange gradient (#FF9800 → #F57C00)
- **Delete Button** - Red gradient (#F44336 → #D32F2F)
- **View Button** - Blue gradient (#2196F3 → #1976D2)

### **3. Typography:**
- **Device Name** - 20px, font-weight 700
- **Device ID** - 14px, monospace font
- **Details** - 14px, regular weight
- **Labels** - 14px, font-weight 600

### **4. Spacing & Layout:**
- **Card Padding** - 20px
- **Section Margins** - 16px-20px
- **Button Gaps** - 12px
- **Detail Row Padding** - 8px

## 🔄 **การทำงานของระบบ**

### **1. Data Loading:**
```
1. เรียก loadDevices()
2. ดึงข้อมูลจาก API
3. เรียงข้อมูลตาม device id
4. แสดงใน UI
```

### **2. Device Display:**
```
1. แสดง device card แต่ละรายการ
2. แสดงข้อมูลครบถ้วน
3. แสดง status badge ตามสี
4. แสดงปุ่ม actions
```

### **3. Device Actions:**
```
1. View - ดูข้อมูลอุปกรณ์
2. Delete - แสดง confirmation
3. Edit - แสดงรายละเอียดแบบ popup
```

### **4. Search Process:**
```
1. ผู้ใช้พิมพ์ในช่องค้นหา
2. เรียก onDeviceSearch()
3. กรองข้อมูลตาม query
4. อัปเดต devicesDisplay
5. แสดงผลลัพธ์ใหม่
```

### **5. Search Fields:**
```
1. Device Name - display_name หรือ name
2. Device ID - id หรือ deviceid
3. Status - status
4. User Name - ชื่อผู้ใช้ที่ผูกกับอุปกรณ์
5. Description - คำอธิบาย
```

## 📚 **เอกสารที่เกี่ยวข้อง**
- **`docs/admin-user-list-enhancement.md`** - การปรับปรุง User List
- **`docs/admin-user-search-enhancement.md`** - การเพิ่มช่องค้นหา User

## 🎉 **สรุป**

**✅ ปรับปรุงรายการอุปกรณ์เรียบร้อยแล้ว!**

**🔧 การปรับปรุงที่ทำ:**
- **Enhanced Display** - แสดงข้อมูลครบถ้วน
- **Device Sorting** - เรียงตาม device id
- **Card Layout** - แสดงเป็น card สวยงาม
- **Status Badges** - แสดงสถานะด้วยสี
- **Complete Information** - ข้อมูลครบถ้วน
- **Enhanced Actions** - ปุ่ม actions ครบถ้วน
- **Search Functionality** - ช่องค้นหาแบบ real-time

**🛡️ ผลลัพธ์:**
- **Better Organization** - จัดระเบียบข้อมูลได้ดี
- **Visual Appeal** - ดูสวยงามและเป็นมืออาชีพ
- **Complete Information** - ข้อมูลครบถ้วน
- **Easy Management** - จัดการอุปกรณ์ได้ง่าย
- **User Experience** - ประสบการณ์ผู้ใช้ดีขึ้น
- **Search Capability** - ค้นหาได้ง่ายและรวดเร็ว

**ตอนนี้รายการอุปกรณ์แสดงข้อมูลครบถ้วน มีช่องค้นหา และเรียงตาม device id แล้ว!** 🎉✨
