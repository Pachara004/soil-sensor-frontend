import { Component } from '@angular/core';
import { Route, Router } from '@angular/router';
import { Location } from '@angular/common';

@Component({
  selector: 'app-forgotpass',
  standalone: true,
  imports: [],
  templateUrl: './forgotpass.component.html',
  styleUrl: './forgotpass.component.scss'
})
export class ForgotpassComponent {
constructor(
  private router: Router,
  private location: Location) {}
  goBack(){
    this.location.back();
  }
  sendOtp() {
    console.log('ส่ง OTP แล้ว');
  }

  confirmOtp() {
    console.log('ตรวจสอบ OTP แล้ว');
  }
}
