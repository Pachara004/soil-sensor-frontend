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
  
  // ✅ Delete report loading state
  deletingReport = false;
  deletingReportKey: string | null = null;
  
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
      
      // ✅ ใช้ endpoint หลักสำหรับดึงข้อมูล reports
      try {
        console.log('🔍 Loading reports from /api/reports');
        const response = await lastValueFrom(
          this.http.get<any>(`${this.apiUrl}/api/reports`, { headers })
        );
        
        console.log('📊 Response from /api/reports:', response);
        
        // ✅ ตรวจสอบ response format
        let reportsData: any[] = [];
        
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
          // ✅ แปลงข้อมูลให้ตรงกับ interface
          this.reports = reportsData.map((report: any) => {
            return this.transformReportData(report);
          });
          
          // เรียงลำดับตาม timestamp
          this.reports.sort((a, b) => {
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          });
          
          console.log(`✅ Reports loaded from /api/reports:`, this.reports.length, 'reports');
          console.log('📋 Sample report data:', this.reports[0]);
        } else {
          console.log('⚠️ No reports found in response');
          this.reports = [];
        }
        
      } catch (endpointError: any) {
        console.log(`❌ Reports endpoint /api/reports failed:`, endpointError.status, endpointError.message);
        
        // ✅ ถ้าไม่สามารถดึงข้อมูลได้ ให้แสดงข้อความแจ้งเตือน
        this.reports = [];
        this.notificationService.showNotification('warning', 'ไม่สามารถโหลดรายงานได้', 'กรุณาตรวจสอบการเชื่อมต่อหรือสิทธิ์การเข้าถึง');
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
    console.log('🔍 Raw report data:', data);
    console.log('🔍 Images data:', data.images);
    
    const parsedImages = this.parseImages(data.images || data.attachments || data.files || []);
    console.log('🔍 Parsed images:', parsedImages);
    
    const report: Report = {
      key: data.key || data.id || data.report_id || String(data.id),
      subject: data.subject || data.title || data.report_title || 'ไม่มีหัวข้อ',
      message: data.message || data.description || data.content || data.report_message || '',
      timestamp: data.timestamp || data.created_at || data.date || new Date().toISOString(),
      username: data.username || data.user_name || data.reporter || data.user?.username || 'ไม่ระบุ',
      user_email: data.user_email || data.email || data.user?.email || data.reporter_email,
      status: data.status || data.report_status || 'new',
      priority: data.priority || data.report_priority || data.urgency || 'medium',
      images: parsedImages,
      device_info: this.parseDeviceInfo(data.device_info || data.device || data.sensor_info)
    };
    
    console.log('🔍 Final report object:', report);
    return report;
  }

  // ✅ ฟังก์ชันแปลงข้อมูลภาพ
  private parseImages(images: any): string[] {
    if (!images) {
      return [];
    }
    
    if (Array.isArray(images)) {
      return images.map((img) => {
        if (typeof img === 'string') {
          return img;
        }
        if (img.url) {
          return img.url;
        }
        if (img.image_url) {
          return img.image_url;
        }
        if (img.imageurl) {
          return img.imageurl; // ✅ เพิ่ม imageurl (จาก database)
        }
        if (img.file_path) {
          return img.file_path;
        }
        if (img.storage_path) {
          return img.storage_path;
        }
        return String(img);
      }).filter(url => url && url.length > 0);
    }
    
    return [];
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



  async deleteReport(key: string) {
    // ✅ ใช้ notification popup แทน confirm()
    this.notificationService.showNotification('warning', 'ยืนยันการลบ', 'ต้องการลบเรื่องนี้จริงหรือไม่?', true, 'ลบ', async () => {
      // เริ่ม loading state
      this.deletingReport = true;
      this.deletingReportKey = key;
      
      try {
        console.log('🗑️ Deleting report:', key);
        const headers = await this.getAuthHeaders();
        
        // ✅ ลองใช้หลาย endpoints สำหรับลบ
        const deleteEndpoints = [
          `/api/reports/${key}`,
          `/api/admin/reports/${key}`,
          `/api/user-reports/${key}`
        ];

        let deleteSuccess = false;
        for (const endpoint of deleteEndpoints) {
          try {
            console.log(`🗑️ Trying to delete via: ${endpoint}`);
            await lastValueFrom(
              this.http.delete(`${this.apiUrl}${endpoint}`, { headers })
            );
            console.log(`✅ Report deleted successfully via ${endpoint}`);
            deleteSuccess = true;
            break;
          } catch (endpointError: any) {
            console.log(`❌ Delete endpoint ${endpoint} failed:`, endpointError.status);
            continue;
          }
        }

        if (deleteSuccess) {
          this.notificationService.showNotification('success', 'ลบสำเร็จ', 'รายงานถูกลบเรียบร้อยแล้ว');
          
          // ✅ ปิด modal ถ้าเป็นรายงานที่เลือกอยู่
          if (this.selectedReport && this.selectedReport.key === key) {
            this.selectedReport = null;
          }
          
          // ✅ ลบรายงานจาก local array ทันที
          this.reports = this.reports.filter(report => report.key !== key);
          
          // ✅ Reload ข้อมูลใหม่
          await this.loadReports();
        } else {
          // ✅ ถ้าไม่สามารถลบได้ ให้ลบจาก local array เท่านั้น
          this.reports = this.reports.filter(report => report.key !== key);
          if (this.selectedReport && this.selectedReport.key === key) {
            this.selectedReport = null;
          }
          this.notificationService.showNotification('warning', 'ลบในเครื่อง', 'ลบรายงานในเครื่องเท่านั้น (ไม่สามารถเชื่อมต่อ backend)');
        }
      } catch (error) {
        console.error('❌ Error deleting report:', error);
        this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการลบรายงาน');
      } finally {
        // หยุด loading state
        this.deletingReport = false;
        this.deletingReportKey = null;
      }
    });
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

  // ✅ ฟังก์ชันดูภาพประกอบ
  viewImage(imageUrl: string) {
    this.selectedImage = imageUrl;
    this.showImageModal = true;
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
