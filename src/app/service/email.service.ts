import { Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  constructor(private functions: Functions) {}

  async sendOTP(email: string): Promise<any> {
    const sendOTPEmail = httpsCallable(this.functions, 'sendOTPEmail');
    try {
      const result = await sendOTPEmail({ email });
      return result.data;
    } catch (error) {
      console.error('Error sending OTP:', error);
      throw error;
    }
  }

  async verifyOTP(email: string, otp: string): Promise<any> {
    const verifyOTP = httpsCallable(this.functions, 'verifyOTP');
    try {
      const result = await verifyOTP({ email, otp });
      return result.data;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw error;
    }
  }
}