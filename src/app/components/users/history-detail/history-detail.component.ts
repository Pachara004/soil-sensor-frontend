import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { SafePipe } from '../../../shared/safe.pipe';
import { environment } from '../../../service/environment'; // นำเข้า environment

interface MeasurementData {
  id?: string;
  deviceId?: string;
  date?: string;
  temperature?: number;
  moisture?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  ph?: number;
  location?: string;
  customLocationName?: string;
  autoLocationName?: string;
  measurementPoint?: number;
  lat?: number; // เพิ่ม type ชัดเจนเพื่อหลีกเลี่ยง index signature หากแน่ใจว่าใช้
  lng?: number; // เพิ่ม type ชัดเจนเพื่อหลีกเลี่ยง index signature หากแน่ใจว่าใช้
  [key: string]: any;
}

interface FertilizerRecommendation {
  formula: string;
  amount: string;
  description: string;
}

@Component({
  selector: 'app-history-detail',
  standalone: true,
  imports: [CommonModule, SafePipe],
  templateUrl: './history-detail.component.html',
  styleUrl: './history-detail.component.scss',
})
export class HistoryDetailComponent implements OnInit {
  username: string = '';
  deviceId: string = '';
  measureDate: string = '';
  measureTime: string = '';

  temperature = 0;
  moisture = 0;
  nitrogen = 0;
  phosphorus = 0;
  potassium = 0;
  ph = 0;
  locationDetail: string = '';
  mapUrl: string = '';
  measurementData: MeasurementData = {};

  constructor(private location: Location, private router: Router) {}

  ngOnInit() {
    this.loadMeasurementData();
  }

  private loadMeasurementData() {
    const data: MeasurementData = JSON.parse(
      localStorage.getItem('selectedMeasurement') || '{}'
    );
    this.measurementData = data;

    // โหลดข้อมูลผู้ใช้
    const userData = localStorage.getItem('user');
    this.username = userData
      ? JSON.parse(userData).username || 'Unknown'
      : 'Unknown';

    // โหลดข้อมูลอุปกรณ์
    this.deviceId = data.deviceId || 'ไม่ระบุอุปกรณ์';

    // วันที่และเวลา
    if (data.date) {
      const date = new Date(data.date);
      this.measureDate = date.toLocaleDateString('th-TH');
      this.measureTime = date.toLocaleTimeString('th-TH');
    }

    // ค่าการวัด
    this.temperature = data.temperature || 0;
    this.moisture = data.moisture || 0;
    this.nitrogen = data.nitrogen || 0;
    this.phosphorus = data.phosphorus || 0;
    this.potassium = data.potassium || 0;
    this.ph = data.ph || 0;

    // ตำแหน่ง
    this.locationDetail = this.getDisplayLocation();

    // สร้าง URL แผนที่ (สมมติใช้ MapTiler Static API)
    if (data['lat'] && data['lng']) {
      this.mapUrl = `https://api.maptiler.com/maps/streets/static/[${data['lng']},${data['lat']},10]/256x256.png?key=${environment.mapTilerApiKey}`;
    }
  }

  // Methods used in template must be public
  getDisplayLocation(): string {
    return (
      this.measurementData.customLocationName ||
      this.measurementData.autoLocationName ||
      'ไม่ระบุ'
    );
  }

  getTemperatureStatus(): string { return 'ok'; }
  getTemperatureStatusText(): string { return this.temperature > 0 ? 'ปกติ' : 'ไม่ทราบ'; }

  getMoistureStatus(): string { return 'ok'; }
  getMoistureStatusText(): string { return this.moisture > 0 ? 'ปกติ' : 'ไม่ทราบ'; }

  getNitrogenStatus(): string { return 'ok'; }
  getNitrogenStatusText(): string { return this.nitrogen > 0 ? 'ปกติ' : 'ไม่ทราบ'; }

  getPhosphorusStatus(): string { return 'ok'; }
  getPhosphorusStatusText(): string { return this.phosphorus > 0 ? 'ปกติ' : 'ไม่ทราบ'; }

  getPotassiumStatus(): string { return 'ok'; }
  getPotassiumStatusText(): string { return this.potassium > 0 ? 'ปกติ' : 'ไม่ทราบ'; }

  getPhStatus(): string { return 'ok'; }
  getPhStatusText(): string { return this.ph >= 6.5 && this.ph <= 7.5 ? 'ดี' : 'ต้องปรับปรุง'; }

  getOverallStatus(): string { return 'ok'; }
  getOverallStatusIcon(): string { return 'fas fa-check-circle'; }
  getOverallStatusTitle(): string {
    const phStatus = this.ph >= 6.5 && this.ph <= 7.5 ? 'ดี' : 'ต้องปรับปรุง';
    const nutrientStatus = [this.nitrogen, this.phosphorus, this.potassium].every((v) => v > 0)
      ? 'ดี'
      : 'ต้องปรับปรุง';
    return `สถานะดิน: ${phStatus} (pH), ${nutrientStatus} (ธาตุอาหาร)`;
  }
  getOverallStatusDescription(): string { return 'สรุปสถานะโดยรวมของสภาพดิน'; }

  getRecommendations(): FertilizerRecommendation[] | string[] {
    // Return empty list temporarily for template compatibility
    return [];
  }

  downloadReport() {
    const reportData = {
      deviceId: this.deviceId,
      date: this.measureDate,
      time: this.measureTime,
      location: this.getDisplayLocation(),
      measurements: {
        temperature: this.temperature,
        moisture: this.moisture,
        nitrogen: this.nitrogen,
        phosphorus: this.phosphorus,
        potassium: this.potassium,
        ph: this.ph,
      },
      recommendations: this.getRecommendations(),
      overallStatus: this.getOverallStatusTitle(),
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `soil-report-${this.deviceId}-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  shareReport() {
    const shareText = `รายงานการวัดดิน\nอุปกรณ์: ${this.deviceId}\nวันที่: ${
      this.measureDate
    }\nสถานะ: ${this.getOverallStatusTitle()}`;

    if (navigator.share) {
      navigator.share({
        title: 'รายงานการวัดดิน',
        text: shareText,
      });
    } else {
      navigator.clipboard.writeText(shareText).then(() => {
        alert('คัดลอกข้อมูลแล้ว!');
      });
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
