import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  userID: string | null = null;
  name: string = ''; // เพิ่ม name        
  username: string = '';
  email: string = '';
  phoneNumber: string = '';

  constructor(
    private router: Router,
    private location: Location 
  ) {}

ngOnInit(): void {
  let userData = localStorage.getItem('user');

  if (!userData) {
    userData = localStorage.getItem('admin'); // ถ้าไม่มี user → ลองหา admin
  }

  if (userData) {
    const user = JSON.parse(userData);
    this.userID = user.userID || user[0]?.userID || null;
    this.name = user.name || user[0]?.name || ''; // โหลด name
    this.username = user.username || user[0]?.username || '';
    this.email = user.email || user[0]?.email || '';
    this.phoneNumber = user.phoneNumber || user[0]?.phoneNumber || '';
  } else {
    alert('ไม่พบข้อมูลผู้ใช้');
    this.router.navigate(['/']);
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
}
