import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Expense } from '../../models/Expense';
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
export class ExpenseService {
  constructor(private http: HttpClient) {}

  // Create a new item
  create(data: Expense): Observable<any> {
    return this.http
      .post(API_URL + 'Create', data, httpOptions)
      .pipe(catchError(this.handleError));
  }

  // Read an item by ID
  get(id: number): Observable<any> {
    return this.http
      .get(`${API_URL}/${id}`, httpOptions)
      .pipe(catchError(this.handleError));
  }

  // Read all items
  getAll(): Observable<any[]> {
    return this.http
      .get<any[]>(API_URL + 'GetAll', httpOptions)
      .pipe(catchError(this.handleError));
  }

  // Update an item by ID — the controller exposes `api/Expense/Update/{id}`,
  // not `api/Expense/{id}`.
  update(id: number, data: any): Observable<any> {
    return this.http
      .put(`${API_URL}Update/${id}`, data, httpOptions)
      .pipe(catchError(this.handleError));
  }

  // Delete an item by ID — `api/Expense/Delete/{id}`.
  delete(id: number): Observable<any> {
    return this.http
      .delete(`${API_URL}Delete/${id}`, httpOptions)
      .pipe(catchError(this.handleError));
  }

  // Handle errors
  private handleError(error: any): Observable<never> {
    console.error('Expense request failed:', error);
    throw error;
  }
}
