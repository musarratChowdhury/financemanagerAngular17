import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  AddContributionRequest,
  CreateGoalRequest,
  SavingsGoal,
  UpdateGoalRequest,
} from '../../models/SavingsGoal';

const API_URL = `${environment.apiUrl}/api/Goal`;

const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json',
  }),
};

/**
 * Savings goals and their contribution ledger.
 *
 * "Saved so far" is derived server-side from the ledger, so every mutation returns the
 * recalculated goal — the caller never has to re-fetch to see the new average or pace.
 */
@Injectable({
  providedIn: 'root',
})
export class GoalService {
  constructor(private http: HttpClient) {}

  getAll(): Observable<SavingsGoal[]> {
    return this.http.get<SavingsGoal[]>(API_URL, httpOptions).pipe(catchError(this.handleError));
  }

  create(request: CreateGoalRequest): Observable<SavingsGoal> {
    return this.http
      .post<SavingsGoal>(API_URL, request, httpOptions)
      .pipe(catchError(this.handleError));
  }

  update(id: number, request: UpdateGoalRequest): Observable<SavingsGoal> {
    return this.http
      .put<SavingsGoal>(`${API_URL}/${id}`, request, httpOptions)
      .pipe(catchError(this.handleError));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${id}`, httpOptions).pipe(catchError(this.handleError));
  }

  /** "Add to saved" — one ledger row. Returns the recalculated goal. */
  addContribution(id: number, request: AddContributionRequest): Observable<SavingsGoal> {
    return this.http
      .post<SavingsGoal>(`${API_URL}/${id}/contribution`, request, httpOptions)
      .pipe(catchError(this.handleError));
  }

  /** Removes a mis-entered contribution; the only supported correction. */
  removeContribution(id: number, contributionId: number): Observable<void> {
    return this.http
      .delete<void>(`${API_URL}/${id}/contribution/${contributionId}`, httpOptions)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any): Observable<never> {
    console.error('Goal request failed:', error);
    throw error;
  }
}
