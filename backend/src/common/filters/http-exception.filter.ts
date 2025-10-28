import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();

      if (typeof errorResponse === 'object') {
        message = (errorResponse as any).message || 'Unknown error';
        error = (errorResponse as any).error || exception.name;
      } else {
        message = errorResponse;
        error = exception.name;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'InternalServerError';

      // Log unexpected errors
      this.logger.error(
        `Unexpected error: ${(exception as any).message}`,
        (exception as any).stack,
      );
    }

    const errorResponse = {
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ...(process.env.NODE_ENV === 'development' && {
        stack: (exception as any).stack,
      }),
    };

    response.status(status).json(errorResponse);
  }
}
