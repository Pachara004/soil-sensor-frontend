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

  // 🔥 NEW: เก็บคำขอผูกอุปกรณ์ที่รออนุมัติ
  pendingClaims: { deviceId: string; username: string; ts: number }[] = [];

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

    // 🔥 NEW: subscribe อุปกรณ์ทั้งหมด เพื่อดึงรายการ claim แบบ realtime
    const devicesRef = ref(this.db, 'devices');
    onValue(devicesRef, (snap) => {
      const list: { deviceId: string; username: string; ts: number }[] = [];
      if (snap.exists()) {
        const obj = snap.val() || {};
        Object.keys(obj).forEach((deviceId) => {
          const d = obj[deviceId] || {};
          if (d.claim && d.claim.username) {
            list.push({
              deviceId,
              username: d.claim.username,
              ts: d.claim.ts || 0
            });
          }
        });
      }
      // เรียงเวลาล่าสุดก่อน
      list.sort((a,b) => b.ts - a.ts);
      this.pendingClaims = list;
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

  // 🆕 อนุมัติ claim → set user + enabled แล้วลบ claim (และซิงก์ meta + ชื่อ)
  async approveClaim(deviceId: string) {
    try {
      const devRef = ref(this.db, `devices/${deviceId}`);
      const snap = await get(devRef);
      if (!snap.exists()) { alert('ไม่พบอุปกรณ์'); return; }

      const dev = snap.val() || {};
      if (!dev.claim || !dev.claim.username) { alert('ไม่พบคำขอในอุปกรณ์นี้'); return; }

      const username = dev.claim.username;
      const now = Date.now();

      // ✅ อัปเดตโหนดหลัก + meta ให้ครบ เพื่อให้ ESP32 อ่านเจอ enabled=true ได้แน่
      await update(devRef, {
        user: username,
        enabled: true,
        name: deviceId,
        status: dev.status || 'offline',
        updatedAt: now,
        meta: {
          ...(dev.meta || {}),
          userName: username,
          deviceName: deviceId,
          enabled: true,
          registeredAt: dev.meta?.registeredAt || now,
          updatedAt: now
        },
        claim: null
      });

      // ผูก device เข้ากับผู้ใช้ (จะโชว์หน้า user)
      await set(ref(this.db, `users/${username}/devices/${deviceId}`), true);

      alert(`อนุมัติสำเร็จ → ผูกกับผู้ใช้ ${username}`);
      // รีโหลดรายการอุปกรณ์ เพื่อแสดงทรัพย์ล่าสุด
      await this.loadDevices();
      this.cdr.detectChanges();
    } catch (e) {
      console.error(e);
      alert('อนุมัติไม่สำเร็จ');
    }
  }

  // 🆕 ปฏิเสธ claim → ลบ claim ออก
  async rejectClaim(deviceId: string) {
    try {
      const devRef = ref(this.db, `devices/${deviceId}`);
      const snap = await get(devRef);
      if (!snap.exists()) { alert('ไม่พบอุปกรณ์'); return; }

      const dev = snap.val() || {};
      if (!dev.claim) { alert('ไม่พบคำขอในอุปกรณ์นี้'); return; }

      await update(devRef, { claim: null, updatedAt: Date.now() });
      alert('ปฏิเสธคำขอแล้ว');
    } catch (e) {
      console.error(e);
      alert('ปฏิเสธไม่สำเร็จ');
    }
  }

  async deleteDevice(deviceName: string) {
    if (confirm(`ลบอุปกรณ์ ${deviceName} ?`)) {
      try {
        // หาข้อมูลอุปกรณ์ก่อนลบ เพื่อดูว่าผูกกับผู้ใช้คนไหน
        const deviceRef = ref(this.db, `devices/${deviceName}`);
        const deviceSnap = await get(deviceRef);
        
        let deviceUser = null;
        if (deviceSnap.exists()) {
          const deviceData = deviceSnap.val();
          deviceUser = deviceData.user;
        }

        // ลบอุปกรณ์จากหลัก
        await this.adminService.deleteDevice(deviceName);
        
        // ถ้ามีผู้ใช้ที่ผูกกับอุปกรณ์นี้ ให้ลบออกจาก users/{username}/devices/{deviceName} ด้วย
        if (deviceUser) {
          const userDeviceRef = ref(this.db, `users/${deviceUser}/devices/${deviceName}`);
          await set(userDeviceRef, null);
        }
        
        alert('ลบอุปกรณ์สำเร็จ (ทั้งจากระบบและจากผู้ใช้)');
        await this.loadDevices();
      } catch (error) {
        console.error('เกิดข้อผิดพลาดในการลบอุปกรณ์:', error);
        alert('เกิดข้อผิดพลาดในการลบอุปกรณ์');
      }
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
