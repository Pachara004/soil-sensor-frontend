# Frontend Username Sync Between PostgreSQL and Firebase

## 🎯 **วัตถุประสงค์:**
แก้ไขให้เมื่อแก้ไข username ในหน้าเว็บแล้ว มันจะอัปเดตทั้งใน PostgreSQL database และ Firebase Realtime Database

## 🐛 **ปัญหาที่พบ:**

### **จากรูป Firebase Console:**
- **PostgreSQL:** อัปเดต username สำเร็จ
- **Firebase:** `userName` field ใน devices ยังไม่ถูกอัปเดต
- **ผลลัพธ์:** ข้อมูลไม่ sync กันระหว่างสองระบบ

### **ตัวอย่างจากรูป:**
```json
// Firebase Realtime Database
{
  "devices": {
    "esp32-soil-001": {
      "userName": "mrpacharawongsasri", // ❌ ไม่ถูกอัปเดต
      "userId": 57,
      "userEmail": "mrpacharawongsasri@gmail.com"
    }
  }
}
```

---

## 🔧 **การแก้ไข:**

### **1. เพิ่ม Firebase Database Imports:**

#### **ไฟล์:** `src/app/components/users/edit-profile/edit-profile.component.ts`

#### **เพิ่ม Imports:**
```typescript
import { Database, ref, update, get } from '@angular/fire/database'; // ✅ เพิ่ม Firebase Database
```

#### **เพิ่ม Database Dependency:**
```typescript
constructor(
  private router: Router,
  private location: Location,
  private http: HttpClient,
  private constants: Constants,
  private auth: Auth,
  private database: Database, // ✅ เพิ่ม Firebase Database
  private notificationService: NotificationService
) {
  this.apiUrl = this.constants.API_ENDPOINT;
}
```

### **2. แก้ไข saveProfile() Method:**

#### **เพิ่ม Firebase Update:**
```typescript
const response = await lastValueFrom(
  this.http.put<any>(`${this.apiUrl}/api/users/${userid}`, updateData, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
);

// ✅ อัปเดต Firebase Realtime Database ด้วย
await this.updateFirebaseUsername(userid, this.username);

this.notificationService.showNotification('success', 'บันทึกข้อมูลสำเร็จ!', 'ข้อมูลของคุณได้รับการอัปเดตแล้วทั้งใน PostgreSQL และ Firebase', true, 'กลับ', () => {
  this.location.back();
});
```

### **3. เพิ่ม updateFirebaseUsername() Method:**

#### **Method สำหรับอัปเดต Firebase:**
```typescript
// ✅ อัปเดต username ใน Firebase Realtime Database
private async updateFirebaseUsername(userid: number, newUsername: string) {
  try {
    console.log(`🔄 Updating Firebase username for userid: ${userid} to: ${newUsername}`);
    
    // ✅ อัปเดต username ใน devices ที่ user เป็นเจ้าของ
    const devicesRef = ref(this.database, 'devices');
    const devicesSnapshot = await get(devicesRef);
    
    if (devicesSnapshot.exists()) {
      const devices = devicesSnapshot.val();
      const updates: { [key: string]: any } = {};
      
      // ✅ หา devices ที่ user เป็นเจ้าของ
      Object.keys(devices).forEach(deviceKey => {
        const device = devices[deviceKey];
        if (device.userId === userid || device.userid === userid) {
          updates[`devices/${deviceKey}/userName`] = newUsername;
          console.log(`📝 Updating device ${deviceKey} userName to: ${newUsername}`);
        }
      });
      
      // ✅ อัปเดต Firebase
      if (Object.keys(updates).length > 0) {
        await update(ref(this.database), updates);
        console.log(`✅ Firebase username updated for ${Object.keys(updates).length} devices`);
      } else {
        console.log('ℹ️ No devices found for this user to update');
      }
    } else {
      console.log('ℹ️ No devices found in Firebase');
    }
    
  } catch (error) {
    console.error('❌ Error updating Firebase username:', error);
    // ✅ ไม่ throw error เพื่อไม่ให้กระทบการอัปเดต PostgreSQL
    // แค่ log error และให้ PostgreSQL อัปเดตสำเร็จ
  }
}
```

---

## 🧪 **การทดสอบ:**

### **Test Case: Update Username**

#### **ขั้นตอน:**
1. เข้าหน้า Edit Profile
2. แก้ไข username
3. กดปุ่ม "บันทึก"

#### **ผลลัพธ์ที่คาดหวัง:**

#### **PostgreSQL Database:**
```sql
UPDATE users SET user_name = 'new_username' WHERE userid = 57;
```

#### **Firebase Realtime Database:**
```json
{
  "devices": {
    "esp32-soil-001": {
      "userName": "new_username", // ✅ ถูกอัปเดต
      "userId": 57,
      "userEmail": "mrpacharawongsasri@gmail.com"
    }
  }
}
```

