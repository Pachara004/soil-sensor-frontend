import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { Auth } from '@angular/fire/auth';

export const authTokenInterceptor: HttpInterceptorFn = (
	req: HttpRequest<unknown>,
	next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
	console.log('🚀 AuthInterceptor START - URL:', req.url);
	console.log('🔍 Request method:', req.method);
	
	// ตรวจสอบว่าเป็น API request หรือไม่
	if (!req.url.includes('/api/')) {
		console.log('⏭️ Skipping non-API request:', req.url);
		return next(req);
	}

	console.log('🔐 Processing API request:', req.url);

	const router = inject(Router);
	const auth = inject(Auth);

	return from((async () => {
		const user = auth.currentUser;
		console.log('👤 Current user in interceptor:', user ? user.email : 'null');
		
		if (!user) {
			console.warn('❌ No authenticated user found for API request');
			return null;
		}
		
		try {
			const idToken = await user.getIdToken();
			console.log('✅ Firebase ID token obtained in interceptor:', idToken.substring(0, 20) + '...');
			return idToken;
		} catch (error) {
			console.error('❌ Failed to get Firebase ID token:', error);
			return null;
		}
	})()).pipe(
		switchMap((idToken) => {
			let authReq = req;
			if (idToken) {
				authReq = req.clone({
					setHeaders: {
						Authorization: `Bearer ${idToken}`,
					},
				});
				console.log('✅ Added Authorization header to request');
			} else {
				console.warn('⚠️ No ID token available, proceeding without auth header');
			}
			return next(authReq);
		}),
		catchError((error) => {
			console.error('❌ API request failed in interceptor:', error);
			return throwError(() => error);
		})
	);
};
