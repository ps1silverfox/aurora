import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { OracleExceptionFilter } from './oracle-exception.filter';

function makeHost(json: jest.Mock): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({
        status: () => ({ json }),
      }),
      getRequest: () => ({ url: '/api/v1/test' }),
    }),
  } as unknown as ArgumentsHost;
}

describe('OracleExceptionFilter', () => {
  let filter: OracleExceptionFilter;
  let json: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new OracleExceptionFilter();
    json = jest.fn();
    host = makeHost(json);
  });

  it('maps ORA-00001 (unique constraint) to 409 Conflict', () => {
    filter.catch({ errorNum: 1, message: 'ORA-00001: unique constraint violated' }, host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ status: HttpStatus.CONFLICT }),
    );
  });

  it('maps ORA-01403 (no data found) to 404 Not Found', () => {
    filter.catch({ errorNum: 1403, message: 'ORA-01403: no data found' }, host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ status: HttpStatus.NOT_FOUND }),
    );
  });

  it('maps unknown ORA codes to 500', () => {
    filter.catch({ errorNum: 99999, message: 'ORA-99999: unknown' }, host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ status: HttpStatus.INTERNAL_SERVER_ERROR }),
    );
  });

  it('response includes RFC 7807 fields', () => {
    filter.catch({ errorNum: 1, message: 'ORA-00001' }, host);
    const calls = json.mock.calls as [Record<string, unknown>][];
    const body = calls[0]?.[0] ?? {};
    expect(typeof body['type']).toBe('string');
    expect(typeof body['title']).toBe('string');
    expect(typeof body['detail']).toBe('string');
  });
});
