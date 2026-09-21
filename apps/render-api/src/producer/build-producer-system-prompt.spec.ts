import { describe, expect, it } from 'vitest';

import {
  buildProducerAppRulesSection,
  buildProducerProjectSection,
  buildProducerSystemPrompt,
  PRODUCER_BASE_ALLOWED_TOOLS,
  producerAllowedTools,
} from './build-producer-system-prompt';
import type { ProducerProjectContext } from './collect-producer-context';

const CONTEXT: ProducerProjectContext = {
  slug: 'demo-01',
  projectRoot: '/media/demo-01',
  repoRoot: '/repo',
  apiUrl: 'http://127.0.0.1:4399',
  assetSource: 'catalog',
  assets: [
    { path: 'raw/aroll/clip01.mp4', role: 'aroll', durationMs: 25_900 },
    { path: 'raw/logo/logo.png', role: 'logo', durationMs: null },
  ],
  hasTimeline: true,
  producerScript: 'none',
};

const EMPTY_CONTEXT: ProducerProjectContext = {
  ...CONTEXT,
  assetSource: 'raw-scan',
  assets: [],
  hasTimeline: false,
  producerScript: 'none',
};

describe('buildProducerProjectSection', () => {
  it('da el slug, las dos raíces absolutas, la API y el estado de la Timeline', () => {
    const section = buildProducerProjectSection(CONTEXT);

    expect(section).toContain('Slug: demo-01');
    expect(section).toContain('/media/demo-01');
    expect(section).toContain('Repository root and your working directory: /repo');
    expect(section).toContain('Studio API: http://127.0.0.1:4399');
    expect(section).toContain('work/timeline.json exists');
  });

  it('lista cada asset con su rol y su duración en segundos', () => {
    const section = buildProducerProjectSection(CONTEXT);
    expect(section).toContain('- aroll: raw/aroll/clip01.mp4 (25.9s)');
    expect(section).toContain('- logo: raw/logo/logo.png');
    expect(section).not.toContain('raw/logo/logo.png (');
  });

  it('avisa que las duraciones no están medidas cuando el catálogo todavía no existe', () => {
    expect(
      buildProducerProjectSection({ ...CONTEXT, assetSource: 'raw-scan' }),
    ).toContain('the project has no catalog yet');
  });

  it('dice explícitamente que hay que preguntar cuando raw/ está vacío', () => {
    const section = buildProducerProjectSection(EMPTY_CONTEXT);
    expect(section).toContain('raw/ is empty');
    expect(section).toContain('Ask the user');
    expect(section).toContain('none yet');
  });
});

