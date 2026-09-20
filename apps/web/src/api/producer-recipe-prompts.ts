import type { Language } from '../i18n/language';

export type ProducerRecipePrompts = Readonly<Record<Language, string>>;

export const TUTORIAL_RECIPE_PROMPT: ProducerRecipePrompts = {
  en:
    'I want a tutorial out of this screen recording, for YouTube. Tutorial recipe: narration with ' +
    'a generated voice (Daniela, Rioplatense Spanish) synchronized with what happens on screen, ' +
    'following my table of scenes and times, classic subtitles at the bottom, soft free background ' +
    'music with its credit, the transparent logo at the bottom right at 50 %, and a 2 second ' +
    'opening plate and closing plate with a white background and the logo. Timed script: [paste ' +
    'your table of scenes here, or tell me to watch the video and propose it to you]. Once we ' +
    'agree on the script, produce it and render it.',
  es:
    'Quiero un tutorial de esta grabación de pantalla, para YouTube. Receta Tutorial: narración ' +
    'con voz generada (Daniela, español rioplatense) sincronizada con lo que pasa en pantalla ' +
    'siguiendo mi tabla de escenas y tiempos, subtítulos clásicos abajo, música libre suave de ' +
    'fondo con crédito, el logo transparente abajo a la derecha al 50 %, y una placa de inicio y ' +
    'otra de cierre de 2 segundos con fondo blanco y el logo. Guion con tiempos: [pegá acá tu ' +
    'tabla de escenas, o decime que mire el video y te la proponga]. Cuando confirmemos el guion, ' +
    'producí y renderizá.',
};

export const PRODUCER_RECIPE_PROMPTS = {
  tutorial: TUTORIAL_RECIPE_PROMPT,
} as const;
