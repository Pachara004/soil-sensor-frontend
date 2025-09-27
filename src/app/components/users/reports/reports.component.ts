import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Constants } from '../../../config/constants';
import { NotificationService } from '../../../service/notification.service';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';

interface SelectedImage {
  file: File;
  preview: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  subject: string = '';
  message: string = '';
  selectedImages: SelectedImage[] = [];
  isUploading: boolean = false;
  currentUser: any = null;
  private apiUrl: string;

  constructor(
    private router: Router,
    private location: Location,
    private http: HttpClient,
    private constants: Constants,
    private notificationService: NotificationService,
    private storage: Storage,
    private auth: Auth
  ) {
    this.apiUrl = this.constants.API_ENDPOINT;
    
    // ตรวจสอบ user authentication
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
    });
  }

  goBack() {
    this.location.back();
  }

  onImageSelected(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // ตรวจสอบขนาดไฟล์ (ไม่เกิน 5MB)
        if (file.size > 5 * 1024 * 1024) {
          this.notificationService.showNotification('error', 'ไฟล์ใหญ่เกินไป', 'ขนาดไฟล์ต้องไม่เกิน 5MB');
          continue;
        }

        // ตรวจสอบประเภทไฟล์
        if (!file.type.startsWith('image/')) {
          this.notificationService.showNotification('error', 'ประเภทไฟล์ไม่ถูกต้อง', 'กรุณาเลือกไฟล์รูปภาพเท่านั้น');
          continue;
        }

        // สร้าง preview
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.selectedImages.push({
            file: file,
            preview: e.target.result
          });
        };
        reader.readAsDataURL(file);
      }
    }
    
    // ล้าง input เพื่อให้สามารถเลือกไฟล์เดิมได้อีก
    event.target.value = '';
  }

  removeImage(index: number) {
    this.selectedImages.splice(index, 1);
  }

  async uploadImagesToFirebase(): Promise<string[]> {
    if (this.selectedImages.length === 0) {
      return [];
    }

    const uploadPromises = this.selectedImages.map(async (imageData, index) => {
      const timestamp = Date.now();
      const fileName = `reports/${this.currentUser?.uid || 'anonymous'}/${timestamp}_${index}_${imageData.file.name}`;
      const storageRef = ref(this.storage, fileName);
      
      try {
        const snapshot = await uploadBytes(storageRef, imageData.file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
      } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
      }
    });

    return Promise.all(uploadPromises);
  }

  async sendReport() {
    if (!this.subject.trim() || !this.message.trim()) {
      this.notificationService.showNotification('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    this.isUploading = true;

    try {
      let imageUrls: string[] = [];

      // อัปโหลดรูปภาพไปยัง Firebase Storage (ถ้ามี)
      if (this.selectedImages.length > 0) {
        this.notificationService.showNotification('info', 'กำลังอัปโหลดรูปภาพ...', 'กรุณารอสักครู่');
        imageUrls = await this.uploadImagesToFirebase();
      }

      // ส่งข้อมูลไปยัง backend
      const reportData = {
        subject: this.subject,
        message: this.message,
        timestamp: new Date().toISOString(),
        images: imageUrls,
        userId: this.currentUser?.uid || null,
        userEmail: this.currentUser?.email || null
      };

      await this.http
        .post(`${this.apiUrl}/api/reports`, reportData)
        .toPromise();

      this.notificationService.showNotification('success', 'ส่งเรื่องสำเร็จ!', 'ทีมงานจะติดต่อกลับโดยเร็ว', true, 'กลับ', () => {
        this.location.back();
      });

      // ล้างฟอร์ม
      this.subject = '';
      this.message = '';
      this.selectedImages = [];
    } catch (error) {
      console.error('Error sending report:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการส่งรายงาน');
    } finally {
      this.isUploading = false;
    }
  }
}
