import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Constants } from '../../../config/constants';
import { NotificationService } from '../../../service/notification.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  subject: string = '';
  message: string = '';
  private apiUrl: string;

  constructor(
    private router: Router,
    private location: Location,
    private http: HttpClient,
    private constants: Constants,
    private notificationService: NotificationService
  ) {
    this.apiUrl = this.constants.API_ENDPOINT;
  }

  goBack() {
    this.location.back();
  }

  async sendReport() {
    if (!this.subject.trim() || !this.message.trim()) {
      this.notificationService.showNotification('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      // ลบ username parameter ออก - ให้ AuthInterceptor จัดการ Firebase ID token
      await this.http
        .post(`${this.apiUrl}/api/reports`, {
          subject: this.subject,
          message: this.message,
          timestamp: new Date().toISOString(),
        })
        .toPromise();

      this.notificationService.showNotification('success', 'ส่งเรื่องสำเร็จ!', 'ทีมงานจะติดต่อกลับโดยเร็ว', true, 'กลับ', () => {
        this.location.back();
      });

      // ล้างฟอร์ม
      this.subject = '';
      this.message = '';
    } catch (error) {
      console.error('Error sending report:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการส่งรายงาน');
    }
  }
}
