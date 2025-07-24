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
      await this.loadDevices();
      if (this.devices.length > 0) {
        this.deviceName = localStorage.getItem('selectedDevice') || this.devices[0];
      }
    } else {
      alert('กรุณาล็อกอินก่อน');
      this.router.navigate(['/']);
    }
  }

  async loadDevices() {
    this.isLoading = true;
    try {
      const snapshot = await get(child(ref(this.db), `users/${this.userID}/devices`));
      if (snapshot.exists()) {
        this.devices = Object.keys(snapshot.val());
        if (this.devices.length === 0) {
          this.devices = ['ไม่มีอุปกรณ์'];
          this.deviceName = 'ไม่มีอุปกรณ์';
        }
      } else {
        this.devices = ['ไม่มีอุปกรณ์'];
        this.deviceName = 'ไม่มีอุปกรณ์';
      }
    } catch (error) {
      console.error('ข้อผิดพลาดในการโหลดชื่ออุปกรณ์:', error);
      this.devices = ['เกิดข้อผิดพลาด'];
      this.deviceName = 'เกิดข้อผิดพลาด';
    } finally {
      this.isLoading = false;
    }
  }

  onDeviceChange() {
    localStorage.setItem('selectedDevice', this.deviceName);
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
    this.router.navigate(['/history']);
  }

  goToMeasure() {
    this.router.navigate(['/measure']);
  }

  goToContactAdmin() {
    this.router.navigate(['/reports']);
  }
}