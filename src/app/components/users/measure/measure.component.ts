import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Database, ref, push } from '@angular/fire/database';

@Component({
  selector: 'app-measure',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './measure.component.html',
  styleUrl: './measure.component.scss'
})
export class MeasureComponent {
  locationDetail: string = '';

  // ตัวอย่างค่าเซ็นเซอร์ (ในอนาคตคุณจะดึงจริงจากฮาร์ดแวร์)
  temperature = 28;
  moisture = 40;
  nitrogen = 100;
  phosphorus = 50;
  potassium = 30;
  ph = 6.5;

  constructor(
    private router: Router,
    private location: Location,
    private db: Database  // ✅ ต้องมี Database Injected
  ) {}

  openMapPicker() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.locationDetail = `Lat: ${lat}, Lng: ${lng}`;
      }, error => {
        alert('ไม่สามารถดึงตำแหน่งได้');
      });
    } else {
      alert('อุปกรณ์ไม่รองรับ GPS');
    }
  }

  async saveMeasurement() {
    if (!this.locationDetail) {
      alert('กรุณาระบุตำแหน่งก่อนบันทึก');
      return;
    }

    const data = {
      temperature: this.temperature,
      moisture: this.moisture,
      nitrogen: this.nitrogen,
      phosphorus: this.phosphorus,
      potassium: this.potassium,
      ph: this.ph,
      location: this.locationDetail,
      timestamp: Date.now()
    };

    try {
      const measureRef = ref(this.db, 'measurements'); // ✅ path ใน DB
      await push(measureRef, data);

      alert('บันทึกข้อมูลสำเร็จ!');
      // ล้าง location
      this.locationDetail = '';
    } catch (err) {
      console.error(err);
      alert('บันทึกไม่สำเร็จ');
    }
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
