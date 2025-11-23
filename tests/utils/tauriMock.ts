import { mockIPC } from '@tauri-apps/api/mocks';
import type { InvokeArgs } from '@tauri-apps/api/core';

/**
 * Handler for a single Tauri IPC command.
 */
export type IPCHandler<T = unknown> = (
  cmd: string,
  args?: InvokeArgs,
) => T | Promise<T>;

/**
 * Mock out @tauri-apps/api invoke() calls.
 */
export function installTauriMock(
  handlers: Record<string, IPCHandler>,
): void {
  mockIPC((cmd, args) => {
    const fn = handlers[cmd];
    return fn ? fn(cmd, args) : null;
  }, { shouldMockEvents: true });
}

/**
 * Assert that invoke() args are a plain object, and narrow their type.
 */
export function ensureInvokeArgsObject<T extends object>(
  args?: InvokeArgs,
  cmd?: string,
): T {
  if (
    !args
    || Array.isArray(args)
    || args instanceof ArrayBuffer
    || args instanceof Uint8Array
    || typeof args !== 'object'
  ) {
    throw new Error(
      `Invalid invoke args for${cmd ? ` '${cmd}'` : ''}: expected object, got ${
        args == null ? String(args) : Object.prototype.toString.call(args)
      }`,
    );
  }
  return args as T;
}
