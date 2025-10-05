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
import { Map, Marker, config, LngLatBounds, Popup } from '@maptiler/sdk';
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
  areasid?: string;
  measurementPoint?: number;
  lat?: number;
  lng?: number;
  [key: string]: any;
}
interface AreaGroup {
  areasid: string;
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
  userData: any = null;
  deviceData: any = null;
  areas: AreaGroup[] = [];
  areaGroups: AreaGroup[] = [];
  selectedArea: AreaGroup | null = null;
  showAreaDetails = false;
  isLoading = true;
  showCardMenu = false;
  map: Map | undefined;
  markers: any[] = [];
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
        // ดึงข้อมูล user และ device จาก backend with debounce
        setTimeout(() => this.loadUserAndDeviceData(), 50);
      } else {
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
      // ✅ โหลดแค่ areas ที่เป็นจุดหลักๆ ตาม device ที่เลือก
      await this.loadAreas();
    }
  }
  async loadUserAndDeviceData() {
    if (!this.currentUser) return;
    
    // Check cache first for better performance
    const cacheKey = `user_data_${this.userEmail}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const data = JSON.parse(cachedData);
        if (Date.now() - data.timestamp < 300000) { // 5 minutes cache
          this.userData = data.userData;
          this.deviceData = data.deviceData;
          this.loadAreas();
          return;
        }
      } catch (e) {
        // Cache invalid, continue with API call
      }
    }
    
    try {
      // ดึงข้อมูล user และ device จาก backend
      const token = await this.currentUser.getIdToken();
      // ดึงข้อมูล user จาก PostgreSQL
      let userDataFound = false;
      const userEndpoints = [
        '/api/auth/me',
        '/api/user/profile',
        '/api/user/me',
        '/api/profile'
      ];
      for (const endpoint of userEndpoints) {
        try {
          const userResponse = await lastValueFrom(
            this.http.get<any>(`${this.apiUrl}${endpoint}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
          );
          let userData = userResponse;
          if (userResponse.user) {
            userData = userResponse.user;
          }
          if (userData && (userData.user_name || userData.username)) {
            // ✅ ตั้งค่า username และ userName จาก PostgreSQL
            this.username = userData.user_name || userData.username || this.username;
            this.userName = userData.user_name || userData.username || this.userName;
            this.userEmail = userData.user_email || userData.email || this.userEmail;
            userDataFound = true;
            break; // หยุดเมื่อเจอ endpoint ที่ทำงานได้
          }
        } catch (userError: any) {
          // User endpoint failed
          continue; // ลอง endpoint ถัดไป
        }
      }
      if (!userDataFound) {
        // ✅ ถ้าไม่สามารถดึงข้อมูลจาก backend ได้ ให้ใช้ข้อมูลจาก Firebase
        this.username = this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'ไม่ระบุ';
        this.userName = this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'ไม่ระบุ';
        this.userEmail = this.currentUser.email || 'ไม่ระบุ';
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
        }
      } catch (deviceError) {
      }
      // Cache the data for better performance
      localStorage.setItem(cacheKey, JSON.stringify({
        userData: this.userData,
        deviceData: this.deviceData,
        timestamp: Date.now()
      }));
      
      // ดึงข้อมูล areas หลังจากได้ token แล้ว
      await this.loadAreas();
      // ✅ ไม่ต้องดึง measurements ทีละจุดแล้ว เพราะ areas API มีข้อมูลครบถ้วนแล้ว
    } catch (error) {
      console.error('❌ Error loading user and device data:', error);
    }
  }
  async loadAreas() {
    if (!this.currentUser) {
      return;
    }
    
    // Check cache for areas data
    const areasCacheKey = `areas_data_${this.userEmail}`;
    const cachedAreas = localStorage.getItem(areasCacheKey);
    if (cachedAreas) {
      try {
        const data = JSON.parse(cachedAreas);
        if (Date.now() - data.timestamp < 600000) { // 10 minutes cache
          this.areas = data.areas;
          this.areaGroups = data.areaGroups;
          this.isLoading = false;
          return;
        }
      } catch (e) {
        // Cache invalid, continue with API call
      }
    }
    
    this.isLoading = true;
    try {
      const token = await this.currentUser.getIdToken();
      
      // ✅ ดึงข้อมูล areas ก่อน
      let areasApiUrl = `${this.apiUrl}/api/measurements/areas/with-measurements`;
      if (this.deviceId) {
        const actualDeviceId = this.deviceMap[this.deviceId] || this.deviceId;
        areasApiUrl += `?deviceid=${actualDeviceId}`;
      }
      
      const areasResponse = await lastValueFrom(
        this.http.get<any[]>(areasApiUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );

      if (areasResponse && Array.isArray(areasResponse)) {
        // ✅ ดึงข้อมูล measurements ทั้งหมดจาก measurement table
        const measurementsResponse = await lastValueFrom(
          this.http.get<any[]>(`${this.apiUrl}/api/measurements`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );
        
        // All measurements loaded from API
        
        // Debug: ดูข้อมูล measurements ที่มี lat/lng
        const measurementsWithCoords = measurementsResponse.filter(m => m.lat && m.lng);
        // Measurements with coordinates processed
        
        // Debug: ดูข้อมูล measurements ที่มี lat/lng และไม่เป็น 0
        const measurementsWithValidCoords = measurementsResponse.filter(m => {
          const lat = parseFloat(String(m.lat || '0'));
          const lng = parseFloat(String(m.lng || '0'));
          return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
        });
        // Valid measurements with coordinates processed

        // แปลงข้อมูลจาก Areas API เป็น format ที่ต้องการ
        const areaGroups: AreaGroup[] = areasResponse.map(area => {
          const areasid = area.areasid?.toString() || area.id?.toString() || '';
          
          // ✅ กรอง measurements ที่มี areasid เดียวกันจาก measurement table
          const areaMeasurements = measurementsResponse.filter(measurement => 
            measurement.areasid && measurement.areasid.toString() === areasid
          );

          // Area measurements from DB processed
          
          // Debug: ดูข้อมูล measurements ที่มี lat/lng สำหรับ area นี้
          const areaMeasurementsWithCoords = areaMeasurements.filter(m => m.lat && m.lng);
          // Area measurements with coordinates processed
          
          // Debug: ดูข้อมูล measurements ที่มี lat/lng และไม่เป็น 0 สำหรับ area นี้
          const areaMeasurementsWithValidCoords = areaMeasurements.filter(m => {
            const lat = parseFloat(String(m.lat || '0'));
            const lng = parseFloat(String(m.lng || '0'));
            return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
          });
          // Area measurements with valid coordinates processed

          // ✅ คำนวณขนาดพื้นที่จาก polygon bounds
          const areaSize = this.calculateAreaFromBounds(area.polygon_bounds || []);
          const areaSizeFormatted = this.formatAreaToThaiUnits(areaSize);
          
          // ✅ ใช้ค่าเฉลี่ยจาก backend แทนการคำนวณใหม่
          const averages = {
            temperature: parseFloat(area.temperature_avg) || 0,
            moisture: parseFloat(area.moisture_avg) || 0,
            nitrogen: parseFloat(area.nitrogen_avg) || 0,
            phosphorus: parseFloat(area.phosphorus_avg) || 0,
            potassium: parseFloat(area.potassium_avg) || 0,
            ph: parseFloat(area.ph_avg) || 0
          };
          
          // Area backend data processed
          
          return {
            areasid: areasid,
            areaName: area.area_name || 'ไม่ระบุพื้นที่',
            measurements: areaMeasurements,
            totalMeasurements: areaMeasurements.length,
            averages: averages,
            lastMeasurementDate: areaMeasurements.length > 0 
              ? areaMeasurements[0].createdAt || areaMeasurements[0].date || area.created_at || ''
              : area.created_at || ''
          };
        });
        
        this.areas = areaGroups;
        this.areaGroups = areaGroups;
        
        // Cache the areas data for better performance
        localStorage.setItem(areasCacheKey, JSON.stringify({
          areas: areaGroups,
          areaGroups: areaGroups,
          timestamp: Date.now()
        }));
        
        this.isLoading = false;
        
        // Areas with measurements loaded
        
        if (areaGroups.length === 0) {
          this.notificationService.showNotification(
            'info',
            'ไม่มีข้อมูล',
            'ยังไม่มีข้อมูลการวัดค่าในระบบ'
          );
        }
      } else {
        this.areas = [];
        this.areaGroups = [];
        this.isLoading = false;
        this.notificationService.showNotification(
          'info',
          'ไม่มีข้อมูล',
          'ยังไม่มีข้อมูลการวัดค่าในระบบ'
        );
      }
    } catch (error: any) {
      console.error('❌ Error loading areas:', error);
      this.isLoading = false;
      if (error.status === 401) {
        this.notificationService.showNotification(
          'error',
          'หมดอายุการเข้าสู่ระบบ',
          'กรุณาเข้าสู่ระบบใหม่'
        );
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
          areasid: area.id || area.areasid || '',
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

  // ✅ ฟังก์ชันสำหรับ format ตัวเลข
  formatNumber(value: number, decimals: number = 2): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00';
    }
    return value.toFixed(decimals);
  }
  viewAreaDetails(area: AreaGroup) {
    this.selectedArea = area;
    this.showAreaDetails = true;
    // แสดงแผนที่หลังจาก DOM อัปเดต
    setTimeout(() => {
      this.showMapInAreaDetails();
    }, 200);
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
      • อุณหภูมิ: ${this.formatNumber(stats.temperature)}°C
      • ความชื้น: ${this.formatNumber(stats.moisture)}%
      • ไนโตรเจน: ${this.formatNumber(stats.nitrogen)} mg/kg
      • ฟอสฟอรัส: ${this.formatNumber(stats.phosphorus)} mg/kg
      • โพแทสเซียม: ${this.formatNumber(stats.potassium)} mg/kg
      • ค่า pH: ${this.formatNumber(stats.ph, 1)}`;
    this.notificationService.showNotification('info', 'ข้อมูล', message);
  }
  viewMeasurementDetail(measurement: Measurement) {
    // ใช้ device_id จริงสำหรับการส่งข้อมูล
    const actualDeviceId = this.deviceMap[this.deviceId || ''] || this.deviceId;
    const measurementData = { 
      ...measurement, 
      deviceId: actualDeviceId,
      areasid: measurement.areasid || this.selectedArea?.areasid
    };
    // แสดงข้อมูลการวัดในรูปแบบ popup หรือ modal
    const detailMessage = `
จุดที่: ${measurement.measurementPoint || 'ไม่ระบุ'}
วันที่: ${new Date(measurement.date).toLocaleDateString('th-TH')}
เวลา: ${new Date(measurement.date).toLocaleTimeString('th-TH')}
อุณหภูมิ: ${measurement.temperature}°C
ความชื้น: ${measurement.moisture}%
ไนโตรเจน: ${measurement.nitrogen} ppm
ฟอสฟอรัส: ${measurement.phosphorus} ppm
โพแทสเซียม: ${measurement.potassium} ppm
pH: ${measurement.ph}
พิกัด: ${measurement.lat}, ${measurement.lng}
    `.trim();
    this.notificationService.showNotification(
      'info',
      'รายละเอียดการวัด',
      detailMessage
    );
    // บันทึกข้อมูลสำหรับหน้า detail (ถ้าต้องการ)
    localStorage.setItem('selectedMeasurement', JSON.stringify(measurementData));
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
  // ✅ ฟังก์ชันคำแนะนำการปรับปรุงดิน
  recommendSoilImprovement(area: AreaGroup | null): { message: string; fertilizers: any[] } {
    if (!area || !area.averages) {
      return {
        message: 'ไม่สามารถให้คำแนะนำได้ เนื่องจากไม่มีข้อมูลการวัด',
        fertilizers: []
      };
    }
    const { temperature, moisture, nitrogen, phosphorus, potassium, ph } = area.averages;
    // วิเคราะห์สภาพดิน
    let message = '';
    const fertilizers: any[] = [];
    // ตรวจสอบ pH
    if (ph < 6.0) {
      message += 'ดินมีสภาพเป็นกรด (pH ต่ำ) ควรปรับปรุงด้วยปูนขาว ';
      fertilizers.push({
        formula: 'ปูนขาว (CaCO3)',
        amount: '1-2 ตัน/ไร่',
        description: 'ปรับปรุงความเป็นกรด-ด่างของดิน'
      });
    } else if (ph > 7.5) {
      message += 'ดินมีสภาพเป็นด่าง (pH สูง) ควรปรับปรุงด้วยกำมะถัน ';
      fertilizers.push({
        formula: 'กำมะถัน (S)',
        amount: '100-200 กก./ไร่',
        description: 'ลดความเป็นด่างของดิน'
      });
    }
    // ตรวจสอบธาตุอาหาร
    if (nitrogen < 20) {
      message += 'ดินขาดไนโตรเจน ';
      fertilizers.push({
        formula: 'ปุ๋ยยูเรีย (46-0-0)',
        amount: '20-30 กก./ไร่',
        description: 'เพิ่มไนโตรเจนในดิน'
      });
    }
    if (phosphorus < 15) {
      message += 'ดินขาดฟอสฟอรัส ';
      fertilizers.push({
        formula: 'ปุ๋ยฟอสเฟต (0-46-0)',
        amount: '15-25 กก./ไร่',
        description: 'เพิ่มฟอสฟอรัสในดิน'
      });
    }
    if (potassium < 15) {
      message += 'ดินขาดโพแทสเซียม ';
      fertilizers.push({
        formula: 'ปุ๋ยโพแทสเซียม (0-0-60)',
        amount: '10-20 กก./ไร่',
        description: 'เพิ่มโพแทสเซียมในดิน'
      });
    }
    // ตรวจสอบความชื้น
    if (moisture < 40) {
      message += 'ดินมีความชื้นต่ำ ควรเพิ่มการให้น้ำ ';
    } else if (moisture > 80) {
      message += 'ดินมีความชื้นสูง ควรปรับปรุงการระบายน้ำ ';
    }
    if (message === '') {
      message = 'ดินมีสภาพดี เหมาะสำหรับการเพาะปลูก';
    }
    return { message, fertilizers };
  }
  // ✅ ฟังก์ชันแนะนำพืชที่เหมาะสม
  recommendCrops(area: AreaGroup | null): string[] {
    if (!area || !area.averages) {
      return ['ไม่สามารถแนะนำได้ เนื่องจากไม่มีข้อมูลการวัด'];
    }
    const { temperature, moisture, nitrogen, phosphorus, potassium, ph } = area.averages;
    const crops: string[] = [];
    // วิเคราะห์ตามสภาพดิน
    if (ph >= 6.0 && ph <= 7.5) {
      if (moisture >= 50 && moisture <= 80) {
        if (temperature >= 20 && temperature <= 35) {
          crops.push('ข้าว', 'ข้าวโพด', 'อ้อย');
        }
        if (nitrogen >= 20 && phosphorus >= 15) {
          crops.push('ถั่วเหลือง', 'ถั่วลิสง');
        }
        if (potassium >= 15) {
          crops.push('มันสำปะหลัง', 'ยางพารา');
        }
      }
    }
    // เพิ่มพืชที่เหมาะสมตามสภาพทั่วไป
    if (crops.length === 0) {
      crops.push('พืชผักสวนครัว', 'ไม้ดอกไม้ประดับ');
    }
    return crops;
  }
  // ✅ ฟังก์ชันแสดงแผนที่ในรายละเอียดพื้นที่
  showMapInAreaDetails() {
    if (!this.selectedArea || !this.selectedArea.measurements.length) {
      return;
    }
    
    // ใช้ setTimeout เพื่อให้ DOM อัปเดตก่อน
    setTimeout(() => {
      const mapContainer = document.querySelector('#mapContainer') as HTMLElement;
      if (!mapContainer) {
        // Map container not found
        return;
      }
      
      // ล้างแผนที่เก่า (ถ้ามี)
      mapContainer.innerHTML = '';
      
      // Creating MapTiler map
      
      // Processing measurements for map
      
      // Debug: ดูข้อมูล measurements ที่มี lat/lng
      const measurementsWithCoords = this.selectedArea!.measurements.filter(m => m.lat && m.lng);
      // Measurements with coordinates processed for map
      
      // Debug: ดูข้อมูล measurements ที่มี lat/lng และไม่เป็น 0
      const measurementsWithValidCoords = this.selectedArea!.measurements.filter(m => {
        const lat = parseFloat(String(m.lat || '0'));
        const lng = parseFloat(String(m.lng || '0'));
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });
      // Valid measurements with coordinates processed
      
      // คำนวณจุดกึ่งกลางของพื้นที่
      const validMeasurements = this.selectedArea!.measurements.filter(m => {
        const lat = parseFloat(String(m.lat || '0'));
        const lng = parseFloat(String(m.lng || '0'));
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });
      
      // Valid measurements found for map
      
      // Measurements being sent to map
      
      if (validMeasurements.length === 0) {
        // No valid measurements with coordinates
        this.showSimpleMap(mapContainer);
        return;
      }
      
      const centerLat = validMeasurements.reduce((sum, m) => sum + parseFloat(String(m.lat || '0')), 0) / validMeasurements.length;
      const centerLng = validMeasurements.reduce((sum, m) => sum + parseFloat(String(m.lng || '0')), 0) / validMeasurements.length;
      
      // Map center calculated
      
      // สร้างแผนที่แบบ MapTiler SDK - ใช้พิกัดจากหน้า measurement
      this.map = new Map({
        container: mapContainer,
        style: `https://api.maptiler.com/maps/satellite/style.json?key=${environment.mapTilerApiKey}`,
        center: [103.2501379, 16.2464504], // ✅ ใช้พิกัดจากหน้า measurement (คณะวิทยาการสารสนเทศ มหาวิทยาลัยมหาสารคาม)
        zoom: 17, // ✅ ขยายให้เห็นรายละเอียดของคณะ
        pitch: 0,
        bearing: 0
      });
      
      const bounds = new LngLatBounds();
      let hasPoint = false;
      
      // สร้าง markers สำหรับแต่ละจุดวัด
      const markers: any[] = [];
      validMeasurements.forEach((measurement, index) => {
        // ✅ ใช้พิกัดจริงจาก database แทนพิกัดปลอม
        const lat = parseFloat(String(measurement.lat || '0'));
        const lng = parseFloat(String(measurement.lng || '0'));
        
        // Processing measurement for marker
        
        // ✅ ตรวจสอบพิกัดจริงจาก database
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          // สร้าง marker แบบ MapTiler SDK
          const marker = new Marker({ 
            color: '#4ecdc4',
            scale: 1.2
          }).setLngLat([lng, lat]).addTo(this.map!);
          
          // Marker created
          
          // เพิ่ม popup แบบเรียบง่าย - Simple Clean Design
          marker.setPopup(new Popup({
            offset: [0, -15],
            closeButton: true,
            closeOnClick: false,
            maxWidth: '300px',
            className: 'simple-popup'
          }).setHTML(`
              <div style="font-family: Arial, sans-serif; padding: 10px;">
                <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px;">
                  จุดวัดที่ ${measurement.measurementPoint || index + 1}
                </div>
                
                <div style="font-size: 11px; line-height: 1.6;">
                  <div>อุณหภูมิ: ${this.formatNumber(parseFloat(String(measurement.temperature || '0')) || 0)}°C</div>
                  <div>ความชื้น: ${this.formatNumber(parseFloat(String(measurement.moisture || '0')) || 0)}%</div>
                  <div>pH: ${this.formatNumber(parseFloat(String(measurement.ph || '0')) || 0, 1)}</div>
                  <div>ไนโตรเจน: ${this.formatNumber(parseFloat(String(measurement.nitrogen || '0')) || 0)}</div>
                  <div>ฟอสฟอรัส: ${this.formatNumber(parseFloat(String(measurement.phosphorus || '0')) || 0)}</div>
                  <div>โพแทสเซียม: ${this.formatNumber(parseFloat(String(measurement.potassium || '0')) || 0)}</div>
                  
                  <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd;">
                    <div>วันที่: ${measurement['measurement_date'] || 'ไม่ระบุ'}</div>
                    <div>เวลา: ${measurement['measurement_time'] || 'ไม่ระบุ'}</div>
                    <div style="font-size: 10px; color: #666; margin-top: 4px;">
                      ${lat.toFixed(6)}, ${lng.toFixed(6)}
                    </div>
                  </div>
                </div>
              </div>
            `));
          
          bounds.extend([lng, lat]);
          hasPoint = true;
          markers.push(marker);
          // Marker added to map
        }
      });
      
      // เก็บ reference ของ markers
      this.markers = markers;
      
      this.map.once('load', () => {
        if (hasPoint) {
        // Map bounds calculated
          this.map!.fitBounds(bounds, { padding: 40, maxZoom: 17, duration: 0 });
        }
      });
      
      // MapTiler map initialized
        // Map bounds calculated
      
    }, 100);
  }
  // ✅ ฟังก์ชันแสดงแผนที่แบบง่าย (เมื่อไม่มี Leaflet)
  showSimpleMap(container: HTMLElement) {
    const measurements = this.selectedArea!.measurements;
    let mapHtml = '<div style="background: #f0f0f0; padding: 20px; border-radius: 8px;">';
    mapHtml += '<h4>จุดวัดในพื้นที่</h4>';
    measurements.forEach((measurement, index) => {
      if (measurement.lat && measurement.lng) {
        mapHtml += `
          <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 5px; border-left: 4px solid #4CAF50;">
            <strong>จุดที่ ${measurement.measurementPoint || index + 1}</strong><br>
            <small>พิกัด: ${measurement.lat}, ${measurement.lng}</small><br>
            <small>วันที่: ${new Date(measurement.date).toLocaleDateString('th-TH')}</small>
          </div>
        `;
      }
    });
    mapHtml += '</div>';
    container.innerHTML = mapHtml;
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


  // ✅ คำนวณค่าเฉลี่ยจาก measurements จริง
  calculateAveragesFromMeasurements(measurements: any[]): {
    temperature: number;
    moisture: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    ph: number;
  } {
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

    const totals = measurements.reduce((acc, measurement) => ({
      temperature: acc.temperature + (measurement.temperature || 0),
      moisture: acc.moisture + (measurement.moisture || 0),
      nitrogen: acc.nitrogen + (measurement.nitrogen || 0),
      phosphorus: acc.phosphorus + (measurement.phosphorus || 0),
      potassium: acc.potassium + (measurement.potassium || 0),
      ph: acc.ph + (measurement.ph || 0)
    }), { temperature: 0, moisture: 0, nitrogen: 0, phosphorus: 0, potassium: 0, ph: 0 });

    const count = measurements.length;
    return {
      temperature: totals.temperature / count,
      moisture: totals.moisture / count,
      nitrogen: totals.nitrogen / count,
      phosphorus: totals.phosphorus / count,
      potassium: totals.potassium / count,
      ph: totals.ph / count
    };
  }

  // ✅ แสดงช่วง Measurement ID
  getMeasurementIdRange(area: AreaGroup): string {
    if (!area.measurements || area.measurements.length === 0) {
      return 'ไม่มีข้อมูล';
    }

    const measurementIds = area.measurements
      .map(m => m['measurementid'] || m['id'])
      .filter(id => id != null && id !== 'null' && id !== 'undefined' && id !== '')
      .sort((a, b) => Number(a) - Number(b));

    // Area measurements processed

    if (measurementIds.length === 0) {
      return 'ไม่มี ID';
    }

    if (measurementIds.length === 1) {
      return measurementIds[0].toString();
    }

    const minId = measurementIds[0];
    const maxId = measurementIds[measurementIds.length - 1];
    
    if (minId === maxId) {
      return minId.toString();
    }

    return `${minId}-${maxId}`;
  }
}
