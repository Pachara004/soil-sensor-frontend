import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Database, ref, onValue, get } from '@angular/fire/database';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

interface Measurement {
  id: string;
  location: string;
  date: string;
  temperature?: number;
  moisture?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  ph?: number;
  areaId?: string;
  measurementPoint?: number;
  [key: string]: any;
}

interface AreaGroup {
  areaId: string;
  areaName: string;
  measurements: Measurement[];
  totalMeasurements: number;
  averages: {
    temperature: number;
    moisture: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    ph: number;
  };
  lastMeasurementDate: string;
}

interface UserData {
  username: string;
  userID: string;
  name: string;
  email: string;
  phone: string;
  devices?: { [key: string]: boolean };
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [FormsModule, CommonModule, MatProgressSpinnerModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss'
})
export class HistoryComponent implements OnInit {
  username: string = '';
  deviceId: string = '';
  devices: string[] = [];
  history: Measurement[] = [];
  areaGroups: AreaGroup[] = [];
  selectedAreaId: string = '';
  showAreaDetails: boolean = false;
  selectedArea: AreaGroup | null = null;
  isLoading = false;

  constructor(
    private router: Router,
    private location: Location,
    private db: Database
  ) {}

  async ngOnInit() {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user: UserData = JSON.parse(userData);
      this.username = user.username || 'ไม่พบชื่อผู้ใช้';
      await this.loadDevices();
      if (this.devices.length > 0) {
        this.deviceId = localStorage.getItem('selectedDevice') || this.devices[0];
        this.loadHistory();
      }
    } else {
      alert('กรุณาล็อกอินก่อน');
      this.router.navigate(['/']);
    }
  }

  async loadDevices() {
    this.isLoading = true;
    try {
      const userRef = ref(this.db, `users/${this.username}/devices`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        this.devices = Object.keys(snapshot.val());
        if (this.devices.length === 0) {
          alert('ไม่พบอุปกรณ์ที่เชื่อมโยง');
          this.devices = ['NPK0001'];
        }
      } else {
        alert('ไม่พบข้อมูลอุปกรณ์');
        this.devices = ['NPK0001'];
      }
    } catch (error) {
      console.error('ข้อผิดพลาดในการโหลดอุปกรณ์:', error);
      this.devices = ['NPK0001'];
    } finally {
      this.isLoading = false;
    }
  }

 loadHistory() {
  if (!this.deviceId) return;
  this.isLoading = true;
  const measurementRef = ref(this.db, `measurements/${this.deviceId}`);
  onValue(
    measurementRef,
    snapshot => {
      const data = snapshot.val();
      if (data) {
        this.history = Object.entries(data).map(([key, value]: [string, any]) => {
          // สร้างชื่อพื้นที่ที่มีความหมาย
          let areaName = this.createMeaningfulAreaName(value, key);

          return {
            id: key,
            location: value.location || 'ไม่ระบุสถานที่',
            date: value.date || new Date().toISOString().split('T')[0],
            temperature: value.temperature || 0,
            moisture: value.moisture || 0,
            nitrogen: value.nitrogen || 0,
            phosphorus: value.phosphorus || 0,
            potassium: value.potassium || 0,
            ph: value.ph || 0,
            areaId: value.areaId,
            measurementPoint: value.measurementPoint,
            derivedAreaName: areaName,
            ...value
          };
        });
        
        // จัดกลุ่มข้อมูลตาม area
        this.groupByArea();
      } else {
        this.history = [];
        this.areaGroups = [];
      }
      this.isLoading = false;
    },
    error => {
      console.error('ข้อผิดพลาดในการโหลดประวัติ:', error);
      this.history = [];
      this.areaGroups = [];
      this.isLoading = false;
    }
  );
}
private createMeaningfulAreaName(value: any, measurementId: string): string {
  // 1. ลองใช้ชื่อที่กำหนดเองก่อน
  if (value['customLocationName'] && 
      value['customLocationName'] !== 'Unknown Location' && 
      value['customLocationName'].trim() !== '') {
    return value['customLocationName'];
  }

  // 2. ลองใช้ชื่อพื้นที่อัตโนมัติ
  if (value['autoLocationName'] && 
      value['autoLocationName'] !== 'Unknown Location' && 
      value['autoLocationName'].trim() !== '') {
    return value['autoLocationName'];
  }

  // 3. ประมวลผลจาก location
  if (value.location && 
      value.location !== 'ไม่ระบุสถานที่' && 
      value.location !== 'Unknown Location' && 
      value.location.trim() !== '') {
    
    const locationName = value.location.split(' (')[0].trim();
    if (locationName && locationName !== 'Unknown Location') {
      return locationName;
    }
  }

  // 4. ใช้ areaId ถ้ามี
  if (value.areaId && value.areaId !== 'no-area') {
    if (value.areaId.includes('_')) {
      const parts = value.areaId.split('_');
      const lastPart = parts[parts.length - 1];
      return `พื้นที่ ${lastPart}`;
    }
    return `พื้นที่ ${value.areaId}`;
  }

  // 5. สร้างชื่อจากวันที่และเวลา
  if (value.date) {
    const date = new Date(value.date);
    const dateStr = date.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
    return `พื้นที่ ${dateStr}`;
  }

  // 6. สร้างจาก measurement ID (กรณีสุดท้าย)
  const shortId = measurementId.substring(0, 6);
  return `พื้นที่ ${shortId}`;
}
  private groupByArea() {
  const areaMap = new Map<string, Measurement[]>();
  
  // จัดกลุ่มการวัดตาม areaId หรือชื่อพื้นที่
  this.history.forEach(measurement => {
    let groupKey = measurement.areaId || 'no-area';
    
    // ถ้าไม่มี areaId ให้ใช้ชื่อพื้นที่เป็น key
    if (groupKey === 'no-area' && measurement['derivedAreaName']) {
      groupKey = `area_${measurement['derivedAreaName']}`;
    }

    if (!areaMap.has(groupKey)) {
      areaMap.set(groupKey, []);
    }
    areaMap.get(groupKey)!.push(measurement);
  });

  // สร้าง AreaGroup
  this.areaGroups = Array.from(areaMap.entries()).map(([areaId, measurements]) => {
    const sortedMeasurements = measurements.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const averages = this.calculateAverages(measurements);
    const areaName = this.getAreaName(areaId, measurements);
    
    console.log(`Final Area: ${areaId} -> ${areaName}`, measurements.length, 'measurements');

    return {
      areaId,
      areaName,
      measurements: sortedMeasurements,
      totalMeasurements: measurements.length,
      averages,
      lastMeasurementDate: sortedMeasurements[0]?.date || ''
    };
  }).sort((a, b) => 
    new Date(b.lastMeasurementDate).getTime() - new Date(a.lastMeasurementDate).getTime()
  );

  console.log('Final areaGroups with names:', this.areaGroups.map(ag => ({
    id: ag.areaId,
    name: ag.areaName,
    count: ag.totalMeasurements
  })));
}

  private calculateAverages(measurements: Measurement[]) {
    if (measurements.length === 0) {
      return {
        temperature: 0,
        moisture: 0,
        nitrogen: 0,
        phosphorus: 0,
        potassium: 0,
        ph: 0
      };
    }

    const totals = measurements.reduce((acc, measurement) => {
      acc.temperature += measurement.temperature || 0;
      acc.moisture += measurement.moisture || 0;
      acc.nitrogen += measurement.nitrogen || 0;
      acc.phosphorus += measurement.phosphorus || 0;
      acc.potassium += measurement.potassium || 0;
      acc.ph += measurement.ph || 0;
      return acc;
    }, {
      temperature: 0,
      moisture: 0,
      nitrogen: 0,
      phosphorus: 0,
      potassium: 0,
      ph: 0
    });

    const count = measurements.length;
    return {
      temperature: parseFloat((totals.temperature / count).toFixed(2)),
      moisture: parseFloat((totals.moisture / count).toFixed(2)),
      nitrogen: parseFloat((totals.nitrogen / count).toFixed(2)),
      phosphorus: parseFloat((totals.phosphorus / count).toFixed(2)),
      potassium: parseFloat((totals.potassium / count).toFixed(2)),
      ph: parseFloat((totals.ph / count).toFixed(2))
    };
  }
