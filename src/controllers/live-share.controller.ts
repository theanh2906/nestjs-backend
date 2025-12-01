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

@Controller('/api/live-share')
export class LiveShareController {
  constructor(
    private readonly liveShareService: LiveShareService,
    private readonly appGateway: AppGateway
  ) {}

  /**
   * Create a new room
   */
  @Post('rooms')
  async createRoom() {
    return await this.liveShareService.createRoom();
  }

  /**
   * Get or create admin room (for logged in users)
   */
  @Post('rooms/admin')
  async getOrCreateAdminRoom() {
    return await this.liveShareService.getOrCreateAdminRoom();
  }

  /**
   * Get room data
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
   * Get room content (messages + files sorted by timestamp)
   */
  @Get('rooms/:roomId/content')
  async getRoomContent(@Param('roomId') roomId: string) {
    return await this.liveShareService.getRoomContent(roomId);
  }

  /**
   * Add a text message to room
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
   * Upload a file to room
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
   * Delete room and all its files
   */
  @Delete('rooms/:roomId')
  async deleteRoom(@Param('roomId') roomId: string) {
    await this.liveShareService.deleteRoom(roomId);
    // Broadcast to all clients in the room via WebSocket
    this.appGateway.broadcastRoomDeleted(roomId);
    return { message: 'Room deleted successfully' };
  }

  /**
   * Clear history (messages and files) for admin room
   */
  @Post('rooms/:roomId/clear-history')
  async clearHistory(@Param('roomId') roomId: string) {
    await this.liveShareService.clearHistory(roomId);
    // Broadcast to all clients in the room
    this.appGateway.broadcastHistoryCleared(roomId);
    return { message: 'History cleared successfully' };
  }
}
