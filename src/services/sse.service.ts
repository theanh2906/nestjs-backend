import { Inject, Injectable } from '@nestjs/common';
import {
  interval,
  map,
  Observable,
  startWith,
  Subject,
  switchMap,
  takeWhile,
} from 'rxjs';
import { SseEvent } from '../shared/types';
import { JenkinsService } from './jenkins.service';

@Injectable()
export class SseService {
  @Inject() private readonly jenkinsService: JenkinsService;

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

  /**
   * Stream build log using SSE
   */
  streamBuildLog(jobName: string, buildNumber: number): Observable<any> {
    let nextStart = 0;

    return interval(2000).pipe(
      startWith(0), // Start immediately
      switchMap(async () => {
        try {
          const logData = await this.jenkinsService.getProgressiveConsoleOutput(
            jobName,
            buildNumber,
            nextStart
          );

          nextStart = logData.nextStart;

          return {
            data: {
              jobName,
              buildNumber,
              content: logData.content,
              hasMore: logData.hasMore,
              nextStart: logData.nextStart,
              timestamp: Date.now(),
            },
            type: 'build-log',
          };
        } catch (error) {
          console.error(
            `Error streaming build log for ${jobName} #${buildNumber}:`,
            error
          );
          return {
            data: {
              jobName,
              buildNumber,
              content: '',
              hasMore: false,
              nextStart,
              error: error.message,
              timestamp: Date.now(),
            },
            type: 'build-log-error',
          };
        }
      }),
      takeWhile((result: any) => {
        // Continue streaming while there's more data or if there's an error (to send the error message)
        return result.data.hasMore || result.type === 'build-log-error';
      }, true), // Include the last emission when hasMore becomes false
      map((result: any) => ({
        data: JSON.stringify(result.data),
        type: result.type,
      }))
    );
  }
}
