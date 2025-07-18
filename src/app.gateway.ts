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
import { FileService, FirebaseService, SystemService } from './services';
import * as fs from 'node:fs';
import * as path from 'path';

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
    private readonly firebaseService: FirebaseService
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

      // Create a zip file from the folder
      const zipFilePath =
        await this.fileService.createZipFromFolder('C:\\Notes');
      this.logger.log(`Zip file created at: ${zipFilePath}`);

      // Read the zip file from disk
      const fileInfo = await this.fileService.getFileInfo(zipFilePath);
      if (!fileInfo) {
        throw new Error('Failed to get zip file info');
      }

      // Read the file content
      const fileBuffer = await fs.promises.readFile(zipFilePath);

      // Create an Express.Multer.File object
      const multerFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: path.basename(zipFilePath),
        encoding: '7bit',
        mimetype: 'application/zip',
        buffer: fileBuffer,
        size: fileInfo.size,
        destination: '',
        filename: path.basename(zipFilePath),
        path: zipFilePath,
        stream: null,
      };

      // Upload the file to Firebase Storage
      const fileUrl =
        await this.firebaseService.uploadFilesToStorage(multerFile);
      this.sendMessage('data-update', 'updated');
      this.logger.log(`File uploaded to Firebase Storage: ${fileUrl}`);

      // Clean up the local zip file
      await fs.promises.unlink(zipFilePath);
      this.logger.log(`Local zip file deleted: ${zipFilePath}`);
    } catch (error) {
      this.logger.error(`File sync error: ${error.message}`);
    }
  }

  sendMessage(event: string, data: any) {
    this.server.emit(event, data);
  }
}
