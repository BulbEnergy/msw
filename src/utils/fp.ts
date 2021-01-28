export const runOrMap = <A, B>(fn: (a: A) => B, val: A | A[]) => {
  return Array.isArray(val)
    ? val.map(fn).filter(<T>(b: T | null): b is T => b !== null)
    : fn(val)
}
export const runOrFind = <A, C>(fn: (a: A) => C, val: A | A[]) => {
  return Array.isArray(val) ? val.find(fn) : fn(val) && val
}
