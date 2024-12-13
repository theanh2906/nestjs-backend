import { Injectable } from '@nestjs/common';
import { BaseService } from '../shared/base.service';
import AdmZip from 'adm-zip';
import { ConfigService } from '@nestjs/config';
import path from 'path';
import process from 'node:process';
import * as fs from 'fs';

@Injectable()
export class FileService extends BaseService {
  protected readonly FOLDER_PATH = path.join(
    process.cwd(),
    this.configService.get<string>('UPLOAD_FOLDER'),
  );

  constructor(private configService: ConfigService) {
    super();
  }

  async createZip(
    files: { buffer: Buffer; originalName: string }[],
  ): Promise<Buffer> {
    const zip = new AdmZip();
    files.forEach((file) => {
      zip.addFile(file.originalName, file.buffer);
    });
    return zip.toBuffer();
  }

  deleteFile(fileName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const fullPath = path.resolve(`${this.FOLDER_PATH}/${fileName}`); // Resolve relative paths

      fs.unlink(fullPath, (err) => {
        if (err) {
          return reject(new Error('Failed to delete file: ' + err.message));
        }
        resolve();
      });
    });
  }
}
