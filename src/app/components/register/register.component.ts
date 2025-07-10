import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
// Define interface for form data
interface FormData {
  name: string;
  username: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// Define interface for field configuration
interface FieldConfig {
  label: string;
  name: keyof FormData; // This ensures type safety
  type: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, CommonModule], // Import required modules here
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
    private location: Location) {}

  onRegister() {
    // Reset previous errors
    this.passwordMismatch = false;
    
    const { password, confirmPassword } = this.formData;
    
    // Validate password match
    if (password !== confirmPassword) {
      this.passwordMismatch = true;
      return;
    }

    // Validate required fields
    if (!this.validateRequiredFields()) {
      return;
    }

    this.isSubmitting = true;

    // TODO: ส่งข้อมูลไป API หรือจัดเก็บ
    console.log('Registered:', this.formData);

    // Simulate API call
    setTimeout(() => {
      this.isSubmitting = false;
      // กลับไปหน้า login
      this.router.navigate(['/login']);
    }, 2000);
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

  // Track by function for ngFor performance
  trackByFieldName(index: number, field: FieldConfig): string {
    return field.name;
  }

  goBack() {
    this.location.back(); // กลับไปหน้าก่อนหน้า 
  }
}