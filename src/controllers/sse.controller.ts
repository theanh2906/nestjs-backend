import { Controller, Inject, Query, Sse } from '@nestjs/common';
import { SseEvent } from '../shared/types';
import { SseService } from '../services';
import { JenkinsService } from '../services/jenkins.service';

/**
 * Controller for handling Server-Sent Events (SSE).
 */
@Controller({
  path: '/api/sse',
})
export class SseController {
  @Inject() private readonly sseService: SseService;
  @Inject() private readonly jenkinsService: JenkinsService;

  /**
   * Establishes an SSE connection for streaming system monitoring data.
   * @returns An Observable that emits monitoring data events.
   */
  @Sse(SseEvent.MonitorReport)
  sendMonitoringData() {
    console.log('sse event triggered');
    return this.sseService.getEvent(SseEvent.MonitorReport);
  }

  /**
   * Streams the build log for a specific Jenkins job.
   * @param jobName The name of the Jenkins job.
   * @param buildNumber The build number of the Jenkins job.
   * @returns An Observable that emits build log events.
   */
  @Sse(SseEvent.BuildLog)
  streamBuildLog(
    @Query('jobName') jobName: string,
    @Query('buildNumber') buildNumber: string
  ) {
    console.log(`Starting build log stream for ${jobName} #${buildNumber}`);
    return this.sseService.streamBuildLog(jobName, parseInt(buildNumber));
  }

  /**
   * Streams Jenkins monitoring data.
   * @returns An Observable that emits Jenkins monitoring events.
   */
  @Sse(SseEvent.JenkinsMonitoring)
  streamJenkinsMonitoring() {
    console.log('Starting Jenkins monitoring stream');
    return this.sseService.streamJenkinsMonitoring();
  }
}
