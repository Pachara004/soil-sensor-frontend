import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Database, ref, push, set } from '@angular/fire/database';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss'
})
export class ReportsComponent {
  subject: string = '';
  message: string = '';

  constructor(
    private router: Router,
    private location: Location,
    private db: Database // 👈 เพิ่ม Database
  ) {}

  goBack() {
    this.location.back();
  }

  async sendReport() {
    if (!this.subject.trim() || !this.message.trim()) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    // เก็บข้อมูลลง Realtime Database
    const reportsRef = ref(this.db, 'reports'); // path: /reports
    const newReportRef = push(reportsRef);

    const userData = JSON.parse(localStorage.getItem('user') || '{}');

    await set(newReportRef, {
      subject: this.subject,
      message: this.message,
      timestamp: new Date().toISOString(),
      userID: userData.userID || 'unknown',
      username: userData.username || 'unknown'
    });

    alert('ส่งเรื่องสำเร็จ! ทีมงานจะติดต่อกลับโดยเร็ว');

    // ล้างฟอร์ม
    this.subject = '';
    this.message = '';
  }
}
