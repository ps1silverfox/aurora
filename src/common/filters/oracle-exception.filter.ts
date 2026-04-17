import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

interface OracleError {
  errorNum: number;
  message: string;
}

const ORA_MAP: Record<number, { status: HttpStatus; title: string }> = {
  1: { status: HttpStatus.CONFLICT, title: 'Unique constraint violation' },
  1400: { status: HttpStatus.UNPROCESSABLE_ENTITY, title: 'Cannot insert null value' },
  1403: { status: HttpStatus.NOT_FOUND, title: 'No data found' },
  2290: { status: HttpStatus.UNPROCESSABLE_ENTITY, title: 'Check constraint violated' },
  2291: { status: HttpStatus.UNPROCESSABLE_ENTITY, title: 'Integrity constraint violated' },
  2292: { status: HttpStatus.CONFLICT, title: 'Child record found' },
};

@Catch()
export class OracleExceptionFilter implements ExceptionFilter {
  catch(exception: OracleError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<{ url: string }>();

    const mapped = ORA_MAP[exception.errorNum] ?? {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      title: 'Database error',
    };

    res.status(mapped.status).json({
      type: `https://errors.aurora-cms.dev/oracle/${exception.errorNum}`,
      title: mapped.title,
      status: mapped.status,
      detail: exception.message,
      instance: req.url,
    });
  }
}
