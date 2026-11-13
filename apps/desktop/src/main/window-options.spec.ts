import { describe, expect, it } from 'vitest';

import {
  canvasBackground,
  mainWindowOptions,
  setupWindowOptions,
  windowTheme,
} from './window-options';

describe('windowTheme', () => {
  it('maps the native dark flag to a theme', () => {
    expect(windowTheme(true)).toBe('dark');
    expect(windowTheme(false)).toBe('light');
  });
});

describe('canvasBackground', () => {
  it('uses the canvas color of each theme', () => {
    expect(canvasBackground('dark')).toBe('#101322');
    expect(canvasBackground('light')).toBe('#e8eaf0');
  });
});

describe('mainWindowOptions', () => {
  const options = mainWindowOptions('dark');

  it('sets default and minimum sizes', () => {
    expect(options).toMatchObject({ width: 1280, height: 800, minWidth: 960, minHeight: 640 });
  });

  it('hides the native title bar and places the traffic lights over the sidebar', () => {
    expect(options.titleBarStyle).toBe('hiddenInset');
    expect(options.trafficLightPosition).toEqual({ x: 16, y: 16 });
  });

  it('stays opaque, themed and hidden until ready to avoid a flash', () => {
    expect(options.show).toBe(false);
    expect(options.backgroundColor).toBe('#101322');
    expect(options.transparent).toBeUndefined();
    expect(options.vibrancy).toBeUndefined();
  });

  it('keeps the renderer isolated and sandboxed without a preload', () => {
    expect(options.webPreferences).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
  });

  it('follows the light theme', () => {
    expect(mainWindowOptions('light').backgroundColor).toBe('#e8eaf0');
  });
});

describe('setupWindowOptions', () => {
  const options = setupWindowOptions('light', '/path/preload.js');

  it('keeps the fixed setup size and is not resizable', () => {
    expect(options).toMatchObject({ width: 640, height: 760, resizable: false });
  });

  it('shares the title bar and background treatment', () => {
    expect(options).toMatchObject({
      titleBarStyle: 'hiddenInset',
      show: false,
      backgroundColor: '#e8eaf0',
    });
  });

  it('passes the preload with the same isolation settings', () => {
    expect(options.webPreferences).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: '/path/preload.js',
    });
  });
});
