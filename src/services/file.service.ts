import { Injectable } from '@nestjs/common';
import { BaseService } from '../shared/base.service';
import AdmZip from 'adm-zip';
import { ConfigService } from '@nestjs/config';
import path from 'path';
import * as fs from 'fs';

@Injectable()
export class FileService extends BaseService {
  protected readonly FOLDER_PATH = '/uploads';

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
}
