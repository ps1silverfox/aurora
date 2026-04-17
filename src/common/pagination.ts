export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  prevCursor: string | null;
}

export const encodeCursor = (value: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

export const decodeCursor = (cursor: string): Record<string, unknown> | null => {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
};
