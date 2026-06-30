import type { ExecutionActionHandler, ExecutionProvider } from "@/lib/execution/provider";
import type { ActionExecutionContext } from "@/lib/execution/types";

const handlers: ExecutionActionHandler[] = [];

export function registerHandler(handler: ExecutionActionHandler): void {
  const duplicate = handlers.find((h) => h.id === handler.id);
  if (duplicate) {
    throw new Error(`Execution handler already registered: ${handler.id}`);
  }
  handlers.push(handler);
}

export function registerProvider(provider: ExecutionProvider): void {
  for (const handler of provider.handlers) {
    registerHandler(handler);
  }
}

export function resolveHandler(ctx: ActionExecutionContext): ExecutionActionHandler | null {
  return (
    handlers.find(
      (handler) =>
        handler.platform === ctx.platform &&
        handler.actionType === ctx.actionType &&
        (!handler.entityTypes || handler.entityTypes.includes(ctx.entityType)),
    ) ?? null
  );
}

export function listRegisteredHandlers(): ExecutionActionHandler[] {
  return [...handlers];
}

export function clearHandlersForTests(): void {
  handlers.length = 0;
}
