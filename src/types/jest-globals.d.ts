// @types/jest は expo/react-native の型と衝突しやすいため、
// 実際に使っているマッチャーだけを最小限で宣言する。
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare namespace it {
  function each<T extends unknown[]>(
    cases: readonly T[],
  ): (name: string, fn: (...args: T) => void | Promise<void>) => void;
  function each<T>(cases: readonly T[]): (name: string, fn: (arg: T) => void | Promise<void>) => void;
}
declare function beforeEach(fn: () => void): void;
declare function afterEach(fn: () => void): void;

interface JestMatchers {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toMatchObject(expected: object): void;
  toBeNull(): void;
  toContain(expected: unknown): void;
  toMatch(expected: string | RegExp): void;
  toHaveBeenCalled(): void;
  toHaveBeenCalledWith(...args: unknown[]): void;
}

interface JestAsyncMatchers {
  toBe(expected: unknown): Promise<void>;
  toEqual(expected: unknown): Promise<void>;
  toMatchObject(expected: object): Promise<void>;
  toBeNull(): Promise<void>;
}

declare function expect<T = unknown>(value: T): JestMatchers & {
  not: JestMatchers;
  resolves: JestAsyncMatchers;
  rejects: JestAsyncMatchers;
};

declare namespace jest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Mock<R = any, A extends any[] = any[]> {
    (...args: A): R;
    mock: { calls: A[] };
    mockResolvedValue(value: unknown): Mock<R, A>;
    mockResolvedValueOnce(value: unknown): Mock<R, A>;
    mockRejectedValueOnce(value: unknown): Mock<R, A>;
    mockImplementation(fn: (...args: A) => R): Mock<R, A>;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function fn<R = any, A extends any[] = any[]>(impl?: (...args: A) => R): Mock<R, A>;
  function spyOn(target: object, method: string): Mock;
  function restoreAllMocks(): void;
}
