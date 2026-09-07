import { describe, expect, it } from 'vitest';

import { BinaryNotFoundError } from '../errors/binary-not-found-error';
import { CommandFailedError } from '../errors/command-failed-error';
import { isMediaLocalError, MediaLocalError } from '../errors/media-local-error';
import { mapExecaResult, SPAWN_FAILURE_EXIT_CODE } from './execa-command-runner';
import { FixtureCommandRunner } from './fixture-command-runner';

describe('mapExecaResult (mapeo de D-06, sin ejecutar ningún binario)', () => {
  it('un exitCode numérico se devuelve como CommandResult, incluso distinto de cero', () => {
    expect(mapExecaResult('ffmpeg', [], { stdout: 'out', stderr: 'boom', exitCode: 1 })).toEqual({
      stdout: 'out',
      stderr: 'boom',
      exitCode: 1,
    });
  });

  it('ENOENT sin exitCode se traduce a BinaryNotFoundError con el binario invocado', () => {
    const error = (() => {
      try {
        mapExecaResult('whisper-cli', [], { stdout: '', stderr: '', code: 'ENOENT' });
        return undefined;
      } catch (err) {
        return err;
      }
    })();

    expect(error).toBeInstanceOf(BinaryNotFoundError);
    expect((error as BinaryNotFoundError).binary).toBe('whisper-cli');
  });

  it('una falla de spawn sin ENOENT (p. ej. timeout) se traduce a CommandFailedError con SPAWN_FAILURE_EXIT_CODE', () => {
    const error = (() => {
      try {
        mapExecaResult('ffmpeg', ['-i', 'x'], { stdout: '', stderr: 'timed out' });
        return undefined;
      } catch (err) {
        return err;
      }
    })();

    expect(error).toBeInstanceOf(CommandFailedError);
    const commandError = error as CommandFailedError;
    expect(commandError.exitCode).toBe(SPAWN_FAILURE_EXIT_CODE);
    expect(commandError.stderr).toBe('timed out');
  });

  it('usa message cuando no hay stderr en la falla de spawn', () => {
    const error = (() => {
      try {
        mapExecaResult('ffmpeg', [], { stdout: '', stderr: '', message: 'spawn failed' });
        return undefined;
      } catch (err) {
        return err;
      }
    })();

    expect((error as CommandFailedError).stderr).toBe('spawn failed');
  });
});

