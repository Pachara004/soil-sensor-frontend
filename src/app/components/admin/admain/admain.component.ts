import { Component } from '@angular/core';
import { Router } from '@angular/router';
@Component({
  selector: 'app-admain',
  standalone: true,
  imports: [],
  templateUrl: './admain.component.html',
  styleUrl: './admain.component.scss'
})
export class AdmainComponent {
  userID: string | null = null;

  constructor(
    private router: Router,
  ) {
    const navigation = this.router.getCurrentNavigation();
    this.userID = navigation?.extras.state?.['data'] || null;
  }

  logout() {
    localStorage.removeItem('user');  // หรือล้างทั้งหมดก็ได้ด้วย localStorage.clear()
    this.router.navigate(['/']); // กลับไปหน้า login
  }
  goToUsers() {
    this.router.navigate(['/profile']); // เปลี่ยนตาม route ของคุณ
  }

  goToReports() {
    this.router.navigate(['/reports']); // เปลี่ยนตาม route ของคุณ
  }

}