import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { BudgetLimit, BudgetMonth } from '../../models/BudgetLimit';

const API_URL = `${environment.apiUrl}/api/Budget`;

const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json',
  }),
};

/**
 * Category ceilings. The server owns the maths (spend for the selected month,
 * projection, safe-to-spend), so this service only moves data.
 */
@Injectable({
  providedIn: 'root',
})
export class BudgetLimitService {
  constructor(private http: HttpClient) {}

  /** Limits joined with that month's spend, plus the projection figures. */
  getSummary(month: number, year: number): Observable<BudgetMonth> {
    const params = new HttpParams().set('month', month.toString()).set('year', year.toString());

    return this.http
      .get<BudgetMonth>(`${API_URL}/summary`, { ...httpOptions, params })
      .pipe(catchError(this.handleError));
  }

  /** Insert or update the ceiling for one category. */
  save(categoryId: number, monthlyLimit: number): Observable<BudgetLimit> {
    return this.http
      .post<BudgetLimit>(API_URL, { categoryId, monthlyLimit }, httpOptions)
      .pipe(catchError(this.handleError));
  }

  /** Back to "no budget" for that category. */
  remove(categoryId: number): Observable<void> {
    return this.http
      .delete<void>(`${API_URL}/${categoryId}`, httpOptions)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any): Observable<never> {
    console.error('Budget request failed:', error);
    throw error;
  }
}
