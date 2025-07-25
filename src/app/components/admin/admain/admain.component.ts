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
  filteredUsers: any[] = [];
  unreadCount: number = 0;

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
    this.allUsers = await this.adminService.getAllUsers();
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