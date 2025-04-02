import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SystemService } from './services';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  },
})
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(AppGateway.name);

  constructor(private readonly systemService: SystemService) {}

  afterInit(): void {
    this.logger.log('WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('ready', 'Socket connected!');
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.handshake.query.userId}`);
  }

  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() message: any,
    @ConnectedSocket() client: Socket,
  ): void {
    this.logger.log(
      `Message received from client ${client.id}: ${JSON.stringify(message)}`,
    );
    client.emit('response', { success: true, message: 'Message received' });
  }

  @SubscribeMessage('data-update')
  handleUpdateData(
    @MessageBody() message: any,
    @ConnectedSocket() client: Socket,
  ): void {
    this.logger.log(`Data update ${client.id}: ${JSON.stringify(message)}`);
  }

  @SubscribeMessage('command')
  async executeCommand(@MessageBody() command: any) {
    return await this.systemService.executeCommand(command);
  }

  @SubscribeMessage('offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { offer: any; to: string },
  ) {
    this.server
      .to(payload.to)
      .emit('offer', { offer: payload.offer, from: client.id });
  }

  // Handle the answer from the receiver
  @SubscribeMessage('answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { answer: any; to: string },
  ) {
    this.server
      .to(payload.to)
      .emit('answer', { answer: payload.answer, from: client.id });
  }

  // Handle ICE candidates for peer connection
  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { candidate: any; to: string },
  ) {
    this.server
      .to(payload.to)
      .emit('ice-candidate', { candidate: payload.candidate, from: client.id });
  }

  sendMessage(event: string, data: any) {
    this.server.emit(event, data);
  }
}
