import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { SseEvent } from '../shared/types';

@Injectable()
export class SseService {
  private eventSubjects: { [key in SseEvent]: Subject<any> } = {
    'monitor-report': new Subject<any>(),
  };

  getEvent(eventName: SseEvent): Observable<any> {
    if (!this.eventSubjects[eventName]) {
      this.eventSubjects[eventName] = new Subject<any>();
    }
    return this.eventSubjects[eventName].asObservable();
  }

  emit(eventName: SseEvent, data: any): void {
    if (this.eventSubjects[eventName]) {
      this.eventSubjects[eventName].next(data);
    }
  }
}
