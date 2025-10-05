import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: 'main',
    loadComponent: () =>
      import('./components/users/main/main.component').then(
        (m) => m.MainComponent
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
    path: 'edit-profile',
    loadComponent: () =>
      import('./components/users/edit-profile/edit-profile.component').then(
        (m) => m.EditProfileComponent
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
    path: 'forgotpass',
    loadComponent: () =>
      import('./components/users/forgotpass/forgotpass.component').then(
        (m) => m.ForgotpassComponent
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
    path: 'history',
    loadComponent: () =>
      import('./components/users/history/history.component').then(
        (m) => m.HistoryComponent
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
    path: 'device-detail',
    loadComponent: () =>
      import('./components/admin/detail/detail.component').then(
        (m) => m.DetailComponent
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
    path: 'adregister',
    loadComponent: () =>
      import('./components/adregister/adregister.component').then(
        (m) => m.AdregisterComponent
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
