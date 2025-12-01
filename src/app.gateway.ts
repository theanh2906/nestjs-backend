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
import {
  FileService,
  FirebaseService,
  LiveShareService,
  SystemService,
} from './services';

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

  constructor(
    private readonly systemService: SystemService,
    private readonly fileService: FileService,
    private readonly firebaseService: FirebaseService,
    private readonly liveShareService: LiveShareService
  ) {}

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

  // @SubscribeMessage('message')
  // handleMessage(
  //   @MessageBody() message: any,
  //   @ConnectedSocket() client: Socket
  // ): void {
  //   this.logger.log(
  //     `Message received from client ${client.id}: ${JSON.stringify(message)}`
  //   );
  //   client.emit('response', { success: true, message: 'Message received' });
  // }

  @SubscribeMessage('data-update')
  handleUpdateData(
    @MessageBody() message: any,
    @ConnectedSocket() client: Socket
  ): void {
    this.logger.log(`Data update ${client.id}: ${JSON.stringify(message)}`);
  }

  @SubscribeMessage('command')
  async executeCommand(
    @MessageBody() command: any,
    @ConnectedSocket() client: Socket
  ) {
    try {
      this.logger.log(`Executing command from client ${client.id}: ${command}`);
      const result = await this.systemService.executeCommand(command);
      this.logger.log(`Command executed successfully`);
      return { success: true, result };
    } catch (error) {
      this.logger.error(`Command execution failed: ${error}`);
      return { success: false, error: error.toString() };
    }
  }

  @SubscribeMessage('offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { offer: any; to: string }
  ) {
    this.server
      .to(payload.to)
      .emit('offer', { offer: payload.offer, from: client.id });
  }

  // Handle the answer from the receiver
  @SubscribeMessage('answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { answer: any; to: string }
  ) {
    this.server
      .to(payload.to)
      .emit('answer', { answer: payload.answer, from: client.id });
  }

  // Handle ICE candidates for peer connection
  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { candidate: any; to: string }
  ) {
    this.server
      .to(payload.to)
      .emit('ice-candidate', { candidate: payload.candidate, from: client.id });
  }

  @SubscribeMessage('file-sync')
  async handleFileSync() {
    // return this.firebaseService.handleFileSync();
  }

  // Live Share Room Events
  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string
  ) {
    client.join(roomId);
    this.logger.log(`Client ${client.id} joined room ${roomId}`);
    client.to(roomId).emit('user-joined', { userId: client.id });
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string
  ) {
    client.leave(roomId);
    this.logger.log(`Client ${client.id} left room ${roomId}`);
    client.to(roomId).emit('user-left', { userId: client.id });
  }

  // Broadcast new message to all clients in the room
  broadcastMessage(roomId: string, message: any) {
    this.server.to(roomId).emit('new-message', message);
  }

  // Broadcast new file to all clients in the room
  broadcastFile(roomId: string, file: any) {
    this.server.to(roomId).emit('new-file', file);
  }

  // Broadcast room deletion to all clients in the room
  broadcastRoomDeleted(roomId: string) {
    this.server.to(roomId).emit('room-deleted', { roomId });
  }

  // Broadcast history cleared to all clients in the room
  broadcastHistoryCleared(roomId: string) {
    this.server.to(roomId).emit('history-cleared', { roomId });
  }

  sendMessage(event: string, data: any) {
    this.server.emit(event, data);
  }
}
