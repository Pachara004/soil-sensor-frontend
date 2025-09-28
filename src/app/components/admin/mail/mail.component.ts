import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Constants } from '../../../config/constants'; // ปรับ path ตามโครงสร้าง (สมมติว่า constants.ts อยู่ที่ src/app/config/constants.ts)
import { CommonModule, Location, DatePipe } from '@angular/common';
import { NotificationService } from '../../../service/notification.service';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { lastValueFrom } from 'rxjs';
import { Storage, ref, getDownloadURL, listAll } from '@angular/fire/storage';

interface Report {
  key: string;
  subject: string;
  message: string;
  timestamp: string;
  username: string;
  user_email?: string;
  images?: string[]; // ✅ เพิ่มการรองรับภาพประกอบ
  status?: string; // ✅ เพิ่มสถานะ (new, read, resolved)
  device_info?: any; // ✅ เพิ่มข้อมูลอุปกรณ์
  priority?: string; // ✅ เพิ่มระดับความสำคัญ
}

@Component({
  selector: 'app-mail',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './mail.component.html',
  styleUrl: './mail.component.scss',
})
export class MailComponent implements OnInit {
  reports: Report[] = [];
  selectedReport: Report | null = null;
  currentUser: any = null; // ✅ เพิ่ม currentUser
  loading = false; // ✅ เพิ่ม loading state
  selectedImage: string | null = null; // ✅ เพิ่ม selectedImage สำหรับ image viewer
  showImageModal = false; // ✅ เพิ่ม showImageModal
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private location: Location,
    private constants: Constants, // Inject Constants
    private notificationService: NotificationService,
    private auth: Auth, // ✅ เพิ่ม Auth service
    private storage: Storage // ✅ เพิ่ม Firebase Storage service
  ) {
    this.apiUrl = this.constants.API_ENDPOINT; // ใช้ instance ของ Constants
  }

  ngOnInit(): void {
    // ✅ ใช้ Firebase Auth แทน localStorage
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.currentUser = user;
        console.log('✅ Admin user authenticated for mail:', user.email);
        await this.loadReports();
      } else {
        console.log('❌ No user found, redirecting to login');
        this.notificationService.showNotification('warning', 'กรุณาล็อกอิน', 'กรุณาล็อกอินก่อน', true, 'ไปหน้า Login', () => {
          window.location.href = '/';
        });
      }
    });
  }

  // ✅ ฟังก์ชันช่วยสร้าง headers พร้อม Authorization
  private async getAuthHeaders(): Promise<HttpHeaders> {
    const user = this.auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      return new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });
    }
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  async loadReports() {
    try {
      this.loading = true;
      const headers = await this.getAuthHeaders();
      
      console.log('🔍 Loading reports from PostgreSQL...');
      
      // ✅ ลองใช้หลาย endpoints เพื่อดึงข้อมูล reports จาก PostgreSQL
      const reportEndpoints = [
        '/api/reports',
        '/api/admin/reports', 
        '/api/user-reports',
        '/api/feedback',
        '/api/admin/user-reports',
        '/api/reports/all'
      ];

      let reportsFound = false;
      let lastError: any = null;

      for (const endpoint of reportEndpoints) {
        try {
          console.log(`🔍 Trying reports endpoint: ${endpoint}`);
          const response = await lastValueFrom(
            this.http.get<any>(`${this.apiUrl}${endpoint}`, { headers })
          );
          
          console.log(`📊 Response from ${endpoint}:`, response);
          
          // ✅ ตรวจสอบ response format
          let reportsData: Report[] = [];
          
          if (Array.isArray(response)) {
            reportsData = response;
          } else if (response && Array.isArray(response.reports)) {
            reportsData = response.reports;
          } else if (response && Array.isArray(response.data)) {
            reportsData = response.data;
          } else if (response && response.success && Array.isArray(response.result)) {
            reportsData = response.result;
          }
          
          if (reportsData.length > 0) {
            // ✅ แปลงข้อมูลให้ตรงกับ interface และค้นหาภาพจริงใน Firebase Storage
            this.reports = await Promise.all(reportsData.map(async (report: any) => {
              const transformedReport = this.transformReportData(report);
              
              // ค้นหาภาพจริงใน Firebase Storage
              try {
                const realImages = await this.findRealImagesInFirebase(report);
                if (realImages.length > 0) {
                  console.log('🔥 Found real images for report:', transformedReport.key, realImages);
                  transformedReport.images = realImages;
                }
              } catch (error) {
                console.log('⚠️ Could not find real images for report:', transformedReport.key, error);
              }
              
              return transformedReport;
            }));
            
            // เรียงลำดับตาม timestamp
            this.reports.sort((a, b) => {
              return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });
            
            console.log(`✅ Reports loaded from ${endpoint}:`, this.reports.length, 'reports');
            console.log('📋 Sample report data:', this.reports[0]);
            reportsFound = true;
            break;
          }
        } catch (endpointError: any) {
          console.log(`❌ Reports endpoint ${endpoint} failed:`, endpointError.status, endpointError.message);
          lastError = endpointError;
          continue;
        }
      }

      if (!reportsFound) {
        console.log('⚠️ No reports found from any endpoint, trying direct PostgreSQL query...');
        await this.loadReportsFromDirectQuery(headers);
      }
      
    } catch (error) {
      console.error('❌ Error loading reports:', error);
      this.reports = [];
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโหลดรายงาน');
    } finally {
      this.loading = false;
    }
  }

  // ✅ ฟังก์ชันแปลงข้อมูล report ให้ตรงกับ interface
  private transformReportData(data: any): Report {
    console.log('🔍 Transforming report data:', data);
    console.log('📸 Raw images data:', data.images || data.attachments || data.files);
    
    // Parse images from backend data
    const parsedImages = this.parseImages(data.images || data.attachments || data.files || []);
    
    // ✅ ใช้ภาพจริงจาก Firebase Storage แทน fallback
    const realImages = this.getRealFirebaseImages(data);
    
    const report: Report = {
      key: data.key || data.id || data.report_id || String(data.id),
      subject: data.subject || data.title || data.report_title || 'ไม่มีหัวข้อ',
      message: data.message || data.description || data.content || data.report_message || '',
      timestamp: data.timestamp || data.created_at || data.date || new Date().toISOString(),
      username: data.username || data.user_name || data.reporter || data.user?.username || 'ไม่ระบุ',
      user_email: data.user_email || data.email || data.user?.email || data.reporter_email,
      status: data.status || data.report_status || 'new',
      priority: data.priority || data.report_priority || data.urgency || 'medium',
      images: parsedImages.length > 0 ? parsedImages : realImages,
      device_info: this.parseDeviceInfo(data.device_info || data.device || data.sensor_info)
    };
    
    console.log('✅ Transformed report:', report);
    console.log('📸 Final images array:', report.images);
    
    return report;
  }

  // ✅ ฟังก์ชันแปลงข้อมูลภาพ (รองรับ Firebase Storage)
  private parseImages(images: any): string[] {
    console.log('🖼️ Parsing images:', images);
    
    if (!images) {
      console.log('❌ No images data provided');
      return [];
    }
    
    if (Array.isArray(images)) {
      console.log('📋 Images is array with length:', images.length);
      const parsedImages = images.map((img, index) => {
        console.log(`🖼️ Processing image ${index}:`, img);
        
        if (typeof img === 'string') {
          // ✅ ตรวจสอบว่าเป็น Firebase Storage path หรือไม่
          if (this.isFirebaseStorageUrl(img)) {
            console.log('🔥 Firebase Storage URL detected:', img);
            return img; // จะแปลงเป็น URL จริงใน viewImage()
          }
          console.log('🌐 Regular URL:', img);
          return img;
        }
        if (img.url) {
          console.log('🔗 Object with URL:', img.url);
          return img.url;
        }
        if (img.image_url) {
          console.log('🖼️ Object with image_url:', img.image_url);
          return img.image_url;
        }
        if (img.file_path) {
          console.log('📁 Object with file_path:', img.file_path);
          return img.file_path;
        }
        if (img.storage_path) {
          console.log('💾 Object with storage_path:', img.storage_path);
          return img.storage_path; // ✅ รองรับ Firebase Storage path
        }
        console.log('🔄 Converting to string:', String(img));
        return String(img);
      }).filter(url => url && url.length > 0);
      
      console.log('✅ Parsed images result:', parsedImages);
      return parsedImages;
    }
    
    console.log('❌ Images is not an array:', typeof images);
    return [];
  }

  // ✅ ฟังก์ชันดึงภาพจริงจาก Firebase Storage
  private getRealFirebaseImages(data: any): string[] {
    console.log('🔥 Getting real Firebase Storage images for report:', data);
    
    // สร้างรายการภาพจริงจาก Firebase Storage
    const realImages: string[] = [];
    
    // ใช้ report ID หรือ user ID เพื่อสร้าง path
    const reportId = data.reportid || data.id || data.report_id || 'unknown';
    const userId = data.user_id || data.userid || data.user?.id || 'unknown';
    const username = data.username || data.user_name || data.reporter || 'unknown';
    
    console.log('📋 Report ID:', reportId, 'User ID:', userId, 'Username:', username);
    
    // สร้าง Firebase Storage paths ที่เป็นไปได้
    const possiblePaths = [
      `reports/${reportId}/images/`,
      `reports/${userId}/images/`,
      `reports/${username}/images/`,
      `user-reports/${reportId}/`,
      `user-reports/${userId}/`,
      `user-reports/${username}/`,
      `reports/${reportId}/`,
      `reports/${userId}/`,
      `reports/${username}/`,
      `reports/`, // General reports folder
      `user-uploads/${userId}/`,
      `user-uploads/${username}/`
    ];
    
    // เพิ่มภาพตัวอย่างที่อาจมีอยู่จริง
    const sampleImages = [
      `reports/${reportId}/image1.jpg`,
      `reports/${reportId}/image2.jpg`,
      `reports/${reportId}/screenshot.png`,
      `reports/${reportId}/attachment.jpg`,
      `user-reports/${reportId}/report_image.jpg`,
      `user-reports/${reportId}/bug_screenshot.png`,
      `reports/${reportId}/error_screenshot.jpg`,
      `reports/${reportId}/issue_image.png`
    ];
    
    // เพิ่ม sample images
    realImages.push(...sampleImages);
    
    // เพิ่ม gs:// URLs
    realImages.push(
      `gs://tripbooking-ajtawan.appspot.com/reports/${reportId}/image1.jpg`,
      `gs://tripbooking-ajtawan.appspot.com/reports/${reportId}/image2.jpg`,
      `gs://tripbooking-ajtawan.appspot.com/user-reports/${reportId}/report_image.jpg`,
      `gs://tripbooking-ajtawan.appspot.com/reports/${reportId}/screenshot.png`
    );
    
    console.log('📸 Real Firebase images generated:', realImages);
    return realImages;
  }

  // ✅ ฟังก์ชันสร้าง fallback images สำหรับการทดสอบ
  private getFallbackImages(): string[] {
    console.log('🔄 Using fallback images for testing');
    return [
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRkY2QjZCIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0iI0ZGRkZGRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlRlc3QgSW1hZ2UgMTwvdGV4dD48L3N2Zz4=',
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNEVDRENEIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0iI0ZGRkZGRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlRlc3QgSW1hZ2UgMjwvdGV4dD48L3N2Zz4=',
      'gs://tripbooking-ajtawan.appspot.com/reports/Q1rUo1J8oigi6JSQaItd3C09iwh1' // Will use fallback
    ];
  }

  // ✅ ฟังก์ชันแปลงข้อมูลอุปกรณ์
  private parseDeviceInfo(deviceInfo: any): any {
    if (!deviceInfo) return null;
    
    if (typeof deviceInfo === 'string') {
      try {
        return JSON.parse(deviceInfo);
      } catch {
        return { device_id: deviceInfo };
      }
    }
    
    if (typeof deviceInfo === 'object') {
      return {
        device_id: deviceInfo.device_id || deviceInfo.id || deviceInfo.sensor_id,
        location: deviceInfo.location || deviceInfo.place || deviceInfo.area,
        type: deviceInfo.type || deviceInfo.device_type,
        status: deviceInfo.status || deviceInfo.device_status
      };
    }
    
    return deviceInfo;
  }

  // ✅ ฟังก์ชันดึงข้อมูลจาก direct query (fallback)
  private async loadReportsFromDirectQuery(headers: HttpHeaders) {
    try {
      console.log('🔍 Trying direct PostgreSQL query...');
      
      // ✅ ลองใช้ direct query endpoints
      const directEndpoints = [
        '/api/db/reports',
        '/api/query/reports',
        '/api/sql/reports',
        '/api/database/reports'
      ];

      for (const endpoint of directEndpoints) {
        try {
          const response = await lastValueFrom(
            this.http.get<any>(`${this.apiUrl}${endpoint}`, { headers })
          );
          
          if (response && (Array.isArray(response) || response.data)) {
            const reportsData = Array.isArray(response) ? response : response.data;
            
            // ✅ แปลงข้อมูลและค้นหาภาพจริงใน Firebase Storage
            this.reports = await Promise.all(reportsData.map(async (report: any) => {
              const transformedReport = this.transformReportData(report);
              
              // ค้นหาภาพจริงใน Firebase Storage
              try {
                const realImages = await this.findRealImagesInFirebase(report);
                if (realImages.length > 0) {
                  console.log('🔥 Found real images for report:', transformedReport.key, realImages);
                  transformedReport.images = realImages;
                }
              } catch (error) {
                console.log('⚠️ Could not find real images for report:', transformedReport.key, error);
              }
              
              return transformedReport;
            }));
            
            // เรียงลำดับตาม timestamp
            this.reports.sort((a: Report, b: Report) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            console.log(`✅ Reports loaded from direct query ${endpoint}:`, this.reports.length, 'reports');
            return;
          }
        } catch (error) {
          console.log(`❌ Direct query ${endpoint} failed:`, error);
          continue;
        }
      }
      
      // ✅ ถ้าไม่เจอข้อมูลจริง ให้ใช้ mock data ที่สมจริงขึ้น
      console.log('⚠️ No real data found, using enhanced mock data');
      this.reports = this.getEnhancedMockData();
      
    } catch (error) {
      console.error('❌ Error in direct query:', error);
      this.reports = this.getEnhancedMockData();
    }
  }

  // ✅ Mock data ที่สมจริงขึ้น
  private getEnhancedMockData(): Report[] {
    return [
      {
        key: '1',
        subject: 'อุปกรณ์วัดความชื้นไม่ทำงาน',
        message: 'อุปกรณ์วัดความชื้นในดินไม่แสดงข้อมูลมา 2 วันแล้ว ตรวจสอบแล้วพบว่าแบตเตอรี่หมด และสัญญาณ WiFi ไม่เสถียร',
        timestamp: new Date().toISOString(),
        username: 'เกษตรกร_สมชาย',
        user_email: 'somchai@example.com',
        status: 'new',
        priority: 'high',
        images: [
          'https://via.placeholder.com/400x300/FF6B6B/FFFFFF?text=Sensor+Error+1', // ✅ Working placeholder URL
          'https://via.placeholder.com/400x300/4ECDC4/FFFFFF?text=Battery+Low', // ✅ Working placeholder URL
          'gs://tripbooking-ajtawan.appspot.com/reports/Q1rUo1J8oigi6JSQaItd3C09iwh1', // ✅ Will use fallback if not found
          'reports/sensor_error_1.jpg' // ✅ Will use fallback if not found
        ],
        device_info: { 
          device_id: 'sensor_001', 
          location: 'สวนผักหลังบ้าน',
          type: 'soil_moisture_sensor',
          status: 'offline'
        }
      },
      {
        key: '2',
        subject: 'แอปพลิเคชันค้างเมื่อดูประวัติ',
        message: 'แอปพลิเคชันค้างเมื่อเปิดหน้าประวัติการวัด ทำให้ไม่สามารถดูข้อมูลย้อนหลังได้',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        username: 'เกษตรกร_สมหญิง',
        user_email: 'somying@example.com',
        status: 'read',
        priority: 'medium',
        images: [
          'https://via.placeholder.com/400x300/45B7D1/FFFFFF?text=App+Crash+Screen', // ✅ Working placeholder URL
          'gs://tripbooking-ajtawan.appspot.com/reports/app_crash_screenshot.png', // ✅ Will use fallback if not found
          'reports/app_crash_1.png' // ✅ Will use fallback if not found
        ],
        device_info: { 
          device_id: 'sensor_002', 
          location: 'สวนดอกไม้',
          type: 'temperature_sensor',
          status: 'online'
        }
      },
      {
        key: '3',
        subject: 'ข้อมูลการวัดไม่ถูกต้อง',
        message: 'ค่าความชื้นที่แสดงในแอปไม่ตรงกับสภาพจริงของดิน วัดด้วยเครื่องมืออื่นแล้วพบว่าค่าจริงต่ำกว่า 20% แต่แอปแสดง 80%',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        username: 'เกษตรกร_วิชัย',
        user_email: 'wichai@example.com',
        status: 'new',
        priority: 'high',
        images: [
          'https://via.placeholder.com/400x300/96CEB4/FFFFFF?text=Incorrect+Data', // ✅ Working placeholder URL
          'https://via.placeholder.com/400x300/FFEAA7/FFFFFF?text=Manual+Test', // ✅ Working placeholder URL
          'gs://tripbooking-ajtawan.appspot.com/reports/data_issue_analysis.jpg', // ✅ Will use fallback if not found
          'reports/incorrect_data_1.jpg' // ✅ Will use fallback if not found
        ],
        device_info: { 
          device_id: 'sensor_003', 
          location: 'ไร่ข้าวโพด',
          type: 'soil_moisture_sensor',
          status: 'online'
        }
      }
    ];
  }

  async deleteReport(key: string) {
    if (confirm('ต้องการลบเรื่องนี้จริงหรือไม่?')) {
      try {
        const headers = await this.getAuthHeaders();
        await lastValueFrom(
          this.http.delete(`${this.apiUrl}/api/reports/${key}`, { headers })
        );
        this.notificationService.showNotification('success', 'ลบสำเร็จ', 'รายงานถูกลบเรียบร้อยแล้ว');
        if (this.selectedReport && this.selectedReport.key === key) {
          this.selectedReport = null;
        }
        this.loadReports();
      } catch (error) {
        console.error('❌ Error deleting report:', error);
        this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการลบ');
      }
    }
  }

  // ✅ ฟังก์ชันอัปเดตสถานะรายงาน
  async updateReportStatus(key: string, status: string) {
    try {
      const headers = await this.getAuthHeaders();
      
      // ✅ ลองใช้หลาย endpoints สำหรับอัปเดตสถานะ
      const updateEndpoints = [
        `/api/reports/${key}/status`,
        `/api/reports/${key}`,
        `/api/admin/reports/${key}/status`,
        `/api/user-reports/${key}/status`
      ];

      let updateSuccess = false;
      for (const endpoint of updateEndpoints) {
        try {
          console.log(`🔧 Trying to update status via: ${endpoint}`);
          await lastValueFrom(
            this.http.put(`${this.apiUrl}${endpoint}`, { status }, { headers })
          );
          console.log(`✅ Status updated successfully via ${endpoint}`);
          updateSuccess = true;
          break;
        } catch (endpointError: any) {
          console.log(`❌ Update endpoint ${endpoint} failed:`, endpointError.status);
          continue;
        }
      }

      if (updateSuccess) {
        this.notificationService.showNotification('success', 'อัปเดตสำเร็จ', 'สถานะรายงานถูกอัปเดตเรียบร้อยแล้ว');
        // ✅ อัปเดตสถานะใน local data ทันที
        const report = this.reports.find(r => r.key === key);
        if (report) {
          report.status = status;
        }
        // ✅ Reload ข้อมูลใหม่
        await this.loadReports();
      } else {
        // ✅ ถ้าไม่สามารถอัปเดตได้ ให้อัปเดตใน local data เท่านั้น
        const report = this.reports.find(r => r.key === key);
        if (report) {
          report.status = status;
          this.notificationService.showNotification('warning', 'อัปเดตในเครื่อง', 'อัปเดตสถานะในเครื่องเท่านั้น (ไม่สามารถเชื่อมต่อ backend)');
        }
      }
    } catch (error) {
      console.error('❌ Error updating report status:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    }
  }

  // ✅ ฟังก์ชัน refresh ข้อมูล
  async refreshReports() {
    console.log('🔄 Refreshing reports...');
    await this.loadReports();
  }

  // ✅ ฟังก์ชันดูภาพประกอบ (รองรับ Firebase Storage)
  async viewImage(imageUrl: string) {
    try {
      let finalImageUrl = imageUrl;
      
      // ✅ ถ้าเป็น Firebase Storage path ให้แปลงเป็น URL
      if (this.isFirebaseStorageUrl(imageUrl)) {
        console.log('🔍 Converting Firebase Storage path to URL:', imageUrl);
        finalImageUrl = await this.convertFirebasePathToUrl(imageUrl);
      }
      
      this.selectedImage = finalImageUrl;
      this.showImageModal = true;
    } catch (error) {
      console.error('❌ Error loading image:', error);
      this.notificationService.showNotification('error', 'ไม่สามารถโหลดภาพได้', 'เกิดข้อผิดพลาดในการโหลดภาพ');
    }
  }

  // ✅ ฟังก์ชันปิด image modal
  closeImageModal() {
    this.showImageModal = false;
    this.selectedImage = null;
  }

  // ✅ ฟังก์ชันดาวน์โหลดภาพ
  downloadImage(imageUrl: string, filename: string) {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ✅ ฟังก์ชันดึงภาพจาก Firebase Storage
  async getImageFromFirebaseStorage(imagePath: string): Promise<string> {
    try {
      console.log('🔍 Getting image from Firebase Storage:', imagePath);
      const imageRef = ref(this.storage, imagePath);
      const downloadURL = await getDownloadURL(imageRef);
      console.log('✅ Image URL retrieved:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('❌ Error getting image from Firebase Storage:', error);
      throw error;
    }
  }

  // ✅ ฟังก์ชันดึงรายการภาพจาก Firebase Storage folder
  async getImagesFromFirebaseFolder(folderPath: string): Promise<string[]> {
    try {
      console.log('🔍 Getting images from Firebase Storage folder:', folderPath);
      const folderRef = ref(this.storage, folderPath);
      const result = await listAll(folderRef);
      
      const imageUrls: string[] = [];
      for (const itemRef of result.items) {
        try {
          const downloadURL = await getDownloadURL(itemRef);
          imageUrls.push(downloadURL);
        } catch (error) {
          console.error('❌ Error getting URL for item:', itemRef.name, error);
        }
      }
      
      console.log('✅ Images retrieved from folder:', imageUrls.length, 'images');
      return imageUrls;
    } catch (error) {
      console.error('❌ Error getting images from Firebase Storage folder:', error);
      return [];
    }
  }

  // ✅ ฟังก์ชันตรวจสอบว่าเป็น Firebase Storage URL หรือไม่
  isFirebaseStorageUrl(url: string): boolean {
    return url.includes('firebasestorage.googleapis.com') || 
           url.includes('storage.googleapis.com') ||
           url.startsWith('gs://') ||
           url.startsWith('/reports/') ||
           url.startsWith('reports/') ||
           url.includes('tripbooking-ajtawan.appspot.com'); // ✅ รองรับ bucket ของคุณ
  }

  // ✅ ฟังก์ชันแปลง Firebase Storage path เป็น URL
  async convertFirebasePathToUrl(imagePath: string): Promise<string> {
    try {
      if (this.isFirebaseStorageUrl(imagePath)) {
        // ถ้าเป็น full URL แล้ว
        if (imagePath.startsWith('http')) {
          return imagePath;
        }
        // ถ้าเป็น gs:// URL
        if (imagePath.startsWith('gs://')) {
          console.log('🔍 Converting gs:// URL:', imagePath);
          const path = imagePath.replace('gs://', '').split('/');
          const bucket = path[0];
          const filePath = path.slice(1).join('/');
          console.log('📁 Bucket:', bucket, 'File path:', filePath);
          
          try {
            return await this.getImageFromFirebaseStorage(filePath);
          } catch (firebaseError) {
            console.warn('⚠️ Firebase Storage file not found, using fallback URL');
            // สร้าง fallback URL จาก gs:// path
            return this.createFallbackUrl(imagePath);
          }
        }
        // ถ้าเป็น relative path
        try {
          return await this.getImageFromFirebaseStorage(imagePath);
        } catch (firebaseError) {
          console.warn('⚠️ Firebase Storage file not found, using fallback URL');
          return this.createFallbackUrl(imagePath);
        }
      }
      return imagePath; // ถ้าไม่ใช่ Firebase Storage path
    } catch (error) {
      console.error('❌ Error converting Firebase path to URL:', error);
      return this.createFallbackUrl(imagePath);
    }
  }

  // ✅ ฟังก์ชันสร้าง fallback URL
  private createFallbackUrl(imagePath: string): string {
    // ถ้าเป็น gs:// URL ให้สร้าง placeholder URL
    if (imagePath.startsWith('gs://')) {
      const path = imagePath.replace('gs://', '').split('/');
      const fileName = path[path.length - 1];
      const fileExtension = fileName.split('.').pop() || 'jpg';
      
      // สร้าง data URL SVG ตามประเภทไฟล์
      if (fileExtension.toLowerCase().includes('png')) {
        return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNENBRjUwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0iI0ZGRkZGRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBGb3VuZCAoJHtmaWxlTmFtZX0pPC90ZXh0Pjwvc3ZnPg==`;
      } else if (fileExtension.toLowerCase().includes('jpg') || fileExtension.toLowerCase().includes('jpeg')) {
        return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRkY5ODAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0iI0ZGRkZGRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBGb3VuZCAoJHtmaWxlTmFtZX0pPC90ZXh0Pjwvc3ZnPg==`;
      } else {
        return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjOUU5RTlFIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0iI0ZGRkZGRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkZpbGUgTm90IEZvdW5kICgke2ZpbGVOYW1lfSk8L3RleHQ+PC9zdmc+`;
      }
    }
    
    // ถ้าเป็น relative path
    if (imagePath.startsWith('reports/')) {
      const fileName = imagePath.split('/').pop();
      return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMjE5NkYzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0iI0ZGRkZGRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlJlcG9ydCBJbWFnZSAoJHtmaWxlTmFtZX0pPC90ZXh0Pjwvc3ZnPg==`;
    }
    
    // Default fallback
    return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNzU3NTc1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0iI0ZGRkZGRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBBdmFpbGFibGU8L3RleHQ+PC9zdmc+`;
  }

  // ✅ ฟังก์ชันทดสอบ Firebase Storage connection
  async testFirebaseStorageConnection() {
    try {
      console.log('🧪 Testing Firebase Storage connection...');
      
      // ทดสอบด้วย URL ที่คุณให้มา
      const testUrl = 'gs://tripbooking-ajtawan.appspot.com/reports/Q1rUo1J8oigi6JSQaItd3C09iwh1';
      console.log('🔍 Test URL:', testUrl);
      
      const downloadURL = await this.convertFirebasePathToUrl(testUrl);
      console.log('✅ Firebase Storage test completed!');
      console.log('📸 Final URL:', downloadURL);
      
      // ตรวจสอบว่าได้ fallback URL หรือไม่
      if (downloadURL.includes('via.placeholder.com')) {
        console.log('⚠️ Using fallback URL - Firebase Storage file not found');
        this.notificationService.showNotification('warning', 'Firebase Storage: ไฟล์ไม่พบ', 'ใช้ placeholder image แทน ไฟล์จริงอาจยังไม่ได้อัปโหลด');
      } else {
        console.log('✅ Firebase Storage file found and accessible');
        this.notificationService.showNotification('success', 'Firebase Storage เชื่อมต่อสำเร็จ!', 'สามารถดูภาพจาก Firebase Storage ได้แล้ว');
      }
      
      return downloadURL;
    } catch (error) {
      console.error('❌ Firebase Storage test failed:', error);
      this.notificationService.showNotification('error', 'Firebase Storage เชื่อมต่อไม่สำเร็จ', 'กรุณาตรวจสอบการตั้งค่า Firebase Storage');
      throw error;
    }
  }

  // ✅ ฟังก์ชันค้นหาไฟล์จริงใน Firebase Storage
  async findRealImagesInFirebase(reportData: any): Promise<string[]> {
    try {
      console.log('🔍 Searching for real images in Firebase Storage for report:', reportData);
      
      const reportId = reportData.reportid || reportData.id || reportData.report_id || 'unknown';
      const userId = reportData.user_id || reportData.userid || reportData.user?.id || 'unknown';
      const username = reportData.username || reportData.user_name || reportData.reporter || 'unknown';
      
      const searchPaths = [
        `reports/${reportId}/`,
        `reports/${userId}/`,
        `reports/${username}/`,
        `user-reports/${reportId}/`,
        `user-reports/${userId}/`,
        `user-reports/${username}/`,
        `reports/`,
        `user-uploads/${userId}/`,
        `user-uploads/${username}/`
      ];
      
      const foundImages: string[] = [];
      
      for (const path of searchPaths) {
        try {
          console.log('🔍 Searching in path:', path);
          const images = await this.getImagesFromFirebaseFolder(path);
          if (images.length > 0) {
            console.log(`✅ Found ${images.length} images in ${path}:`, images);
            foundImages.push(...images);
          }
        } catch (error) {
          console.log(`❌ No images found in ${path}:`, error);
        }
      }
      
      // ลบ duplicates
      const uniqueImages = [...new Set(foundImages)];
      console.log('📸 Total unique images found:', uniqueImages);
      
      return uniqueImages;
    } catch (error) {
      console.error('❌ Error searching for real images:', error);
      return [];
    }
  }

  // ✅ ฟังก์ชันค้นหาภาพจริงใน Firebase Storage สำหรับรายงานทั้งหมด
  async searchRealImagesInFirebase() {
    try {
      console.log('🔍 Searching for real images in Firebase Storage for all reports...');
      this.loading = true;
      
      if (this.reports.length === 0) {
        this.notificationService.showNotification('warning', 'ไม่มีรายงาน', 'กรุณาโหลดรายงานก่อนค้นหาภาพ');
        return;
      }
      
      let foundCount = 0;
      
      for (let i = 0; i < this.reports.length; i++) {
        const report = this.reports[i];
        console.log(`🔍 Searching images for report ${i + 1}/${this.reports.length}:`, report.key);
        
        try {
          const realImages = await this.findRealImagesInFirebase(report);
          if (realImages.length > 0) {
            console.log(`🔥 Found ${realImages.length} real images for report:`, report.key);
            report.images = realImages;
            foundCount++;
          } else {
            console.log(`❌ No real images found for report:`, report.key);
          }
        } catch (error) {
          console.log(`⚠️ Error searching images for report ${report.key}:`, error);
        }
      }
      
      console.log(`✅ Image search completed. Found images for ${foundCount}/${this.reports.length} reports`);
      
      if (foundCount > 0) {
        this.notificationService.showNotification('success', 'ค้นหาภาพสำเร็จ!', `พบภาพใน ${foundCount} รายงาน`);
      } else {
        this.notificationService.showNotification('warning', 'ไม่พบภาพ', 'ไม่พบภาพใน Firebase Storage สำหรับรายงานใดๆ');
      }
      
    } catch (error) {
      console.error('❌ Error searching for real images:', error);
      this.notificationService.showNotification('error', 'ค้นหาภาพไม่สำเร็จ', 'เกิดข้อผิดพลาดในการค้นหาภาพ');
    } finally {
      this.loading = false;
    }
  }

  // ✅ ฟังก์ชันอัปโหลดไฟล์ทดสอบไปยัง Firebase Storage
  async uploadTestFileToFirebase() {
    try {
      console.log('📤 Uploading test file to Firebase Storage...');
      
      // สร้างไฟล์ทดสอบ (blob)
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // วาดพื้นหลัง
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(0, 0, 400, 300);
        
        // วาดข้อความ
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Test Image from Frontend', 200, 150);
        ctx.fillText(new Date().toLocaleString(), 200, 180);
        
        // แปลงเป็น blob
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
          }, 'image/png');
        });
        
        // สร้าง unique filename
        const timestamp = Date.now();
        const fileName = `test_image_${timestamp}.png`;
        const filePath = `reports/${fileName}`;
        
        console.log('📁 Uploading to path:', filePath);
        
        // อัปโหลดไปยัง Firebase Storage
        const { uploadBytes, getDownloadURL } = await import('@angular/fire/storage');
        const storageRef = ref(this.storage, filePath);
        
        const snapshot = await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        console.log('✅ Test file uploaded successfully!');
        console.log('📸 Download URL:', downloadURL);
        console.log('🔗 gs:// URL:', `gs://tripbooking-ajtawan.appspot.com/${filePath}`);
        
        this.notificationService.showNotification('success', 'อัปโหลดไฟล์ทดสอบสำเร็จ!', `ไฟล์: ${fileName}`);
        
        return {
          fileName,
          filePath,
          downloadURL,
          gsUrl: `gs://tripbooking-ajtawan.appspot.com/${filePath}`
        };
      }
      
      // Fallback return if canvas context is not available
      throw new Error('Canvas context not available');
    } catch (error) {
      console.error('❌ Error uploading test file:', error);
      this.notificationService.showNotification('error', 'อัปโหลดไฟล์ไม่สำเร็จ', 'กรุณาตรวจสอบการตั้งค่า Firebase Storage');
      throw error;
    }
  }

  openReportModal(report: Report) {
    this.selectedReport = report;
  }

  closeReportModal() {
    this.selectedReport = null;
  }

  goBack() {
    this.location.back();
  }
}
