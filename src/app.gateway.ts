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
import { SystemService } from './services/system.service';

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
    this.logger.log(`Client disconnected: ${client.id}`);
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

  sendMessage(event: string, data: string) {
    this.server.emit(event, data);
  }
}
