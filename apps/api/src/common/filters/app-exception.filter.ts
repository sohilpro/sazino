import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { mapPrismaError } from '../prisma-errors';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception;

    const res = host.switchToHttp().getResponse<Response>();
    const error = mapPrismaError(exception) ?? exception;

    if (error instanceof HttpException) {
      const status = error.getStatus();
      const body = error.getResponse();
      res.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    this.logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
}