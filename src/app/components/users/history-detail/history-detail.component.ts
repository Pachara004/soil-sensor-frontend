import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { SafePipe } from '../../../shared/safe.pipe';

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
  [key: string]: any;
}

@Component({
  selector: 'app-history-detail',
  standalone: true,
  imports: [CommonModule, SafePipe],
  templateUrl: './history-detail.component.html',
  styleUrl: './history-detail.component.scss'
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
    const data: MeasurementData = JSON.parse(localStorage.getItem('selectedMeasurement') || '{}');
    this.measurementData = data;

    // โหลดข้อมูลผู้ใช้
    const userData = localStorage.getItem('user');
    this.username = userData 
      ? JSON.parse(userData).username || 'Unknown'
      : 'Unknown';

    // โหลดข้อมูลอุปกรณ์
    this.deviceId = data.deviceId || 'ไม่ระบุอุปกรณ์';

    // จัดการวันที่และเวลา
    if (data.date) {
      const date = new Date(data.date);
      this.measureDate = date.toLocaleDateString('th-TH', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      this.measureTime = date.toLocaleTimeString('th-TH', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
    } else {
      this.measureDate = 'ไม่ระบุวันที่';
      this.measureTime = 'ไม่ระบุเวลา';
    }

    // โหลดค่าเซ็นเซอร์
    this.temperature = Number(data.temperature ?? 0);
    this.moisture = Number(data.moisture ?? 0);
    this.nitrogen = Number(data.nitrogen ?? 0);
    this.phosphorus = Number(data.phosphorus ?? 0);
    this.potassium = Number(data.potassium ?? 0);
    this.ph = Number(data.ph ?? 0);

    // จัดการข้อมูลตำแหน่ง
    this.locationDetail = this.determineLocationDetail(data);
    this.setupMap(data);
  }

  private determineLocationDetail(data: MeasurementData): string {
    if (data['customLocationName']) {
      return data['customLocationName'];
    }
    if (data['autoLocationName']) {
      return data['autoLocationName'];
    }
    if (data.location && data.location !== 'Unknown Location') {
      return data.location;
    }
    return 'ไม่ระบุสถานที่';
  }

  private setupMap(data: MeasurementData) {
    if (data.location) {
      const coords = data.location.match(/(-?\d+(\.\d+)?)/g);
      if (coords && coords.length >= 2) {
        const lat = coords[0];
        const lng = coords[1];
        this.mapUrl = `https://maps.google.com/maps?q=${lat},${lng}&output=embed&z=15`;
      }
    }
  }

  // ฟังก์ชันสำหรับแสดงชื่อสถานที่
  getDisplayLocation(): string {
    if (this.locationDetail === 'ไม่ระบุสถานที่' || this.locationDetail === 'Unknown Location') {
      return 'ไม่ระบุสถานที่';
    }
    
    // ตัดพิกัดออก ถ้ามี
    const locationName = this.locationDetail.split(' (')[0];
    return locationName || 'ไม่ระบุสถานที่';
  }

  // ฟังก์ชันสำหรับตรวจสอบสถานะอุณหภูมิ
  getTemperatureStatus(): string {
    if (this.temperature < 15) return 'status-cold';
    if (this.temperature > 35) return 'status-hot';
    return 'status-normal';
  }

  getTemperatureStatusText(): string {
    if (this.temperature < 15) return 'เย็น';
    if (this.temperature > 35) return 'ร้อน';
    return 'ปกติ';
  }

  // ฟังก์ชันสำหรับตรวจสอบความชื้น
  getMoistureStatus(): string {
    if (this.moisture < 30) return 'status-low';
    if (this.moisture > 70) return 'status-high';
    return 'status-normal';
  }

  getMoistureStatusText(): string {
    if (this.moisture < 30) return 'แห้ง';
    if (this.moisture > 70) return 'ชื้นเกินไป';
    return 'เหมาะสม';
  }

  // ฟังก์ชันสำหรับตรวจสอบไนโตรเจน
  getNitrogenStatus(): string {
    if (this.nitrogen < 20) return 'status-low';
    if (this.nitrogen > 40) return 'status-high';
    return 'status-normal';
  }

  getNitrogenStatusText(): string {
    if (this.nitrogen < 20) return 'ต่ำ';
    if (this.nitrogen > 40) return 'สูง';
    return 'เหมาะสม';
  }

  // ฟังก์ชันสำหรับตรวจสอบฟอสฟอรัส
  getPhosphorusStatus(): string {
    if (this.phosphorus < 15) return 'status-low';
    if (this.phosphorus > 30) return 'status-high';
    return 'status-normal';
  }

  getPhosphorusStatusText(): string {
    if (this.phosphorus < 15) return 'ต่ำ';
    if (this.phosphorus > 30) return 'สูง';
    return 'เหมาะสม';
  }

  // ฟังก์ชันสำหรับตรวจสอบโพแทสเซียม
  getPotassiumStatus(): string {
    if (this.potassium < 100) return 'status-low';
    if (this.potassium > 300) return 'status-high';
    return 'status-normal';
  }

  getPotassiumStatusText(): string {
    if (this.potassium < 100) return 'ต่ำ';
    if (this.potassium > 300) return 'สูง';
    return 'เหมาะสม';
  }

  // ฟังก์ชันสำหรับตรวจสอบ pH
  getPhStatus(): string {
    if (this.ph < 6.0) return 'status-acidic';
    if (this.ph > 8.0) return 'status-alkaline';
    return 'status-normal';
  }

  getPhStatusText(): string {
    if (this.ph < 6.0) return 'เป็นกรด';
    if (this.ph > 8.0) return 'เป็นด่าง';
    return 'เป็นกลาง';
  }

  // ฟังก์ชันสำหรับประเมินสถานะโดยรวม
  getOverallStatus(): string {
    const issues = this.getIssuesCount();
    if (issues === 0) return 'overall-good';
    if (issues <= 2) return 'overall-moderate';
    return 'overall-poor';
  }

  getOverallStatusIcon(): string {
    const status = this.getOverallStatus();
    switch (status) {
      case 'overall-good': return 'fas fa-check-circle';
      case 'overall-moderate': return 'fas fa-exclamation-triangle';
      default: return 'fas fa-times-circle';
    }
  }

  getOverallStatusTitle(): string {
    const status = this.getOverallStatus();
    switch (status) {
      case 'overall-good': return 'สภาพดินเหมาะสม';
      case 'overall-moderate': return 'สภาพดินปานกลาง';
      default: return 'สภาพดินต้องปรับปรุง';
    }
  }

  getOverallStatusDescription(): string {
    const status = this.getOverallStatus();
    switch (status) {
      case 'overall-good': return 'ค่าทั้งหมดอยู่ในเกณฑ์ที่เหมาะสมสำหรับการปลูกพืช';
      case 'overall-moderate': return 'มีค่าบางตัวที่ควรติดตาม อาจต้องปรับปรุงเล็กน้อย';
      default: return 'มีหลายค่าที่ไม่เหมาะสม ต้องปรับปรุงดินก่อนปลูกพืช';
    }
  }

  private getIssuesCount(): number {
    let issues = 0;
    
    if (this.getTemperatureStatus() !== 'status-normal') issues++;
    if (this.getMoistureStatus() !== 'status-normal') issues++;
    if (this.getNitrogenStatus() !== 'status-normal') issues++;
    if (this.getPhosphorusStatus() !== 'status-normal') issues++;
    if (this.getPotassiumStatus() !== 'status-normal') issues++;
    if (this.getPhStatus() !== 'status-normal') issues++;

    return issues;
  }

  // คำแนะนำ
  getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.getMoistureStatus() === 'status-low') {
      recommendations.push('เพิ่มการรดน้ำ หรือปรับปรุงระบบการระบายน้ำ');
    } else if (this.getMoistureStatus() === 'status-high') {
      recommendations.push('ลดการรดน้ำ หรือปรับปรุงการระบายน้ำให้ดีขึ้น');
    }

    if (this.getNitrogenStatus() === 'status-low') {
      recommendations.push('เพิ่มปุ่ยไนโตรเจน เช่น ปุ่ยยูเรีย หรือปุ่ยคอก');
    }

    if (this.getPhosphorusStatus() === 'status-low') {
      recommendations.push('เพิ่มปุ่ยฟอสเฟต เช่น ปุ่ยกระดูกป่น');
    }

    if (this.getPotassiumStatus() === 'status-low') {
      recommendations.push('เพิ่มปุ่ยโพแทสเซียม เช่น ปุ่ยมูเรียทออฟโพแทช');
    }

    if (this.getPhStatus() === 'status-acidic') {
      recommendations.push('เพิ่มปูนขาวเพื่อลดความเป็นกรดของดิน');
    } else if (this.getPhStatus() === 'status-alkaline') {
      recommendations.push('เพิ่มซัลเฟอร์หรือปุ่ยเปรียวเพื่อลดความเป็นด่าง');
    }

    return recommendations;
  }

  // ฟังก์ชันสำหรับดาวน์โหลดรายงาน
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
        ph: this.ph
      },
      recommendations: this.getRecommendations(),
      overallStatus: this.getOverallStatusTitle()
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `soil-report-${this.deviceId}-${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  // ฟังก์ชันสำหรับแชร์
  shareReport() {
    const shareText = `รายงานการวัดดิน\nอุปกรณ์: ${this.deviceId}\nวันที่: ${this.measureDate}\nสถานะ: ${this.getOverallStatusTitle()}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'รายงานการวัดดิน',
        text: shareText,
      });
    } else {
      // Fallback สำหรับเบราว์เซอร์ที่ไม่รองรับ Web Share API
      navigator.clipboard.writeText(shareText).then(() => {
        alert('คัดลอกข้อมูลแล้ว!');
      });
    }
  }

  // Navigation functions
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