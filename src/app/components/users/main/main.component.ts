import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Database, ref, get, child } from '@angular/fire/database';

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
  devices: string[] = [];
  isLoading = false;

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
      
      if (this.devices.length > 0 && this.devices[0] !== 'ไม่มีอุปกรณ์') {
        this.deviceName = localStorage.getItem('selectedDevice') || this.devices[0];
      } else {
        this.deviceName = 'ไม่มีอุปกรณ์';
        localStorage.removeItem('selectedDevice'); // ลบข้อมูลเก่าออก
      }
    } else {
      alert('กรุณาล็อกอินก่อน');
      this.router.navigate(['/']);
    }
  }

  async loadDevices() {
    this.isLoading = true;
    this.devices = []; // รีเซ็ตก่อน
    
    try {
      console.log('Loading devices for user:', this.userID);
      
      // วิธีที่ 1: ตรวจสอบ path users/{userID}/devices
      const userDevicesSnapshot = await get(child(ref(this.db), `users/${this.userID}/devices`));
      
      if (userDevicesSnapshot.exists()) {
        const userDevicesData = userDevicesSnapshot.val();
        console.log('User devices data:', userDevicesData);
        
        if (typeof userDevicesData === 'object' && userDevicesData !== null) {
          // ถ้าเป็น object ให้เอา keys
          this.devices = Object.keys(userDevicesData);
        } else if (Array.isArray(userDevicesData)) {
          // ถ้าเป็น array
          this.devices = userDevicesData;
        }
      }
      
      // วิธีที่ 2: ถ้าไม่พบในวิธีที่ 1 ให้ค้นหาใน devices node ทั้งหมด
      if (this.devices.length === 0) {
        console.log('No devices found in user node, searching in devices node...');
        
        const allDevicesSnapshot = await get(child(ref(this.db), 'devices'));
        
        if (allDevicesSnapshot.exists()) {
          const allDevicesData = allDevicesSnapshot.val();
          console.log('All devices data:', allDevicesData);
          
          const userDevices: string[] = [];
          
          // ค้นหาอุปกรณ์ที่เป็นของ user นี้
          for (const [deviceId, deviceData] of Object.entries(allDevicesData)) {
            const device = deviceData as any;
            
            // ตรวจสอบทั้ง user field และ owner field
            if (device.user === this.userID || device.owner === this.userID || device.userId === this.userID) {
              userDevices.push(device.name || deviceId);
            }
          }
          
          this.devices = userDevices;
        }
      }
      
      // วิธีที่ 3: ถ้ายังไม่พบ ให้ค้นหาใน userDevices node
      if (this.devices.length === 0) {
        console.log('Searching in userDevices node...');
        
        const userDevicesSnapshot = await get(child(ref(this.db), `userDevices/${this.userID}`));
        
        if (userDevicesSnapshot.exists()) {
          const userData = userDevicesSnapshot.val();
          console.log('UserDevices data:', userData);
          
          if (Array.isArray(userData)) {
            this.devices = userData;
          } else if (typeof userData === 'object') {
            this.devices = Object.keys(userData);
          }
        }
      }
      
      // ตรวจสอบผลลัพธ์สุดท้าย
      if (this.devices.length === 0) {
        console.log('No devices found for user:', this.userID);
        this.devices = ['ไม่มีอุปกรณ์'];
        this.deviceName = 'ไม่มีอุปกรณ์';
      } else {
        console.log('Found devices:', this.devices);
        // ตรวจสอบว่าไม่มีข้อมูลแปลกๆ เช่น object ที่แสดงเป็น string
        this.devices = this.devices.filter(device => {
          if (typeof device === 'string' && !device.startsWith('{')) {
            return true;
          }
          return false;
        });
        
        if (this.devices.length === 0) {
          this.devices = ['ไม่มีอุปกรณ์'];
          this.deviceName = 'ไม่มีอุปกรณ์';
        }
      }
      
    } catch (error) {
      console.error('ข้อผิดพลาดในการโหลดชื่ออุปกรณ์:', error);
      this.devices = ['เกิดข้อผิดพลาด'];
      this.deviceName = 'เกิดข้อผิดพลาด';
    } finally {
      this.isLoading = false;
      console.log('Final devices array:', this.devices);
      console.log('Final device name:', this.deviceName);
    }
  }

  onDeviceChange() {
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
    // ตรวจสอบว่ามีอุปกรณ์หรือไม่
    if (this.deviceName === 'ไม่มีอุปกรณ์') {
      alert('กรุณาเพิ่มอุปกรณ์ก่อนดูประวัติ');
      return;
    }
    this.router.navigate(['/history']);
  }

  goToMeasure() {
    // ตรวจสอบว่ามีอุปกรณ์หรือไม่
    if (this.deviceName === 'ไม่มีอุปกรณ์') {
      alert('กรุณาเพิ่มอุปกรณ์ก่อนทำการวัดค่า');
      return;
    }
    this.router.navigate(['/measure']);
  }

  goToContactAdmin() {
    this.router.navigate(['/reports']);
  }
}