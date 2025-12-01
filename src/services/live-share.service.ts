import { Inject, Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

export interface RoomMessage {
  id: string;
  content: string;
  timestamp: number;
  type: 'text';
}

export interface RoomFile {
  id: string;
  name: string;
  url: string;
  size: number;
  timestamp: number;
  type: 'file';
}

export interface Room {
  id: string;
  createdAt: number;
  messages: RoomMessage[];
  files: RoomFile[];
}

@Injectable()
export class LiveShareService {
  private bucket: admin.storage.Storage;

  constructor(@Inject('FIREBASE_ADMIN') private firebaseApp: admin.app.App) {
    this.bucket = admin.storage(this.firebaseApp);
  }

  /**
   * Create a new room
   */
  async createRoom(): Promise<{ roomId: string }> {
    const roomId = uuidv4();
    const room: Room = {
      id: roomId,
      createdAt: Date.now(),
      messages: [],
      files: [],
    };

    // Create room metadata file in Firebase Storage
    await this.saveRoomMetadata(roomId, room);

    return { roomId };
  }

  /**
   * Get or create admin room (persistent room for logged in users)
   */
  async getOrCreateAdminRoom(): Promise<{ roomId: string }> {
    const roomId = 'admin';
    const existingRoom = await this.getRoom(roomId);

    if (existingRoom) {
      return { roomId };
    }

    // Create admin room if it doesn't exist
    const room: Room = {
      id: roomId,
      createdAt: Date.now(),
      messages: [],
      files: [],
    };

    await this.saveRoomMetadata(roomId, room);
    return { roomId };
  }

  /**
   * Get room data
   */
  async getRoom(roomId: string): Promise<Room | null> {
    try {
      const file = this.bucket.bucket().file(`rooms/${roomId}/metadata.json`);
      const [exists] = await file.exists();

      if (!exists) {
        return null;
      }

      const [content] = await file.download();
      return JSON.parse(content.toString());
    } catch (error) {
      console.error('Error getting room:', error);
      return null;
    }
  }

  /**
   * Add a text message to room
   */
  async addMessage(roomId: string, content: string): Promise<RoomMessage> {
    const room = await this.getRoom(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const message: RoomMessage = {
      id: uuidv4(),
      content,
      timestamp: Date.now(),
      type: 'text',
    };

    room.messages.push(message);
    await this.saveRoomMetadata(roomId, room);

    return message;
  }

  /**
   * Upload a file to room
   */
  async uploadFile(
    roomId: string,
    file: Express.Multer.File
  ): Promise<RoomFile> {
    const room = await this.getRoom(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const fileId = uuidv4();
    const fileName = `${fileId}_${file.originalname}`;
    const filePath = `rooms/${roomId}/files/${fileName}`;

    // Upload file to Firebase Storage
    const bucket = this.bucket.bucket();
    const fileRef = bucket.file(filePath);

    await fileRef.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    // Make file publicly accessible
    await fileRef.makePublic();

    const fileUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    const roomFile: RoomFile = {
      id: fileId,
      name: file.originalname,
      url: fileUrl,
      size: file.size,
      timestamp: Date.now(),
      type: 'file',
    };

    room.files.push(roomFile);
    await this.saveRoomMetadata(roomId, room);

    return roomFile;
  }

  /**
   * Delete room and all its files
   */
  async deleteRoom(roomId: string): Promise<void> {
    const bucket = this.bucket.bucket();
    const folderPath = `rooms/${roomId}/`;

    // Delete all files in the folder
    await bucket.deleteFiles({
      prefix: folderPath,
    });
  }

  /**
   * Clear history (messages and files) for admin room
   */
  async clearHistory(roomId: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const bucket = this.bucket.bucket();

    // Delete all files
    if (room.files.length > 0) {
      const filesPath = `rooms/${roomId}/files/`;
      await bucket.deleteFiles({
        prefix: filesPath,
      });
    }

    // Reset room with empty messages and files
    room.messages = [];
    room.files = [];
    await this.saveRoomMetadata(roomId, room);
  }

  /**
   * Save room metadata to Firebase Storage
   */
  private async saveRoomMetadata(roomId: string, room: Room): Promise<void> {
    const bucket = this.bucket.bucket();
    const file = bucket.file(`rooms/${roomId}/metadata.json`);

    await file.save(JSON.stringify(room), {
      metadata: {
        contentType: 'application/json',
      },
    });
  }

  /**
   * Get room content (messages + files sorted by timestamp)
   */
  async getRoomContent(roomId: string): Promise<(RoomMessage | RoomFile)[]> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return [];
    }

    const allContent = [...room.messages, ...room.files];
    return allContent.sort((a, b) => a.timestamp - b.timestamp);
  }
}
