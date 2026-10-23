import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReceiptScanItem {
  name: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
}

export interface ReceiptScanResult {
  merchant: string | null;
  date: string | null;
  currency: string | null;
  items: ReceiptScanItem[];
  subtotal: number | null;
  discount: number | null;
  total: number | null;
  rawTotalText: string | null;
  itemsMatchTotal: boolean;
  needsReview: boolean;
}

@Injectable({ providedIn: 'root' })
export class ReceiptScannerService {
  constructor(private http: HttpClient) {}

  recognize(image: File): Promise<ReceiptScanResult> {
    const formData = new FormData();
    formData.append('file', image, image.name);
    return firstValueFrom(
      this.http.post<ReceiptScanResult>(
        `${environment.apiUrl}/api/Receipt/Scan`,
        formData
      )
    );
  }
}
