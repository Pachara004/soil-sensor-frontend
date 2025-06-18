import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-measure',
  standalone: true,
  imports: [],
  templateUrl: './measure.component.html',
  styleUrl: './measure.component.scss'
})
export class MeasureComponent {
  constructor(private router: Router) {}
goBack() {
    this.router.navigate(['/main']);
  }
  goToProfile() {
    this.router.navigate(['/profile']);
  }
}
