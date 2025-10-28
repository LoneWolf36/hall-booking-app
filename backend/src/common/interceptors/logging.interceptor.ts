import { Injectable } from '@nestjs/common';
import {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, headers, body, params, query } = req;
    const tenantId = headers['x-tenant-id'];
    const idempotencyKey = headers['x-idempotency-key'];
    const started = Date.now();

    this.logger.log({
      msg: 'request',
      method,
      url,
      tenantId,
      idempotencyKey,
      params,
      query,
    });

    return next.handle().pipe(
      tap({
        next: (response) => {
          const duration = Date.now() - started;
          this.logger.log({
            msg: 'response',
            method,
            url,
            status: response?.statusCode ?? 200,
            duration,
            tenantId,
          });
        },
        error: (err) => {
          const duration = Date.now() - started;
          this.logger.error({
            msg: 'error',
            method,
            url,
            duration,
            tenantId,
            code: err?.code,
            status: err?.status,
            error: err?.message,
          });
        },
      }),
    );
  }
}
