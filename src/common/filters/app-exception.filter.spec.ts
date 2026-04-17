import { ArgumentsHost } from '@nestjs/common';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { AppExceptionFilter } from './app-exception.filter';

function makeHost(json: jest.Mock): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status: () => ({ json }) }),
      getRequest: () => ({ url: '/api/v1/resource' }),
    }),
  } as unknown as ArgumentsHost;
}

describe('AppExceptionFilter', () => {
  let filter: AppExceptionFilter;
  let json: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AppExceptionFilter();
    json = jest.fn();
    host = makeHost(json);
  });

  it('maps NotFoundError to 404 with RFC 7807 body', () => {
    filter.catch(new NotFoundError('article missing'), host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 404, title: 'Not Found' }),
    );
  });

  it('maps ForbiddenError to 403', () => {
    filter.catch(new ForbiddenError('denied'), host);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('maps ConflictError to 409', () => {
    filter.catch(new ConflictError('duplicate slug'), host);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
  });

  it('maps ValidationError to 422 and includes details', () => {
    filter.catch(new ValidationError('bad input', { title: 'required' }), host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 422, errors: { title: 'required' } }),
    );
  });
});
