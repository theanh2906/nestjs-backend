import { Controller, Inject, Query, Sse } from '@nestjs/common';
import { SseEvent } from '../shared/types';
import { SseService } from '../services';
import { JenkinsService } from '../services/jenkins.service';

@Controller({
  path: '/api/sse',
})
export class SseController {
  @Inject() private readonly sseService: SseService;
  @Inject() private readonly jenkinsService: JenkinsService;

  @Sse(SseEvent.MonitorReport)
  sendMonitoringData() {
    console.log('sse event triggered');
    return this.sseService.getEvent(SseEvent.MonitorReport);
  }

  @Sse(SseEvent.BuildLog)
  streamBuildLog(
    @Query('jobName') jobName: string,
    @Query('buildNumber') buildNumber: string
  ) {
    console.log(`Starting build log stream for ${jobName} #${buildNumber}`);
    return this.sseService.streamBuildLog(jobName, parseInt(buildNumber));
  }

  @Sse(SseEvent.JenkinsMonitoring)
  streamJenkinsMonitoring() {
    console.log('Starting Jenkins monitoring stream');
    return this.sseService.streamJenkinsMonitoring();
  }
}
