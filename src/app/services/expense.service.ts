import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

const API_URL = 'https://financemanager.duckdns.org/api/Expense/';
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
  create(data: any): Observable<any> {
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

  // Update an item by ID
  update(id: number, data: any): Observable<any> {
    return this.http
      .put(`${API_URL}/${id}`, data, httpOptions)
      .pipe(catchError(this.handleError));
  }

  // Delete an item by ID
  delete(id: number): Observable<any> {
    return this.http
      .delete(`${API_URL}/${id}`, httpOptions)
      .pipe(catchError(this.handleError));
  }

  // Handle errors
  private handleError(error: any): Observable<never> {
    console.error('An error occurred:', error); // for demo purposes only
    return error('Something bad happened; please try again later.');
  }
}
