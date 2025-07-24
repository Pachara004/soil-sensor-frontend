import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { MainComponent } from './components/users/main/main.component';
import { ProfileComponent } from './components/users/profile/profile.component';
import { EditProfileComponent } from './components/users/edit-profile/edit-profile.component';
import { MeasureComponent } from './components/users/measure/measure.component';
import { ForgotpassComponent } from './components/users/forgotpass/forgotpass.component';
import { ReportsComponent } from './components/users/reports/reports.component';
import { HistoryComponent } from './components/users/history/history.component';
import { AdmainComponent } from './components/admin/admain/admain.component';
import { DetailComponent } from './components/admin/detail/detail.component';


export const routes: Routes = [
    { path: '', component: LoginComponent },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    { path: 'main', component: MainComponent},
    { path: 'profile',  component: ProfileComponent},
    { path: 'edit-profile', component: EditProfileComponent},
    { path: 'measure', component: MeasureComponent},
    { path: 'forgotpass', component: ForgotpassComponent},
    { path: 'reports', component: ReportsComponent},
    { path: 'history', component: HistoryComponent },
    { path: 'adminmain', component: AdmainComponent },
    { path: 'device-detail', component: DetailComponent }, 
];
