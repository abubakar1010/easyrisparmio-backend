import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiBody,
} from '@nestjs/swagger';
import { FileUploadService } from './file-upload.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('File Upload')
@Controller('upload')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload a file',
    description:
      'Uploads a single file to the server. Accepts any file type via multipart/form-data. ' +
      'Maximum file size is 10 MB. Files are stored on disk with a UUID filename. ' +
      'Requires authentication (any role).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File to upload (max 10 MB)',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The file to upload (PDF, image, document, etc.)',
        },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({
    description: 'File uploaded successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            url: '/uploads/3f8a9b2c-d4e5-6f78-90ab-cdef12345678.pdf',
            filename: '3f8a9b2c-d4e5-6f78-90ab-cdef12345678.pdf',
            originalName: 'bolletta-enel-giugno-2026.pdf',
            size: 245760,
            mimeType: 'application/pdf',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'No file provided or file exceeds 10 MB limit',
    content: {
      'application/json': {
        examples: {
          no_file: {
            summary: 'No file provided',
            value: {
              success: false,
              statusCode: 400,
              message: ['File is required'],
              timestamp: '2026-06-24T12:00:00.000Z',
            },
          },
          too_large: {
            summary: 'File exceeds size limit',
            value: {
              success: false,
              statusCode: 400,
              message: ['File too large. Maximum size is 10 MB'],
              timestamp: '2026-06-24T12:00:00.000Z',
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 401,
          message: ['Unauthorized'],
          timestamp: '2026-06-24T12:00:00.000Z',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_req, file, cb) => {
          const filename = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, filename);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    const url = `/uploads/${file.filename}`;
    return {
      url,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }
}
