import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Income } from '../../models/Income';
import { environment } from '../../environments/environment';

const API_URL = `${environment.apiUrl}/api/Income/`;
const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json',
  }),
};

@Injectable({
  providedIn: 'root',
})
export class IncomeService {
  constructor(private http: HttpClient) {}

  getIncomesOfAMonth(month: number, year: number): Observable<Income[]> {
    const params = new HttpParams()
      .set('month', month.toString())
      .set('year', year.toString());

    return this.http
      .get<Income[]>(`${API_URL}GetIncomesOfAMonth`, { ...httpOptions, params })
      .pipe(catchError(this.handleError));
  }

  create(income: Income): Observable<void> {
    return this.http
      .post<void>(`${API_URL}Create`, income, httpOptions)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any): Observable<never> {
    console.error('Income request failed:', error);
    throw error;
  }
}
