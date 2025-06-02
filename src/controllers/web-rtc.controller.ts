import { Body, Controller, Param, Post } from '@nestjs/common';
import { WebRtcService } from '../services';

@Controller('webrtc')
export class WebRtcController {
  constructor(private readonly webRtcService: WebRtcService) {}

  @Post(':sessionId/offer')
  async handleOffer(@Param('sessionId') sessionId: string, @Body() body: any) {
    const answer = await this.webRtcService.handleOffer(sessionId, body.offer);
    return { answer };
  }

  @Post(':sessionId/answer')
  async handleAnswer(@Param('sessionId') sessionId: string, @Body() body: any) {
    await this.webRtcService.handleAnswer(sessionId, body.answer);
    return { status: 'ok' };
  }

  @Post(':sessionId/ice')
  async handleIce(@Param('sessionId') sessionId: string, @Body() body: any) {
    await this.webRtcService.handleIceCandidate(sessionId, body.candidate);
    return { status: 'ok' };
  }

  @Post(':sessionId/file-sync')
  async initiateFileSync(
    @Param('sessionId') sessionId: string,
    @Body() body: any
  ) {
    await this.webRtcService.initiateFileSync(sessionId, body.fileMeta);
    return { status: 'initiated' };
  }
}
