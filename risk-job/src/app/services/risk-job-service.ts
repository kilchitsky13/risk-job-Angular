import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, retryWhen, scan, mergeMap } from 'rxjs/operators';
import { BorrowerRisk } from '../models/borrower-risk';

@Injectable({
  providedIn: 'root'
})
export class RiskJobService {
  private apiUrl = environment.apiUrl;
  
  constructor(private http: HttpClient) {}

  // GET -> returns BorrowerRisk[]
  runRiskJob(): Observable<BorrowerRisk[]> {
    const url = `${this.apiUrl}/api/RiskJob/run-risk-job`;
    return this.http.get<BorrowerRisk[]>(url).pipe(
      retryWhen(errors =>
        errors.pipe(
          scan((retryCount, err) => {
            if (retryCount >= 2) {
              throw err;
            }
            return retryCount + 1;
          }, 0),
          mergeMap(retryCount => timer(1000 * Math.pow(2, retryCount)))
        )
      ),
      catchError(error => {
        if (error.status === 404) {
          // Return empty array if 404 (no borrowers)
          return new Observable<BorrowerRisk[]>(observer => {
            observer.next([]);
            observer.complete();
          });
        }
        return this.handleError(error);
      })
    );
  }

  // POST -> init job (no body expected)
  initRisk(): Observable<void> {
    const url = `${this.apiUrl}/api/RiskJob/init-risk`;
    return this.http.post(url, null, { observe: 'response' }).pipe(
      // Map 204 or 200 to void
      // If status is 204, just return
      // If status is not 2xx, throw error
      mergeMap(response => {
        if (response.status === 204 || response.status === 200) {
          return new Observable<void>(observer => {
            observer.next();
            observer.complete();
          });
        }
        return throwError(() => new Error('Unexpected response status: ' + response.status));
      }),
      catchError(this.handleError)
    );
  }

  private handleError(error: any) {
    // Normalize error message for UI
    let message = 'An unknown error occurred';
    if (error?.error?.message) message = error.error.message;
    else if (error?.message) message = error.message;
    else if (typeof error === 'string') message = error;

    return throwError(() => new Error(message));
  }
}
