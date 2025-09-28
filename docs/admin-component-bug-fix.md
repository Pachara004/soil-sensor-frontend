# Admin Component Bug Fix

## 🎯 **เป้าหมาย**
แก้ไข error `ctx_r0.selectUser is not a function` ในหน้า admin component

## 🚨 **ปัญหาที่พบ**

### **Error Message:**
```
admain.component.html:200 ERROR TypeError: ctx_r0.selectUser is not a function
    at AdmainComponent_ul_68_li_1_Template_li_click_0_listener (admain.component.html:200:56)
```

### **สาเหตุ:**
- ใน HTML template มีการเรียกใช้ `selectUser(u.username)` ที่บรรทัด 200
- แต่ใน TypeScript component ไม่มีฟังก์ชัน `selectUser` ถูกประกาศ
- ทำให้เกิด runtime error เมื่อผู้ใช้คลิกเลือก user จาก suggestion list

## 🔧 **การแก้ไขที่ทำ**

### **1. เพิ่มฟังก์ชัน selectUser:**
```typescript
selectUser(username: string) {
  this.newDeviceUser = username;
  this.filteredUsers = [];
}
```

### **2. ปรับปรุงฟังก์ชัน onUserInput:**
```typescript
onUserInput() {
  const query = this.newDeviceUser.toLowerCase();
  if (query.length > 0) {
    this.filteredUsers = this.allUsers.filter(user => 
      user.username.toLowerCase().includes(query) ||
      (user.email && user.email.toLowerCase().includes(query))
    );
  } else {
    this.filteredUsers = [];
  }
}
```

### **3. เพิ่มฟังก์ชัน User Management:**
```typescript
// ✅ User management methods
editUser(user: UserData) {
  this.editingUser = { ...user };
  this.newPassword = '';
  this.showEditModal = true;
}

closeEditModal() {
  this.showEditModal = false;
  this.editingUser = { username: '' };
  this.newPassword = '';
}

async saveUserChanges() {
  if (!this.editingUser.username) {
    this.notificationService.showNotification('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณาเลือกผู้ใช้ที่ต้องการแก้ไข');
    return;
  }

  try {
    const updateData: any = {
      user_name: this.editingUser.username,
      user_email: this.editingUser.email,
      role: this.editingUser.type || 'user'
    };

    if (this.newPassword && this.newPassword.trim()) {
      updateData.user_password = this.newPassword;
    }

    const token = await this.currentUser.getIdToken();
    const response = await lastValueFrom(
      this.http.put(`${this.apiUrl}/api/users/${this.editingUser.username}`, updateData, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    );

    this.notificationService.showNotification('success', 'บันทึกสำเร็จ', 'ข้อมูลผู้ใช้ถูกอัปเดตเรียบร้อยแล้ว');
    this.closeEditModal();
    await this.loadAllUsersOnce();
  } catch (error: any) {
    console.error('Error saving user changes:', error);
    this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้');
  }
}

async deleteUser(username: string) {
  this.notificationService.showNotification('warning', 'ยืนยันการลบ', `ต้องการลบผู้ใช้ ${username} จริงหรือไม่?`, true, 'ลบ', async () => {
    try {
      const token = await this.currentUser.getIdToken();
      await lastValueFrom(
        this.http.delete(`${this.apiUrl}/api/users/${username}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );

      this.notificationService.showNotification('success', 'ลบสำเร็จ', 'ผู้ใช้ถูกลบเรียบร้อยแล้ว');
      await this.loadAllUsersOnce();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถลบผู้ใช้ได้');
    }
  });
}
```

## 🔄 **การทำงานของระบบ**

### **1. User Input & Selection:**
```
1. ผู้ใช้พิมพ์ชื่อ user ใน input field
2. เรียก onUserInput() เพื่อ filter users
3. แสดง suggestion list
4. ผู้ใช้คลิกเลือก user
5. เรียก selectUser() เพื่อตั้งค่า newDeviceUser
6. ซ่อน suggestion list
```

### **2. User Management:**
```
1. คลิก "แก้ไข" → เรียก editUser()
2. เปิด modal แก้ไขข้อมูล
3. แก้ไขข้อมูลและคลิก "บันทึก"
4. เรียก saveUserChanges()
5. อัปเดตข้อมูลใน database
6. ปิด modal และ refresh ข้อมูล
```

### **3. User Deletion:**
```
1. คลิก "ลบ" → เรียก deleteUser()
2. แสดง confirmation dialog
3. ยืนยันการลบ
4. เรียก API ลบ user
5. Refresh ข้อมูล
```

## 🎯 **ฟีเจอร์ที่เพิ่ม**

### **1. User Selection:**
- **Auto-complete** - แสดง suggestion เมื่อพิมพ์
- **Filter** - กรองตาม username และ email
- **Selection** - คลิกเลือก user จาก list

### **2. User Management:**
- **Edit User** - แก้ไขข้อมูลผู้ใช้
- **Change Password** - เปลี่ยนรหัสผ่าน
- **Change Role** - เปลี่ยน role (user/admin)
- **Delete User** - ลบผู้ใช้

### **3. Error Handling:**
- **Validation** - ตรวจสอบข้อมูลก่อนบันทึก
- **Error Messages** - แสดงข้อความ error ที่ชัดเจน
- **Success Messages** - แสดงข้อความสำเร็จ

## 📱 **UI Components ที่เกี่ยวข้อง**

### **1. User Input with Suggestions:**
```html
<div class="user-input-box">
  <input type="text" placeholder="ชื่อผู้ใช้" [(ngModel)]="newDeviceUser" (input)="onUserInput()">
  <ul class="suggest-list" *ngIf="filteredUsers.length > 0">
    <li *ngFor="let u of filteredUsers" (click)="selectUser(u.username)">
      {{ u.username }}
    </li>
  </ul>
