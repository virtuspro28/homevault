export function reportClientError(context: string, error?: unknown): void {
  if (!import.meta.env.DEV) {
    return;
  }

  console.error(`[HomeVault:${context}]`, error);
}
