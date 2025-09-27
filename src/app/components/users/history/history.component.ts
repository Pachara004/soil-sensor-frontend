import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Map, Marker, config, LngLatBounds } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { environment } from '../../../service/environment';
import { Constants } from '../../../config/constants';
import { NotificationService } from '../../../service/notification.service';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { lastValueFrom } from 'rxjs';

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
  lat?: number;
  lng?: number;
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
  polygonBounds?: [number, number][];
}

interface UserData {
  username: string;
  userID: string;
  name: string;
  email: string;
  phone: string;
  devices?: { [key: string]: boolean };
}

interface FertilizerRecommendation {
  formula: string;
  amount: string;
  description: string;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [FormsModule, CommonModule, MatProgressSpinnerModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit, AfterViewInit, OnDestroy {
  username: string = '';
  userName: string = '';
  userEmail: string = '';
  deviceId: string | null = null;
  devices: string[] = [];
  deviceMap: { [key: string]: string } = {}; // Map device_name to device_id
  areas: AreaGroup[] = [];
  areaGroups: AreaGroup[] = [];
  selectedArea: AreaGroup | null = null;
  showAreaDetails = false;
  isLoading = true;
  showCardMenu = false;
  map: Map | undefined;
  currentUser: any = null;
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLElement>;
  private apiUrl: string;

  constructor(
    private router: Router,
    private location: Location,
    private http: HttpClient,
    private constants: Constants,
    private notificationService: NotificationService,
    private auth: Auth
  ) {
    this.apiUrl = this.constants.API_ENDPOINT;
    config.apiKey = environment.mapTilerApiKey;
  }

  ngOnInit(): void {
    // ใช้ Firebase Auth แทน localStorage
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.username = user.displayName || user.email?.split('@')[0] || '';
        this.userName = user.displayName || user.email?.split('@')[0] || '';
        this.userEmail = user.email || '';
        console.log('✅ User authenticated:', this.username);
        
        // ดึงข้อมูล user และ device จาก backend
        this.loadUserAndDeviceData();
      } else {
        console.log('❌ No user found, redirecting to login');
        this.router.navigate(['/login']);
      }
    });
  }

  ngAfterViewInit() {
    this.initializeMap();
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  async onDeviceChange() {
    if (this.deviceId) {
      console.log('📱 Device changed to:', this.deviceId);
      await this.loadDeviceMeasurements();
    }
  }

  async loadUserAndDeviceData() {
    if (!this.currentUser) return;
    
    try {
      console.log('👤 Loading user and device data...');
      
      // ดึงข้อมูล user และ device จาก backend
      const token = await this.currentUser.getIdToken();
      
      // ดึงข้อมูล user
      try {
        const userResponse = await lastValueFrom(
          this.http.get<any>(`${this.apiUrl}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );
        
        if (userResponse && userResponse.user) {
          const userData = userResponse.user;
          this.username = userData.user_name || userData.username || this.username;
          console.log('👤 User data loaded:', this.username);
        }
      } catch (userError) {
        console.log('⚠️ Could not load user data from backend:', userError);
      }
      
      // ดึงข้อมูล device
      try {
        const devicesResponse = await lastValueFrom(
          this.http.get<any[]>(`${this.apiUrl}/api/devices`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );
        
        if (devicesResponse && devicesResponse.length > 0) {
          this.devices = devicesResponse.map(device => device.device_name || device.deviceid);
          // สร้าง map สำหรับแปลง device_name กลับเป็น device_id
          this.deviceMap = {};
          devicesResponse.forEach(device => {
            const deviceName = device.device_name || device.deviceid;
            this.deviceMap[deviceName] = device.deviceid;
          });
          this.deviceId = this.devices[0] || null;
          console.log('📱 Devices loaded:', this.devices);
          console.log('📱 Device map:', this.deviceMap);
        }
      } catch (deviceError) {
        console.log('⚠️ Could not load devices from backend:', deviceError);
      }
      
      // ดึงข้อมูล areas หลังจากได้ token แล้ว
      await this.loadAreas();
      
      // ถ้ามี deviceId ให้ดึง measurements ของ device นั้นด้วย
      if (this.deviceId) {
        await this.loadDeviceMeasurements();
      }
      
    } catch (error) {
      console.error('❌ Error loading user and device data:', error);
    }
  }

  async loadAreas() {
    if (!this.currentUser) {
      console.log('❌ No current user, cannot load areas');
      return;
    }
    
    this.isLoading = true;
    try {
      const token = await this.currentUser.getIdToken();
      
      // ใช้ endpoint /api/measurements/areas ที่ backend พร้อมแล้ว
      const response = await lastValueFrom(
        this.http.get<{ [key: string]: AreaGroup }>(
          `${this.apiUrl}/api/measurements/areas`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        )
      );
      
      const list = Object.values(response || {}).map((area) => ({
        ...area,
        measurements: area.measurements || [],
      }));
      this.areas = list;
      this.areaGroups = list;
      this.isLoading = false;
      console.log('✅ Areas loaded successfully:', list.length);
      
      if (list.length === 0) {
        this.notificationService.showNotification(
          'info',
          'ไม่มีข้อมูล',
          'ยังไม่มีข้อมูลการวัดค่าในระบบ'
        );
      }
      
    } catch (error: any) {
      console.error('❌ Error loading areas:', error);
      this.isLoading = false;
      
      // ตรวจสอบว่าเป็น 501 Not Implemented หรือ 500 Internal Server Error
      if (error.status === 501 || error.status === 500) {
        console.log('⚠️ API endpoint error, trying alternative endpoint');
        // ลองใช้ endpoint อื่น
        await this.loadAreasAlternative();
      } else if (error.status === 401) {
        console.log('⚠️ Unauthorized, token may be expired');
        this.notificationService.showNotification(
          'error',
          'หมดอายุการเข้าสู่ระบบ',
          'กรุณาเข้าสู่ระบบใหม่'
        );
        // Redirect to login
        this.router.navigate(['/login']);
      } else {
        this.notificationService.showNotification(
          'error',
          'เกิดข้อผิดพลาด',
          'ไม่สามารถโหลดข้อมูลประวัติการวัดได้ กรุณาลองใหม่อีกครั้ง'
        );
      }
    }
  }

  async loadAreasAlternative() {
    try {
      console.log('🔄 Trying alternative endpoint: /api/areas');
      const token = await this.currentUser.getIdToken();
      
      // ลองใช้ endpoint /api/areas
      const response = await lastValueFrom(
        this.http.get<any[]>(
          `${this.apiUrl}/api/areas`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        )
      );
      
      if (response && Array.isArray(response)) {
        // แปลงข้อมูล areas เป็น format ที่ต้องการ
        const areaGroups: AreaGroup[] = response.map(area => ({
          areaId: area.id || area.areaId || '',
          areaName: area.name || area.location || 'ไม่ระบุสถานที่',
          measurements: area.measurements || [],
          totalMeasurements: area.measurements?.length || 0,
          averages: {
            temperature: 0,
            moisture: 0,
            nitrogen: 0,
            phosphorus: 0,
            potassium: 0,
            ph: 0
          },
          lastMeasurementDate: area.measurements?.[0]?.date || ''
        }));
        
        this.areas = areaGroups;
        this.areaGroups = areaGroups;
        console.log('✅ Areas loaded from alternative endpoint:', areaGroups.length);
        
        if (areaGroups.length === 0) {
          this.notificationService.showNotification(
            'info',
            'ยังไม่มีข้อมูล',
            'ยังไม่มีข้อมูลการวัดค่าในระบบ'
          );
        }
      } else {
        this.areas = [];
        this.areaGroups = [];
        this.notificationService.showNotification(
          'info',
          'ยังไม่มีข้อมูล',
          'ยังไม่มีข้อมูลการวัดค่าในระบบ'
        );
      }
      
    } catch (altError: any) {
      console.error('❌ Alternative endpoint also failed:', altError);
      
      if (altError.status === 401) {
        console.log('⚠️ Unauthorized in alternative endpoint, token may be expired');
        this.notificationService.showNotification(
          'error',
          'หมดอายุการเข้าสู่ระบบ',
          'กรุณาเข้าสู่ระบบใหม่'
        );
        // Redirect to login
        this.router.navigate(['/login']);
      } else {
        this.areas = [];
        this.areaGroups = [];
        this.notificationService.showNotification(
          'info',
          'ยังไม่มีข้อมูล',
          'ยังไม่มีข้อมูลการวัดค่าในระบบ'
        );
      }
    }
  }

  async loadDeviceMeasurements() {
    if (!this.currentUser || !this.deviceId) return;
    
    try {
      // แปลง device_name กลับเป็น device_id สำหรับ API call
      const actualDeviceId = this.deviceMap[this.deviceId] || this.deviceId;
      console.log('📱 Loading measurements for device:', this.deviceId, '->', actualDeviceId);
      const token = await this.currentUser.getIdToken();
      
      const response = await lastValueFrom(
        this.http.get<Measurement[]>(
          `${this.apiUrl}/api/measurements/${actualDeviceId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        )
      );
      
      if (response && Array.isArray(response)) {
        console.log('✅ Device measurements loaded:', response.length);
        
        // จัดกลุ่ม measurements ตาม location
        const areaMap: { [key: string]: AreaGroup } = {};
        
        response.forEach((measurement) => {
          const location = measurement.location || 'ไม่ระบุสถานที่';
          
          if (!areaMap[location]) {
            areaMap[location] = {
              areaId: measurement.areaId || '',
              areaName: location,
              measurements: [],
              totalMeasurements: 0,
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
          }
          
          const area = areaMap[location];
          area.measurements.push(measurement);
          area.totalMeasurements = area.measurements.length;
          
          // หาการวัดล่าสุด
          if (!area.lastMeasurementDate || new Date(measurement.date) > new Date(area.lastMeasurementDate)) {
            area.lastMeasurementDate = measurement.date;
          }
        });
        
        const deviceAreas: AreaGroup[] = Object.values(areaMap);
        
        // รวมกับ areas ที่มีอยู่แล้ว
        this.areas = [...this.areas, ...deviceAreas];
        this.areaGroups = this.areas;
        
        console.log('✅ Total areas after adding device measurements:', this.areas.length);
      }
      
    } catch (error: any) {
      console.error('❌ Error loading device measurements:', error);
      
      if (error.status === 401) {
        console.log('⚠️ Unauthorized in device measurements, token may be expired');
        this.notificationService.showNotification(
          'error',
          'หมดอายุการเข้าสู่ระบบ',
          'กรุณาเข้าสู่ระบบใหม่'
        );
        // Redirect to login
        this.router.navigate(['/login']);
      }
    }
  }

  initializeMap() {
    if (!this.mapContainer || !this.selectedArea) return;
    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: 'streets-v2',
      center: [100.5018, 13.7563],
      zoom: 10,
    });

    if (this.selectedArea.measurements.length > 0) {
      this.selectedArea.measurements.forEach((m) => {
        if (m.lat && m.lng) {
          new Marker({ color: '#FF0000' })
            .setLngLat([m.lng, m.lat])
            .addTo(this.map!);
        }
      });
    }
  }

  getDisplayAreaName(area: AreaGroup): string {
    return area.areaName || 'ไม่ระบุพื้นที่';
  }

  viewAreaDetails(area: AreaGroup) {
    this.selectedArea = area;
    this.showAreaDetails = true;
    this.initializeMap();
    this.fitMapToBounds();
  }

  fitMapToBounds() {
    if (
      !this.map ||
      !this.selectedArea ||
      this.selectedArea.measurements.length === 0
    )
      return;

    const validMeasurements = this.selectedArea.measurements.filter(
      (m) => m.lat !== undefined && m.lng !== undefined && !isNaN(m.lat!) && !isNaN(m.lng!)
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
    this.notificationService.showNotification('info', 'ข้อมูล', message);
  }

  viewMeasurementDetail(item: Measurement) {
    // ใช้ device_id จริงสำหรับการส่งข้อมูล
    const actualDeviceId = this.deviceMap[this.deviceId || ''] || this.deviceId;
    const measurementData = { ...item, deviceId: actualDeviceId };
    localStorage.setItem('selectedMeasurement', JSON.stringify(measurementData));
    this.router.navigate(['/history-detail']);
  }

  backToAreaList() {
    this.showAreaDetails = false;
    this.selectedArea = null;
    if (this.map) {
      this.map.remove();
      this.map = undefined;
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

  toggleCardMenu() {
    this.showCardMenu = !this.showCardMenu;
  }

  closeCardMenu() {
    this.showCardMenu = false;
  }

  // ปิด menu เมื่อคลิกข้างนอก
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (!(event.target as Element).closest('.card-menu')) {
      this.closeCardMenu();
    }
  }
}
