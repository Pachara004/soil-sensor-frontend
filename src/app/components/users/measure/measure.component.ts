import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Map, Marker, config, LngLatBounds, Popup } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { environment } from '../../../service/environment';
import { Constants } from '../../../config/constants';
import { lastValueFrom } from 'rxjs';
import { Database, ref, onValue, off } from '@angular/fire/database';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { NotificationService } from '../../../service/notification.service';

interface UserData {
  username: string;
  userID: string;
  name: string;
  email: string;
  phone: string;
  devices?: { [key: string]: boolean };
}

interface Measurement {
  deviceId: string;
  temperature: number;
  moisture: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  location: string;
  lat: number;
  lng: number;
  date: string;
  timestamp: number;
  locationNameType?: 'custom' | 'auto';
  customLocationName?: string | null;
  autoLocationName?: string | null;
  areaId?: string; // ใช้ undefined แทน null (ถ้าจะใช้ null ให้เปลี่ยนเป็น: string | null)
  measurementPoint?: number;
}

interface Area {
  id: string;
  name: string;
  deviceId: string;
  username: string;
  polygonBounds: [number, number][];
  createdDate: string;
  createdTimestamp: number;
  totalMeasurements: number;
  averages?: {
    temperature: number;
    moisture: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    ph: number;
  };
}

// ✅ Interface สำหรับ Firebase live data
interface FirebaseLiveData {
  temperature: number;
  moisture: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  timestamp: number;
  deviceId: string;
  status: 'online' | 'offline';
}

@Component({
  selector: 'app-measure',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './measure.component.html',
  styleUrls: ['./measure.component.scss'],
})
export class MeasureComponent implements OnInit, AfterViewInit, OnDestroy {
  customLocationName: string = '';
  areaName: string = '';
  currentAreaId: string | null = null;
  currentArea: Area | null = null;
  measurements: Measurement[] = [];
  measurementCount = 0;

  // Minimal fields used by template
  isLoading = false;
  bounds: any = null;
  temperature = 0;
  moisture = 0;
  nitrogen = 0;
  phosphorus = 0;
  potassium = 0;
  ph = 0;
  locationDetail = '';
  showPopup = false;
  points: any[] = [];
  selectedPoints: [number, number][] = [];
  isSelectingArea = false;
  currentPolygon: any = null;
  measurementPoints: [number, number][] = []; // ✅ จุดที่ต้องวัด
  showMeasurementPoints = false; // ✅ แสดงจุดที่ต้องวัด

  // ✅ Firebase live data properties
  liveData: FirebaseLiveData | null = null;
  isLiveDataConnected = false;
  liveDataSubscription: any = null;
  currentUser: any = null;
  
  // ✅ User data properties
  userName: string = '';
  userEmail: string = '';
  userPhone: string = '';
  deviceName: string = '';
  deviceStatus: 'online' | 'offline' = 'offline';
  
  // ✅ UI Control properties
  showUserInfo = true;  // แสดงข้อมูล user โดยอัตโนมัติ
  showDeviceInfo = false;
  showMainMap = false;
  showCardMenu = false;

  map: Map | undefined;
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLElement>;

