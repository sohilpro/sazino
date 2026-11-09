import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from '../logging/request-log';
import { mapPrismaError } from '../prisma-errors';
import { captureServerError } from '../sentry';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception;

    const http = host.switchToHttp();
    const req = http.getRequest<RequestWithId>();
    const res = http.getResponse<Response>();
    const error = mapPrismaError(exception) ?? exception;

    if (error instanceof HttpException) {
      const status = error.getStatus();
      const body = error.getResponse();
      res.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    const path = (req.originalUrl ?? req.url).split('?')[0];
    const requestId = req.id;
    const tenantId = req.user?.tenantId;

    this.logger.error({
      msg: 'unhandled exception',
      requestId,
      method: req.method,
      path,
      tenantId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    captureServerError(error, { requestId, tenantId, route: `${req.method} ${path}` });

    res.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      ...(requestId ? { requestId } : {}),
    });
  }
}