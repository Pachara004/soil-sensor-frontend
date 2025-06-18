import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './edit-profile.component.html',
  styleUrl: './edit-profile.component.scss'
})
export class EditProfileComponent implements OnInit {
  userID: string | null = null;
  username: string = '';
  email: string = '';
  phone: string = '';
  password: string = '';
  confirmPassword: string = '';


  constructor(private router: Router) {}

  ngOnInit(): void {
    // รับข้อมูลจาก localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      this.userID = user.userID || user[0]?.userID || null;
      this.username = user.username || user[0]?.username || '';
      this.email = user.email || user[0]?.email || '';
      this.phone = user.phone || user[0]?.phone || '';
    } else {
      alert('ไม่พบข้อมูลผู้ใช้');
      this.router.navigate(['/']); // redirect ไปหน้า login
    }
  }
  goBack() {
    this.router.navigate(['/profile']); 
  }
}