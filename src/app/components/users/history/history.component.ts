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
          console.log(`🔍 Trying user endpoint: ${endpoint}`);
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
            console.log(`✅ User data loaded from PostgreSQL ${endpoint}:`, {
              username: this.username,
              userName: this.userName,
              userEmail: this.userEmail
            });
            userDataFound = true;
            break; // หยุดเมื่อเจอ endpoint ที่ทำงานได้
          }
        } catch (userError: any) {
          console.log(`❌ User endpoint ${endpoint} failed:`, userError.status);
          continue; // ลอง endpoint ถัดไป
        }
      }

      if (!userDataFound) {
        console.log('⚠️ No PostgreSQL user data found, using Firebase data');
        // ✅ ถ้าไม่สามารถดึงข้อมูลจาก backend ได้ ให้ใช้ข้อมูลจาก Firebase
        this.username = this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'ไม่ระบุ';
        this.userName = this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'ไม่ระบุ';
        this.userEmail = this.currentUser.email || 'ไม่ระบุ';
        console.log('👤 Using Firebase data as fallback:', {
          username: this.username,
          userName: this.userName,
          userEmail: this.userEmail
        });
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
      
      // ✅ ใช้ Areas API พร้อม deviceid parameter
      let apiUrl = `${this.apiUrl}/api/measurements/areas/with-measurements`;
      
      // ถ้ามี deviceId ให้เพิ่ม parameter
      if (this.deviceId) {
        const actualDeviceId = this.deviceMap[this.deviceId] || this.deviceId;
        apiUrl += `?deviceid=${actualDeviceId}`;
        console.log('📱 Loading areas for device:', this.deviceId, '->', actualDeviceId);
      } else {
        console.log('📱 Loading all areas (no device filter)');
      }
      
      const response = await lastValueFrom(
        this.http.get<any[]>(
          apiUrl,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        )
      );
      
      if (response && Array.isArray(response)) {
        // แปลงข้อมูลจาก Areas API เป็น format ที่ต้องการ
        const areaGroups: AreaGroup[] = response.map(area => ({
          areaId: area.areasid?.toString() || area.id?.toString() || '',
          areaName: area.area_name || 'ไม่ระบุพื้นที่',
          measurements: area.measurements || [],
          totalMeasurements: area.totalmeasurement || area.measurements?.length || 0,
          averages: {
            temperature: parseFloat(area.temperature_avg) || 0,
            moisture: parseFloat(area.moisture_avg) || 0,
            nitrogen: parseFloat(area.nitrogen_avg) || 0,
            phosphorus: parseFloat(area.phosphorus_avg) || 0,
            potassium: parseFloat(area.potassium_avg) || 0,
            ph: parseFloat(area.ph_avg) || 0
          },
          lastMeasurementDate: area.created_at || ''
        }));
        
        this.areas = areaGroups;
        this.areaGroups = areaGroups;
        this.isLoading = false;
        console.log('✅ Areas loaded from Areas API:', areaGroups.length);
        console.log('📊 Areas data:', areaGroups);
        
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
        console.log('⚠️ Unauthorized, token may be expired');
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
        
        // คำนวณค่าเฉลี่ยสำหรับแต่ละ area
        Object.values(areaMap).forEach(area => {
          if (area.measurements.length > 0) {
            const measurements = area.measurements;
            area.averages = {
              temperature: measurements.reduce((sum, m) => sum + (m.temperature || 0), 0) / measurements.length,
              moisture: measurements.reduce((sum, m) => sum + (m.moisture || 0), 0) / measurements.length,
              nitrogen: measurements.reduce((sum, m) => sum + (m.nitrogen || 0), 0) / measurements.length,
              phosphorus: measurements.reduce((sum, m) => sum + (m.phosphorus || 0), 0) / measurements.length,
              potassium: measurements.reduce((sum, m) => sum + (m.potassium || 0), 0) / measurements.length,
              ph: measurements.reduce((sum, m) => sum + (m.ph || 0), 0) / measurements.length
            };
          }
        });
        
        const deviceAreas: AreaGroup[] = Object.values(areaMap);
        
        // รวมกับ areas ที่มีอยู่แล้ว
        this.areas = [...this.areas, ...deviceAreas];
        this.areaGroups = this.areas;
        
        console.log('✅ Total areas after adding device measurements:', this.areas.length);
        console.log('📊 Areas with averages:', deviceAreas.map(area => ({
          name: area.areaName,
          measurements: area.totalMeasurements,
          averages: area.averages
        })));
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
    console.log('📊 Viewing area details:', area);
    
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
      • อุณหภูมิ: ${stats.temperature}°C
      • ความชื้น: ${stats.moisture}%
      • ไนโตรเจน: ${stats.nitrogen} mg/kg
      • ฟอสฟอรัส: ${stats.phosphorus} mg/kg
      • โพแทสเซียม: ${stats.potassium} mg/kg
      • ค่า pH: ${stats.ph}`;
    this.notificationService.showNotification('info', 'ข้อมูล', message);
  }

  viewMeasurementDetail(measurement: Measurement) {
    console.log('📊 Viewing measurement detail:', measurement);
    
    // ใช้ device_id จริงสำหรับการส่งข้อมูล
    const actualDeviceId = this.deviceMap[this.deviceId || ''] || this.deviceId;
    const measurementData = { ...measurement, deviceId: actualDeviceId };
    
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
      console.log('⚠️ No measurements to show on map');
      return;
    }

    // ใช้ setTimeout เพื่อให้ DOM อัปเดตก่อน
    setTimeout(() => {
      const mapContainer = document.querySelector('#mapContainer') as HTMLElement;
      if (!mapContainer) {
        console.log('⚠️ Map container not found');
        return;
      }

      // ตรวจสอบว่า Leaflet library โหลดแล้วหรือไม่
      if (typeof (window as any).L === 'undefined') {
        console.log('⚠️ Leaflet library not loaded, using simple map display');
        this.showSimpleMap(mapContainer);
        return;
      }

      const L = (window as any).L;
      
      // สร้างแผนที่แบบง่าย (ใช้ OpenStreetMap)
      const map = L.map(mapContainer).setView([16.2464504, 103.2501379], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // เพิ่ม markers สำหรับแต่ละจุดวัด
      this.selectedArea!.measurements.forEach((measurement, index) => {
        if (measurement.lat && measurement.lng) {
          const marker = L.marker([measurement.lat, measurement.lng])
            .addTo(map)
            .bindPopup(`
              <div style="min-width: 200px;">
                <h4>จุดที่ ${measurement.measurementPoint || index + 1}</h4>
                <p><strong>วันที่:</strong> ${new Date(measurement.date).toLocaleDateString('th-TH')}</p>
                <p><strong>อุณหภูมิ:</strong> ${measurement.temperature}°C</p>
                <p><strong>ความชื้น:</strong> ${measurement.moisture}%</p>
                <p><strong>pH:</strong> ${measurement.ph}</p>
                <p><strong>ไนโตรเจน:</strong> ${measurement.nitrogen} ppm</p>
                <p><strong>ฟอสฟอรัส:</strong> ${measurement.phosphorus} ppm</p>
                <p><strong>โพแทสเซียม:</strong> ${measurement.potassium} ppm</p>
              </div>
            `);
        }
      });

      // ปรับ view ให้แสดงทุก markers
      if (this.selectedArea!.measurements.length > 0) {
        const group = new L.featureGroup();
        this.selectedArea!.measurements.forEach(measurement => {
          if (measurement.lat && measurement.lng) {
            group.addLayer(L.marker([measurement.lat, measurement.lng]));
          }
        });
        map.fitBounds(group.getBounds().pad(0.1));
      }

      console.log('🗺️ Map created with', this.selectedArea!.measurements.length, 'measurement points');
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
}
