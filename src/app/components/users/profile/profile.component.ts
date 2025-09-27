import { Component, OnInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Constants } from '../../../config/constants';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  userID: string | null = null;
  name: string = '';
  username: string = '';
  email: string = '';
  phoneNumber: string = '';
  userType: string = '';
  emailVerified: boolean = false;
  isLoading: boolean = true;
  showCardMenu = false;
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
    // ตรวจสอบ Firebase auth state
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        console.log('✅ User is authenticated in profile:', user.email);
        this.loadUserProfile(user);
      } else {
        console.log('❌ User is not authenticated, redirecting to login');
        this.router.navigate(['/']);
      }
    });
  }

  async loadUserProfile(firebaseUser: any) {
    try {
      this.isLoading = true;
      
      // ใช้ข้อมูลจาก Firebase เป็นหลัก
      this.userID = firebaseUser.uid;
      this.email = firebaseUser.email || '';
      this.emailVerified = firebaseUser.emailVerified || false;
      this.name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '';
      this.username = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '';

      console.log('👤 Loading user profile from backend...');
      
      // ลองดึงข้อมูลเพิ่มเติมจาก backend
      try {
        const token = await firebaseUser.getIdToken();
        console.log('🔑 Firebase ID token obtained for profile');

        // ลองใช้ API endpoints หลายตัว
        const endpoints = [
          '/api/auth/me',
          '/api/user/profile',
          '/api/user/me'
        ];

        for (const endpoint of endpoints) {
          try {
            console.log(`🔍 Trying endpoint: ${endpoint}`);
            const response = await lastValueFrom(
              this.http.get<any>(`${this.apiUrl}${endpoint}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              })
            );
            
            console.log(`✅ Success with ${endpoint}:`, response);
            
            // อัปเดตข้อมูลจาก backend ถ้ามี
            let userData = response;
            if (response.user) {
              userData = response.user;
            }
            
            console.log('📋 User data from backend:', userData);
            console.log('📞 Phone fields available:', {
              user_phone: userData.user_phone,  // ✅ เพิ่ม user_phone
              phone: userData.phone,
              phoneNumber: userData.phoneNumber,
              phone_number: userData.phone_number,
              mobile: userData.mobile,
              tel: userData.tel,
              contact: userData.contact
            });
            
            if (userData.user_name || userData.username || userData.name) {
              this.username = userData.user_name || userData.username || userData.name || this.username;
              this.name = userData.user_name || userData.username || userData.name || this.name;
            }
            if (userData.email) {
              this.email = userData.email;
            }
            
            // ลองหาเบอร์โทรศัพท์จาก field names หลายแบบ
            const phoneValue = userData.user_phone ||  // ✅ เพิ่ม user_phone
                              userData.phone || 
                              userData.phoneNumber || 
                              userData.phone_number || 
                              userData.mobile || 
                              userData.tel || 
                              userData.contact || 
                              userData.phone_no ||
                              userData.phoneNo ||
                              '';
            
            if (phoneValue) {
              this.phoneNumber = phoneValue;
              console.log('📞 Phone number found:', phoneValue);
            } else {
              console.log('❌ No phone number found in backend data');
            }
            
            if (userData.type || userData.userType) {
              this.userType = userData.type || userData.userType || 'user';
            }
            
            console.log('👤 Updated profile data from backend');
            break; // หยุดเมื่อเจอ endpoint ที่ทำงานได้
          } catch (endpointError: any) {
            console.log(`❌ Endpoint ${endpoint} failed:`, endpointError.status);
            continue; // ลอง endpoint ถัดไป
          }
        }
      } catch (tokenError) {
        console.log('❌ Failed to get token for additional profile data');
      }
      
    } catch (error: any) {
      console.error('❌ Error loading user profile:', error);
    } finally {
      this.isLoading = false;
      console.log('📋 Final profile data:', {
        userID: this.userID,
        username: this.username,
        name: this.name,
        email: this.email,
        phoneNumber: this.phoneNumber,
        userType: this.userType,
        emailVerified: this.emailVerified
      });
    }
  }

  goBack() {
    this.location.back();
  }

  goToEditProfile() {
    this.router.navigate(['/edit-profile']);
  }

  goToContactAdmin() {
    this.router.navigate(['/reports']);
  }

  goToHistory() {
    this.router.navigate(['/history']);
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
