import { decodeCursor, encodeCursor } from './pagination';

describe('cursor encoding', () => {
  it('round-trips an object through base64 JSON', () => {
    const cursor = { id: 'abc-123', createdAt: '2026-01-01T00:00:00Z' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('encodeCursor produces a string with no padding issues', () => {
    const encoded = encodeCursor({ id: 'x' });
    expect(typeof encoded).toBe('string');
    expect(encoded).not.toContain('{');
  });

  it('decodeCursor returns null for empty string', () => {
    expect(decodeCursor('')).toBeNull();
  });

  it('decodeCursor returns null for invalid base64', () => {
    expect(decodeCursor('not-valid-json!!!')).toBeNull();
  });
});
