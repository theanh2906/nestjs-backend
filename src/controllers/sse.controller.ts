import { Controller, Inject, Sse } from '@nestjs/common';
import { SseEvent } from '../shared/types';
import { SseService } from '../services';

@Controller({
  path: '/api/sse',
})
export class SseController {
  @Inject() private readonly sseService: SseService;
  @Sse(SseEvent.MonitorReport)
  sendMonitoringData() {
    return this.sseService.getEvent(SseEvent.MonitorReport);
  }
}