describe('buildProducerAppRulesSection', () => {
  it('desactiva las instrucciones de desarrollo del repo para el productor', () => {
    const section = buildProducerAppRulesSection(CONTEXT, '/usr/bin/piper', 'sonnet');
    expect(section).toContain('CLAUDE.md');
    expect(section).toContain('Never modify source code');
  });

  it('confina la escritura al proyecto y prohíbe tocar otros proyectos de media/', () => {
    const section = buildProducerAppRulesSection(CONTEXT, '/usr/bin/piper', 'sonnet');
    expect(section).toContain('only create or change files under /media/demo-01');
    expect(section).toContain('Never touch another project');
  });

  it('prefiere los jobs de la API y da el curl exacto del proyecto', () => {
    const section = buildProducerAppRulesSection(CONTEXT, '/usr/bin/piper', 'sonnet');
    expect(section).toContain('http://127.0.0.1:4399/projects/demo-01/jobs');
    expect(section).toContain('"kind":"montage"');
    expect(section).toContain('http://127.0.0.1:4399/jobs/<jobId>');
  });

  it('prohíbe leer el .env, no sólo sourcearlo: el agente intentó un cat en el smoke', () => {
    const section = buildProducerAppRulesSection(CONTEXT, '/usr/bin/piper', 'sonnet');
    expect(section).toContain('Never source, read,');
    expect(section).toContain('open or print the .env file');
  });

  it('incluye las formas reescritas por el hook rtk, que si no quedan denegadas', () => {
    const patterns = [...PRODUCER_BASE_ALLOWED_TOOLS];
    expect(patterns).toContain('Bash(rtk curl *)');
    expect(patterns).toContain('Bash(rtk ls *)');
    expect(patterns).toContain('Bash(rtk read *)');
  });

  it('da la receta de Piper con el binario resuelto, y una salida cuando no está instalado', () => {
    expect(buildProducerAppRulesSection(CONTEXT, '/usr/bin/piper', 'sonnet')).toContain(
      '`/usr/bin/piper -m <model .onnx> -i <text file> -f <out.wav>`',
    );
    expect(buildProducerAppRulesSection(CONTEXT, null, 'sonnet')).toContain('Piper is not installed');
  });

  it('pone el binario de Piper en la lista blanca cuando está instalado (FIX-e-burgos-015-002)', () => {
    expect(producerAllowedTools('/usr/bin/piper')).toEqual([
      ...PRODUCER_BASE_ALLOWED_TOOLS,
      'Bash(/usr/bin/piper *)',
    ]);
    expect(producerAllowedTools('piper').at(-1)).toBe('Bash(piper *)');
    expect(producerAllowedTools(null)).toEqual([...PRODUCER_BASE_ALLOWED_TOOLS]);
    expect(buildProducerAppRulesSection(CONTEXT, '/usr/bin/piper', 'sonnet')).toContain(
      'Bash(/usr/bin/piper *)',
    );
  });

  it('cuando el proyecto ya trae work/producer/script.txt lo declara como EL guion y prohibe pedir la tabla de nuevo', () => {
    const timed = buildProducerProjectSection({ ...CONTEXT, producerScript: 'timed' });
    const plain = buildProducerProjectSection({ ...CONTEXT, producerScript: 'plain' });
    const none = buildProducerProjectSection({ ...CONTEXT, producerScript: 'none' });

    expect(timed).toContain('work/producer/script.txt WITH time marks');
    expect(timed).toContain('never ask the user for a scene table');
    expect(plain).toContain('without time marks');
    expect(none).not.toContain('work/producer/script.txt');
  });

  it('traduce el lenguaje comun del usuario a jobs y flags sin pedirle parametros tecnicos (FIX-e-burgos-015-003)', () => {
    const rules = buildProducerAppRulesSection(CONTEXT, null, 'haiku');
    expect(rules).toContain('THE USER SPEAKS IN PLAIN LANGUAGE AND YOU TRANSLATE');
    expect(rules).toContain('"for YouTube / the web" → `format: youtube-16x9`');
    expect(rules).toContain('"generate the voice / automatic voice / AI voice"');
    expect(rules).toContain('do not ask again');
  });

  it('inyecta el modelo del turno en la regla de los jobs (FIX-e-burgos-015-002)', () => {
    expect(buildProducerAppRulesSection(CONTEXT, null, 'haiku')).toContain('"model": "haiku"');
    expect(buildProducerAppRulesSection(CONTEXT, null, 'opus')).toContain('"model": "opus"');
  });

  it('nunca habla de API key y manda mostrar el error literal del proveedor (FIX-e-burgos-015-002)', () => {
    const section = buildProducerAppRulesSection(CONTEXT, null, 'sonnet');
    expect(section).toContain('Claude Code subscription');
    expect(section).toContain('NO API key anywhere');
    expect(section).toContain('AI_AGENT_RATE_LIMITED');
    expect(section).toContain('`result` field of the error');
  });

  it('manda seguir el A-roll para el formato y dar voz sin storyboard (FIX-e-burgos-015-002)', () => {
    const section = buildProducerAppRulesSection(CONTEXT, null, 'sonnet');
    expect(section).toContain('youtube-16x9');
    expect(section).toContain('reels-9x16');
    expect(section).toContain('"kind":"voice","scriptPath":"work/producer/script.txt"');
  });

  it('manda preguntar la plataforma y producir un solo formato (FIX-e-burgos-007-002)', () => {
    const section = buildProducerAppRulesSection(CONTEXT, null, 'sonnet');
    expect(section).toContain('ASK THE USER WHICH PLATFORM');
    expect(section).toContain('Never render every size unless the user explicitly asks');
  });

  it('explica el camino de grabación muda + narración generada (FIX-e-burgos-007-002)', () => {
    const section = buildProducerAppRulesSection(CONTEXT, null, 'sonnet');
    expect(section).toContain('"voice":"script"');
    expect(section).toContain('MONTAGE_VOICE_TRACK_NOT_FOUND');
    expect(section).toContain('voiceTrack.truncatedMs');
    expect(section).toContain('min(voice, A-roll)');
  });

  it('exige sincronizar la narración con la acción y explica las marcas de tiempo (FIX-e-burgos-009-002)', () => {
    const rules = buildProducerAppRulesSection(CONTEXT, null, 'sonnet');

    expect(rules).toContain('SYNCHRONIZE THE NARRATION WITH WHAT HAPPENS ON SCREEN');
    expect(rules).toContain('`[m:ss]`');
    expect(rules).toContain('[m:ss-m:ss]');
    expect(rules).toContain('Never spread the sentences over the');
    expect(rules).toContain('WATCH THE VIDEO BEFORE WRITING');
    expect(rules).toContain('ffmpeg -ss <seconds>');
    expect(rules).toContain('overflowMs');
  });

  it('con guion cronometrado el video dura el A-roll completo (FIX-e-burgos-009-002)', () => {
    const rules = buildProducerAppRulesSection(CONTEXT, null, 'sonnet');

    expect(rules).toContain('With a timed script the video lasts the WHOLE A-roll');
    expect(rules).toContain('min(voice, A-roll)');
  });

  it('elige el estilo de subtítulos según el tipo de video y traduce el lenguaje común (FIX-e-burgos-003-003)', () => {
    const rules = buildProducerAppRulesSection(CONTEXT, null, 'sonnet');

    expect(rules).toContain('captionStyle');
    expect(rules).toContain('subtle-lower');
    expect(rules).toContain('bold-impact');
    expect(rules).toContain('subtítulos normales');
    expect(rules).toContain('captions grandes');
  });

  it('publica la lista blanca completa de herramientas', () => {
    const section = buildProducerAppRulesSection(CONTEXT, null, 'sonnet');
    for (const tool of PRODUCER_BASE_ALLOWED_TOOLS) {
      expect(section).toContain(tool);
    }
  });

  it('explica que mkdir y cp no existen y cómo copiar un medio sin ellos', () => {
    const section = buildProducerAppRulesSection(CONTEXT, null, 'sonnet');
    expect(section).toContain('`mkdir`, `cp`, `mv` and `rm` are NOT available');
    expect(section).toContain('ffmpeg -i <source> -c copy <destination>');
    expect(section).toContain('Never ask the user to change permissions.');
  });

  it('exige un comando por llamada, sin prefijos ni encadenados que la lista blanca no matchea', () => {
    const section = buildProducerAppRulesSection(CONTEXT, null, 'sonnet');
    expect(section).toContain('literal prefix');
    expect(section).toContain('`BASE=/x ffprobe …` is denied');
    expect(section).toContain('one command per call');
  });

  it('exige el bloque de sugerencias en toda respuesta, con el ejemplo literal', () => {
    const section = buildProducerAppRulesSection(CONTEXT, null, 'sonnet');
    expect(section).toContain('End EVERY reply');
    expect(section).toContain('```suggestions');
    expect(section).toContain('opciones numeradas'.replace('opciones numeradas', 'numbered options'));
  });
});

