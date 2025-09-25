import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Constants } from '../../../config/constants'; // ปรับ path ตามโครงสร้าง (สมมติว่า constants.ts อยู่ที่ src/app/config/constants.ts)
import { CommonModule, Location, DatePipe } from '@angular/common';
import { NotificationService } from '../../../service/notification.service';

interface Report {
  key: string;
  subject: string;
  message: string;
  timestamp: string;
  username: string;
}

@Component({
  selector: 'app-mail',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './mail.component.html',
  styleUrl: './mail.component.scss',
})
export class MailComponent implements OnInit {
  reports: Report[] = [];
  selectedReport: Report | null = null;
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private location: Location,
    private constants: Constants, // Inject Constants
    private notificationService: NotificationService
  ) {
    this.apiUrl = this.constants.API_ENDPOINT; // ใช้ instance ของ Constants
  }

  ngOnInit(): void {
    this.loadReports();
  }

  async loadReports() {
    try {
      const response = await this.http
        .get<Report[]>(`${this.apiUrl}/api/reports`)
        .toPromise();
      this.reports = (response || []).sort((a, b) => {
        return (
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      });
    } catch (error) {
      console.error('Error loading reports:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโหลดรายงาน');
    }
  }

  async deleteReport(key: string) {
    if (confirm('ต้องการลบเรื่องนี้จริงหรือไม่?')) {
      try {
        await this.http.delete(`${this.apiUrl}/api/reports/${key}`).toPromise();
        this.notificationService.showNotification('success', 'ลบสำเร็จ', 'รายงานถูกลบเรียบร้อยแล้ว');
        if (this.selectedReport && this.selectedReport.key === key) {
          this.selectedReport = null;
        }
        this.loadReports();
      } catch (error) {
        console.error('Error deleting report:', error);
        this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการลบ');
      }
    }
  }

  openReportModal(report: Report) {
    this.selectedReport = report;
  }

  closeReportModal() {
    this.selectedReport = null;
  }

  goBack() {
    this.location.back();
  }
}
