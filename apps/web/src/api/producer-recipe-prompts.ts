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

export const TUTORIAL_VERTICAL_RECIPE_PROMPT: ProducerRecipePrompts = {
  en:
    'I want a vertical tutorial out of this screen recording, for Shorts, Reels and TikTok. ' +
    'Vertical tutorial recipe: the recording is already vertical, narration with a generated voice ' +
    '(Daniela, Rioplatense Spanish) synchronized with what happens on screen, following my table of ' +
    'scenes and times, classic subtitles at the bottom — I will switch them to the big ones in the ' +
    'preview if I want to —, soft free background music with its credit, the transparent logo at the ' +
    'top left at 50 %, and a 2 second opening plate and closing plate with a white background and ' +
    'the logo. The script always closes with a farewell: if my scene table does not bring one, add ' +
    'one yourself as the last line, something like «¡Gracias por ver este tutorial! Nos vemos en el ' +
    'próximo.» {script} Once we agree on the script, produce it and render it.',
  es:
    'Quiero un tutorial vertical de esta grabación de pantalla, para Shorts, Reels y TikTok. Receta ' +
    'Tutorial Vertical: la grabación ya está en vertical, narración con voz generada (Daniela, ' +
    'español rioplatense) sincronizada con lo que pasa en pantalla siguiendo mi tabla de escenas y ' +
    'tiempos, subtítulos clásicos abajo —después los cambio por los grandes en el preview si quiero—, ' +
    'música libre suave de fondo con crédito, el logo transparente arriba a la izquierda al 50 %, y ' +
    'una placa de inicio y otra de cierre de 2 segundos con fondo blanco y el logo. El guion cierra ' +
    'siempre con una despedida: si mi tabla no la trae, agregala vos como última línea, del estilo ' +
    '«¡Gracias por ver este tutorial! Nos vemos en el próximo.» {script} Cuando confirmemos el guion, ' +
    'producí y renderizá.',
};

export const PRODUCT_AD_RECIPE_PROMPT: ProducerRecipePrompts = {
  en:
    'I want a vertical ad for my product, for Shorts, Reels and TikTok: short, very energetic and ' +
    'full of movement. Product ad recipe: build the video out of the product photos I uploaded, ' +
    'zooming each one continuously so nothing is ever still, one photo per line of the script, ' +
    'narration with a generated voice (Daniela, Rioplatense Spanish), fast cuts, big captions that ' +
    'pop word by word, free music with a lot of presence and its credit, the logo at the top left, ' +
    'and a one and a half second closing plate with a white background and the logo — no opening ' +
    'plate, nobody waits for one. The ad ends with a short call to action, not with a goodbye. ' +
    'Message: [tell me in one line what the product is and what the ad should promise, or tell me ' +
    'to read the photos and propose it myself]. Once we agree on the script, produce it and render it.',
  es:
    'Quiero una publicidad vertical de mi producto, para Shorts, Reels y TikTok: corta, muy ' +
    'energética y con mucho movimiento. Receta Publicidad: armá el video con las fotos del producto ' +
    'que subí, con zoom continuo en cada una para que nunca queden quietas, una foto por línea del ' +
    'guion, narración con voz generada (Daniela, español rioplatense), cortes rápidos, captions ' +
    'grandes que saltan palabra por palabra, música libre con mucha presencia y su crédito, el logo ' +
    'arriba a la izquierda, y una placa de cierre de un segundo y medio con fondo blanco y el logo ' +
    '—sin placa de inicio, nadie espera dos segundos—. El aviso termina con un llamado a la acción ' +
    'corto, no con una despedida. Mensaje: [contame en una línea qué producto es y qué querés que ' +
    'prometa el aviso, o decime que mire las fotos y lo proponga yo]. Cuando confirmemos el guion, ' +
    'producí y renderizá.',
};

export const PRODUCER_RECIPE_PROMPTS = {
  tutorial: TUTORIAL_RECIPE_PROMPT,
  'tutorial-vertical': TUTORIAL_VERTICAL_RECIPE_PROMPT,
  'product-ad': PRODUCT_AD_RECIPE_PROMPT,
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
