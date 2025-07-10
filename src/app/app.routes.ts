import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { MainComponent } from './components/main/main.component';
import { ProfileComponent } from './components/profile/profile.component';
import { EditProfileComponent } from './components/edit-profile/edit-profile.component';
import { MeasureComponent } from './components/measure/measure.component';
import { ForgotpassComponent } from './components/forgotpass/forgotpass.component';

export const routes: Routes = [
    { path: '', component: LoginComponent },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    { path: 'main', component: MainComponent},
    { path: 'profile',  component: ProfileComponent},
    { path: 'edit-profile', component: EditProfileComponent},
    { path: 'measure', component: MeasureComponent},
    { path: 'forgotpass', component: ForgotpassComponent},
];
