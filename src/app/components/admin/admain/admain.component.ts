import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AdminService } from '../../../service/AdminService';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Database, ref, get, update, onValue, set } from '@angular/fire/database';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Unsubscribe } from '@firebase/util';

interface UserData {
  username: string;
  email?: string;
  type?: string;
  createdAt?: number | string;
  [key: string]: any;
}

const isNonAdmin = (u: UserData) =>
  ((u.type || 'user') + '').toLowerCase() !== 'admin';

@Component({
  selector: 'app-admain',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './admain.component.html',
  styleUrl: './admain.component.scss'
})
export class AdmainComponent implements OnInit, OnDestroy {
  adminName: string | null = null;
  devices: any[] = [];
  newDeviceName = '';
  newDeviceUser = '';
  // 🆕 สำหรับผูกอุปกรณ์ที่มาจาก ESP32 (มี deviceId อยู่แล้ว)
  hwDeviceId = '';
  hwDeviceName = '';
  hwDeviceUser = '';

  allUsers: UserData[] = [];
  allUsersDisplay: UserData[] = [];
  filteredUsers: UserData[] = [];
  unreadCount = 0;
  totalUsers = 0;
  totalUsersFiltered = 0;
  showUsersList = true;
  showEditModal = false;
  loadingUsers = false;
  showDevicesList = false;
  editingUser: UserData = { username: '' };
  newPassword = '';
  suggestOpen = false;
  usersUnsub: Unsubscribe | null = null;

  private searchSubject = new Subject<string>();

  constructor(
    private adminService: AdminService,
    private router: Router,
    private db: Database,
    private cdr: ChangeDetectorRef
  ) {
    const adminData = localStorage.getItem('admin');
    if (adminData) {
      try {
        const parsedData = JSON.parse(adminData);
        this.adminName = parsedData.name || parsedData.username || null;
      } catch (e) {
        console.error('JSON parse error:', e);
      }
    }

    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(query => this.filterUsers(query));
  }

