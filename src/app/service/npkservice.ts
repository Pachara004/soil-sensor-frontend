import { Injectable } from '@angular/core';
import { Constants } from '../config/constants';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { SignupData, Users } from '../Models/login-signup';

@Injectable({
  providedIn: 'root'
})
export class Npkservice {
  isLoggedIn: boolean | undefined;
  queryParams: any;
  constructor(private constants: Constants, private http: HttpClient) {
    this.isLoggedIn = undefined;
  }

  public async LoginUser(username: string, password: string) {
    const url = this.constants.API_ENDPOINT + "/login/" + username + "/" + password;
    try {
      const response = await lastValueFrom(this.http.get(url));
      return response as Users[];
    } catch (error) {
      console.error('Error logging in:', error);
      return [];
    }
  }
  public async GetLoginUser(uid: number) {
    const url = this.constants.API_ENDPOINT + "/login/" + uid;
    const response = await lastValueFrom(this.http.get(url));
    return response as Users[];
  }
  public async GetUserall() {
    const url = this.constants.API_ENDPOINT + "/login";
    const response = await lastValueFrom(this.http.get(url));
    return response as Users[];
  }
  public async SignupUser(name: string,username: string, password: string, type: string, file: File) {
    const url = this.constants.API_ENDPOINT + '/login/signup';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    formData.append('username', username);
    formData.append('password', password);
    formData.append('type', type);

    try {
        const response = await this.http.post(url, formData).toPromise();
        console.log(response);
        return response as SignupData[];
    } catch (error) {
        throw error;
    }
}

  async isLoggedInUser(userID: string): Promise<{ image: string } | null> {
    const url = this.constants.API_ENDPOINT + "/login/" + userID;
    try {
      const response = await lastValueFrom(this.http.get(url));
      console.log('Response from isLoggedInUser:', response);
      return response as { image: string };
    } catch (error) {
      console.error('Error checking login status:', error);
      return null;
    }
  }

  public logoutUser() {
    this.isLoggedIn = false;
  }
}
