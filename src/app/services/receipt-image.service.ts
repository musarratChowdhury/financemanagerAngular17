import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ReceiptImage } from '../../models/ReceiptImage';

const API_URL = `${environment.apiUrl}/api/Receipt/`;

/** A presigned download URL and when it stops working. */
export interface ReceiptImageUrl {
  url: string;
  /** ISO instant. */
  expiresAt: string;
}

/**
 * The softcopy of a receipt. One photo per receipt, so every call is addressed by
 * the receipt id — there is no image id to track on the client.
 *
 * The bucket is private: `getUrl()` is the only way to see a photo and it is
 * short-lived (5 minutes by default), which is why the viewer refetches rather
 * than caching a URL.
 */
@Injectable({
  providedIn: 'root',
})
export class ReceiptImageService {
  constructor(private http: HttpClient) {}

  /**
   * Stores the photo, replacing any existing one.
   *
   * Deliberately no `Content-Type` header: the browser must set the multipart
   * boundary itself. Copying the JSON header the other services use breaks the
   * upload with a 400 that says nothing useful.
   */
  upload(receiptId: number, file: File): Observable<ReceiptImage> {
    const form = new FormData();
    form.append('file', file, file.name);

    return this.http
      .post<ReceiptImage>(`${API_URL}${receiptId}/image`, form)
      .pipe(catchError(this.handleError));
  }

  getMetadata(receiptId: number): Observable<ReceiptImage> {
    return this.http
      .get<ReceiptImage>(`${API_URL}${receiptId}/image`)
      .pipe(catchError(this.handleError));
  }

  /** 404 when the receipt has no photo. */
  getUrl(receiptId: number): Observable<ReceiptImageUrl> {
    return this.http
      .get<ReceiptImageUrl>(`${API_URL}${receiptId}/image/url`)
      .pipe(catchError(this.handleError));
  }

  remove(receiptId: number): Observable<void> {
    return this.http
      .delete<void>(`${API_URL}${receiptId}/image`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: unknown): Observable<never> {
    console.error('Receipt photo request failed:', error);
    return throwError(() => error);
  }
}
