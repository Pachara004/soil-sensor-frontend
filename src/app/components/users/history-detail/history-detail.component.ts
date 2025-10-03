import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { environment } from '../../../service/environment'; // นำเข้า environment
import { NotificationService } from '../../../service/notification.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { Constants } from '../../../config/constants';
import { Map, Marker, config, LngLatBounds, Popup } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

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
  lat?: number;
  lng?: number;
  areasid?: string;
  [key: string]: any;
}

interface MeasurementPoint {
  id: string;
  areasid: string;
  deviceId: string;
  temperature: number;
  moisture: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  lat: number;
  lng: number;
  measurementPoint: number;
  createdAt: string;
  updatedAt: string;
  date?: string; // เพิ่ม property date
}

interface AreaSummary {
  areasid: string;
  areaName: string;
  totalPoints: number;
  areaSize: number;
  areaSizeFormatted: string;
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

interface FertilizerRecommendation {
  formula: string;
  amount: string;
  description: string;
}

@Component({
  selector: 'app-history-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-detail.component.html',
  styleUrl: './history-detail.component.scss',
})
export class HistoryDetailComponent implements OnInit, AfterViewInit, OnDestroy {
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

  // ข้อมูลจุดวัดทั้งหมด
  measurementPoints: MeasurementPoint[] = [];
  selectedPoint: MeasurementPoint | null = null;
  showPointDetail = false;
  loading = false;
  areasid: string = '';
  
  // ข้อมูลสรุปพื้นที่
  areaSummary: AreaSummary | null = null;
  
  // แผนที่
  map: Map | undefined;
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLElement>;
  measurementMarkers: any[] = [];

  private apiUrl: string;

  constructor(
    private location: Location, 
    private router: Router,
    private notificationService: NotificationService,
    private http: HttpClient,
    private auth: Auth,
    private constants: Constants
  ) {
    this.apiUrl = this.constants.API_ENDPOINT;
    config.apiKey = environment.mapTilerApiKey;
  }

  ngOnInit() {
    this.loadMeasurementData();
    this.loadAreaSummary();
    this.loadMeasurementPoints();
  }
  
  ngAfterViewInit() {
    // รอให้ข้อมูลโหลดเสร็จก่อนสร้างแผนที่
    setTimeout(() => {
      this.initializeMap();
    }, 1000);
  }
  
  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
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

    // เก็บ areasid สำหรับโหลดจุดวัด
    this.areasid = data.areasid || '';
  }

  // โหลดข้อมูลสรุปพื้นที่
  async loadAreaSummary() {
    if (!this.areasid) {
      return;
    }

    try {
      const headers = await this.getAuthHeaders();
      
      const response = await lastValueFrom(
        this.http.get<any>(`${this.apiUrl}/api/measurements/areas/with-measurements?areasid=${this.areasid}`, { headers })
      );

      if (response && Array.isArray(response) && response.length > 0) {
        const areaData = response[0];
        this.areaSummary = {
          areasid: areaData.areasid?.toString() || areaData.id?.toString() || '',
          areaName: areaData.area_name || 'ไม่ระบุพื้นที่',
          totalPoints: areaData.totalmeasurement || areaData.measurements?.length || 0,
          areaSize: this.calculateAreaFromBounds(areaData.polygon_bounds || []),
          areaSizeFormatted: this.formatAreaToThaiUnits(this.calculateAreaFromBounds(areaData.polygon_bounds || [])),
          averages: {
            temperature: parseFloat(areaData.temperature_avg) || 0,
            moisture: parseFloat(areaData.moisture_avg) || 0,
            nitrogen: parseFloat(areaData.nitrogen_avg) || 0,
            phosphorus: parseFloat(areaData.phosphorus_avg) || 0,
            potassium: parseFloat(areaData.potassium_avg) || 0,
            ph: parseFloat(areaData.ph_avg) || 0
          },
          lastMeasurementDate: areaData.created_at || ''
        };
      }
    } catch (error: any) {
      console.error('Error loading area summary:', error);
      // ถ้าไม่สามารถโหลดข้อมูลสรุปได้ ให้คำนวณจากจุดวัด
      this.calculateSummaryFromPoints();
    }
  }

