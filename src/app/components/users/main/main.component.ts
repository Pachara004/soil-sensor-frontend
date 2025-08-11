import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Database, ref, get, onValue, update, set } from '@angular/fire/database';
import { interval, Subscription } from 'rxjs';

interface Device {
  id: string;
  displayName: string;
  status: 'online' | 'offline';
}

type LivePayload = {
  ts_epoch?: number;   // epoch วินาทีจากอุปกรณ์ (อาศัย NTP)
  ts_uptime?: number;  // uptime วินาทีจากอุปกรณ์ (fallback)
  temperature?: number;
  moisture?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  ph?: number;
  // progress?: number;
};

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent implements OnInit, OnDestroy {
  userID: string = '';

  // มี placeholder เริ่มต้นกันเฟรมแรกที่อาร์เรย์ยังว่าง
  devices: Device[] = [{ id: '__none__', displayName: 'กำลังโหลด...', status: 'offline' }];
  selectedDevice: Device | null = null;
  selectedDeviceId: string = '';   // ใช้ subscribe /live/{id}

  isLoading = false;
  currentTime: string = '';
  private clockSubscription: Subscription | null = null;

  // live monitor
  private liveUnsub: (() => void) | null = null;
  private readonly FRESH_WINDOW_MS = 45_000; // ถือว่าสดภายใน 45 วิ
  private liveOfflineTimer: any = null;
  private lastLiveLocalMs = 0;

  // ฟอร์ม “ขอผูกอุปกรณ์”
  claimDeviceId: string = '';
  lastClaimMessage: string = '';
  lastClaimType: 'ok' | 'warn' | 'err' | '' = '';
  requestingClaim = false;

  constructor(
    private router: Router,
    private db: Database
  ) {}

  async ngOnInit() {
    const userData = localStorage.getItem('user');
    if (!userData) {
      alert('กรุณาล็อกอินก่อน');
      this.router.navigate(['/']);
      return;
    }

    const user = JSON.parse(userData);
    this.userID = user.username || user.userID || 'ไม่พบข้อมูล';

    await this.loadDevices();

    if (this.devices.length > 0 && this.devices[0].id !== '__none__') {
      this.selectedDeviceId = (localStorage.getItem('selectedDeviceId') || this.devices[0].id).trim();
      this.selectedDevice = this.devices.find(d => d.id === this.selectedDeviceId) || this.devices[0];
      this.selectedDeviceId = this.selectedDevice.id; // sync
      this.startLiveMonitor(this.selectedDeviceId);
    } else {
      this.selectedDeviceId = '__none__';
      this.selectedDevice = null;
      localStorage.removeItem('selectedDeviceId');
    }

    // นาฬิกา
    this.updateTime();
    this.clockSubscription = interval(1000).subscribe(() => this.updateTime());
  }

  ngOnDestroy() {
    if (this.clockSubscription) this.clockSubscription.unsubscribe();
    if (this.liveUnsub) { this.liveUnsub(); this.liveUnsub = null; }
    if (this.liveOfflineTimer) { clearTimeout(this.liveOfflineTimer); this.liveOfflineTimer = null; }
  }

  // ===== clock =====
  private updateTime() {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const ss = now.getSeconds().toString().padStart(2, '0');
    this.currentTime = `${hh}:${mm}:${ss}`;
  }

  // ===== โหลดรายการอุปกรณ์ของผู้ใช้ =====
  private async loadDevices() {
    this.isLoading = true;
    this.devices = [];

    try {
      // วิธีที่ 1: users/{userID}/devices (map)
      const userDevicesRef = ref(this.db, `users/${this.userID}/devices`);
      const userDevicesSnapshot = await get(userDevicesRef);

      if (userDevicesSnapshot.exists()) {
        const userDevicesData = userDevicesSnapshot.val();
        if (userDevicesData && typeof userDevicesData === 'object') {
          this.devices = Object.entries<any>(userDevicesData).map(([deviceId, value]) => ({
            id: deviceId,
            displayName: value?.name || deviceId,
            status: (value?.status as 'online' | 'offline') || 'offline'
          }));
        }
      }

      // วิธีที่ 2: /devices (owner/user = userID)
      if (this.devices.length === 0) {
        const allDevicesRef = ref(this.db, 'devices');
        const snap = await get(allDevicesRef);
        if (snap.exists()) {
          const data = snap.val();
          const list: Device[] = [];
          for (const [deviceId, dev] of Object.entries<any>(data)) {
            if (dev?.user === this.userID || dev?.owner === this.userID || dev?.userId === this.userID) {
              list.push({
                id: deviceId,
                displayName: dev?.name || deviceId,
                status: (dev?.status as 'online' | 'offline') || 'offline'
              });
            }
          }
          this.devices = list;
        }
      }

      // วิธีที่ 3: userDevices/{userID}
      if (this.devices.length === 0) {
        const userDevices2Ref = ref(this.db, `userDevices/${this.userID}`);
        const snap2 = await get(userDevices2Ref);
        if (snap2.exists()) {
          const data2 = snap2.val();
          if (Array.isArray(data2)) {
            this.devices = data2
              .filter(d => d?.id)
              .map((d: any) => ({
                id: d.id,
                displayName: d?.name || d.id,
                status: (d?.status as 'online' | 'offline') || 'offline'
              }));
          } else if (data2 && typeof data2 === 'object') {
            this.devices = Object.entries<any>(data2).map(([deviceId, v]) => ({
              id: deviceId,
              displayName: v?.name || deviceId,
              status: (v?.status as 'online' | 'offline') || 'offline'
            }));
          }
        }
      }

      // ผลลัพธ์สุดท้าย
      if (this.devices.length === 0) {
        this.devices = [{ id: '__none__', displayName: 'ไม่มีอุปกรณ์', status: 'offline' }];
        this.selectedDevice = null;
      } else {
        this.devices = this.devices.filter(d => typeof d.id === 'string' && d.id.trim().length > 0);
        if (!this.devices.length) {
          this.devices = [{ id: '__none__', displayName: 'ไม่มีอุปกรณ์', status: 'offline' }];
          this.selectedDevice = null;
        }
      }
    } catch (error) {
      console.error('ข้อผิดพลาดในการโหลดอุปกรณ์:', error);
      this.devices = [{ id: '__none__', displayName: 'เกิดข้อผิดพลาด', status: 'offline' }];
      this.selectedDevice = null;
    } finally {
      this.isLoading = false;
    }
  }

  // ===== เปลี่ยนอุปกรณ์ที่เลือก =====
  onDeviceChange() {
    this.selectedDevice = this.devices.find(d => d.id === this.selectedDeviceId) || null;

    if (this.selectedDevice && this.selectedDevice.id !== '__none__') {
      localStorage.setItem('selectedDeviceId', this.selectedDevice.id);
      this.startLiveMonitor(this.selectedDevice.id);
    } else {
      localStorage.removeItem('selectedDeviceId');
      if (this.liveUnsub) { this.liveUnsub(); this.liveUnsub = null; }
      if (this.liveOfflineTimer) { clearTimeout(this.liveOfflineTimer); this.liveOfflineTimer = null; }
    }
  }

  // ===== LIVE monitor: อ่าน /live/{deviceId} แล้วอัปเดต online/offline =====
  private startLiveMonitor(deviceIdRaw: string) {
    const deviceId = (deviceIdRaw || '').trim();
    if (!deviceId || deviceId === '__none__') {
      if (this.liveUnsub) { this.liveUnsub(); this.liveUnsub = null; }
      if (this.liveOfflineTimer) { clearTimeout(this.liveOfflineTimer); this.liveOfflineTimer = null; }
      this.setDeviceStatus(deviceIdRaw, 'offline');
      return;
    }

    // ปิดตัวเก่าก่อน
    if (this.liveUnsub) { this.liveUnsub(); this.liveUnsub = null; }
    if (this.liveOfflineTimer) { clearTimeout(this.liveOfflineTimer); this.liveOfflineTimer = null; }
    this.lastLiveLocalMs = 0;

    const liveRef = ref(this.db, `live/${deviceId}`);
    this.liveUnsub = onValue(liveRef, (snap) => {
      if (!snap.exists()) {
        this.setDeviceStatus(deviceId, 'offline');
        return;
      }
      const v = (snap.val() || {}) as LivePayload;

      const now = Date.now();
      const seenSec = typeof v.ts_epoch === 'number' ? v.ts_epoch : 0;
      let isFresh = false;

      // 1) ถ้ามี ts_epoch และยังไม่เกินกรอบ → สด
      if (seenSec > 0) {
        isFresh = (now - seenSec * 1000) < this.FRESH_WINDOW_MS;
      }

      // 2) ถ้า ts_epoch ไม่มี/เป็น 0 แต่มี onValue เด้ง (หรือมี ts_uptime>0) → ถือว่าสด (ให้ timer เป็นตัวตัด)
      if (!isFresh && seenSec === 0) {
        if (typeof v.ts_uptime === 'number' && v.ts_uptime > 0) {
          isFresh = true;
        } else {
          isFresh = true; // เด้ง onValue = มีอัปเดต
        }
      }

      this.setDeviceStatus(deviceId, isFresh ? 'online' : 'offline');

      // ตั้ง/รีเซ็ตตัวจับเวลา ถ้าไม่มีเด้งใหม่ในกรอบ → offline
      if (isFresh) {
        this.lastLiveLocalMs = now;
        if (this.liveOfflineTimer) clearTimeout(this.liveOfflineTimer);
        this.liveOfflineTimer = setTimeout(() => {
          if (Date.now() - this.lastLiveLocalMs >= this.FRESH_WINDOW_MS) {
            this.setDeviceStatus(deviceId, 'offline');
          }
        }, this.FRESH_WINDOW_MS + 1000);
      }
    }, (err) => {
      console.error('live onValue error:', err);
      this.setDeviceStatus(deviceId, 'offline');
    });
  }

  // อัปเดตทั้ง selectedDevice และ devices[]
  private setDeviceStatus(deviceId: string, status: 'online' | 'offline') {
    if (!deviceId) return;

    if (this.selectedDevice && this.selectedDevice.id === deviceId) {
      this.selectedDevice = { ...this.selectedDevice, status };
    }
    if (this.devices && this.devices.length) {
      this.devices = this.devices.map(d =>
        d.id === deviceId ? { ...d, status } : d
      );
    }
  }

  // ===== Actions / Nav =====
  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('selectedDeviceId');
    this.router.navigate(['/']);
  }

  goToProfile() { this.router.navigate(['/profile']); }

  goToHistory() {
    if (!this.selectedDevice || this.selectedDevice.id === '__none__') {
      alert('กรุณาเพิ่มอุปกรณ์ก่อนดูประวัติ');
      return;
    }
    this.router.navigate(['/history']);
  }

  goToMeasure() {
    if (!this.selectedDevice || this.selectedDevice.id === '__none__') {
      alert('กรุณาเพิ่มอุปกรณ์ก่อนทำการวัดค่า');
      return;
    }
    this.router.navigate(['/measure']);
  }

  goToContactAdmin() { this.router.navigate(['/reports']); }

  // ===== ขอผูกอุปกรณ์ =====
  async requestDeviceClaim() {
    const rawId = (this.claimDeviceId || '').trim();
    if (!rawId) {
      this.lastClaimType = 'warn';
      this.lastClaimMessage = 'กรุณากรอก Device ID ก่อน';
      return;
    }
    if (!this.userID) {
      this.lastClaimType = 'err';
      this.lastClaimMessage = 'กรุณาเข้าสู่ระบบใหม่';
      return;
    }

    const deviceId = rawId.toLowerCase();
    const username = this.userID;

    try {
      this.requestingClaim = true;
      this.lastClaimMessage = '';
      this.lastClaimType = '';

      const devRef = ref(this.db, `devices/${deviceId}`);
      const snap = await get(devRef);

      if (snap.exists()) {
        const dev = snap.val() || {};
        const meta = (dev.meta || {}) as any;

        const alreadyBound =
          !!meta.userName ||
          !!dev.user ||
          dev.enabled === true;

        if (alreadyBound) {
          this.lastClaimType = 'err';
          this.lastClaimMessage = 'อุปกรณ์นี้ถูกผูกกับผู้ใช้คนอื่นแล้ว';
          return;
        }

        if (dev.claim && dev.claim.username) {
          if (dev.claim.username === username) {
            const since = new Date(dev.claim.ts || Date.now()).toLocaleString('th-TH');
            this.lastClaimType = 'warn';
            this.lastClaimMessage = `คุณได้ส่งคำขอนี้แล้ว (ตั้งแต่ ${since}) กรุณารอผู้ดูแลอนุมัติ`;
            return;
          } else {
            this.lastClaimType = 'err';
            this.lastClaimMessage = 'มีผู้ใช้อื่นกำลังขอผูกอุปกรณ์นี้อยู่';
            return;
          }
        }

        await update(devRef, {
          enabled: false,
          user: null,
          claim: { username, ts: Date.now() }
        });
      } else {
        await set(devRef, {
          enabled: false,
          user: null,
          claim: { username, ts: Date.now() }
        });
      }

      this.lastClaimType = 'ok';
      this.lastClaimMessage = `ส่งคำขอสำเร็จ! กรุณารอแอดมินอนุมัติ (อุปกรณ์: ${deviceId})`;
      this.claimDeviceId = '';
    } catch (err) {
      console.error('requestDeviceClaim error:', err);
      this.lastClaimType = 'err';
      this.lastClaimMessage = 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
    } finally {
      this.requestingClaim = false;
    }
  }
}
