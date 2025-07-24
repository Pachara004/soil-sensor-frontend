import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Database, ref, onValue, push, get } from '@angular/fire/database';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SafeUrlPipe } from '../../../shared/safe-url.pipe';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

interface UserData {
  username: string;
  userID: string;
  name: string;
  email: string;
  phone: string;
  devices?: { [key: string]: boolean };
}

@Component({
  selector: 'app-measure',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeUrlPipe, MatProgressSpinnerModule],
  templateUrl: './measure.component.html',
  styleUrl: './measure.component.scss'
})
export class MeasureComponent implements OnInit {
  locationDetail: string = '';
  username: string = '';
  deviceId: string = '';
  devices: string[] = [];
  temperature: number = 0;
  moisture: number = 0;
  nitrogen: number = 0;
  phosphorus: number = 0;
  potassium: number = 0;
  ph: number = 0;
  mapUrl: SafeResourceUrl | null = null;
  isLoading = false;

  constructor(
    private router: Router,
    private location: Location,
    private db: Database,
    private sanitizer: DomSanitizer
  ) {}

  async ngOnInit() {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user: UserData = JSON.parse(userData);
      this.username = user.username || 'ไม่พบชื่อผู้ใช้';
      await this.loadDevices();
      this.deviceId = localStorage.getItem('selectedDevice') || this.devices[0] || 'NPK0001';
      this.loadSensorData();
    } else {
      alert('กรุณาล็อกอินก่อน');
      this.router.navigate(['/']);
    }
  }

  async loadDevices() {
    this.isLoading = true;
    try {
      const userDevicesRef = ref(this.db, `users/${this.username}/devices`);
      const devicesSnapshot = await get(userDevicesRef);
      if (devicesSnapshot.exists()) {
        this.devices = Object.keys(devicesSnapshot.val());
        if (this.devices.length === 0) {
          alert('ไม่พบอุปกรณ์');
          this.devices = ['NPK0001'];
        }
      } else {
        alert('ไม่พบข้อมูลอุปกรณ์');
        this.devices = ['NPK0001'];
      }
    } catch (error) {
      console.error('ข้อผิดพลาดในการโหลดอุปกรณ์:', error);
      this.devices = ['NPK0001'];
    } finally {
      this.isLoading = false;
    }
  }

  async loadSensorData() {
    this.isLoading = true;
    try {
      const sensorRef = ref(this.db, `devices/${this.deviceId}/sensor`);
      const sensorSnap = await get(sensorRef);
      if (sensorSnap.exists()) {
        const sensor = sensorSnap.val();
        this.temperature = sensor.temperature || 0;
        this.moisture = sensor.moisture || 0;
        this.nitrogen = sensor.nitrogen || 0;
        this.phosphorus = sensor.phosphorus || 0;
        this.potassium = sensor.potassium || 0;
        this.ph = sensor.ph || 0;
      } else {
        console.log('ไม่พบข้อมูล sensor');
      }
    } catch (error) {
      console.error('ข้อผิดพลาดในการโหลดข้อมูลเซ็นเซอร์:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onDeviceChange() {
    localStorage.setItem('selectedDevice', this.deviceId);
    this.loadSensorData();
  }

  openMapPicker() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const url = `https://www.google.com/maps?q=${lat},${lng}&hl=th&z=16&output=embed`;
          this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.locationDetail = `Lat: ${lat}, Lng: ${lng}`;
        },
        error => {
          alert('ไม่สามารถดึงตำแหน่งได้');
        }
      );
    } else {
      alert('อุปกรณ์ไม่รองรับ GPS');
    }
  }

  async saveMeasurement() {
    if (!this.locationDetail) {
      alert('กรุณาระบุตำแหน่งก่อนบันทึก');
      return;
    }

    this.isLoading = true;
    try {
      const data = {
        deviceId: this.deviceId,
        temperature: this.temperature,
        moisture: this.moisture,
        nitrogen: this.nitrogen,
        phosphorus: this.phosphorus,
        potassium: this.potassium,
        ph: this.ph,
        location: this.locationDetail,
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now()
      };

      const measureRef = ref(this.db, `measurements/${this.deviceId}`);
      await push(measureRef, data);

      alert('บันทึกข้อมูลสำเร็จ!');
      this.locationDetail = '';
      this.mapUrl = null;
      this.router.navigate(['/history']);
    } catch (err) {
      console.error('ข้อผิดพลาดในการบันทึก:', err);
      alert('บันทึกไม่สำเร็จ');
    } finally {
      this.isLoading = false;
    }
  }

  goBack() {
    this.location.back();
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  goToContactAdmin() {
    this.router.navigate(['/reports']);
  }
}