  // โหลดจุดวัดทั้งหมดของ areas id (measurementid ที่มี areasid เดียวกัน)
  async loadMeasurementPoints() {
    if (!this.areasid) {
      return;
    }

    try {
      this.loading = true;
      const headers = await this.getAuthHeaders();
      
      // ดึงข้อมูล measurements ที่มี areasid เดียวกัน
      const response = await lastValueFrom(
        this.http.get<any>(`${this.apiUrl}/api/measurements?areasid=${this.areasid}`, { headers })
      );

      if (response && Array.isArray(response)) {
        this.measurementPoints = response;
        console.log(`🔍 Loaded ${response.length} measurement points for areasid ${this.areasid}:`, response);
      } else if (response && Array.isArray(response.data)) {
        this.measurementPoints = response.data;
        console.log(`🔍 Loaded ${response.data.length} measurement points from data:`, response.data);
      } else if (response && Array.isArray(response.measurements)) {
        this.measurementPoints = response.measurements;
        console.log(`🔍 Loaded ${response.measurements.length} measurement points from measurements:`, response.measurements);
      } else {
        this.measurementPoints = [];
        console.log('🔍 No measurement points found');
      }

      // กรองเฉพาะ measurements ที่มี areasid เดียวกัน
      this.measurementPoints = this.measurementPoints.filter(point => 
        point.areasid && point.areasid.toString() === this.areasid
      );

      // เรียงลำดับตาม measurementPoint หรือ createdAt
      this.measurementPoints.sort((a, b) => {
        if (a.measurementPoint && b.measurementPoint) {
          return a.measurementPoint - b.measurementPoint;
        }
        return new Date(a.createdAt || a.date || 0).getTime() - new Date(b.createdAt || b.date || 0).getTime();
      });

      console.log(`📊 Loaded ${this.measurementPoints.length} measurement points for areasid: ${this.areasid}`);

      // ถ้ายังไม่มีข้อมูลสรุป ให้คำนวณจากจุดวัด
      if (!this.areaSummary) {
        this.calculateSummaryFromPoints();
      }

    } catch (error: any) {
      console.error('Error loading measurement points:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลจุดวัดได้');
      this.measurementPoints = [];
    } finally {
      this.loading = false;
    }
  }

  // คำนวณข้อมูลสรุปจากจุดวัด
  calculateSummaryFromPoints() {
    if (this.measurementPoints.length === 0) {
      this.areaSummary = {
        areasid: this.areasid,
        areaName: 'ไม่ระบุพื้นที่',
        totalPoints: 0,
        areaSize: 0,
        areaSizeFormatted: '0.00 ไร่',
        averages: {
          temperature: 0,
          moisture: 0,
          nitrogen: 0,
          phosphorus: 0,
          potassium: 0,
          ph: 0
        },
        lastMeasurementDate: ''
      };
      return;
    }

    // คำนวณค่าเฉลี่ย
    const totals = this.measurementPoints.reduce((acc, point) => ({
      temperature: acc.temperature + (point.temperature || 0),
      moisture: acc.moisture + (point.moisture || 0),
      nitrogen: acc.nitrogen + (point.nitrogen || 0),
      phosphorus: acc.phosphorus + (point.phosphorus || 0),
      potassium: acc.potassium + (point.potassium || 0),
      ph: acc.ph + (point.ph || 0)
    }), { temperature: 0, moisture: 0, nitrogen: 0, phosphorus: 0, potassium: 0, ph: 0 });

    const count = this.measurementPoints.length;
    const averages = {
      temperature: totals.temperature / count,
      moisture: totals.moisture / count,
      nitrogen: totals.nitrogen / count,
      phosphorus: totals.phosphorus / count,
      potassium: totals.potassium / count,
      ph: totals.ph / count
    };

    // คำนวณขนาดพื้นที่จากจุดวัด (ประมาณการ)
    const areaSize = this.calculateAreaFromPoints(this.measurementPoints);

    this.areaSummary = {
      areasid: this.areasid,
      areaName: this.measurementData['areaName'] || 'ไม่ระบุพื้นที่',
      totalPoints: count,
      areaSize: areaSize,
      areaSizeFormatted: this.formatAreaToThaiUnits(areaSize),
      averages: averages,
      lastMeasurementDate: this.measurementPoints[0]?.createdAt || ''
    };
  }

