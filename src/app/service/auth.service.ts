import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Constants } from '../config/constants';
import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from '@angular/fire/auth';
import { catchError, throwError } from 'rxjs'; // เพิ่มสำหรับจัดการ error
import { Observable } from 'rxjs';

interface UserData {
  uid: string;
  email: string;
  username: string;
  fullName: string;
  phoneNumber: string;
  type: string;
  emailVerified: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl: string;

  constructor(
    private http: HttpClient,
    private auth: Auth,
    private constants: Constants
  ) {
    this.apiUrl = this.constants.API_ENDPOINT; // ใช้ instance ของ Constants
  }

  login(email: string, password: string): Promise<any> {
    return this.http
      .post(`${this.apiUrl}/api/auth/login`, { email, password })
      .pipe(
        catchError((error) => {
          console.error('Error logging in:', error);
          return throwError(() => new Error('Login failed'));
        })
      )
      .toPromise();
  }

  async loginWithGoogle(): Promise<any> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(this.auth, provider);
    const idToken = await result.user.getIdToken();
    return this.http
      .post(`${this.apiUrl}/api/auth/google-login`, { idToken })
      .pipe(
        catchError((error) => {
          console.error('Error logging in with Google:', error);
          return throwError(() => new Error('Google login failed'));
        })
      )
      .toPromise();
  }

  checkEmailExists(email: string): Promise<boolean> {
    return this.http
      .get<{ exists: boolean }>(`${this.apiUrl}/api/auth/check-email/${email}`)
      .pipe(
        catchError((error) => {
          console.error('Error checking email:', error);
          return throwError(() => new Error('Email check failed'));
        })
      )
      .toPromise()
      .then((res) => res?.exists || false); // รับรองว่าได้ boolean แม้ res เป็น undefined
  }

  checkUsernameExists(username: string): Promise<boolean> {
    return this.http
      .get<{ exists: boolean }>(
        `${this.apiUrl}/api/auth/check-username/${username}`
      )
      .pipe(
        catchError((error) => {
          console.error('Error checking username:', error);
          return throwError(() => new Error('Username check failed'));
        })
      )
      .toPromise()
      .then((res) => res?.exists || false); // รับรองว่าได้ boolean แม้ res เป็น undefined
  }

  changeUserPassword(oldPassword: string, newPassword: string): Promise<void> {
    return this.http
      .put(`${this.apiUrl}/api/auth/change-password`, {
        oldPassword,
        newPassword,
      })
      .pipe(
        catchError((error) => {
          console.error('Error changing password:', error);
          return throwError(() => new Error('Password change failed'));
        })
      )
      .toPromise()
      .then(() => {}); // คืนค่า void
  }

  logout(): Promise<void> {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('admin');
    return signOut(this.auth);
  }
}
