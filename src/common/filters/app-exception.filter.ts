import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { AppError, ValidationError } from '../errors';

const HTTP_TITLES: Record<number, string> = {
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
};

@Catch(AppError)
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: AppError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<{ url: string }>();
    const status = exception.statusCode;

    const body: Record<string, unknown> = {
      type: `https://errors.aurora-cms.dev/${status}`,
      title: HTTP_TITLES[status] ?? 'Error',
      status,
      detail: exception.message,
      instance: req.url,
    };

    if (exception instanceof ValidationError) {
      body['errors'] = exception.details;
    }

    res.status(status).json(body);
  }
}