</div>
```

### **2. User List with Actions:**
```html
<div class="list-item" *ngFor="let user of allUsersDisplay">
  <div class="item-info">
    <div class="item-name">{{ user.username }}</div>
    <div class="item-detail">อีเมล: {{ user.email }}</div>
    <div class="item-detail highlight">ประเภท: {{ user.type || 'user' }}</div>
  </div>
  <div class="item-actions">
    <button class="btn btn-edit" (click)="editUser(user)">แก้ไข</button>
    <button class="btn btn-delete" (click)="deleteUser(user.username)">ลบ</button>
  </div>
</div>
```

### **3. Edit Modal:**
```html
<div class="modal-overlay" *ngIf="showEditModal">
  <div class="modal">
    <div class="modal-header">
      <h3>แก้ไขข้อมูลผู้ใช้</h3>
      <button class="close-btn" (click)="closeEditModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>ชื่อผู้ใช้:</label>
        <input type="text" [(ngModel)]="editingUser.username" readonly>
      </div>
      <div class="form-group">
        <label>อีเมล:</label>
        <input type="email" [(ngModel)]="editingUser.email">
      </div>
      <div class="form-group">
        <label>รหัสผ่านใหม่:</label>
        <input type="password" [(ngModel)]="newPassword">
      </div>
      <div class="form-group">
        <label>ประเภทผู้ใช้:</label>
        <select [(ngModel)]="editingUser.type">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="save-btn" (click)="saveUserChanges()">บันทึก</button>
      <button class="cancel-btn" (click)="closeEditModal()">ยกเลิก</button>
    </div>
  </div>
</div>
```

## 🎯 **ข้อดีของการแก้ไข**

1. **Error Resolution** - แก้ไข runtime error
2. **User Experience** - ใช้งานได้ปกติ
3. **Functionality** - ฟีเจอร์ครบถ้วน
4. **Error Handling** - จัดการ error ได้ดี
5. **API Integration** - เชื่อมต่อกับ backend

## 📚 **เอกสารที่เกี่ยวข้อง**
- **`docs/user-management-endpoints.md`** - API endpoints สำหรับจัดการผู้ใช้

## 🎉 **สรุป**

**✅ แก้ไข error ในหน้า admin เรียบร้อยแล้ว!**

**🔧 การแก้ไขที่ทำ:**
- **selectUser Function** - เพิ่มฟังก์ชันที่ขาดหายไป
- **onUserInput Enhancement** - ปรับปรุงการ filter users
- **User Management** - เพิ่มฟังก์ชันจัดการผู้ใช้
- **Error Handling** - จัดการ error ได้ดีขึ้น

**🛡️ ผลลัพธ์:**
- **No More Errors** - ไม่มี runtime error
- **Full Functionality** - ฟีเจอร์ทำงานได้ครบถ้วน
- **Better UX** - ประสบการณ์ผู้ใช้ดีขึ้น
- **API Integration** - เชื่อมต่อกับ backend ได้

**ตอนนี้หน้า admin ใช้งานได้ปกติและไม่มี error แล้ว!** 🎉✨
