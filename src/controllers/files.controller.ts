import { Bucket } from '@google-cloud/storage';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FileFieldsInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as process from 'node:process';
import * as path from 'path';
import { AppGateway } from '../app.gateway';
import { FileService, FirebaseService } from '../services';
import { BaseController } from '../shared/base.controller';
import { FileTypes } from '../shared/constants';
import { UtilsService } from '../shared/utils.service';

@Controller({
  path: '/api/files',
})
export class FilesController extends BaseController {
  protected readonly folderPath = path.join(
    process.cwd(),
    this.configService.get<string>('UPLOAD_FOLDER')
  );
  private bucket: Bucket;

  constructor(
    private readonly configService: ConfigService,
    private readonly utils: UtilsService,
    private readonly fileService: FileService,
    private readonly firebaseService: FirebaseService,
    private readonly gateway: AppGateway,
    @Inject('FIREBASE_ADMIN') protected readonly firebaseApp: admin.app.App
  ) {
    super();
    this.logger.log(process.cwd());
    this.bucket = firebaseApp.storage().bucket();
  }

  @Get()
  @SkipThrottle()
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

  @Get('/firebase')
  @SkipThrottle()
  async getAllFilesInStorage() {
    return await this.firebaseService.getAllFiles();
  }

  @Post('/firebase/folder')
  async createFolder(@Body('folderName') folderName: string) {
    try {
      const result = await this.firebaseService.createFolder(folderName);
      return { message: result };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Delete('/firebase')
  async deleteFiles(@Body() fileNames: string[]) {
    try {
      await this.firebaseService.deleteFiles(fileNames);
      return { message: `Files ${fileNames.join(', ')} deleted successfully.` };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get(':fileName')
  downloadFile(@Param('fileName') fileName: string) {
    const file = fs.createReadStream(
      `${this.folderPath}/${decodeURI(fileName)}`
    );
    const extension = fileName.split('.').pop();
    return new StreamableFile(file, {
      type: FileTypes[extension],
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Get('/firebase/:fileName')
  async downloadFileFromStorage(
    @Param('fileName') fileName: string,
    @Query('preview') preview?: boolean
  ) {
    try {
      const file = this.bucket.file(fileName);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new NotFoundException(`File ${fileName} not found`);
      }

      // Get file metadata
      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType || 'application/octet-stream';

      // Create read stream
      const fileStream = file.createReadStream();

      // Return file with disposition based on preview flag
      return new StreamableFile(fileStream, {
        type: contentType,
        disposition: `${preview ? 'inline' : 'attachment'}; filename="${fileName}"`,
      });
    } catch (error) {
      if (error.name === 'NotFoundException') {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error ${preview ? 'previewing' : 'downloading'} file`
      );
    }
  }
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT) // No content response for successful deletion
  async deleteFile(@Body() fileNames: string[]): Promise<void> {
    try {
      for (const fileName of fileNames) {
        await this.fileService.deleteFile(fileName);
      }
      return; // Send no content response
    } catch (_error) {
      throw new Error('Could not delete the file');
    }
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: diskStorage({
        destination: './uploads',
        filename: (_, file, callback) => {
          const fileName = `${file.originalname}`;
          callback(null, fileName);
        },
      }),
    })
  )
  uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    return files.map((file) => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
    }));
  }

  @Post('/firebase')
  @UseInterceptors(FilesInterceptor('files', 20))
  async uploadFilesToStorage(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded.');
    }
    const uploadPromises = files.map(
      this.firebaseService.uploadFilesToStorage.bind(this)
    );
    const fileUrls = await Promise.all(uploadPromises);
    return { urls: fileUrls };
  }

  @Post('/zip')
  @UseInterceptors(
    FileFieldsInterceptor([
      {
        name: 'files',
        maxCount: 10,
      },
    ])
  )
  async compressAndDownload(
    @UploadedFiles() files: { files?: Express.Multer.File[] }
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
      }))
    );

    try {
      await fs.promises.writeFile(this.folderPath + '/files.zip', zipBuffer);
      return this.downloadFile('files.zip');
    } catch (_err: any) {
      throw new InternalServerErrorException('Cannot write file');
    }
  }
}
