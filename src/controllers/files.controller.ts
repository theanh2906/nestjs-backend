import {
  Controller,
  Get,
  Post,
  Query,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { join } from 'path';
import { FileTypes } from '../shared/constants';
import * as process from 'node:process';
import { ConfigService } from '@nestjs/config';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

@Controller({
  path: '/api/files',
})
export class FilesController {
  protected readonly folderPath =
    this.configService.get<string>('UPLOAD_FOLDER');

  constructor(private configService: ConfigService) {}

  @Get()
  getFile(@Query('fileName') fileName: string) {
    const file = createReadStream(join(process.cwd(), 'package.json'));
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
