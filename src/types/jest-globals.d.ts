// @types/jest は expo/react-native の型と衝突しやすいため、
// 実際に使っているマッチャーだけを最小限で宣言する。
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;

interface JestMatchers {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toMatchObject(expected: object): void;
}

declare function expect<T = unknown>(value: T): JestMatchers & {
  not: JestMatchers;
};
