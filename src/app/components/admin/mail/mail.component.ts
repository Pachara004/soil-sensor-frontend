import { Component, OnInit } from '@angular/core';
import { Database, ref, onValue, remove } from '@angular/fire/database';
import { CommonModule, Location, DatePipe } from '@angular/common';

@Component({
  selector: 'app-mail',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './mail.component.html',
  styleUrl: './mail.component.scss',
})
export class MailComponent implements OnInit {
  reports: any[] = [];
  selectedReport: any = null;

  constructor(
    private db: Database,
    private location: Location
  ) {}

  ngOnInit(): void {
    const reportsRef = ref(this.db, 'reports');
    onValue(reportsRef, (snapshot) => {
      const data = snapshot.val();
      this.reports = [];

      for (let key in data) {
        this.reports.push({
          key: key,
          subject: data[key].subject,
          message: data[key].message,
          timestamp: data[key].timestamp,
          username: data[key].username,
        });
      }

      // Sort by latest timestamp
      this.reports.sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
    });
  }

  async deleteReport(key: string) {
    if (confirm('ต้องการลบเรื่องนี้จริงหรือไม่?')) {
      try {
        const reportRef = ref(this.db, `reports/${key}`);
        await remove(reportRef);
        alert('ลบสำเร็จ');
        if (this.selectedReport && this.selectedReport.key === key) {
          this.selectedReport = null;
        }
      } catch (error) {
        console.error('Error deleting report:', error);
        alert('เกิดข้อผิดพลาดในการลบ');
      }
    }
  }

  openReportModal(report: any) {
    this.selectedReport = report;
  }

  closeReportModal() {
    this.selectedReport = null;
  }

  goBack() {
    this.location.back();
  }
}