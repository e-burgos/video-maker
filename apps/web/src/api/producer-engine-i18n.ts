import type { TranslateFn } from '../i18n/language-context';
import type { ProducerEngineId } from './render-api-types';

export function producerEngineLabelKey(engine: ProducerEngineId): 'settings.engine.claudeCli' | 'settings.engine.openrouter' {
  return engine === 'claude-cli' ? 'settings.engine.claudeCli' : 'settings.engine.openrouter';
}

export function producerEngineLabel(t: TranslateFn, engine: ProducerEngineId): string {
  return t(producerEngineLabelKey(engine));
}

export function producerEngineActiveLabel(t: TranslateFn, engine: ProducerEngineId): string {
  return t('producer.withEngine', { engine: producerEngineLabel(t, engine) });
}
