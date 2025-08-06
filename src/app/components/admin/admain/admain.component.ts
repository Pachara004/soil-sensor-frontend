import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdminService } from '../../../service/AdminService';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Database, ref, onValue, update } from '@angular/fire/database';

@Component({
  selector: 'app-admain',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './admain.component.html',
  styleUrl: './admain.component.scss'
})
export class AdmainComponent implements OnInit {
  adminName: string | null = null;
  devices: any[] = [];
  newDeviceName = '';
  newDeviceUser = '';
  allUsers: any[] = [];
  allUsersDisplay: any[] = []; // สำหรับแสดงใน UI
  filteredUsers: any[] = [];
  unreadCount: number = 0;
  totalUsers: number = 0;
  showUsersList: boolean = false;
  showEditModal: boolean = false;
  showDevicesList: boolean = false;
  editingUser: any = {};
  newPassword: string = '';

  constructor(
    private adminService: AdminService,
    private router: Router,
    private db: Database
  ) {
    // ดึงข้อมูลจาก localStorage และแยก name
    const adminData = localStorage.getItem('admin');
    if (adminData) {
      try {
        const parsedData = JSON.parse(adminData);
        this.adminName = parsedData.name || parsedData.username || null;
      } catch (e) {
        console.error('ข้อผิดพลาดในการแยก JSON จาก localStorage:', e);
      }
    }
  }

  async ngOnInit() {
    if (!this.adminName) {
      alert('กรุณาล็อกอินก่อน');
      this.router.navigate(['/']);
      return;
    }
    await this.loadDevices();
    await this.loadAllUsers();
    
    const reportsRef = ref(this.db, 'reports');
    onValue(reportsRef, (snapshot) => {
      let count = 0;
      snapshot.forEach(child => {
        if (!child.val().read) {
          count++;
        }
      });
      this.unreadCount = count;
    });
  }

  async loadDevices() {
    this.devices = await this.adminService.getDevices();
  }

  async loadAllUsers() {
    // โหลดผู้ใช้ทั้งหมดและกรองเฉพาะ type = 'user'
    this.allUsers = await this.adminService.getAllUsers();
    this.allUsersDisplay = this.allUsers.filter(user => 
      user.type === 'user' || !user.type // รวม user ที่ไม่มี type กำหนดด้วย
    );
    this.totalUsers = this.allUsersDisplay.length;
  }

  toggleUsersList() {
    this.showUsersList = !this.showUsersList;
    if (this.showUsersList) {
      this.loadAllUsers(); // รีเฟรชข้อมูลเมื่อเปิดรายการ
    }
  }

  editUser(user: any) {
    this.editingUser = { ...user }; // สำเนาข้อมูล
    this.newPassword = '';
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editingUser = {};
    this.newPassword = '';
  }

  async saveUserChanges() {
    try {
      // เตรียมข้อมูลที่จะอัปเดต
      const updateData: any = {
        username: this.editingUser.username,
        type: this.editingUser.type || 'user'
      };

      // ถ้ามีอีเมล
      if (this.editingUser.email !== undefined) {
        updateData.email = this.editingUser.email;
      }

      // ถ้ามีการกรอกรหัสผ่านใหม่
      if (this.newPassword.trim()) {
        updateData.password = this.newPassword;
      }

      await this.adminService.updateUser(this.editingUser.username, updateData);
      alert('อัปเดตข้อมูลผู้ใช้สำเร็จ!');
      this.closeEditModal();
      await this.loadAllUsers(); // รีโหลดข้อมูล
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการอัปเดตผู้ใช้:', error);
      alert('เกิดข้อผิดพลาดในการอัปเดตข้อมูล');
    }
  }

  async deleteUser(username: string) {
    if (confirm(`ต้องการลบผู้ใช้ ${username} หรือไม่?`)) {
      try {
        await this.adminService.deleteUser(username);
        alert('ลบผู้ใช้สำเร็จ!');
        await this.loadAllUsers();
      } catch (error) {
        console.error('เกิดข้อผิดพลาดในการลบผู้ใช้:', error);
        alert('เกิดข้อผิดพลาดในการลบผู้ใช้');
      }
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'ไม่ระบุ';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'ไม่ระบุ';
    }
  }

  onUserInput() {
    const query = this.newDeviceUser.toLowerCase();
    this.filteredUsers = this.allUsers.filter(u =>
      u.username.toLowerCase().includes(query)
    ).slice(0, 5); // จำกัด 5 ชื่อ
  }

  selectUser(username: string) {
    this.newDeviceUser = username;
    this.filteredUsers = [];
  }

  viewDevice(device: any) {
    // เก็บข้อมูลลง localStorage หรือ NavigationExtras
    localStorage.setItem('selectedDevice', JSON.stringify(device));
    this.router.navigate(['/device-detail']);
  }

  async addDevice() {
    if (!this.newDeviceName || !this.newDeviceUser) {
      alert('กรุณากรอกชื่ออุปกรณ์และผู้ใช้');
      return;
    }

    await this.adminService.addDevice(this.newDeviceName, this.newDeviceUser);
    alert('เพิ่มอุปกรณ์สำเร็จ!');
    this.newDeviceName = '';
    this.newDeviceUser = '';
    await this.loadDevices();
  }

  async deleteDevice(deviceName: string) {
    if (confirm(`ลบอุปกรณ์ ${deviceName} ?`)) {
      await this.adminService.deleteDevice(deviceName);
      alert('ลบสำเร็จ');
      await this.loadDevices();
    }
  }
  // เพิ่ม method นี้ใน AdmainComponent class
  toggleDevicesList() {
    this.showDevicesList = !this.showDevicesList;
    if (this.showDevicesList) {
      this.loadDevices(); // รีเฟรชข้อมูลเมื่อเปิดรายการ
    }
  }

  logout() {
    localStorage.removeItem('admin');
    this.router.navigate(['/']);
  }

  goToUsers() {
    this.router.navigate(['/profile']);
  }

  goToReports() {
    // mark all as read
    const reportsRef = ref(this.db, 'reports');
    onValue(reportsRef, (snapshot) => {
      snapshot.forEach(child => {
        const key = child.key!;
        if (!child.val().read) {
          update(ref(this.db, `reports/${key}`), { read: true });
        }
      });
    });

    this.router.navigate(['/mail']); // หรือ path กล่องข้อความ
  }
}