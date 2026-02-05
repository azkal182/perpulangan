export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2, 9)}`;
}
