import { Injectable, OnModuleInit } from '@nestjs/common';
import { BaseService } from '../shared/base.service';
import AdmZip from 'adm-zip';
import path from 'path';
import * as fs from 'fs';
import * as process from 'process';

export interface FileChunk {
  chunk: Buffer;
  currentChunk: number;
  totalChunks: number;
  fileName: string;
  fileSize: number;
}

@Injectable()
export class FileService extends BaseService implements OnModuleInit {
  protected readonly FOLDER_PATH = process.cwd() + '/uploads';
  private readonly DEFAULT_CHUNK_SIZE = 64 * 1024; // 64KB chunks by default

  async onModuleInit() {
    // await this.createZipFromFolder('C:\\Notes');
  }

  async createZip(
    files: { buffer: Buffer; originalName: string }[]
  ): Promise<Buffer> {
    const zip = new AdmZip();
    files.forEach((file) => {
      zip.addFile(file.originalName, file.buffer);
    });
    return zip.toBuffer();
  }

  async createZipFromFolder(folderPath: string): Promise<string> {
    const zip = new AdmZip();
    const fullPath = path.resolve(folderPath); // Resolve relative paths
    const zipName = path.basename(fullPath) + '.zip';
    const outputPath = path.join(folderPath, zipName);

    try {
      // Use addLocalFolder method to recursively add all files and directories
      zip.addLocalFolder(fullPath);

      // Remove the zip file entry if it exists to avoid including itself
      try {
        zip.deleteFile(zipName);
      } catch (e) {
        // Ignore if file doesn't exist in the zip
      }

      // Write the zip file
      await zip.writeZipPromise(outputPath);

      return outputPath;
    } catch (error) {
      console.error(`Error creating zip from folder: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(fileName: string) {
    const fullPath = path.resolve(`${this.FOLDER_PATH}/${fileName}`); // Resolve relative paths

    try {
      await fs.promises.unlink(fullPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(`File ${fileName} does not exist.`);
      } else {
        console.error(`Error while deleting file: ${error.message}`);
      }
    }
  }

  /**
   * Get file information including size and path
   * @param fileName Name of the file to get info for
   * @returns Object with file information or null if file doesn't exist
   */
  async getFileInfo(
    filePath: string
  ): Promise<{ size: number; path: string } | null> {
    const fullPath = path.resolve(filePath);

    try {
      const stats = await fs.promises.stat(fullPath);
      return {
        size: stats.size,
        path: fullPath,
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(`File does not exist.`);
      } else {
        console.error(`Error getting file info: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Stream a file in chunks
   * @returns AsyncGenerator that yields file chunks
   */
  async *streamFileInChunks(
    chunkSize: number = this.DEFAULT_CHUNK_SIZE
  ): AsyncGenerator<FileChunk> {
    const fileInfo = await this.getFileInfo('C:\\Notes\\Notes.zip');

    if (!fileInfo) {
      throw new Error(`File not found`);
    }

    const { size: fileSize, path: filePath } = fileInfo;
    const totalChunks = Math.ceil(fileSize / chunkSize);
    const fileHandle = await fs.promises.open(filePath, 'r');

    try {
      let currentChunk = 0;
      let bytesRead = 0;

      while (bytesRead < fileSize) {
        const buffer = Buffer.alloc(Math.min(chunkSize, fileSize - bytesRead));
        const { bytesRead: readBytes } = await fileHandle.read(
          buffer,
          0,
          buffer.length,
          bytesRead
        );

        if (readBytes === 0) break;

        bytesRead += readBytes;
        currentChunk++;

        yield {
          chunk: Buffer.prototype.slice.call(buffer, 0, readBytes),
          currentChunk,
          totalChunks,
          fileName: 'Notes.zip',
          fileSize,
        };
      }
    } finally {
      await fileHandle.close();
    }
  }

  /**
   * Create a readable stream from a file
   * @param fileName Name of the file to stream
   * @returns Readable stream of the file
   */
  createFileReadStream(fileName: string): fs.ReadStream {
    const fullPath = path.resolve(`${this.FOLDER_PATH}/${fileName}`);
    return fs.createReadStream(fullPath);
  }
}
