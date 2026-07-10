import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (!(exception instanceof HttpException)) {
      this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : exception);
    }
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    let data: Record<string, any> | undefined;
    let errorCode: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || message;
      if (typeof res === 'object' && (res as any).data) {
        data = (res as any).data;
      }
      if (typeof res === 'object' && (res as any).errorCode) {
        errorCode = (res as any).errorCode;
      }
    }

    const body: Record<string, any> = {
      success: false,
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      timestamp: new Date().toISOString(),
    };
    if (errorCode) {
      body.errorCode = errorCode;
    }
    if (data) {
      body.data = data;
    }

    response.status(status).json(body);
  }
}
