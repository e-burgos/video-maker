import type { Language } from '../i18n/language';

export type ProducerRecipePrompts = Readonly<Record<Language, string>>;

export const TUTORIAL_RECIPE_PROMPT: ProducerRecipePrompts = {
  en:
    'I want a tutorial out of this screen recording, for YouTube. Tutorial recipe: narration with ' +
    'a generated voice (Daniela, Rioplatense Spanish) synchronized with what happens on screen, ' +
    'following my table of scenes and times, classic subtitles at the bottom, soft free background ' +
    'music with its credit, the transparent logo at the bottom right at 50 %, and a 2 second ' +
    'opening plate and closing plate with a white background and the logo. The script always ' +
    'closes with a farewell: if my scene table does not bring one, add one yourself as the last ' +
    'line, something like «¡Gracias por ver este tutorial! Nos vemos en el próximo.» ' +
    '{script} Once we agree on the script, produce it and render it.',
  es:
    'Quiero un tutorial de esta grabación de pantalla, para YouTube. Receta Tutorial: narración ' +
    'con voz generada (Daniela, español rioplatense) sincronizada con lo que pasa en pantalla ' +
    'siguiendo mi tabla de escenas y tiempos, subtítulos clásicos abajo, música libre suave de ' +
    'fondo con crédito, el logo transparente abajo a la derecha al 50 %, y una placa de inicio y ' +
    'otra de cierre de 2 segundos con fondo blanco y el logo. El guion cierra siempre con una ' +
    'despedida: si mi tabla no la trae, agregala vos como última línea, del estilo ' +
    '«¡Gracias por ver este tutorial! Nos vemos en el próximo.» {script} Cuando confirmemos ' +
    'el guion, producí y renderizá.',
};

export const PRODUCER_RECIPE_PROMPTS = {
  tutorial: TUTORIAL_RECIPE_PROMPT,
} as const;

export const RECIPE_SCRIPT_SENTENCES: Readonly<Record<Language, Readonly<Record<'present' | 'missing', string>>>> = {
  en: {
    present: 'Timed script: use the one already in the project (work/producer/script.txt).',
    missing: 'Timed script: [paste your table of scenes here, or tell me to watch the video and propose it to you].',
  },
  es: {
    present: 'Guion con tiempos: usá el que ya está en el proyecto (work/producer/script.txt).',
    missing: 'Guion con tiempos: [pegá acá tu tabla de escenas, o decime que mire el video y te la proponga].',
  },
};