describe('buildProducerSystemPrompt', () => {
  it('pone la skill primero, entera, y las dos secciones propias separadas por reglas', () => {
    const skill = '# Skill: video-producer\n\nSos el productor de video del studio.\n';
    const prompt = buildProducerSystemPrompt(skill, CONTEXT, '/usr/bin/piper', 'sonnet');

    expect(prompt.startsWith('# Skill: video-producer')).toBe(true);
    expect(prompt).toContain('Sos el productor de video del studio.');
    expect(prompt.split('\n---\n')).toHaveLength(3);
    expect(prompt.indexOf('# This project')).toBeLessThan(prompt.indexOf('# How you run inside the studio'));
  });
});

describe('buildProducerAppRulesSection — entrega y logo (FIX-015-004)', () => {
  const section = buildProducerAppRulesSection(CONTEXT, null, 'sonnet');

  it('exige nombrar la pantalla de cada artefacto al entregar', () => {
    expect(section).toContain('WHEN YOU DELIVER, SAY WHERE EACH THING IS');
    expect(section).toContain('"Generated" section of the library');
    expect(section).toContain('the `voice` screen');
    expect(section).toContain('the `storyboard` screen');
  });

  it('prohíbe contestar "dónde está" con una ruta de archivo', () => {
    expect(section).toContain('Never hand over');
    expect(section).toContain('name the screen first');
  });

  it('enseña a medir el canal alfa del logo con ffprobe', () => {
    expect(section).toContain('PICK A LOGO WITH TRANSPARENCY');
    expect(section).toContain('pix_fmt');
    expect(section).toContain('`pal8`');
  });

  it('ordena preferir el logo con alfa y preguntar sólo cuando los dos la tienen', () => {
    expect(section).toContain('prefer');
    expect(section).toContain('ask which one only when both have it');
    expect(section).toContain('it will show as a box');
  });
});

