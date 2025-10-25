import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method, url, headers } = request;
    
    const userAgent = headers['user-agent'] || 'Unknown';
    const start = Date.now();
    
    this.logger.log(
      `→ ${method} ${url} - ${userAgent}`
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(
            `← ${method} ${url} ${response.statusCode} - ${duration}ms`
          );
        },
        error: (error) => {
          const duration = Date.now() - start;
          this.logger.error(
            `← ${method} ${url} ${response.statusCode} - ${duration}ms - ERROR: ${error.message}`
          );
        }
      })
    );
  }
}
