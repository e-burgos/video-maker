import { isRenderCliError } from './render-cli-error';

function headerFor(error: unknown): string {
  if (isRenderCliError(error)) {
    const stageToken = error.stage === null ? 'uso' : error.stage;
    return `error [${stageToken}] ${error.reason}`;
  }

  const name = error instanceof Error ? error.name : 'Error';
  const message = error instanceof Error ? error.message : String(error);
  return `error [interno] ${name}: ${message}`;
}

function causeMessageOf(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const cause = error.cause;
  return cause instanceof Error ? cause.message : null;
}

export function formatCliError(error: unknown): readonly string[] {
  const resource = isRenderCliError(error) ? error.resource : null;
  const expected = isRenderCliError(error) ? error.expected : null;
  const hint = isRenderCliError(error) ? error.hint : null;
  const causeMessage = causeMessageOf(error);

  const lines: string[] = [headerFor(error)];
  if (resource !== null) {
    lines.push(`  recurso: ${resource}`);
  }
  if (expected !== null) {
    lines.push(`  esperado: ${expected}`);
  }
  if (causeMessage !== null) {
    lines.push(`  causa: ${causeMessage}`);
  }
  if (hint !== null) {
    lines.push(`  sugerencia: ${hint}`);
  }
  return lines;
}
