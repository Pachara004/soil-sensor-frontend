import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Database, ref, onValue, get } from '@angular/fire/database';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

interface Measurement {
  id: string;
  location: string;
  date: string;
  temperature?: number;
  moisture?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  ph?: number;
  [key: string]: any;
}

interface UserData {
  username: string;
  userID: string;
  name: string;
  email: string;
  phone: string;
  devices?: { [key: string]: boolean };
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [FormsModule, CommonModule, MatProgressSpinnerModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss'
})
export class HistoryComponent implements OnInit {
  username: string = '';
  deviceId: string = '';
  devices: string[] = [];
  history: Measurement[] = [];
  isLoading = false;

  constructor(
    private router: Router,
    private location: Location,
    private db: Database
  ) {}

  async ngOnInit() {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user: UserData = JSON.parse(userData);
      this.username = user.username || 'ไม่พบชื่อผู้ใช้';
      await this.loadDevices();
      if (this.devices.length > 0) {
        this.deviceId = localStorage.getItem('selectedDevice') || this.devices[0];
        this.loadHistory();
      }
    } else {
      alert('กรุณาล็อกอินก่อน');
      this.router.navigate(['/']);
    }
  }

  async loadDevices() {
    this.isLoading = true;
    try {
      const userRef = ref(this.db, `users/${this.username}/devices`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        this.devices = Object.keys(snapshot.val());
        if (this.devices.length === 0) {
          alert('ไม่พบอุปกรณ์ที่เชื่อมโยง');
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

  loadHistory() {
    if (!this.deviceId) return;
    this.isLoading = true;
    const measurementRef = ref(this.db, `measurements/${this.deviceId}`);
    onValue(
      measurementRef,
      snapshot => {
        const data = snapshot.val();
        if (data) {
          this.history = Object.entries(data).map(([key, value]: [string, any]) => ({
            id: key,
            location: value.location || 'ไม่ระบุสถานที่',
            date: value.date || new Date().toISOString().split('T')[0],
            temperature: value.temperature,
            moisture: value.moisture,
            nitrogen: value.nitrogen,
            phosphorus: value.phosphorus,
            potassium: value.potassium,
            ph: value.ph,
            ...value
          }));
        } else {
          this.history = [];
        }
        this.isLoading = false;
      },
      error => {
        console.error('ข้อผิดพลาดในการโหลดประวัติ:', error);
        this.history = [];
        this.isLoading = false;
      }
    );
  }

  onDeviceChange() {
    localStorage.setItem('selectedDevice', this.deviceId);
    this.loadHistory();
  }

  viewDetail(item: Measurement) {
    const measurementData = {
      ...item,
      deviceId: this.deviceId
    };
    localStorage.setItem('selectedMeasurement', JSON.stringify(measurementData));
    this.router.navigate(['/history-detail']);
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