  async ngOnInit() {
    if (!this.adminName) {
      alert('กรุณาล็อกอินก่อน');
      this.router.navigate(['/']);
      return;
    }
    await this.loadDevices();
    await this.loadAllUsersOnce();
    this.loadAllUsersRealtime();

    const reportsRef = ref(this.db, 'reports');
    onValue(reportsRef, (snapshot) => {
      let count = 0;
      snapshot.forEach(child => {
        if (!child.val().read) count++;
      });
      this.unreadCount = count;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    if (this.usersUnsub) {
      this.usersUnsub();
      this.usersUnsub = null;
    }
  }

  loadAllUsersRealtime() {
    this.loadingUsers = true;
    const usersRef = ref(this.db, 'users');
    if (this.usersUnsub) this.usersUnsub();

    this.usersUnsub = onValue(
      usersRef,
      (snap) => {
        this.loadingUsers = false;
        if (!snap.exists()) {
          this.allUsers = [];
          this.allUsersDisplay = [];
          this.totalUsers = 0;
          this.totalUsersFiltered = 0;
          this.cdr.detectChanges();
          return;
        }

        const obj = snap.val() || {};
        const list: UserData[] = Object.keys(obj).map((username) => {
          const u = obj[username] || {};
          return {
            username,
            email: u.email,
            type: u.type,
            createdAt: u.createdAt
          };
        });

        const nonAdmins = list.filter(isNonAdmin);
        nonAdmins.sort((a, b) => toNumber(b.createdAt) - toNumber(a.createdAt));

        this.allUsers = nonAdmins;
        this.allUsersDisplay = [...nonAdmins];
        this.totalUsers = this.allUsers.length;
        this.totalUsersFiltered = this.allUsersDisplay.length;
        this.cdr.detectChanges();
      },
      (err) => {
        console.error('onValue users error:', err);
        this.loadingUsers = false;
        this.allUsers = [];
        this.allUsersDisplay = [];
        this.totalUsers = 0;
        this.totalUsersFiltered = 0;
        this.cdr.detectChanges();
      }
    );

    function toNumber(v: number | string | undefined): number {
      if (v == null) return 0;
      if (typeof v === 'number') return v;
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    }
  }

  async loadAllUsersOnce() {
    this.loadingUsers = true;
    try {
      const usersRef = ref(this.db, 'users');
      const snap = await get(usersRef);
      if (snap.exists()) {
        const obj = snap.val() || {};
        const list: UserData[] = Object.keys(obj).map((username) => {
          const u = obj[username] || {};
          return {
            username,
            email: u.email,
            type: u.type,
            createdAt: u.createdAt
          };
        });

        const nonAdmins = list.filter(isNonAdmin);
        nonAdmins.sort((a, b) => toNumber(b.createdAt) - toNumber(a.createdAt));

        this.allUsers = nonAdmins;
        this.allUsersDisplay = [...nonAdmins];
        this.totalUsers = this.allUsers.length;
        this.totalUsersFiltered = this.allUsersDisplay.length;
      } else {
        this.allUsers = [];
        this.allUsersDisplay = [];
        this.totalUsers = 0;
        this.totalUsersFiltered = 0;
      }
    } catch (e) {
      console.error('loadAllUsersOnce error:', e);
      this.allUsers = [];
      this.allUsersDisplay = [];
      this.totalUsers = 0;
      this.totalUsersFiltered = 0;
    } finally {
      this.loadingUsers = false;
    }

    function toNumber(v: number | string | undefined): number {
      if (v == null) return 0;
      if (typeof v === 'number') return v;
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    }
  }

  applyUserFilter(keyword: string) {
    const kw = keyword.trim().toLowerCase();
    const source = this.allUsers.filter(isNonAdmin);
    if (!kw) {
      this.allUsersDisplay = [...source];
    } else {
      this.allUsersDisplay = source.filter(u =>
        (u.username || '').toLowerCase().includes(kw) ||
        (u.email || '').toLowerCase().includes(kw)
      );
    }
    this.totalUsersFiltered = this.allUsersDisplay.length;
    this.cdr.detectChanges();
  }

  onUserInput() {
    const q = (this.newDeviceUser || '').toLowerCase().trim();
    if (!q) {
      this.filteredUsers = [];
      this.suggestOpen = false;
      return;
    }
    this.filteredUsers = this.allUsers
      .filter(isNonAdmin)
      .filter(u => (u.username || '').toLowerCase().includes(q))
      .slice(0, 10);
    this.suggestOpen = this.filteredUsers.length > 0;
  }

  filterUsers(query: string) {
    if (query) {
      this.filteredUsers = this.allUsersDisplay
        .filter(isNonAdmin)
        .filter(u => (u.username || '').toLowerCase().includes(query))
        .slice(0, 5);
    } else {
      this.filteredUsers = [];
    }
    this.cdr.detectChanges();
  }

  selectUser(username: string) {
    this.newDeviceUser = username;
    this.filteredUsers = [];
    this.suggestOpen = false;
  }

  blurSuggest() {
    setTimeout(() => {
      this.suggestOpen = false;
    }, 120);
  }

  editUser(user: UserData) {
    if (!isNonAdmin(user)) return;
    this.editingUser = { ...user };
    this.newPassword = '';
    this.showEditModal = true;
    this.cdr.detectChanges();
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editingUser = { username: '' };
    this.newPassword = '';
    this.cdr.detectChanges();
  }

  async saveUserChanges() {
    try {
      await update(ref(this.db, `users/${this.editingUser.username}`), {
        email: this.editingUser.email || '',
        type: this.editingUser.type || 'user'
      });
      this.showEditModal = false;
    } catch (e) {
      console.error('saveUserChanges error:', e);
      alert('บันทึกไม่สำเร็จ');
    }
  }

  async deleteUser(username: string) {
    const u = this.allUsers.find(x => x.username === username);
    if (!u || !isNonAdmin(u)) return;

    if (confirm(`ต้องการลบผู้ใช้ ${username} หรือไม่?`)) {
      try {
        await this.adminService.deleteUser(username);
        alert('ลบผู้ใช้สำเร็จ!');
        await this.loadAllUsersOnce();
      } catch (error) {
        console.error('เกิดข้อผิดพลาดในการลบผู้ใช้:', error);
        alert('เกิดข้อผิดพลาดในการลบผู้ใช้');
      }
    }
  }

  formatDate(dateValue: string | number | undefined): string {
    if (!dateValue) return 'ไม่ระบุ';
    try {
      const date = new Date(dateValue);
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'ไม่ระบุ';
    }
  }

  async loadDevices() {
    this.devices = await this.adminService.getDevices();
    this.cdr.detectChanges();
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
    this.filteredUsers = [];
    await this.loadDevices();
  }

  // 🆕 ผูกอุปกรณ์ที่ถูก ESP32 สร้างไว้แล้ว (มี deviceId แล้ว) เข้ากับผู้ใช้
  async addHardwareDevice() {
    const deviceId = (this.hwDeviceId || '').trim();
    const owner = (this.hwDeviceUser || '').trim();
    const name = (this.hwDeviceName || '').trim();

    if (!deviceId || !owner) {
      alert('กรุณากรอก Device ID และ Username ของผู้ใช้');
      return;
    }

    // ตรวจสอบว่า owner มีอยู่จริงและไม่ใช่ admin
    const userRef = ref(this.db, `users/${owner}`);
    const userSnap = await get(userRef);
    if (!userSnap.exists()) {
      alert(`ไม่พบผู้ใช้ "${owner}" ในระบบ`);
      return;
    }
    const userData = userSnap.val() || {};
    if (((userData.type || 'user') + '').toLowerCase() === 'admin') {
      alert('ไม่สามารถผูกอุปกรณ์ให้กับแอดมินได้');
      return;
    }

    // อ่าน meta อุปกรณ์ที่ ESP32 เคยเขียนไว้ (ถ้ามี)
    const metaRef = ref(this.db, `devices/${deviceId}/meta`);
    const metaSnap = await get(metaRef);

    // ถ้ามี meta และมีผู้ใช้ผูกอยู่แล้ว ให้กันไว้ก่อน
    if (metaSnap.exists()) {
      const meta = metaSnap.val() || {};
      if (meta.userName && meta.userName !== owner) {
        alert(`อุปกรณ์นี้ถูกผูกกับผู้ใช้ "${meta.userName}" อยู่แล้ว`);
        return;
      }
    }

    // อัปเดต/สร้าง meta (ไม่ต้องเพิ่มตารางใหม่)
    await update(metaRef, {
      deviceName: name || deviceId,
      userName: owner,
      registeredAt: Date.now()
    });

    // ผูกอุปกรณ์เข้ากับผู้ใช้
    await set(ref(this.db, `users/${owner}/devices/${deviceId}`), true);

    alert('ผูกอุปกรณ์จาก ESP32 เข้ากับผู้ใช้เรียบร้อย!');
    // รีเฟรชรายการอุปกรณ์
    await this.loadDevices();

    // ล้างค่า input
    this.hwDeviceId = '';
    this.hwDeviceName = '';
    this.hwDeviceUser = '';
  }

  async deleteDevice(deviceName: string) {
    if (confirm(`ลบอุปกรณ์ ${deviceName} ?`)) {
      await this.adminService.deleteDevice(deviceName);
      alert('ลบสำเร็จ');
      await this.loadDevices();
    }
  }

  toggleUsersList() {
    this.showUsersList = !this.showUsersList;
    if (this.showUsersList) {
      this.loadAllUsersOnce();
    }
  }

  toggleDevicesList() {
    this.showDevicesList = !this.showDevicesList;
    if (this.showDevicesList) {
      this.loadDevices();
    }
  }

  viewDevice(device: any) {
    localStorage.setItem('selectedDevice', JSON.stringify(device));
    this.router.navigate(['/device-detail']);
  }

  logout() {
    localStorage.removeItem('admin');
    this.router.navigate(['/']);
  }

  goToUsers() {
    this.router.navigate(['/profile']);
  }

  goToReports() {
    const reportsRef = ref(this.db, 'reports');
    onValue(reportsRef, (snapshot) => {
      snapshot.forEach(child => {
        const key = child.key!;
        if (!child.val().read) {
          update(ref(this.db, `reports/${key}`), { read: true });
        }
      });
    });
    this.router.navigate(['/mail']);
  }
}
