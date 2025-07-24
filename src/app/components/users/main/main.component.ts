import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common'; // เพิ่ม CommonModule
import { Database, ref, get, child } from '@angular/fire/database';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule], // เพิ่ม CommonModule
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent implements OnInit {
  userID: string = '';
  deviceName: string = '';

  constructor(
    private router: Router,
    private db: Database
  ) {}

  async ngOnInit() {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      this.userID = user.username || user.userID || 'ไม่พบข้อมูล'; // ใช้ username เช่น "test"

      try {
        const snapshot = await get(child(ref(this.db), `users/${this.userID}/devices`));
        if (snapshot.exists()) {
          const devices = snapshot.val();
          // ดึงชื่ออุปกรณ์ตัวแรกจาก object (เช่น "NPK001")
          this.deviceName = Object.keys(devices)[0] || 'ไม่มีชื่ออุปกรณ์';
        } else {
          this.deviceName = 'ไม่มีอุปกรณ์';
        }
      } catch (error) {
        console.error('ข้อผิดพลาดในการโหลดชื่ออุปกรณ์:', error);
        this.deviceName = 'เกิดข้อผิดพลาด';
      }
    } else {
      alert('กรุณาล็อกอินก่อน');
      this.router.navigate(['/']);
    }
  }
  logout() {
    localStorage.removeItem('user');
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