// เพิ่มฟังก์ชันนี้ใน HistoryComponent
getDisplayAreaName(area: AreaGroup): string {
  // ตรวจสอบว่า areaName เป็น Unknown Location หรือไม่
  if (!area.areaName || 
      area.areaName === 'Unknown Location' || 
      area.areaName.trim() === '') {
    
    // สร้างชื่อจาก areaId
    if (area.areaId && area.areaId !== 'no-area') {
      if (area.areaId.includes('_')) {
        const parts = area.areaId.split('_');
        const lastPart = parts[parts.length - 1];
        return `พื้นที่ ${lastPart}`;
      }
      return `พื้นที่ ${area.areaId.substring(0, 8)}`;
    }
    
    // สร้างชื่อจากวันที่ล่าสุด
    if (area.lastMeasurementDate) {
      const date = new Date(area.lastMeasurementDate);
      const dateStr = date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit'
      });
      return `พื้นที่ ${dateStr}`;
    }
    
    // กรณีสุดท้าย
    return `พื้นที่ที่ ${area.totalMeasurements}`;
  }
  
  return area.areaName;
}
  private getAreaName(areaId: string, measurements: Measurement[]): string {
  if (areaId === 'no-area') {
    return 'ไม่มีการกำหนดพื้นที่';
  }

  const firstMeasurement = measurements[0];
  
  // ใช้ชื่อที่ประมวลผลแล้ว
  if (firstMeasurement && firstMeasurement['derivedAreaName']) {
    return firstMeasurement['derivedAreaName'];
  }

  // Fallback: สร้างชื่อจาก areaId
  if (areaId.includes('_')) {
    const parts = areaId.split('_');
    const lastPart = parts[parts.length - 1];
    return `พื้นที่ ${lastPart}`;
  }

  return `พื้นที่ ${areaId.substring(0, 8)}`;
}
  onDeviceChange() {
    localStorage.setItem('selectedDevice', this.deviceId);
    this.loadHistory();
    this.showAreaDetails = false;
    this.selectedArea = null;
  }

  viewAreaDetails(area: AreaGroup) {
    this.selectedArea = area;
    this.showAreaDetails = true;
  }

  viewMeasurementDetail(item: Measurement) {
    const measurementData = {
      ...item,
      deviceId: this.deviceId
    };
    localStorage.setItem('selectedMeasurement', JSON.stringify(measurementData));
    this.router.navigate(['/history-detail']);
  }

  backToAreaList() {
    this.showAreaDetails = false;
    this.selectedArea = null;
  }

  showAreaStatistics(area: AreaGroup) {
    const stats = area.averages;
    const message = `สถิติพื้นที่: ${area.areaName}
จำนวนจุดวัด: ${area.totalMeasurements} จุด
วันที่วัดล่าสุด: ${area.lastMeasurementDate}

ค่าเฉลี่ย:
• อุณหภูมิ: ${stats.temperature}°C
• ความชื้น: ${stats.moisture}%
• ไนโตรเจน: ${stats.nitrogen} mg/kg
• ฟอสฟอรัส: ${stats.phosphorus} mg/kg
• โพแทสเซียม: ${stats.potassium} mg/kg
• ค่า pH: ${stats.ph}`;

    alert(message);
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