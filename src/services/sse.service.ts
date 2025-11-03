import { Inject, Injectable } from '@nestjs/common';
import {
  interval,
  map,
  Observable,
  startWith,
  Subject,
  switchMap,
  takeWhile,
  catchError,
  of,
} from 'rxjs';
import { SseEvent } from '../shared/types';
import { JenkinsService } from './jenkins.service';

@Injectable()
export class SseService {
  @Inject() private readonly jenkinsService: JenkinsService;

  private eventSubjects: { [key in SseEvent]: Subject<any> } = {
    [SseEvent.MonitorReport]: new Subject<any>(),
    [SseEvent.BuildLog]: new Subject<any>(),
    [SseEvent.JenkinsMonitoring]: new Subject<any>(),
  };

  // Jenkins monitoring refresh interval (10 seconds)
  private readonly JENKINS_REFRESH_INTERVAL = 10000;

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
   * Stream Jenkins monitoring data using SSE
   * This includes jobs, status, health, and queue information
   */
  streamJenkinsMonitoring(): Observable<any> {
    return interval(this.JENKINS_REFRESH_INTERVAL).pipe(
      startWith(0), // Start immediately
      switchMap(async () => {
        try {
          // Fetch all Jenkins data in parallel
          const [jobs, systemInfo, health, queue] = await Promise.allSettled([
            this.jenkinsService.getJobs(),
            this.jenkinsService.getSystemInfo(),
            this.jenkinsService.getHealthCheck(),
            this.jenkinsService.getQueue(),
          ]);

          // Build status object from health and queue
          const status = {
            server:
              health.status === 'fulfilled'
                ? health.value
                : {
                    status: 'error',
                    message: 'Health check failed',
                    timestamp: Date.now(),
                  },
            queue:
              queue.status === 'fulfilled'
                ? {
                    totalItems: queue.value.items?.length || 0,
                    stuckItems:
                      queue.value.items?.filter((item) => item.stuck).length || 0,
                  }
                : { totalItems: 0, stuckItems: 0 },
            system:
              systemInfo.status === 'fulfilled'
                ? {
                    totalJobs: systemInfo.value.jobs?.length || 0,
                    executors: systemInfo.value.numExecutors || 0,
                    mode: systemInfo.value.mode || 'UNKNOWN',
                  }
                : { totalJobs: 0, executors: 0, mode: 'UNKNOWN' },
            timestamp: Date.now(),
          };

          // Add statusInfo to each job (same as controller does)
          const jobsWithStatus =
            jobs.status === 'fulfilled'
              ? jobs.value.map((job) => ({
                  ...job,
                  statusInfo: this.jenkinsService.getJobStatusInfo(job.color),
                  lastBuildFormatted: job.lastBuild
                    ? {
                        ...job.lastBuild,
                        durationFormatted: this.jenkinsService.formatDuration(
                          job.lastBuild.duration
                        ),
                        timestampFormatted: new Date(
                          job.lastBuild.timestamp
                        ).toISOString(),
                      }
                    : null,
                }))
              : [];

          const data = {
            jobs: jobsWithStatus,
            status,
            health: health.status === 'fulfilled' ? health.value : null,
            queue: queue.status === 'fulfilled' ? queue.value : null,
            timestamp: Date.now(),
            errors: {
              jobs: jobs.status === 'rejected' ? jobs.reason?.message : null,
              systemInfo:
                systemInfo.status === 'rejected'
                  ? systemInfo.reason?.message
                  : null,
              health:
                health.status === 'rejected' ? health.reason?.message : null,
              queue: queue.status === 'rejected' ? queue.reason?.message : null,
            },
          };

          return {
            data,
            type: 'jenkins-monitoring',
          };
        } catch (error) {
          console.error('Error streaming Jenkins monitoring data:', error);
          return {
            data: {
              jobs: [],
              status: null,
              health: null,
              queue: null,
              timestamp: Date.now(),
              error: error.message,
            },
            type: 'jenkins-monitoring-error',
          };
        }
      }),
      catchError((error) => {
        console.error('Jenkins monitoring stream error:', error);
        return of({
          data: {
            jobs: [],
            status: null,
            health: null,
            queue: null,
            timestamp: Date.now(),
            error: error.message || 'Stream error',
          },
          type: 'jenkins-monitoring-error',
        });
      }),
      map((result: any) => ({
        data: JSON.stringify(result.data),
        type: result.type,
      }))
    );
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
