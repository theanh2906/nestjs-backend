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
import { Inject, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { QueueService, SystemService } from './services';

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

  @Inject() private queueService: QueueService;

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
    // client.emit('response', { success: true, message: 'Message received' });
  }

  @SubscribeMessage('sendMessage')
  handleSendMessage(
    @MessageBody() message: { topic: string; data: any },
  ): void {
    const { topic, data } = message;
    this.queueService.sendMessage(topic, data);
  }

  // @SubscribeMessage('delete-files')
  // handleDeleteFiles(
  //   @MessageBody() message: any,
  //   @ConnectedSocket() client: Socket,
  // ): void {
  //   const listFileNames = JSON.parse(message) as string[];
  //   console.log(listFileNames);
  // }

  sendMessage(event: string, data: any) {
    this.server.emit(event, data);
  }
}