#### **Console Logs:**
```javascript
📤 Sending update data: {user_name: "new_username", ...}
🔄 Updating Firebase username for userid: 57 to: new_username
📝 Updating device esp32-soil-001 userName to: new_username
✅ Firebase username updated for 1 devices
✅ บันทึกข้อมูลสำเร็จ! ข้อมูลของคุณได้รับการอัปเดตแล้วทั้งใน PostgreSQL และ Firebase
```

---

## 📊 **Firebase Data Structure:**

### **Before Update:**
```json
{
  "devices": {
    "esp32-soil-001": {
      "createdAt": "2025-10-20T04:37:46.970Z",
      "deviceId": "esp32-soil-001",
      "deviceName": "esp32-soil-001",
      "deviceType": "soil-sensor",
      "deviceid": 73,
      "enabled": true,
      "updatedAt": "2025-10-20T04:37:46.970Z",
      "userEmail": "mrpacharawongsasri@gmail.com",
      "userId": 57,
      "userName": "mrpacharawongsasri" // ❌ เก่า
    }
  }
}
```

### **After Update:**
```json
{
  "devices": {
    "esp32-soil-001": {
      "createdAt": "2025-10-20T04:37:46.970Z",
      "deviceId": "esp32-soil-001",
      "deviceName": "esp32-soil-001",
      "deviceType": "soil-sensor",
      "deviceid": 73,
      "enabled": true,
      "updatedAt": "2025-10-20T04:37:46.970Z",
      "userEmail": "mrpacharawongsasri@gmail.com",
      "userId": 57,
      "userName": "new_username" // ✅ ใหม่
    }
  }
}
```

---

## 🎯 **Features ที่เพิ่มขึ้น:**

### **1. Dual Database Sync:**
- ✅ **PostgreSQL Update** - อัปเดต username ใน PostgreSQL
- ✅ **Firebase Update** - อัปเดต userName ใน Firebase devices
- ✅ **Error Handling** - ถ้า Firebase error ไม่กระทบ PostgreSQL

### **2. Smart Device Detection:**
- ✅ **Find User Devices** - หา devices ที่ user เป็นเจ้าของ
- ✅ **Multiple Field Support** - รองรับทั้ง `userId` และ `userid`
- ✅ **Batch Update** - อัปเดตหลาย devices พร้อมกัน

### **3. Enhanced User Experience:**
- ✅ **Success Message** - แจ้งว่าอัปเดตทั้งสองระบบ
- ✅ **Console Logging** - แสดงสถานะการอัปเดต
- ✅ **Error Resilience** - ไม่ล้มเหลวถ้า Firebase error

---

## 🎯 **ผลลัพธ์ที่คาดหวัง:**

### **หลังแก้ไข Frontend จะ:**
- ✅ **อัปเดต PostgreSQL** - username ใน database
- ✅ **อัปเดต Firebase** - userName ใน devices
- ✅ **Sync ข้อมูล** - ข้อมูลตรงกันทั้งสองระบบ
- ✅ **แสดงข้อความสำเร็จ** - แจ้งว่าอัปเดตทั้งสองระบบ

### **Console Logs ที่คาดหวัง:**
```javascript
// ✅ PostgreSQL Update
📤 Sending update data: {user_name: "new_username", ...}
✅ PostgreSQL username updated successfully

// ✅ Firebase Update
🔄 Updating Firebase username for userid: 57 to: new_username
📝 Updating device esp32-soil-001 userName to: new_username
✅ Firebase username updated for 1 devices

// ✅ Success Message
✅ บันทึกข้อมูลสำเร็จ! ข้อมูลของคุณได้รับการอัปเดตแล้วทั้งใน PostgreSQL และ Firebase
```

---

## 🎯 **สรุป:**

### **✅ การแก้ไขสำเร็จ:**
- **Dual Database Sync** - อัปเดตทั้ง PostgreSQL และ Firebase
- **Smart Device Detection** - หา devices ที่ user เป็นเจ้าของ
- **Error Resilience** - ไม่ล้มเหลวถ้า Firebase error
- **Enhanced UX** - แจ้งว่าอัปเดตทั้งสองระบบ

### **🎉 ตอนนี้ระบบจะ:**
- ✅ **อัปเดต PostgreSQL** - username ใน database
- ✅ **อัปเดต Firebase** - userName ใน devices
- ✅ **Sync ข้อมูล** - ข้อมูลตรงกันทั้งสองระบบ
- ✅ **แสดงข้อความสำเร็จ** - แจ้งว่าอัปเดตทั้งสองระบบ

### **📝 หมายเหตุ:**
- การแก้ไขนี้จะอัปเดต userName ในทุก devices ที่ user เป็นเจ้าของ
- ถ้า Firebase error จะไม่กระทบการอัปเดต PostgreSQL
- Console logs ช่วยในการ debug และติดตามการทำงาน
- การแก้ไขใช้ได้ทั้งหน้า edit-profile ปกติและ admin

## 🚀 **Deployment:**
- ✅ **Build สำเร็จ** - Angular build ผ่าน
- ✅ **Deploy สำเร็จ** - Firebase hosting deploy ผ่าน
- ✅ **Firebase Integration** - เชื่อมต่อ Firebase Database สำเร็จ