describe('buildProducerAppRulesSection — receta Tutorial (FIX-015-005)', () => {
  const section = buildProducerAppRulesSection(CONTEXT, null, 'sonnet');

  it('trata una receta nombrada como una decisión tomada, no como una pista', () => {
    expect(section).toContain('A NAMED RECIPE IS A DECISION ALREADY TAKEN, NOT A HINT');
    expect(section).toContain('TUTORIAL RECIPE');
    expect(section).toContain('"Receta Tutorial", "Tutorial recipe"');
    expect(section).toContain('NEVER ask about any of it again');
  });

  it('fija los parámetros exactos del video que salió bien', () => {
    for (const parameter of [
      '"format":"youtube-16x9"',
      '"preset":"educational"',
      '"seed":0',
      '"voice":"script"',
      '"captionStyle":"subtle-lower"',
      '"voiceId":"es_AR-daniela-high"',
      '"gapMs":900',
      '"position":"bottom-right","widthRatio":0.18,"opacity":0.5',
      '"durationMs":2000',
      '"backgroundColor":"#ffffff"',
      '"logoWidthRatio":0.4',
      '"animation":"slide-up"',
      '"animation":"zoom"',
    ]) {
      expect(section).toContain(parameter);
    }
  });

  it('acredita la música y no pisa los niveles del preset', () => {
    expect(section).toContain('credited in work/credits.json');
    expect(section).toContain('-8 dB base, -18 dB ducked');
    expect(section).toContain('do not override them');
  });

  it('deja sólo dos huecos: el guion con tiempos y, si hay varios logos con alfa, cuál', () => {
    expect(section).toContain('ASK ONLY for what the recipe cannot know');
    expect(section).toContain('their scene table, or their');
    expect(section).toContain('more than one file');
    expect(section).toContain('which logo');
  });

  it('pide un guion con marcas de tiempo, una línea por escena', () => {
    expect(section).toContain('carry `[m:ss]` marks');
    expect(section).toContain('one line per scene');
  });
});
