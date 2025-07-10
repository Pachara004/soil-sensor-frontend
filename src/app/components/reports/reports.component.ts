import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule,  FormsModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss'
})
export class ReportsComponent {
  subject: string = '';
  message: string = '';

  constructor(private router: Router, private location: Location) {}

  goBack() {
    this.location.back();
  }

  sendReport() {
    console.log('เรื่องที่แจ้ง:', this.subject);
    console.log('รายละเอียด:', this.message);

    if (!this.subject || !this.message) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    // TODO: ต่อ API หรือส่ง Firebase ก็ได้
    alert('ส่งเรื่องสำเร็จ! ทีมงานจะติดต่อกลับโดยเร็ว');
    this.subject = '';
    this.message = '';
  }
}
