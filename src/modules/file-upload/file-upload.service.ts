import { Injectable, BadRequestException } from '@nestjs/common';
import { join, extname } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileUploadService {
  private readonly uploadDir = join(process.cwd(), 'uploads');

  constructor() {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
  ): Promise<{ url: string; filename: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const filename = `${uuidv4()}${extname(file.originalname)}`;
    const url = `/uploads/${filename}`;

    return { url, filename };
  }

  async deleteFile(filename: string): Promise<void> {
    const filePath = join(this.uploadDir, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  getFilePath(filename: string): string {
    return join(this.uploadDir, filename);
  }
}
