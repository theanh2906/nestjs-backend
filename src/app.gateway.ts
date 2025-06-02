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
import { FileService, SystemService } from './services';

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
    private readonly fileService: FileService
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
  async handleFileSync(@ConnectedSocket() client: Socket) {
    try {
      this.logger.log(`File sync request from client ${client.id}`);

      await this.fileService.createZipFromFolder('C:\\Notes');

      // Stream file in chunks
      try {
        for await (const chunk of this.fileService.streamFileInChunks()) {
          // Send each chunk to the client
          client.emit('file-sync-chunk', {
            ...chunk,
            chunk: chunk.chunk.toString('base64'), // Convert buffer to base64 for transmission
          });

          // Add a small delay to prevent overwhelming the client
          await new Promise((resolve) => setTimeout(resolve, 5));
        }

        // Signal end of file transfer
        client.emit('file-sync-complete', { success: true });
        this.logger.log(`File sync completed`);
      } catch (streamError) {
        this.logger.error(`Error streaming file: ${streamError.message}`);
        client.emit('file-sync-error', {
          message: `Error streaming file: ${streamError.message}`,
        });
      }
    } catch (error) {
      this.logger.error(`File sync error: ${error.message}`);
      client.emit('file-sync-error', { message: error.message });
    }
  }

  sendMessage(event: string, data: any) {
    this.server.emit(event, data);
  }
}
