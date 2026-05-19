import * as p from '@clack/prompts';

export { p };

export function handleCancel<T>(value: T | symbol): value is symbol {
  if (p.isCancel(value)) {
    p.cancel('Cancelled');
    process.exit(1);
  }
  return false;
}

export function cancelExit(): never {
  p.cancel('Cancelled');
  process.exit(1);
}

export async function confirmContinue(message: string, defaultValue = false): Promise<boolean> {
  const result = await p.confirm({
    message,
    active: 'Yes',
    inactive: 'No',
    initialValue: defaultValue,
  });
  if (p.isCancel(result)) cancelExit();
  return result;
}
