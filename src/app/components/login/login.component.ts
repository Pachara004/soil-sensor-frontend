import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NavigationExtras, Router } from '@angular/router';
import { Users } from '../../Models/login-signup';
import { Npkservice } from '../../service/npkservice';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [MatProgressSpinnerModule,CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  isLoading: boolean = false;
  userlogin : Users[] = [];
  constructor(private npkservice: Npkservice, private router: Router, private http: HttpClient) {}
  // async loginuser(username: string, password: string,event: Event) {

  //   // event.preventDefault();
  //   if (username.trim() === '' || password.trim() === '') {
  //     alert("Username or password is not provided.");
  //     return;
  //   }else{
  //     // this.isLoading = true;
  //     this.userlogin = await this.npkservice.LoginUser(username, password);
  //   if(this.userlogin.length > 0 && this.userlogin[0].type === 'user' ){
  //     console.log(this.userlogin);
  //     const user = this.userlogin[0];
  //     const navigationExtras: NavigationExtras = {state: {data: this.userlogin[0].userID}};
  //       localStorage.setItem('user', JSON.stringify(this.userlogin));
  //       this.router.navigate(['main'], navigationExtras);
  //     }else if(this.userlogin.length > 0 && this.userlogin[0].type === 'admin'){
  //       localStorage.setItem('admin', JSON.stringify(this.userlogin));
  //         this.router.navigate(['admin']);
  //     }else{
  //     alert("Login failed.");
  //     }
  //     // setTimeout(() => {
  //     //   // this.router.navigate(['']);
  //     //   this.isLoading = false;
  //     // }, 2000); 
  //   }
  // }
  async loginuser(username: string, password: string, event: Event) {
  // ตรวจสอบว่า email และ password ไม่ว่าง
  if (username.trim() === '' || password.trim() === '') {
    alert("Username or password is not provided.");
    return;
  }

  // ตรวจสอบค่าที่กำหนดไว้
  if (username === 's' && password === 's') {
    const mockUser = {
      userID: 'U0001',
      username: 's',
      email: 's',
      type: 'user'
    };

    const navigationExtras: NavigationExtras = {
      state: { data: mockUser.userID }
    };

    localStorage.setItem('user', JSON.stringify(mockUser));
    this.router.navigate(['main'], navigationExtras);
  } else {
    alert('Login failed. Invalid credentials.');
  }
}

  register() {
    console.log('Navigating to register...');
    this.router.navigate(['/register']);
  }

  goToForgotPassword() {
    console.log('Navigate to forgot password');
    this.router.navigate(['/forgotpass']);
  }
}
