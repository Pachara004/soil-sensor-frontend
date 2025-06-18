import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  userID: string | null = null;

  constructor(private router: Router) {
    const navigation = this.router.getCurrentNavigation();
    this.userID = navigation?.extras.state?.['data'] || null;
  }

  logout() {
    localStorage.removeItem('user');  // หรือล้างทั้งหมดก็ได้ด้วย localStorage.clear()
    this.router.navigate(['/']); // กลับไปหน้า login
  }
  goToProfile() {
    this.router.navigate(['/profile']);
  }
}