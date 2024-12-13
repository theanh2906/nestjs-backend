import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Param,
  Post,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { FileTypes } from '../shared/constants';
import * as process from 'node:process';
import { ConfigService } from '@nestjs/config';
import {
  FileFieldsInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { UtilsService } from '../shared/utils.service';
import { BaseController } from '../shared/base.controller';
import { FileService } from '../services/file.service';

@Controller({
  path: '/api/files',
})
export class FilesController extends BaseController {
  protected readonly folderPath = path.join(
    process.cwd(),
    this.configService.get<string>('UPLOAD_FOLDER'),
  );

  constructor(
    private readonly configService: ConfigService,
    private readonly utils: UtilsService,
    private readonly fileService: FileService,
  ) {
    super();
    this.logger.log(process.cwd());
  }

  @Get()
  getAllFilesInfo() {
    try {
      const files = fs.readdirSync(this.folderPath);
      return files.map((file) => {
        const filePath = path.join(this.folderPath, file);
        const stats = fs.statSync(filePath);

        return {
          name: file,
          size: this.utils.convertCapacity(stats.size),
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
        };
      });
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  @Get(':fileName')
  downloadFile(@Param('fileName') fileName: string) {
    const file = fs.createReadStream(
      `${this.folderPath}/${decodeURI(fileName)}`,
    );
    const extension = fileName.split('.').pop();
    return new StreamableFile(file, {
      type: FileTypes[extension],
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Delete(':fileName')
  @HttpCode(HttpStatus.NO_CONTENT) // No content response for successful deletion
  async deleteFile(@Param('fileName') fileName: string): Promise<void> {
    try {
      await this.fileService.deleteFile(fileName);
      return; // Send no content response
    } catch (_error) {
      throw new Error('Could not delete the file');
    }
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

  @Post('/zip')
  @UseInterceptors(
    FileFieldsInterceptor([
      {
        name: 'files',
        maxCount: 10,
      },
    ]),
  )
  async compressAndDownload(
    @UploadedFiles() files: { files?: Express.Multer.File[] },
  ) {
    // if (fs.existsSync(`${this.folderPath}/files.zip`)) {
    //   fs.rmSync(`${this.folderPath}/files.zip`);
    // }
    if (!files?.files || files.files.length === 0) {
      throw new HttpException('No files uploaded', HttpStatus.BAD_REQUEST);
    }

    const zipBuffer = await this.fileService.createZip(
      files.files.map((file) => ({
        buffer: file.buffer,
        originalName: file.originalname,
      })),
    );

    try {
      await fs.promises.writeFile(this.folderPath + '/files.zip', zipBuffer);
      return this.downloadFile('files.zip');
    } catch (_err: any) {
      throw new InternalServerErrorException('Cannot write file');
    }
  }
}
