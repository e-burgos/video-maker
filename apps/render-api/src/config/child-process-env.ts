const BASE_ALLOWED_KEYS = ['HOME', 'USER', 'LOGNAME', 'TMPDIR', 'PATH', 'SHELL', 'TERM', 'LANG'] as const;

const CONDITIONAL_PREFIXES = ['LC_', 'CLAUDE_CODE_', 'ANTHROPIC_'] as const;

const SUBSCRIPTION_ONLY_BLOCKED_KEYS: ReadonlySet<string> = new Set(['ANTHROPIC_API_KEY']);

export function allowlistedChildEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const allowed: NodeJS.ProcessEnv = {};
  for (const key of BASE_ALLOWED_KEYS) {
    const value = source[key];
    if (value !== undefined) {
      allowed[key] = value;
    }
  }
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }
    if (CONDITIONAL_PREFIXES.some((prefix) => key.startsWith(prefix)) && !SUBSCRIPTION_ONLY_BLOCKED_KEYS.has(key)) {
      allowed[key] = value;
    }
  }
  return allowed;
}
