export function s(selector: string | TemplateStringsArray) {
  const input = typeof selector === 'string' ? selector : selector[0];
  const parts = input.match(/([^ ]+)\s?(.*)?$/);
  return `[x-test=${parts![1]}] ${parts![2] || ''}`;
}

export async function wait(): Promise<void> {
  return new Promise(() => { });
}