  // ฟังก์ชันสำหรับ auth headers
  async getAuthHeaders(): Promise<HttpHeaders> {
    const user = this.auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken();
        return new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        });
      } catch (error) {
        console.error('Error getting auth token:', error);
      }
    }
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  // แสดงรายละเอียดจุดวัด
  showMeasurementPointDetail(point: MeasurementPoint) {
    this.selectedPoint = point;
    this.showPointDetail = true;
  }

  // ปิดรายละเอียดจุดวัด
  closePointDetail() {
    this.selectedPoint = null;
    this.showPointDetail = false;
  }

  // ฟังก์ชันสำหรับแสดงข้อมูลจุดวัด
  getPointDisplayLocation(point: MeasurementPoint): string {
    return `จุดที่ ${point.measurementPoint} (${point.lat.toFixed(6)}, ${point.lng.toFixed(6)})`;
  }

  getPointDate(point: MeasurementPoint): string {
    const date = new Date(point.createdAt);
    return date.toLocaleDateString('th-TH');
  }

  getPointTime(point: MeasurementPoint): string {
    const date = new Date(point.createdAt);
    return date.toLocaleTimeString('th-TH');
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
        this.notificationService.showNotification('success', 'คัดลอกสำเร็จ', 'คัดลอกข้อมูลแล้ว!');
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
  
  // ✅ สร้างแผนที่และแสดงจุดวัด
  initializeMap() {
    if (!this.mapContainer || this.measurementPoints.length === 0) {
      return;
    }
    
    try {
      // สร้างแผนที่
      this.map = new Map({
        container: this.mapContainer.nativeElement,
        style: 'streets-v2',
        center: [100.5018, 13.7563], // กลางประเทศไทย
        zoom: 10,
      });
      
      // เพิ่มจุดวัดทั้งหมด
      this.addMeasurementPointsToMap();
      
      // ปรับ view ให้แสดงทุกจุด
      this.fitMapToBounds();
      
    } catch (error) {
      console.error('Error initializing map:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถสร้างแผนที่ได้');
    }
  }
  
  // ✅ เพิ่มจุดวัดลงแผนที่
  addMeasurementPointsToMap() {
    if (!this.map) return;
    
    // ลบ markers เดิม
    this.measurementMarkers.forEach(marker => marker.remove());
    this.measurementMarkers = [];
    
    // เพิ่ม markers ใหม่
    this.measurementPoints.forEach((point, index) => {
      if (point.lat && point.lng) {
        const marker = new Marker({ color: 'green' }) // สีเขียวตามที่ต้องการ
          .setLngLat([point.lng, point.lat])
          .setPopup(new Popup().setHTML(`
            <div class="measurement-point-popup">
              <h3>จุดวัดที่ ${point.measurementPoint}</h3>
              <div class="measurement-data">
                <p><strong>วันที่:</strong> ${this.getPointDate(point)}</p>
                <p><strong>เวลา:</strong> ${this.getPointTime(point)}</p>
                <p><strong>อุณหภูมิ:</strong> ${point.temperature}°C</p>
                <p><strong>ความชื้น:</strong> ${point.moisture}%</p>
                <p><strong>ไนโตรเจน:</strong> ${point.nitrogen} ppm</p>
                <p><strong>ฟอสฟอรัส:</strong> ${point.phosphorus} ppm</p>
                <p><strong>โพแทสเซียม:</strong> ${point.potassium} ppm</p>
                <p><strong>pH:</strong> ${point.ph}</p>
                <p><strong>พิกัด:</strong> ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}</p>
              </div>
              <button class="view-detail-btn" onclick="window.showPointDetail(${index})">
                ดูรายละเอียด
              </button>
            </div>
          `))
          .addTo(this.map!);
        
        this.measurementMarkers.push(marker);
      }
    });
    
    // เพิ่มฟังก์ชัน global สำหรับปุ่ม
    (window as any).showPointDetail = (index: number) => {
      this.showMeasurementPointDetail(this.measurementPoints[index]);
    };
  }
  
  // ✅ ปรับ view ให้แสดงทุกจุด
  fitMapToBounds() {
    if (!this.map || this.measurementPoints.length === 0) return;
    
    const validPoints = this.measurementPoints.filter(p => p.lat && p.lng);
    if (validPoints.length === 0) return;
    
    const lats = validPoints.map(p => p.lat!);
    const lngs = validPoints.map(p => p.lng!);
    
    const bounds = new LngLatBounds(
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)]
    );
    
    this.map.fitBounds(bounds, { padding: 50, maxZoom: 18 });
  }

  // ✅ คำนวณพื้นที่จากจุดวัด (ประมาณการ)
  calculateAreaFromPoints(points: MeasurementPoint[]): number {
    if (points.length < 3) return 0;
    
    // ใช้ Convex Hull หรือ Bounding Box
    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    // คำนวณพื้นที่จาก Bounding Box
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    
    // แปลงจาก degrees เป็น meters
    const latToMeters = 111000;
    const lngToMeters = 111000 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
    
    const areaInSquareMeters = latDiff * lngDiff * latToMeters * lngToMeters;
    
    // แปลงเป็นไร่ (1 ไร่ = 1,600 ตารางเมตร)
    return areaInSquareMeters / 1600;
  }

  // ✅ คำนวณพื้นที่จาก polygon bounds
  calculateAreaFromBounds(bounds: [number, number][]): number {
    if (bounds.length < 3) return 0;
    
    // ใช้ Shoelace formula
    let area = 0;
    const n = bounds.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += bounds[i][0] * bounds[j][1];
      area -= bounds[j][0] * bounds[i][1];
    }
    area = Math.abs(area) / 2;
    
    // แปลงจาก degrees เป็น meters
    const latToMeters = 111000;
    const lngToMeters = 111000 * Math.cos(bounds[0][1] * Math.PI / 180);
    const areaInSquareMeters = area * latToMeters * lngToMeters;
    
    // แปลงเป็นไร่ (1 ไร่ = 1,600 ตารางเมตร)
    return areaInSquareMeters / 1600;
  }
  
  // ✅ แปลงพื้นที่เป็นหน่วยไทย
  formatAreaToThaiUnits(areaInRai: number): string {
    if (areaInRai === 0) return '0.00 ไร่';
    
    const rai = Math.floor(areaInRai);
    const remainingArea = (areaInRai - rai) * 1600;
    const ngan = Math.floor(remainingArea / 400);
    const remainingAfterNgan = remainingArea % 400;
    const squareWa = Math.floor(remainingAfterNgan / 4);
    const squareMeters = Math.round(remainingAfterNgan % 4);
    
    let result = '';
    if (rai > 0) result += `${rai} ไร่`;
    if (ngan > 0) result += (result ? ' ' : '') + `${ngan} งาน`;
    if (squareWa > 0) result += (result ? ' ' : '') + `${squareWa} ตารางวา`;
    if (squareMeters > 0) result += (result ? ' ' : '') + `${squareMeters} ตารางเมตร`;
    
    return result || '0.00 ไร่';
  }

  // ✅ ฟังก์ชันสำหรับ format ตัวเลข
  formatNumber(value: number, decimals: number = 2): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00';
    }
    return value.toFixed(decimals);
  }
}
