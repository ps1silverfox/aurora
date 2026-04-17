export abstract class AppError extends Error {
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
}

export class ValidationError extends AppError {
  readonly statusCode = 422;
  constructor(
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
