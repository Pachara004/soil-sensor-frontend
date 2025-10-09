import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';

export const routes: Routes = [
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  { path: '', component: LoginComponent },
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  { path: 'login', component: LoginComponent },
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  { path: 'register', component: RegisterComponent },
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  {
    path: 'main',
    loadComponent: () =>
      import('./components/users/main/main.component').then(
        (m) => m.MainComponent
      ),
  },
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./components/users/profile/profile.component').then(
        (m) => m.ProfileComponent
      ),
  },
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  {
    path: 'edit-profile',
    loadComponent: () =>
      import('./components/users/edit-profile/edit-profile.component').then(
        (m) => m.EditProfileComponent
      ),
  },
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  {
    path: 'measure',
    loadComponent: () =>
      import('./components/users/measure/measure.component').then(
        (m) => m.MeasureComponent
      ),
  },
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  {
    path: 'forgotpass',
    loadComponent: () =>
      import('./components/users/forgotpass/forgotpass.component').then(
        (m) => m.ForgotpassComponent
      ),
  },
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  {
    path: 'reports',
    loadComponent: () =>
      import('./components/users/reports/reports.component').then(
        (m) => m.ReportsComponent
      ),
  },
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./components/users/history/history.component').then(
        (m) => m.HistoryComponent
      ),
  },
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  {
    path: 'adminmain',
    loadComponent: () =>
      import('./components/admin/admain/admain.component').then(
        (m) => m.AdmainComponent
      ),
  },
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  {
    path: 'device-detail',
    loadComponent: () =>
      import('./components/admin/detail/detail.component').then(
        (m) => m.DetailComponent
      ),
  },
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  {
    path: 'mail',
    loadComponent: () =>
      import('./components/admin/mail/mail.component').then(
        (m) => m.MailComponent
      ),
  },
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  {
    path: 'adregister',
    loadComponent: () =>
      import('./components/adregister/adregister.component').then(
        (m) => m.AdregisterComponent
      ),
  },
  {
    path: "gps",
    loadComponent: () =>
      import("./components/gps-display.component").then(
        (m) => m.GpsDisplayComponent
      ),
  },
  {
    path: 'change-password',
    loadComponent: () =>
      import('./components/users/change-password/change-password.component').then(
        (m) => m.ChangePasswordComponent
      ),
  },
];
