import {
  Controller,
  Get,
  Post,
  Query,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { FileTypes } from '../shared/constants';
import * as process from 'node:process';
import { ConfigService } from '@nestjs/config';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { UtilsService } from '../shared/utils.service';

@Controller({
  path: '/api/files',
})
export class FilesController {
  protected readonly folderPath =
    this.configService.get<string>('UPLOAD_FOLDER');

  constructor(
    private readonly configService: ConfigService,
    private readonly utils: UtilsService,
  ) {}

  @Get()
  getAllFilesInfo() {
    try {
      const files = fs.readdirSync(this.folderPath);
      return files.map((file) => {
        const filePath = path.join(this.folderPath, file);
        const stats = fs.statSync(filePath);

        return {
          name: file,
          path: filePath,
          size: this.utils.convertCapacity(stats.size),
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
        };
      });
    } catch (error) {
      throw new Error(`Error reading files: ${error}`);
    }
  }

  @Get()
  getFile(@Query('fileName') fileName: string) {
    const file = fs.createReadStream(path.join(process.cwd(), 'package.json'));
    const extension = fileName.split('.').pop();
    return new StreamableFile(file, {
      type: FileTypes[extension],
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads',
        filename: (_, file, callback) => {
          const fileName = `${file.originalname}`;
          callback(null, fileName);
        },
      }),
    }),
  )
  uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    return files.map((file) => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
    }));
  }
}
