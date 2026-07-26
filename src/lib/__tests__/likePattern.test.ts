import { containsPattern, escapeLikePattern } from '@/lib/likePattern';

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards so they match literally', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
  });

  it('escapes the escape character itself', () => {
    expect(escapeLikePattern('c:\\tmp')).toBe('c:\\\\tmp');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeLikePattern('買い物メモ')).toBe('買い物メモ');
  });
});

describe('containsPattern', () => {
  it('wraps the escaped input with wildcards', () => {
    expect(containsPattern('メモ')).toBe('%メモ%');
    expect(containsPattern('50%')).toBe('%50\\%%');
  });
});
