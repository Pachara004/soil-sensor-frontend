import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Database, ref, get, child, onValue, update, set } from '@angular/fire/database';
import { interval, Subscription } from 'rxjs';

interface Device {
  name: string;
  status: 'online' | 'offline';
}

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent implements OnInit {
  userID: string = '';
  deviceName: string = '';
  devices: Device[] = [];
  selectedDevice: Device | null = null;
  isLoading = false;
  currentTime: string = '';
  private clockSubscription: Subscription | null = null;

  // ===== NEW: ฟิลด์สำหรับการ "ขอผูกอุปกรณ์" =====
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
    if (userData) {
      const user = JSON.parse(userData);
      this.userID = user.username || user.userID || 'ไม่พบข้อมูล';
      console.log('Current user:', this.userID);
      
      await this.loadDevices();
      
      if (this.devices.length > 0 && this.devices[0].name !== 'ไม่มีอุปกรณ์') {
        this.deviceName = localStorage.getItem('selectedDevice') || this.devices[0].name;
        this.selectedDevice = this.devices.find(d => d.name === this.deviceName) || this.devices[0];
      } else {
        this.deviceName = 'ไม่มีอุปกรณ์';
        this.selectedDevice = null;
        localStorage.removeItem('selectedDevice'); // ลบข้อมูลเก่าออก
      }
      // Initialize real-time clock
      this.updateTime();
      this.clockSubscription = interval(1000).subscribe(() => {
        this.updateTime();
      });

    } else {
      alert('กรุณาล็อกอินก่อน');
      this.router.navigate(['/']);
    }
  }

  ngOnDestroy() {
    // Clean up clock subscription
    if (this.clockSubscription) {
      this.clockSubscription.unsubscribe();
    }
  }

  private updateTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    this.currentTime = `${hours}:${minutes}:${seconds}`;
  }

  async loadDevices() {
    this.isLoading = true;
    this.devices = []; // รีเซ็ตก่อน
    
    try {
      console.log('Loading devices for user:', this.userID);
      
      // วิธีที่ 1: ตรวจสอบ path users/{userID}/devices
      const userDevicesRef = ref(this.db, `users/${this.userID}/devices`);
      const userDevicesSnapshot = await get(userDevicesRef);
      
      if (userDevicesSnapshot.exists()) {
        const userDevicesData = userDevicesSnapshot.val();
        console.log('User devices data:', userDevicesData);
        
        if (typeof userDevicesData === 'object' && userDevicesData !== null) {
          this.devices = Object.entries(userDevicesData).map(([key, value]: [string, any]) => ({
            name: (value as any).name || key,
            status: (value as any).status || 'offline'
          }));
        }
      }
      
      // วิธีที่ 2: ถ้าไม่พบในวิธีที่ 1 ให้ค้นหาใน devices node ทั้งหมด
      if (this.devices.length === 0) {
        console.log('No devices found in user node, searching in devices node...');
        
        const allDevicesRef = ref(this.db, 'devices');
        onValue(allDevicesRef, (snapshot) => {
          const allDevicesData = snapshot.val();
          if (allDevicesData) {
            const userDevices: Device[] = [];
            for (const [deviceId, deviceData] of Object.entries(allDevicesData)) {
              const device = deviceData as any;
              if (device.user === this.userID || device.owner === this.userID || device.userId === this.userID) {
                userDevices.push({
                  name: device.name || deviceId,
                  status: device.status || 'offline'
                });
              }
            }
            this.devices = userDevices;
            if (this.devices.length > 0) {
              this.deviceName = localStorage.getItem('selectedDevice') || this.devices[0].name;
              this.selectedDevice = this.devices.find(d => d.name === this.deviceName) || this.devices[0];
            } else {
              this.devices = [{ name: 'ไม่มีอุปกรณ์', status: 'offline' }];
              this.deviceName = 'ไม่มีอุปกรณ์';
              this.selectedDevice = null;
            }
          }
        }, (error) => {
          console.error('Error fetching devices:', error);
        });
      }
      
      // วิธีที่ 3: ถ้ายังไม่พบ ให้ค้นหาใน userDevices node
      if (this.devices.length === 0) {
        console.log('Searching in userDevices node...');
        
        const userDevicesRef2 = ref(this.db, `userDevices/${this.userID}`);
        const userDevicesSnapshot2 = await get(userDevicesRef2);
        
        if (userDevicesSnapshot2.exists()) {
          const userData = userDevicesSnapshot2.val();
          console.log('UserDevices data:', userData);
          
          if (Array.isArray(userData)) {
            this.devices = userData.map((d: any) => ({ name: d.name, status: d.status || 'offline' }));
          } else if (typeof userData === 'object') {
            this.devices = Object.entries(userData).map(([key, value]: [string, any]) => ({
              name: (value as any).name || key,
              status: (value as any).status || 'offline'
            }));
          }
        }
      }
      
      // ตรวจสอบผลลัพธ์สุดท้าย
      if (this.devices.length === 0) {
        console.log('No devices found for user:', this.userID);
        this.devices = [{ name: 'ไม่มีอุปกรณ์', status: 'offline' }];
        this.deviceName = 'ไม่มีอุปกรณ์';
        this.selectedDevice = null;
      } else {
        console.log('Found devices:', this.devices);
        this.devices = this.devices.filter(device => typeof device.name === 'string');
        if (this.devices.length === 0) {
          this.devices = [{ name: 'ไม่มีอุปกรณ์', status: 'offline' }];
          this.deviceName = 'ไม่มีอุปกรณ์';
          this.selectedDevice = null;
        } else {
          this.selectedDevice = this.devices.find(d => d.name === this.deviceName) || this.devices[0];
        }
      }
      
    } catch (error) {
      console.error('ข้อผิดพลาดในการโหลดชื่ออุปกรณ์:', error);
      this.devices = [{ name: 'เกิดข้อผิดพลาด', status: 'offline' }];
      this.deviceName = 'เกิดข้อผิดพลาด';
      this.selectedDevice = null;
    } finally {
      this.isLoading = false;
      console.log('Final devices array:', this.devices);
      console.log('Final device name:', this.deviceName);
      console.log('Selected device:', this.selectedDevice);
    }
  }

  onDeviceChange() {
    this.selectedDevice = this.devices.find(d => d.name === this.deviceName) || null;
    if (this.deviceName !== 'ไม่มีอุปกรณ์' && this.deviceName !== 'เกิดข้อผิดพลาด') {
      localStorage.setItem('selectedDevice', this.deviceName);
    } else {
      localStorage.removeItem('selectedDevice');
    }
  }

  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('selectedDevice');
    this.router.navigate(['/']);
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  goToHistory() {
    if (this.deviceName === 'ไม่มีอุปกรณ์') {
      alert('กรุณาเพิ่มอุปกรณ์ก่อนดูประวัติ');
      return;
    }
    this.router.navigate(['/history']);
  }

  goToMeasure() {
    if (this.deviceName === 'ไม่มีอุปกรณ์') {
      alert('กรุณาเพิ่มอุปกรณ์ก่อนทำการวัดค่า');
      return;
    }
    this.router.navigate(['/measure']);
  }

  goToContactAdmin() {
    this.router.navigate(['/reports']);
  }

  // ===== NEW: ผู้ใช้ "ขอผูกอุปกรณ์" โดยไม่เพิ่มตารางใหม่ =====
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

    const deviceId = rawId.toLowerCase(); // normalize
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

        // ถ้ามีการผูกไว้แล้ว
        const alreadyBound =
          !!meta.userName ||
          !!dev.user ||
          dev.enabled === true;

        if (alreadyBound) {
          this.lastClaimType = 'err';
          this.lastClaimMessage = 'อุปกรณ์นี้ถูกผูกกับผู้ใช้คนอื่นแล้ว';
          return;
        }

        // มีคำขอค้างอยู่?
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

        // เขียนคำขอใหม่ลงไป
        await update(devRef, {
          enabled: false,
          user: null,
          claim: { username, ts: Date.now() }
        });

      } else {
        // ยังไม่มี node → สร้าง stub + claim (ไม่สร้าง “ตาราง” ใหม่)
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
