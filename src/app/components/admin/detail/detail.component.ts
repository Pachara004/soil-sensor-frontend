import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Constants } from '../../../config/constants';
import { Map, Marker, LngLatBounds, config } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { environment } from '../../../service/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSpinner } from '@angular/material/progress-spinner';
import { NotificationService } from '../../../service/notification.service';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { lastValueFrom } from 'rxjs';
interface Measurement {
  id: number;
  location: string;
  date: string;
  temperature?: number;
  moisture?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  ph?: number;
  lat?: number;
  lng?: number;
  measurementPoint?: number;
  [key: string]: any;
}
@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSpinner],
  templateUrl: './detail.component.html',
  styleUrl: './detail.component.scss',
})
export class DetailComponent implements OnInit, AfterViewInit, OnDestroy {
  device: any = null;
  measurements: Measurement[] = [];
  isLoading = false;
  map: Map | undefined;
  currentUser: any = null;
  @ViewChild('mapContainer') private mapContainer!: ElementRef<HTMLElement>;
  private apiUrl: string;
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private constants: Constants,
    private notificationService: NotificationService,
    private auth: Auth
  ) {
    config.apiKey = environment.mapTilerApiKey;
    this.apiUrl = this.constants.API_ENDPOINT;
  }
  ngOnInit(): void {
    // ใช้ Firebase Auth
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.loadDeviceData();
      } else {
        this.router.navigate(['/login']);
      }
    });
  }
  async loadDeviceData() {
    // ลองดึง deviceId จาก route parameters ก่อน
    const deviceId = this.route.snapshot.paramMap.get('deviceId');
    if (deviceId) {
      // ดึงข้อมูล device จาก API
      await this.loadDeviceFromAPI(deviceId);
    } else {
      // Fallback: ใช้ localStorage
      const savedDevice = localStorage.getItem('selectedDevice');
      if (savedDevice) {
        this.device = JSON.parse(savedDevice);
        this.loadMeasurements();
      } else {
        this.notificationService.showNotification('error', 'ไม่พบข้อมูล', 'ไม่พบข้อมูลอุปกรณ์', true, 'กลับ', () => {
          this.router.navigate(['/adminmain']);
        });
      }
    }
  }
  async loadDeviceFromAPI(deviceId: string) {
    try {
      const token = await this.currentUser.getIdToken();
      // ดึงข้อมูล device จาก API
      const response = await lastValueFrom(
        this.http.get<any[]>(`${this.apiUrl}/api/devices`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );
      if (response && Array.isArray(response)) {
        // หา device ที่ตรงกับ deviceId
        this.device = response.find(d => d.deviceid?.toString() === deviceId);
        if (this.device) {
          this.loadMeasurements();
        } else {
          this.notificationService.showNotification('error', 'ไม่พบข้อมูล', 'ไม่พบข้อมูลอุปกรณ์', true, 'กลับ', () => {
            this.router.navigate(['/adminmain']);
          });
        }
      }
    } catch (error) {
      console.error('❌ Error loading device from API:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลอุปกรณ์ได้');
    }
  }
  ngAfterViewInit() {
    this.initializeMap();
  }
  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }
  async loadMeasurements() {
    if (!this.device?.deviceid && !this.device?.id) return;
    this.isLoading = true;
    try {
      const deviceId = this.device.deviceid || this.device.id;
      const token = await this.currentUser.getIdToken();
      const response = await lastValueFrom(
        this.http.get<Measurement[]>(`${this.apiUrl}/api/measurements/${deviceId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );
      this.measurements = response || [];
      this.isLoading = false;
      this.initializeMap();
      this.fitMapToBounds();
    } catch (error) {
      console.error('Error loading measurements:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโหลดข้อมูลวัด');
      this.isLoading = false;
    }
  }
  formatDate(dateString: string): string {
    if (!dateString) return 'ไม่ระบุ';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'ไม่ระบุ';
    }
  }
  initializeMap() {
    if (!this.mapContainer) return;
    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: 'streets-v2',
      center: [100.5018, 13.7563], // ค่าเริ่มต้น (กรุงเทพ)
      zoom: 10,
    });
  }
  fitMapToBounds() {
    if (!this.map || this.measurements.length === 0) return;
    const validMeasurements = this.measurements.filter(
      (m) =>
        m.lat !== undefined &&
        m.lng !== undefined &&
        !isNaN(m.lat) &&
        !isNaN(m.lng)
    );
    if (validMeasurements.length === 0) {
      this.mapContainer.nativeElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; color: #666;">
          <p>ไม่พบข้อมูลตำแหน่งของจุดวัด</p>
        </div>
      `;
      return;
    }
    const lats = validMeasurements.map((m) => m.lat!);
    const lngs = validMeasurements.map((m) => m.lng!);
    const bounds = new LngLatBounds(
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)]
    );
    this.map.fitBounds(bounds, { padding: 50, maxZoom: 18 });
  }
  showMeasurementPopup(measurement: Measurement) {
    const details = `จุดที่: ${measurement.measurementPoint || 'ไม่ระบุ'}
วันที่: ${measurement.date}
อุณหภูมิ: ${measurement.temperature}°C
ความชื้น: ${measurement.moisture}%
ไนโตรเจน: ${measurement.nitrogen} mg/kg
ฟอสฟอรัส: ${measurement.phosphorus} mg/kg
โพแทสเซียม: ${measurement.potassium} mg/kg
pH: ${measurement.ph}
พิกัด: ${measurement.lat || 'ไม่ระบุ'}, ${measurement.lng || 'ไม่ระบุ'}`;
    this.notificationService.showNotification('info', 'รายละเอียดการวัด', details);
  }
  goBack() {
    this.router.navigate(['/adminmain']);
  }
}
