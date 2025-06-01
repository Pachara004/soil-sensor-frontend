import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet,HttpClientModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'npkwebfront';
}
