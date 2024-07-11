import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

const API_URL = `${environment.apiUrl}/api/Expense/`;
const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json',
  }),
};
@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  constructor(private http: HttpClient) {}

  get(): Observable<any> {
    return this.http
      .get(`${API_URL}GetExpensesOfThisMonth`, httpOptions)
      .pipe(catchError(this.handleError));
  }

  getBarChartData(): Observable<any> {
    return this.http
      .get(`${API_URL}GetBarChartData`, httpOptions)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any): Observable<never> {
    console.error('An error occurred:', error); // for demo purposes only
    return error('Something bad happened; please try again later.');
  }
}