describe('FixtureCommandRunner', () => {
  it('matchea bin por igualdad exacta o por basename', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { stdout: 'hola', exitCode: 0 } }]);

    await expect(runner.run('/opt/homebrew/bin/ffmpeg', ['-version'])).resolves.toEqual({
      stdout: 'hola',
      stderr: '',
      exitCode: 0,
    });
  });

  it('argsPattern matchea como subsecuencia en orden, con strings y regex intercalados', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', argsPattern: ['-af', /measured_I=/], response: { stderr: 'segunda' } },
      { bin: 'ffmpeg', argsPattern: ['-af', /^loudnorm=(?!.*measured_I)/], response: { stderr: 'primera' } },
    ]);

    const primera = await runner.run('ffmpeg', [
      '-hide_banner',
      '-af',
      'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
    ]);
    const segunda = await runner.run('ffmpeg', [
      '-y',
      '-af',
      'loudnorm=I=-14:TP=-1:LRA=11:measured_I=-23.45:print_format=json',
    ]);

    expect(primera.stderr).toBe('primera');
    expect(segunda.stderr).toBe('segunda');
  });

  it('gana la primera ruta declarada que matchea', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { stderr: 'first' } },
      { bin: 'ffmpeg', response: { stderr: 'second' } },
    ]);

    await expect(runner.run('ffmpeg', [])).resolves.toEqual(expect.objectContaining({ stderr: 'first' }));
  });

  it('la respuesta puede ser una función que recibe la call y el índice global de llamadas', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: (call, index) => ({ stdout: `${call.bin}-${index}` }) },
    ]);

    await runner.run('ffmpeg', ['a']);
    const second = await runner.run('ffmpeg', ['b']);

    expect(second.stdout).toBe('ffmpeg-1');
  });

  it('registra calls en orden con bin, args y opts literales', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: {} }]);

    await runner.run('ffmpeg', ['-i', 'in.mp4'], { cwd: '/tmp' });
    await runner.run('ffmpeg', ['-i', 'out.mp4']);

    expect(runner.calls).toEqual([
      { bin: 'ffmpeg', args: ['-i', 'in.mp4'], opts: { cwd: '/tmp' } },
      { bin: 'ffmpeg', args: ['-i', 'out.mp4'] },
    ]);
  });

  it('callsFor filtra por bin, tolerando ruta completa vs. nombre corto', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: {} },
      { bin: 'ffprobe', response: {} },
    ]);

    await runner.run('ffmpeg', []);
    await runner.run('/usr/bin/ffprobe', []);
    await runner.run('ffmpeg', ['-y']);

    expect(runner.callsFor('ffmpeg')).toHaveLength(2);
    expect(runner.callsFor('ffprobe')).toHaveLength(1);
  });

  it('reset limpia el historial de calls', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: {} }]);

    await runner.run('ffmpeg', []);
    runner.reset();

    expect(runner.calls).toEqual([]);
  });

  it('lanza un Error simple (no CommandFailedError) si ninguna ruta matchea', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffprobe', response: {} }]);

    await expect(runner.run('ffmpeg', ['-y'])).rejects.toThrow(/ffmpeg/);

    const error = await new FixtureCommandRunner([{ bin: 'ffprobe', response: {} }])
      .run('ffmpeg', ['-y'])
      .catch((err: unknown) => err);
    expect(error).not.toBeInstanceOf(CommandFailedError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('CommandFailedError vía la política de exit code del wrapper (CA-022)', () => {
  function throwIfFailed(
    result: { stdout: string; stderr: string; exitCode: number },
    command: string,
    args: string[],
  ) {
    if (result.exitCode !== 0) {
      throw new CommandFailedError({ command, args, exitCode: result.exitCode, stderr: result.stderr });
    }
    return result;
  }

  it('expone command, args, exitCode y trunca stderr a 2048 bytes como sufijo', async () => {
    const longStderr = 'x'.repeat(5000);
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { stderr: longStderr, exitCode: 1 } }]);
    const args = ['-i', 'clip.mp4'];
    const result = await runner.run('ffmpeg', args);

    const error = (() => {
      try {
        throwIfFailed(result, 'ffmpeg', args);
        return undefined;
      } catch (err) {
        return err;
      }
    })();

    expect(error).toBeInstanceOf(CommandFailedError);
    const commandError = error as CommandFailedError;
    expect(commandError.command).toBe('ffmpeg');
    expect(commandError.args).toEqual(args);
    expect(commandError.exitCode).toBe(1);
    expect(Buffer.byteLength(commandError.stderr, 'utf8')).toBe(2048);
    expect(commandError.stderrTruncated).toBe(true);
    expect(longStderr.endsWith(commandError.stderr)).toBe(true);
  });

  it('no trunca ni marca stderrTruncated para un stderr corto', () => {
    const error = new CommandFailedError({ command: 'ffmpeg', args: [], exitCode: 1, stderr: 'boom' });

    expect(error.stderr).toBe('boom');
    expect(error.stderrTruncated).toBe(false);
  });

  it('el message incluye el binario, los args unidos por espacio y el exit code', () => {
    const error = new CommandFailedError({ command: 'ffmpeg', args: ['-i', 'x.mp4'], exitCode: 1, stderr: '' });

    expect(error.message).toContain('ffmpeg');
    expect(error.message).toContain('-i x.mp4');
    expect(error.message).toContain('1');
  });

  it('isMediaLocalError es true, code es COMMAND_FAILED e instanceof MediaLocalError', () => {
    const error = new CommandFailedError({ command: 'ffmpeg', args: [], exitCode: 1, stderr: '' });

    expect(isMediaLocalError(error)).toBe(true);
    expect(error.code).toBe('COMMAND_FAILED');
    expect(error).toBeInstanceOf(MediaLocalError);
  });
});
