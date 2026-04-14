import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LiveShareService } from '../services/live-share.service';
import { AppGateway } from '../app.gateway';

/**
 * Controller for handling live sharing rooms.
 */
@Controller('/api/live-share')
export class LiveShareController {
  constructor(
    private readonly liveShareService: LiveShareService,
    private readonly appGateway: AppGateway
  ) {}

  /**
   * Creates a new room.
   * @returns The newly created room.
   */
  @Post('rooms')
  async createRoom() {
    return await this.liveShareService.createRoom();
  }

  /**
   * Gets or creates an admin room for logged-in users.
   * @returns The admin room.
   */
  @Post('rooms/admin')
  async getOrCreateAdminRoom() {
    return await this.liveShareService.getOrCreateAdminRoom();
  }

  /**
   * Gets the data for a specific room.
   * @param roomId The ID of the room.
   * @returns The room data.
   */
  @Get('rooms/:roomId')
  async getRoom(@Param('roomId') roomId: string) {
    const room = await this.liveShareService.getRoom(roomId);
    if (!room) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }
    return room;
  }

  /**
   * Gets the content of a room, including messages and files, sorted by timestamp.
   * @param roomId The ID of the room.
   * @returns The content of the room.
   */
  @Get('rooms/:roomId/content')
  async getRoomContent(@Param('roomId') roomId: string) {
    return await this.liveShareService.getRoomContent(roomId);
  }

  /**
   * Adds a text message to a room.
   * @param roomId The ID of the room.
   * @param content The content of the message.
   * @returns The newly created message.
   */
  @Post('rooms/:roomId/messages')
  async addMessage(
    @Param('roomId') roomId: string,
    @Body('content') content: string
  ) {
    if (!content || content.trim() === '') {
      throw new HttpException(
        'Message content is required',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const message = await this.liveShareService.addMessage(roomId, content);
      // Broadcast to all clients in the room via WebSocket
      this.appGateway.broadcastMessage(roomId, message);
      return message;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  /**
   * Uploads a file to a room.
   * @param roomId The ID of the room.
   * @param file The file to upload.
   * @returns The newly uploaded file.
   */
  @Post('rooms/:roomId/files')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('roomId') roomId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const roomFile = await this.liveShareService.uploadFile(roomId, file);
      // Broadcast to all clients in the room via WebSocket
      this.appGateway.broadcastFile(roomId, roomFile);
      return roomFile;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  /**
   * Deletes a room and all its files.
   * @param roomId The ID of the room to delete.
   * @returns A success message.
   */
  @Delete('rooms/:roomId')
  async deleteRoom(@Param('roomId') roomId: string) {
    await this.liveShareService.deleteRoom(roomId);
    // Broadcast to all clients in the room via WebSocket
    this.appGateway.broadcastRoomDeleted(roomId);
    return { message: 'Room deleted successfully' };
  }

  /**
   * Clears the history (messages and files) for a room.
   * @param roomId The ID of the room to clear.
   * @returns A success message.
   */
  @Post('rooms/:roomId/clear-history')
  async clearHistory(@Param('roomId') roomId: string) {
    await this.liveShareService.clearHistory(roomId);
    // Broadcast to all clients in the room
    this.appGateway.broadcastHistoryCleared(roomId);
    return { message: 'History cleared successfully' };
  }
}
