import { err, isErr, isOk, ok } from './result';

describe('Result helpers', () => {
  it('ok() creates a success result', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (isOk(r)) {
      expect(r.value).toBe(42);
    }
  });

  it('err() creates a failure result', () => {
    const r = err('boom');
    expect(r.ok).toBe(false);
    if (isErr(r)) {
      expect(r.error).toBe('boom');
    }
  });

  it('isOk returns true only for ok results', () => {
    expect(isOk(ok('x'))).toBe(true);
    expect(isOk(err('x'))).toBe(false);
  });

  it('isErr returns true only for error results', () => {
    expect(isErr(err('x'))).toBe(true);
    expect(isErr(ok('x'))).toBe(false);
  });
});