  private apiUrl: string;
  deviceId: string | null = null;
  username: string = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private http: HttpClient,
    private constants: Constants,
    private database: Database,
    private auth: Auth,
    private notificationService: NotificationService
  ) {
    this.apiUrl = this.constants.API_ENDPOINT;
    config.apiKey = environment.mapTilerApiKey;
  }

  ngOnInit(): void {
    // ✅ รับข้อมูลอุปกรณ์จาก query parameters
    this.route.queryParams.subscribe(params => {
      if (params['deviceId']) {
        this.deviceId = params['deviceId'];
        this.deviceName = params['deviceName'] || 'ไม่ระบุ';
        this.deviceStatus = params['deviceStatus'] || 'offline';
        
        console.log('📱 Device data received from main page:', {
          deviceId: this.deviceId,
          deviceName: this.deviceName,
          deviceStatus: this.deviceStatus
        });
      }
    });
    
    // ✅ ใช้ Firebase Auth แทน localStorage
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.username = user.displayName || user.email?.split('@')[0] || '';
        console.log('✅ User authenticated:', this.username);
        
        // ✅ ดึงข้อมูล user เสมอ และ device (ถ้าไม่มีข้อมูลจาก main page)
        this.loadUserAndDeviceData();
        
        // ✅ เริ่มต้นการเชื่อมต่อ Firebase live data
        this.initializeFirebaseConnection();
        
        // ✅ แสดงแผนที่ทันทีเมื่อเข้าหน้า
        this.showPopup = true;
        this.isSelectingArea = true;
        
        // ✅ เริ่มต้นแผนที่ใน popup หลังจากแสดง popup
        setTimeout(() => {
          this.initializePopupMap();
        }, 1000);
      } else {
        console.log('❌ User not authenticated, redirecting to login');
        this.router.navigate(['/']);
      }
    });
  }

  ngAfterViewInit() {
    this.initializeMap();
    
    // ✅ เริ่มต้นแผนที่ใน popup เมื่อ popup แสดง
    if (this.showPopup) {
      this.initializePopupMap();
    }
  }

  ngOnDestroy() {
    console.log('🔄 Component destroying...');
    
    // ✅ ปิดการเชื่อมต่อ Firebase Realtime Database ก่อน
    if (this.liveDataSubscription) {
      try {
        off(this.liveDataSubscription);
        console.log('✅ Firebase Realtime Database connection closed');
      } catch (error) {
        console.warn('⚠️ Error closing Firebase connection:', error);
      }
      this.liveDataSubscription = null;
    }
    
    // ✅ ปิดแผนที่
    if (this.map) {
      try {
        this.map.remove();
        console.log('✅ Map removed');
      } catch (error) {
        console.warn('⚠️ Error removing map:', error);
      }
      this.map = undefined;
    }
    
    console.log('✅ Component destroyed successfully');
  }

  // ✅ ดึงข้อมูล user และ device
  async loadUserAndDeviceData() {
    if (!this.currentUser) return;
    
    try {
      console.log('👤 Loading user and device data...');
      
      // ✅ ใช้ข้อมูลจาก Firebase เป็นหลัก
      this.userName = this.currentUser.displayName || this.currentUser.email?.split('@')[0] || '';
      this.userEmail = this.currentUser.email || '';
      
      // ✅ ดึงข้อมูลเพิ่มเติมจาก backend
      const token = await this.currentUser.getIdToken();
      
      // ✅ ดึงข้อมูล user เสมอ
      try {
        const userResponse = await lastValueFrom(
          this.http.get<any>(`${this.apiUrl}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );
        
        if (userResponse && userResponse.user) {
          const userData = userResponse.user;
          this.userName = userData.user_name || userData.username || this.userName;
          this.userEmail = userData.user_email || userData.email || this.userEmail;
          this.userPhone = userData.user_phone || userData.phone || '';
          
          console.log('👤 User data loaded from backend:', {
            userName: this.userName,
            userEmail: this.userEmail,
            userPhone: this.userPhone
          });
        } else {
          console.log('⚠️ No user data in backend response, using Firebase data');
        }
      } catch (userError) {
        console.log('⚠️ Could not load user data from backend, using Firebase data:', userError);
      }
      
      // ✅ แสดงข้อมูล user ที่ได้
      console.log('👤 Final user data:', {
        userName: this.userName,
        userEmail: this.userEmail,
        userPhone: this.userPhone
      });
      
      // ✅ ดึงข้อมูล device
      try {
        const devicesResponse = await lastValueFrom(
          this.http.get<any[]>(`${this.apiUrl}/api/devices`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );
        
        if (devicesResponse && devicesResponse.length > 0) {
          const device = devicesResponse[0]; // ใช้ device แรก
          
          // ✅ ใช้ข้อมูลจาก backend เฉพาะถ้าไม่มีข้อมูลจาก main page
          if (!this.deviceId) {
            this.deviceName = device.device_name || device.displayName || device.id || 'ไม่ระบุ';
            this.deviceId = device.id;
          }
          
          // ✅ ตรวจสอบสถานะ device (ออนไลน์/ออฟไลน์)
          this.checkDeviceStatus(this.deviceId || device.id);
          
          console.log('📱 Device data loaded:', {
            deviceId: this.deviceId,
            deviceName: this.deviceName,
            deviceStatus: this.deviceStatus
          });
        } else {
          console.log('⚠️ No devices found for user');
          if (!this.deviceId) {
            this.deviceName = 'ไม่พบอุปกรณ์';
          }
        }
      } catch (deviceError) {
        console.log('⚠️ Could not load device data from backend');
        if (!this.deviceId) {
          this.deviceName = 'ไม่สามารถโหลดข้อมูลอุปกรณ์';
        }
      }
      
    } catch (error) {
      console.error('❌ Error loading user and device data:', error);
    }
  }
  
  // ✅ ตรวจสอบสถานะ device (ออนไลน์/ออฟไลน์)
  checkDeviceStatus(deviceId: string) {
    // ✅ ตรวจสอบจาก Firebase live data
    if (this.liveData && this.liveData.deviceId === deviceId) {
      this.deviceStatus = this.liveData.status || 'offline';
    } else {
      // ✅ ถ้าไม่มี live data ให้ตรวจสอบจาก timestamp
      if (this.liveData && this.liveData.timestamp) {
        const now = Date.now();
        const timeDiff = now - this.liveData.timestamp;
        const fiveMinutes = 5 * 60 * 1000; // 5 นาที
        
        this.deviceStatus = timeDiff < fiveMinutes ? 'online' : 'offline';
      } else {
        this.deviceStatus = 'offline';
      }
    }
    
    console.log(`📡 Device ${deviceId} status: ${this.deviceStatus}`);
  }

  // ✅ เริ่มต้นการเชื่อมต่อ Firebase
  initializeFirebaseConnection() {
    if (!this.currentUser) {
      console.error('❌ No current user for Firebase connection');
      return;
    }
    
    // ✅ ปิดการเชื่อมต่อเดิมก่อน (ถ้ามี)
    if (this.liveDataSubscription) {
      try {
        off(this.liveDataSubscription);
        console.log('✅ Previous Firebase connection closed');
      } catch (error) {
        console.warn('⚠️ Error closing previous Firebase connection:', error);
      }
      this.liveDataSubscription = null;
    }
    
    console.log('🔥 Initializing Firebase connection...');
    
    // ✅ เชื่อมต่อกับ Firebase Realtime Database - table live
    const liveDataRef = ref(this.database, 'live');
    
    this.liveDataSubscription = onValue(liveDataRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          this.liveData = data;
          this.isLiveDataConnected = true;
          
          // ✅ อัปเดตค่าการวัดใน UI
          this.updateMeasurementValues(data);
          
          console.log('🔥 Live data updated:', data);
        } else {
          console.log('🔥 No live data available');
          this.isLiveDataConnected = false;
        }
      } catch (error) {
        console.error('❌ Error processing Firebase data:', error);
        this.isLiveDataConnected = false;
      }
    }, (error) => {
      console.error('❌ Firebase connection error:', error);
      this.isLiveDataConnected = false;
    });
  }
  
  // ✅ อัปเดตค่าการวัดใน UI
  updateMeasurementValues(data: FirebaseLiveData) {
    this.temperature = data.temperature || 0;
    this.moisture = data.moisture || 0;
    this.nitrogen = data.nitrogen || 0;
    this.phosphorus = data.phosphorus || 0;
    this.potassium = data.potassium || 0;
    this.ph = data.ph || 0;
    
    // ✅ อัปเดตสถานะ device
    if (this.deviceId) {
      this.checkDeviceStatus(this.deviceId);
    }
    
    console.log('📊 Measurement values updated:', {
      temperature: this.temperature,
      moisture: this.moisture,
      nitrogen: this.nitrogen,
      phosphorus: this.phosphorus,
      potassium: this.potassium,
      ph: this.ph,
      deviceStatus: this.deviceStatus
    });
  }

  async loadMeasurements(deviceId: string) {
    try {
      const response = await lastValueFrom(
        this.http.get<Measurement[]>(
          `${this.apiUrl}/api/measurements?deviceId=${deviceId}`
        )
      );
      this.measurements = response || [];
      this.measurementCount = this.measurements.length;
      this.initializeMap();
    } catch (error) {
      console.error('Error loading measurements:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
  }

  async saveMeasurement() {
    // ตรวจสอบ device status
    if (!this.deviceId) {
      this.notificationService.showNotification('error', 'ไม่พบอุปกรณ์', 'กรุณาเลือกอุปกรณ์ก่อนบันทึกข้อมูล');
      return;
    }

    if (this.deviceStatus === 'offline') {
      this.notificationService.showNotification('error', 'อุปกรณ์ออฟไลน์', 'อุปกรณ์ที่เลือกอยู่ในสถานะออฟไลน์ กรุณาเลือกอุปกรณ์ที่ออนไลน์');
      return;
    }

    // ตรวจสอบ live data
    if (!this.liveData) {
      this.notificationService.showNotification('error', 'ไม่พบข้อมูลเซ็นเซอร์', 'ไม่พบข้อมูลการวัดจากเซ็นเซอร์ กรุณาตรวจสอบการเชื่อมต่อ');
      return;
    }

    // ตรวจสอบข้อมูลเซ็นเซอร์
    if (this.liveData.temperature === undefined || 
        this.liveData.moisture === undefined || 
        this.liveData.nitrogen === undefined || 
        this.liveData.phosphorus === undefined || 
        this.liveData.potassium === undefined || 
        this.liveData.ph === undefined) {
      this.notificationService.showNotification('error', 'ข้อมูลเซ็นเซอร์ไม่ครบถ้วน', 'ข้อมูลจากเซ็นเซอร์ไม่ครบถ้วน กรุณารอให้เซ็นเซอร์ส่งข้อมูลครบก่อน');
      return;
    }
    
    if (!this.currentUser) {
      console.error('❌ No current user found');
      this.notificationService.showNotification('error', 'ไม่พบข้อมูลผู้ใช้', 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      return;
    }
    
    console.log('👤 Current user:', this.currentUser.uid, this.currentUser.email);
    console.log('📱 Selected device:', this.deviceName, 'Status:', this.deviceStatus);
    console.log('📊 Live data:', this.liveData);
    
    // ✅ ใช้ข้อมูลจาก Firebase live data
    const newMeasurement: Measurement = {
      deviceId: this.deviceId || 'unknown', // ใช้ device ID จาก component
      temperature: this.liveData.temperature,
      moisture: this.liveData.moisture,
      nitrogen: this.liveData.nitrogen,
      phosphorus: this.liveData.phosphorus,
      potassium: this.liveData.potassium,
      ph: this.liveData.ph,
      location: this.locationDetail || 'Auto Location',
      lat: this.selectedPoints.length > 0 ? this.selectedPoints[0][1] : 16.2464504, // ใช้พิกัดจากจุดแรก หรือ default
      lng: this.selectedPoints.length > 0 ? this.selectedPoints[0][0] : 103.2501379,
      date: new Date().toISOString(),
      timestamp: Date.now(),
      locationNameType: this.locationDetail ? 'custom' : 'auto',
      customLocationName: this.locationDetail || null,
      autoLocationName: this.locationDetail ? null : 'Auto Location',
      areaId: this.currentAreaId ?? undefined,
      measurementPoint: this.measurementCount + 1,
    };

    try {
      // ✅ บันทึกเข้า PostgreSQL ผ่าน backend API
      const token = await this.currentUser.getIdToken();
      
      if (!token) {
        console.error('❌ Failed to get Firebase token');
        this.notificationService.showNotification('error', 'ไม่สามารถรับ Token', 'ไม่สามารถรับ Token จาก Firebase กรุณาเข้าสู่ระบบใหม่');
        return;
      }
      
      // Debug: แสดงข้อมูลที่จะส่งไปยัง backend
      console.log('📊 Measurement request body:', newMeasurement);
      console.log('🔑 Token length:', token.length);
      console.log('🔑 Token preview:', token.substring(0, 20) + '...');
      console.log('🌐 API URL:', `${this.apiUrl}/api/measurements`);
      
      const response = await lastValueFrom(
        this.http.post(`${this.apiUrl}/api/measurements`, newMeasurement, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      );
      
      console.log('✅ Measurement saved to PostgreSQL:', response);
      
      // ✅ อัปเดต UI
      this.measurements.push(newMeasurement);
      this.measurementCount++;
      await this.updateAreaStatistics();
      this.initializeMap();
      
      this.notificationService.showNotification('success', 'บันทึกสำเร็จ', 'บันทึกข้อมูลการวัดเรียบร้อยแล้ว');
    } catch (error: any) {
      console.error('❌ Error saving measurement:', error);
      
      // แสดง error details
      if (error.status === 400) {
        console.error('❌ Bad Request - Validation Error:', error.error);
        this.notificationService.showNotification('error', 'ข้อมูลไม่ถูกต้อง', `ข้อมูลไม่ถูกต้อง: ${error.error?.message || 'กรุณาตรวจสอบข้อมูลที่กรอก'}`);
      } else if (error.status === 401) {
        console.error('❌ Unauthorized - Token Error:', error.error);
        this.notificationService.showNotification('error', 'ไม่ได้รับอนุญาต', 'กรุณาเข้าสู่ระบบใหม่');
      } else if (error.status === 500) {
        console.error('❌ Server Error:', error.error);
        this.notificationService.showNotification('error', 'ข้อผิดพลาดเซิร์ฟเวอร์', 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
      } else {
        console.error('❌ Unknown Error:', error);
        this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง');
      }
    }
  }

  async createArea() {
    if (!this.areaName) {
      this.notificationService.showNotification('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อพื้นที่');
      return;
    }
    const newArea: Area = {
      id: Date.now().toString(),
      name: this.areaName,
      deviceId: this.deviceId || '',
      username: '', // ลบ username ออก - ให้ AuthInterceptor จัดการ Firebase ID token
      polygonBounds: this.getPolygonBounds() || [],
      createdDate: new Date().toISOString(),
      createdTimestamp: Date.now(),
      totalMeasurements: 0,
    };
    try {
      await lastValueFrom(this.http.post(`${this.apiUrl}/api/areas`, newArea));
      this.currentAreaId = newArea.id;
      this.currentArea = newArea;
      this.areaName = '';
      this.initializeMap();
    } catch (error) {
      console.error('Error creating area:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการสร้างพื้นที่');
    }
  }

  private getPolygonBounds(): [number, number][] {
    // ต้องอัปเดตจาก map interaction (สมมติใช้พิกัดจากจุดวัดที่มี)
    return this.measurements.length > 0
      ? this.measurements.map((m) => [m.lng, m.lat] as [number, number])
      : [];
  }

  async updateAreaStatistics() {
    if (!this.currentAreaId || this.measurements.length === 0) return;

    try {
      const totals = this.measurements.reduce(
        (acc, m) => ({
          temperature: acc.temperature + (m.temperature || 0),
          moisture: acc.moisture + (m.moisture || 0),
          nitrogen: acc.nitrogen + (m.nitrogen || 0),
          phosphorus: acc.phosphorus + (m.phosphorus || 0),
          potassium: acc.potassium + (m.potassium || 0),
          ph: acc.ph + (m.ph || 0),
        }),
        {
          temperature: 0,
          moisture: 0,
          nitrogen: 0,
          phosphorus: 0,
          potassium: 0,
          ph: 0,
        }
      );
      const count = this.measurements.length;
      const averages = {
        temperature: parseFloat((totals.temperature / count).toFixed(2)),
        moisture: parseFloat((totals.moisture / count).toFixed(2)),
        nitrogen: parseFloat((totals.nitrogen / count).toFixed(2)),
        phosphorus: parseFloat((totals.phosphorus / count).toFixed(2)),
        potassium: parseFloat((totals.potassium / count).toFixed(2)),
        ph: parseFloat((totals.ph / count).toFixed(2)),
      };

      await lastValueFrom(
        this.http.put(`${this.apiUrl}/api/areas/${this.currentAreaId}`, {
          totalMeasurements: count,
          averages,
          lastUpdated: Date.now(),
        })
      );

      if (this.currentArea) {
        this.currentArea.totalMeasurements = count;
        this.currentArea.averages = averages;
      }
    } catch (error) {
      console.error('Error updating area statistics:', error);
    }
  }

  showAreaStatistics() {
    if (!this.currentArea || !this.currentArea.averages) {
      this.notificationService.showNotification('info', 'ไม่มีข้อมูลสถิติ', 'ยังไม่มีข้อมูลสถิติของพื้นที่นี้');
      return;
    }
    const s = this.currentArea.averages;
    const statsMessage = `สถิติพื้นที่: ${this.currentArea.name}
จำนวนจุดวัด: ${this.currentArea.totalMeasurements} จุด

ค่าเฉลี่ย:
• อุณหภูมิ: ${s.temperature}°C
• ความชื้น: ${s.moisture}%
• ไนโตรเจน: ${s.nitrogen} mg/kg
• ฟอสฟอรัส: ${s.phosphorus} mg/kg
• โพแทสเซียม: ${s.potassium} mg/kg
• ค่า pH: ${s.ph}`;
    
    this.notificationService.showNotification('info', 'สถิติพื้นที่', statsMessage);
  }

  startNewArea() {
    if (this.measurementCount > 0) {
      const confirmReset = window.confirm(
        `คุณมีข้อมูลการวัด ${this.measurementCount} จุดในพื้นที่ "${this.areaName}"\nต้องการเริ่มพื้นที่ใหม่หรือไม่?`
      );
      if (!confirmReset) return;
    }
    this.reopenPopup();
  }

  private reopenPopup() {
    this.currentAreaId = null;
    this.currentArea = null;
    this.measurements = [];
    this.measurementCount = 0;
    this.areaName = '';
    this.customLocationName = '';
    this.initializeMap();
  }

  closePopup() { 
    this.showPopup = false; 
    this.isSelectingArea = false;
    this.selectedPoints = [];
    this.measurementPoints = [];
    this.showMeasurementPoints = false;
    this.clearMarks();
  }
  
  stopPropagation(event: Event) { event.stopPropagation(); }
  
  // ✅ เริ่มการเลือกพื้นที่
  startAreaSelection() {
    this.isSelectingArea = true;
    this.selectedPoints = [];
    this.points = [];
    this.clearMarks();
    this.initializePopupMap();
    console.log('🎯 Started area selection mode');
  }
  
  // ✅ เริ่มต้นแผนที่เมื่อ popup แสดง
  onPopupShow() {
    setTimeout(() => {
      this.initializePopupMap();
    }, 100);
  }
  
  
  // ✅ อัปเดต polygon
  updatePolygon() {
    if (!this.map || this.selectedPoints.length < 3) {
      // ลบ polygon ถ้ามีจุดน้อยกว่า 3 จุด
      if (this.map && this.currentPolygon) {
        this.map.removeLayer('polygon-layer');
        this.map.removeLayer('polygon-outline');
        this.map.removeSource('polygon-source');
        this.currentPolygon = null;
      }
      return;
    }
    
    // ลบ polygon เดิม
    if (this.currentPolygon) {
      this.map.removeLayer('polygon-layer');
      this.map.removeLayer('polygon-outline');
      this.map.removeSource('polygon-source');
    }
    
    // สร้าง polygon ใหม่
    this.map.addSource('polygon-source', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [this.selectedPoints]
        }
      }
    });
    
    // ✅ เพิ่ม polygon fill (พื้นหลัง)
    this.map.addLayer({
      id: 'polygon-layer',
      type: 'fill',
      source: 'polygon-source',
      paint: {
        'fill-color': '#00aaff',
        'fill-opacity': 0.2 // ลดความโปร่งใสให้เห็นชัดขึ้น
      }
    });
    
    // ✅ เพิ่ม polygon outline (กรอบ)
    this.map.addLayer({
      id: 'polygon-outline',
      type: 'line',
      source: 'polygon-source',
      paint: {
        'line-color': '#00aaff',
        'line-width': 3, // เพิ่มความหนาของเส้น
        'line-dasharray': [2, 2] // เส้นประ
      }
    });
    
    this.currentPolygon = true;
    console.log('✅ Polygon updated with', this.selectedPoints.length, 'points');
  }
  
  // ✅ เคลียร์จุดทั้งหมด
  clearMarks() {
    this.selectedPoints = [];
    this.points = [];
    
    if (this.map) {
      // ลบ markers
      const markers = document.querySelectorAll('.maplibregl-marker');
      markers.forEach(marker => marker.remove());
      
      // ลบ polygon
      if (this.currentPolygon) {
        this.map.removeLayer('polygon-layer');
        this.map.removeLayer('polygon-outline');
        this.map.removeSource('polygon-source');
        this.currentPolygon = null;
        console.log('🗑️ Polygon cleared');
      }
    }
  }
  
  // ✅ ยืนยันพื้นที่
  confirmArea() {
    if (this.selectedPoints.length < 3) {
      this.notificationService.showNotification('error', 'ข้อมูลไม่เพียงพอ', 'กรุณาเลือกอย่างน้อย 3 จุดเพื่อสร้างพื้นที่');
      return;
    }
    
    // ✅ สร้างจุดที่ต้องวัดภายในพื้นที่
    this.generateMeasurementPoints();
    
    this.showPopup = false;
    this.isSelectingArea = false;
    this.showMeasurementPoints = true;
    
    // ✅ แสดงแผนที่หลักและจุดวัด
    this.showMainMap = true;
    setTimeout(() => {
      this.initializeMap();
    }, 100);
    
    // คำนวณพื้นที่
    const area = this.calculatePolygonArea(this.selectedPoints);
    this.locationDetail = `พื้นที่ที่เลือก: ${area.toFixed(2)} ตารางเมตร (${this.selectedPoints.length} จุด) - จุดวัด: ${this.measurementPoints.length} จุด`;
    
    console.log('✅ Area confirmed:', {
      points: this.selectedPoints.length,
      area: area,
      coordinates: this.selectedPoints,
      measurementPoints: this.measurementPoints.length
    });
    console.log('🗺️ Main map will show measurement points');
  }
  
  // ✅ สร้างจุดที่ต้องวัดภายในพื้นที่
  generateMeasurementPoints() {
    if (this.selectedPoints.length < 3) return;
    
    this.measurementPoints = [];
    
    // ✅ คำนวณขอบเขตของ polygon
    const bounds = this.calculateBounds(this.selectedPoints);
    
    // ✅ คำนวณขนาดพื้นที่ (เมตร)
    const areaSize = this.calculateAreaSize(bounds);
    console.log('📏 Area size:', areaSize, 'meters');
    
    // ✅ กำหนดระยะห่างระหว่างจุดวัดตามขนาดพื้นที่
    let pointDistance: number;
    if (areaSize < 30) {
      // ✅ พื้นที่เล็ก (< 30m): ระยะห่าง 5-10 เมตร
      pointDistance = 7; // ใช้ค่าเฉลี่ย 7 เมตร
      console.log('🔍 Small area: using 5-10m spacing (7m)');
    } else {
      // ✅ พื้นที่ใหญ่ (≥ 30m): ระยะห่าง 10-15 เมตร
      pointDistance = 12; // ใช้ค่าเฉลี่ย 12 เมตร
      console.log('🔍 Large area: using 10-15m spacing (12m)');
    }
    
    // ✅ แปลงระยะห่างจากเมตรเป็นองศา (ประมาณ)
    // 1 องศา ≈ 111,000 เมตร
    const latStep = pointDistance / 111000;
    const lngStep = pointDistance / (111000 * Math.cos((bounds.minLat + bounds.maxLat) / 2 * Math.PI / 180));
    
    console.log('📐 Grid spacing - Lat:', latStep, 'Lng:', lngStep);
    
    // ✅ สร้างจุดวัดแบบ grid pattern
    const points: [number, number][] = [];
    
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += lngStep) {
      for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += latStep) {
        const point: [number, number] = [lng, lat];
        
        // ✅ ตรวจสอบว่าจุดอยู่ใน polygon หรือไม่
        if (this.isPointInPolygon(point, this.selectedPoints)) {
          points.push(point);
        }
      }
    }
    
    // ✅ จำกัดจำนวนจุดไม่เกิน 50 จุด (เพิ่มขึ้นเพื่อให้ครอบคลุมพื้นที่มากขึ้น)
    if (points.length > 50) {
      const step = Math.floor(points.length / 50);
      this.measurementPoints = points.filter((_, index) => index % step === 0).slice(0, 50);
    } else {
      this.measurementPoints = points;
    }
    
    console.log(`🎯 Generated ${this.measurementPoints.length} measurement points with ${pointDistance}m spacing`);
  }
  
  // ✅ คำนวณขอบเขตของ polygon
  calculateBounds(points: [number, number][]) {
    let minLng = points[0][0];
    let maxLng = points[0][0];
    let minLat = points[0][1];
    let maxLat = points[0][1];
    
    for (const [lng, lat] of points) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    
    return { minLng, maxLng, minLat, maxLat };
  }
  
  // ✅ คำนวณขนาดพื้นที่ (เมตร)
  calculateAreaSize(bounds: { minLng: number, maxLng: number, minLat: number, maxLat: number }) {
    // ✅ คำนวณระยะทางในแนว lat และ lng (เมตร)
    const latDistance = (bounds.maxLat - bounds.minLat) * 111000; // 1 องศา ≈ 111,000 เมตร
    const lngDistance = (bounds.maxLng - bounds.minLng) * 111000 * Math.cos((bounds.minLat + bounds.maxLat) / 2 * Math.PI / 180);
    
    // ✅ ใช้ขนาดที่ใหญ่กว่าเป็นตัวแทนขนาดพื้นที่
    const areaSize = Math.max(latDistance, lngDistance);
    
    console.log('📐 Area dimensions:', {
      latDistance: latDistance.toFixed(2) + 'm',
      lngDistance: lngDistance.toFixed(2) + 'm',
      areaSize: areaSize.toFixed(2) + 'm'
    });
    
    return areaSize;
  }
  
  // ✅ ตรวจสอบว่าจุดอยู่ใน polygon หรือไม่
  isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [x, y] = point;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }
  
  // ✅ คำนวณพื้นที่ polygon
  calculatePolygonArea(coordinates: [number, number][]): number {
    if (coordinates.length < 3) return 0;
    
    let area = 0;
    const n = coordinates.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += coordinates[i][0] * coordinates[j][1];
      area -= coordinates[j][0] * coordinates[i][1];
    }
    
    area = Math.abs(area) / 2;
    
    // แปลงจาก degrees เป็น meters (ประมาณ)
    const earthRadius = 6371000; // meters
    const lat1 = coordinates[0][1] * Math.PI / 180;
    const lat2 = coordinates[1][1] * Math.PI / 180;
    const dLat = lat2 - lat1;
    const dLng = (coordinates[1][0] - coordinates[0][0]) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = earthRadius * c;
    
    return area * (distance * distance);
  }
  
  // ✅ เริ่มต้นแผนที่ใน popup
  initializePopupMap() {
    setTimeout(() => {
      const popupMapContainer = document.querySelector('.map-popup');
      if (!popupMapContainer) {
        console.error('❌ Map container not found');
        return;
      }
      
      console.log('🗺️ Initializing popup map...');
      console.log('🗺️ MapTiler API Key:', environment.mapTilerApiKey);
      
      // ลบแผนที่เดิม
      if (this.map) {
        this.map.remove();
        this.map = undefined;
      }
      
      try {
        // สร้างแผนที่ใหม่ - คณะวิทยาการสารสนเทศ มหาวิทยาลัยมหาสารคาม
        this.map = new Map({
          container: popupMapContainer as HTMLElement,
          style: `https://api.maptiler.com/maps/satellite/style.json?key=${environment.mapTilerApiKey}`, // ✅ เปลี่ยนเป็นดาวเทียม
          center: [103.2501379, 16.2464504], // ✅ คณะวิทยาการสารสนเทศ มหาวิทยาลัยมหาสารคาม
          zoom: 17, // ✅ ขยายให้เห็นรายละเอียดของคณะ
          pitch: 0,
          bearing: 0
        });
        
        console.log('🗺️ Map created successfully');
        
        // เพิ่ม event listener สำหรับการคลิก
        this.map.on('click', (e) => {
          const { lng, lat } = e.lngLat;
          console.log(`📍 Map clicked at: [${lng}, ${lat}]`);
          console.log(`🎯 Area selection mode: ${this.isSelectingArea}`);
          
          // ✅ เพิ่มจุดลงใน selectedPoints
          this.selectedPoints.push([lng, lat]);
          console.log(`📍 Added point: [${lng}, ${lat}]`);
          console.log(`📍 Total points: ${this.selectedPoints.length}`);
          
          // ✅ อัปเดต UI
          this.points = this.selectedPoints.map((point, index) => ({
            id: index + 1,
            lng: point[0],
            lat: point[1]
          }));
          
          console.log(`📍 Updated points array:`, this.points);
          
          // ✅ เพิ่ม marker
          const marker = new Marker({ 
            color: '#00aaff',
            scale: 1.2
          })
            .setLngLat([lng, lat])
            .addTo(this.map!);
          
          console.log(`📍 Marker added to map`);
          
          // ✅ อัปเดต polygon
          this.updatePolygon();
        });
        
        this.map.once('load', () => {
          console.log('✅ Popup map loaded and ready for point selection');
          console.log('📍 Default location: คณะวิทยาการสารสนเทศ มหาวิทยาลัยมหาสารคาม [103.2501379, 16.2464504]');
          console.log('🛰️ Map style: Satellite (ดาวเทียม)');
          console.log('🎯 Area selection mode:', this.isSelectingArea);
          console.log('📍 Current points:', this.selectedPoints.length);
        });
        
        this.map.on('error', (e) => {
          console.error('❌ Map error:', e);
        });
        
      } catch (error) {
        console.error('❌ Error creating map:', error);
        this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโหลดแผนที่ กรุณาตรวจสอบ API Key');
      }
    }, 500); // เพิ่มเวลาให้ DOM โหลดเสร็จ
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
  goToHistory() {
    this.router.navigate(['/history']);
  }
  
  // ✅ Methods สำหรับควบคุมการแสดง/ซ่อน
  toggleUserInfo() {
    this.showUserInfo = !this.showUserInfo;
    console.log('👤 User info visibility:', this.showUserInfo);
  }
  
  toggleDeviceInfo() {
    this.showDeviceInfo = !this.showDeviceInfo;
    console.log('📱 Device info visibility:', this.showDeviceInfo);
  }
  
  toggleMainMap() {
    this.showMainMap = !this.showMainMap;
    console.log('🗺️ Main map visibility:', this.showMainMap);
    
    // ✅ อัปเดตแผนที่เมื่อแสดง
    if (this.showMainMap) {
      setTimeout(() => {
        this.initializeMap();
      }, 100);
    }
  }
  
  toggleCardMenu() {
    this.showCardMenu = !this.showCardMenu;
    console.log('📋 Card menu visibility:', this.showCardMenu);
  }
  
  closeCardMenu() {
    this.showCardMenu = false;
  }

  // ========= 🔻 เพิ่มเมธอดนี้เพื่อแก้ TS2339 และจัดการแผนที่ 🔻 =========
  private initializeMap(): void {
    if (!this.mapContainer?.nativeElement) return;

    // เคลียร์แผนที่เดิม (ถ้ามี)
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }

    // สร้างแผนที่ใหม่ - คณะวิทยาการสารสนเทศ มหาวิทยาลัยมหาสารคาม
    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: `https://api.maptiler.com/maps/satellite/style.json?key=${environment.mapTilerApiKey}`, // ✅ เปลี่ยนเป็นดาวเทียม
      center: [103.2501379, 16.2464504], // ✅ คณะวิทยาการสารสนเทศ มหาวิทยาลัยมหาสารคาม
      zoom: 17, // ✅ ขยายให้เห็นรายละเอียดของคณะ
    });

    const bounds = new LngLatBounds();
    let hasPoint = false;

    // แสดงจุดวัดเดิม
    for (const m of this.measurements) {
      if (typeof m.lng === 'number' && typeof m.lat === 'number') {
        new Marker({ color: '#ff6b6b' }).setLngLat([m.lng, m.lat]).addTo(this.map!);
        bounds.extend([m.lng, m.lat]);
        hasPoint = true;
      }
    }

    // ✅ แสดงจุดที่ต้องวัด (จุดใหม่ที่คำนวณจากพื้นที่ที่เลือก)
    if (this.showMeasurementPoints && this.measurementPoints.length > 0) {
      console.log('🎯 Displaying', this.measurementPoints.length, 'measurement points on main map');
      
      for (let i = 0; i < this.measurementPoints.length; i++) {
        const [lng, lat] = this.measurementPoints[i];
        
        // ✅ สร้าง marker สำหรับจุดวัด
        const marker = new Marker({ 
          color: '#4ecdc4', // สีเขียวเข้ม
          scale: 0.8
        }).setLngLat([lng, lat]).addTo(this.map!);
        
        // ✅ เพิ่ม popup สำหรับแสดงหมายเลขจุด
        marker.setPopup(new Popup({
          offset: 25,
          closeButton: false,
          closeOnClick: false
        }).setHTML(`
          <div style="text-align: center; font-weight: bold; color: #2c3e50;">
            จุดวัดที่ ${i + 1}
            <br>
            <small style="color: #7f8c8d;">${lat.toFixed(6)}, ${lng.toFixed(6)}</small>
          </div>
        `));
        
        bounds.extend([lng, lat]);
        hasPoint = true;
      }
      
      console.log('✅ All measurement points displayed on main map');
    }

    this.map.once('load', () => {
      if (hasPoint) {
        this.map!.fitBounds(bounds, { padding: 40, maxZoom: 17, duration: 0 });
      }
    });
  }
  // ========= 🔺 จบ initializeMap 🔺 =========
}
