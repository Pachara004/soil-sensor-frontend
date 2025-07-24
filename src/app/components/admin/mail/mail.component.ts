import { Component, OnInit } from '@angular/core';
import { Database, ref, onValue, remove } from '@angular/fire/database';
import { CommonModule, Location } from '@angular/common';

@Component({
  selector: 'app-mail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mail.component.html',
  styleUrl: './mail.component.scss',
})
export class MailComponent implements OnInit {
  reports: any[] = [];

  constructor
  (
    private db: Database,
    private location: Location,

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

      // เรียงล่าสุดอยู่บน
      this.reports.sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
    });
  }

  async deleteReport(key: string) {
    if (confirm('ต้องการลบเรื่องนี้จริงหรือไม่?')) {
      const reportRef = ref(this.db, `reports/${key}`);
      await remove(reportRef);
      alert('ลบสำเร็จ');
    }
  }
  goBack() {
    this.location.back();
  }
}
