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

/**
 * Service for handling live sharing rooms.
 */
@Injectable()
export class LiveShareService {
  private bucket: admin.storage.Storage;

  constructor(@Inject('FIREBASE_ADMIN') private firebaseApp: admin.app.App) {
    this.bucket = admin.storage(this.firebaseApp);
  }

  /**
   * Creates a new room.
   * @returns The ID of the newly created room.
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
   * Gets or creates an admin room, which is a persistent room for logged-in users.
   * @returns The ID of the admin room.
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
   * Gets the data for a specific room.
   * @param roomId The ID of the room.
   * @returns The room data, or null if the room doesn't exist.
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
   * Adds a text message to a room.
   * @param roomId The ID of the room.
   * @param content The content of the message.
   * @returns The newly created message.
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
   * Uploads a file to a room.
   * @param roomId The ID of the room.
   * @param file The file to upload.
   * @returns The newly uploaded file.
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
   * Deletes a room and all its files.
   * @param roomId The ID of the room to delete.
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
   * Clears the history (messages and files) for a room.
   * @param roomId The ID of the room to clear.
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
   * Saves the room metadata to Firebase Storage.
   * @param roomId The ID of the room.
   * @param room The room data to save.
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
   * Gets the content of a room, including messages and files, sorted by timestamp.
   * @param roomId The ID of the room.
   * @returns The content of the room.
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
