import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Database, ref, update } from '@angular/fire/database';

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
  styleUrl: './edit-profile.component.scss'
})
export class EditProfileComponent implements OnInit {
  userID: string | null = null;
  username: string = '';
  name: string = ''; // เพิ่ม name
  email: string = '';
  phoneNumber: string = '';
  password: string = '';
  confirmPassword: string = '';

  constructor(
    private router: Router,
    private location: Location,
    private db: Database
  ) {}

  ngOnInit(): void {
    let userData = localStorage.getItem('user');
    if (!userData) {
      userData = localStorage.getItem('admin');
    }

    if (userData) {
      const user: UserData = JSON.parse(userData);
      this.userID = user.userID || user.username || null;
      this.username = user.username || '';
      this.name = user.name || user.username || ''; // โหลด name
      this.email = user.email || '';
      this.phoneNumber = user.phoneNumber || '';
    } else {
      alert('ไม่พบข้อมูลผู้ใช้');
      this.router.navigate(['/']);
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
      const userRef = ref(this.db, `users/${this.username}`);
      const updates: Partial<UserData> = {
        username: this.username,
        name: this.name, // เพิ่ม name
        email: this.email,
        phoneNumber: this.phoneNumber
      };
      if (this.password) {
        updates.password = this.password;
      }

      await update(userRef, updates);

      // อัปเดต localStorage
      localStorage.setItem('user', JSON.stringify({
        userID: this.userID,
        username: this.username,
        name: this.name, // เพิ่ม name
        email: this.email,
        phoneNumber: this.phoneNumber
      }));
      localStorage.setItem('admin', JSON.stringify({
        username: this.username,
        name: this.name // ใช้ name แทน username
      }));

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