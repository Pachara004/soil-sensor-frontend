import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { AuthService } from '../../service/auth.service'; // ✅ import Service

interface FormData {
  name: string;
  username: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FieldConfig {
  label: string;
  name: keyof FormData;
  type: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  formData: FormData = {
    name: '',
    username: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  };

  passwordMismatch = false;
  isSubmitting = false;

  fields: FieldConfig[] = [
    { label: 'Name', name: 'name', type: 'text' },
    { label: 'Username', name: 'username', type: 'text' },
    { label: 'Phone', name: 'phone', type: 'tel' },
    { label: 'Email', name: 'email', type: 'email' },
    { label: 'Password', name: 'password', type: 'password' },
    { label: 'Confirm Password', name: 'confirmPassword', type: 'password' },
  ];

  constructor(
    private router: Router,
    private location: Location,
    private authService: AuthService // ✅ Inject AuthService
  ) {}

  async onRegister() {
    this.passwordMismatch = false;

    const { password, confirmPassword } = this.formData;

    if (password !== confirmPassword) {
      this.passwordMismatch = true;
      return;
    }

    if (!this.validateRequiredFields()) {
      return;
    }

    this.isSubmitting = true;

    try {
      await this.authService.register({
        name: this.formData.name,
        username: this.formData.username,
        phone: this.formData.phone,
        email: this.formData.email,
        password: this.formData.password,
      });

      alert('ลงทะเบียนสำเร็จ!');
      this.router.navigate(['/login']);
    } catch (err: any) {
      alert(err.message || 'ลงทะเบียนไม่สำเร็จ');
    } finally {
      this.isSubmitting = false;
    }
  }

  validateRequiredFields(): boolean {
    const requiredFields: (keyof FormData)[] = ['name', 'username', 'phone', 'email', 'password', 'confirmPassword'];
    for (const field of requiredFields) {
      if (!this.formData[field]?.trim()) {
        console.error(`${field} is required`);
        return false;
      }
    }
    return true;
  }

  trackByFieldName(index: number, field: FieldConfig): string {
    return field.name;
  }

  goBack() {
    this.location.back();
  }
}
