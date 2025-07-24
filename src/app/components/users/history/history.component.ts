import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Database, ref, onValue, get } from '@angular/fire/database';
import { CommonModule } from '@angular/common';

interface Measurement {
  id: string;
  location: string;
  date: string;
  [key: string]: any; // รองรับข้อมูลเพิ่มเติม
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
  imports: [FormsModule, CommonModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss'
})
export class HistoryComponent implements OnInit {
  username: string = '';
  deviceId: string = '';
  history: Measurement[] = [];

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
      // โหลด deviceId จาก Firebase
      await this.loadDeviceId();
      // โหลดประวัติ
      this.loadHistory();
    } else {
      alert('กรุณาล็อกอินก่อน');
      this.router.navigate(['/']);
    }
  }

  async loadDeviceId() {
    try {
      const userRef = ref(this.db, `users/${this.username}/devices`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const devices = snapshot.val();
        this.deviceId = Object.keys(devices)[0] || 'NPK0001'; // ใช้ device แรกหรือ fallback
      } else {
        this.deviceId = 'NPK0001'; // Fallback
      }
    } catch (error) {
      console.error('ข้อผิดพลาดในการโหลด deviceId:', error);
      this.deviceId = 'NPK0001';
    }
  }

  loadHistory() {
    const measurementRef = ref(this.db, `measurements/${this.deviceId}`);
    onValue(measurementRef, snapshot => {
      const data = snapshot.val();
      if (data) {
        this.history = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          location: value.location || 'ไม่ระบุสถานที่',
          date: value.date || new Date().toISOString().split('T')[0],
          ...value
        }));
      } else {
        this.history = [];
      }
    }, error => {
      console.error('ข้อผิดพลาดในการโหลดประวัติ:', error);
      this.history = [];
    });
  }

  viewDetail(item: Measurement) {
    localStorage.setItem('selectedHistory', JSON.stringify(item));
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