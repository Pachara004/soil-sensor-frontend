import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Constants } from '../../../config/constants';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { lastValueFrom } from 'rxjs';

interface UserData {
  email: string;
  name: string;
  password: string;
  phoneNumber: string;
  type: string;
  userID: string;
  username: string;
  devices?: { [key: string]: boolean };
}

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './edit-profile.component.html',
  styleUrl: './edit-profile.component.scss',
})
export class EditProfileComponent implements OnInit {
  userID: string | null = null;
  username: string = '';
  name: string = '';
  email: string = '';
  phoneNumber: string = '';
  password: string = '';
  confirmPassword: string = '';
  isLoading: boolean = true;
  currentUser: any = null;
  private apiUrl: string;

  constructor(
    private router: Router,
    private location: Location,
    private http: HttpClient,
    private constants: Constants,
    private auth: Auth
  ) {
    this.apiUrl = this.constants.API_ENDPOINT;
  }

  ngOnInit(): void {
    // ✅ ใช้ Firebase Auth แทน localStorage
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.currentUser = user;
        this.username = user.displayName || user.email?.split('@')[0] || '';
        this.email = user.email || '';
        console.log('✅ User authenticated in edit-profile:', this.username);
        
        // ✅ ดึงข้อมูลเพิ่มเติมจาก backend
        await this.loadUserProfile();
      } else {
        console.log('❌ User not authenticated, redirecting to login');
        this.router.navigate(['/']);
      }
    });
  }

  // ✅ ดึงข้อมูล user profile จาก backend
  async loadUserProfile() {
    if (!this.currentUser) return;
    
    try {
      console.log('👤 Loading user profile from backend...');
      
      const token = await this.currentUser.getIdToken();
      console.log('🔑 Firebase ID token obtained for edit-profile');
      
      // ✅ ดึงข้อมูล user
      try {
        const userResponse = await lastValueFrom(
          this.http.get<any>(`${this.apiUrl}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );
        
        if (userResponse && userResponse.user) {
          const userData = userResponse.user;
          this.username = userData.user_name || userData.username || this.username;
          this.name = userData.fullname || this.username; // ✅ ลบ user_fullname ออก
          this.email = userData.user_email || userData.email || this.email;
          this.phoneNumber = userData.user_phone || userData.phone || '';
          
          console.log('👤 User profile loaded:', {
            username: this.username,
            name: this.name,
            email: this.email,
            phoneNumber: this.phoneNumber
          });
        } else {
          console.log('⚠️ No user data in backend response, using Firebase data');
        }
      } catch (userError) {
        console.log('⚠️ Could not load user data from backend, using Firebase data:', userError);
      }
      
      this.isLoading = false;
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
      this.isLoading = false;
    }
  }

  async saveProfile() {
    if (this.password && this.password !== this.confirmPassword) {
      alert('รหัสผ่านไม่ตรงกัน');
      return;
    }

    if (!this.userID || !this.username) {
      alert('ไม่พบรหัสผู้ใช้หรือชื่อผู้ใช้');
      return;
    }

    try {
      const updates: Partial<UserData> = {
        username: this.username,
        name: this.name,
        email: this.email,
        phoneNumber: this.phoneNumber,
      };
      if (this.password) {
        updates.password = this.password;
      }

      await this.http
        .put(`${this.apiUrl}/api/users/${this.username}`, updates)
        .toPromise();

      // อัปเดต localStorage
      localStorage.setItem(
        'user',
        JSON.stringify({
          userID: this.userID,
          username: this.username,
          name: this.name,
          email: this.email,
          phoneNumber: this.phoneNumber,
        })
      );
      localStorage.setItem(
        'admin',
        JSON.stringify({
          username: this.username,
          name: this.name,
        })
      );

      alert('บันทึกข้อมูลสำเร็จ!');
      this.location.back();
    } catch (error) {
      console.error('ข้อผิดพลาดในการบันทึก:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    }
  }

  goBack() {
    this.location.back();
  }

  goToContactAdmin() {
    this.router.navigate(['/reports']);
  }
}
