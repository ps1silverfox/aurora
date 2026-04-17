import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from './errors';

describe('AppError subtypes', () => {
  it('NotFoundError has statusCode 404', () => {
    const e = new NotFoundError('user not found');
    expect(e).toBeInstanceOf(AppError);
    expect(e).toBeInstanceOf(Error);
    expect(e.statusCode).toBe(404);
    expect(e.message).toBe('user not found');
  });

  it('ForbiddenError has statusCode 403', () => {
    const e = new ForbiddenError('no access');
    expect(e.statusCode).toBe(403);
  });

  it('ConflictError has statusCode 409', () => {
    const e = new ConflictError('already exists');
    expect(e.statusCode).toBe(409);
  });

  it('ValidationError has statusCode 422 and field details', () => {
    const e = new ValidationError('invalid input', { email: 'required' });
    expect(e.statusCode).toBe(422);
    expect(e.details).toEqual({ email: 'required' });
  });
});
