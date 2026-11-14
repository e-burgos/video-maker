import type { BrowserWindowConstructorOptions } from 'electron';

export type WindowTheme = 'light' | 'dark';

export const MAIN_WINDOW_WIDTH = 1280;
export const MAIN_WINDOW_HEIGHT = 800;
export const MAIN_WINDOW_MIN_WIDTH = 960;
export const MAIN_WINDOW_MIN_HEIGHT = 640;
export const SETUP_WINDOW_WIDTH = 640;
export const SETUP_WINDOW_HEIGHT = 760;

const CANVAS_BACKGROUND: Record<WindowTheme, string> = {
  dark: '#101322',
  light: '#e8eaf0',
};

const TRAFFIC_LIGHT_POSITION = { x: 26, y: 28 };

export function windowTheme(shouldUseDarkColors: boolean): WindowTheme {
  return shouldUseDarkColors ? 'dark' : 'light';
}

export function canvasBackground(theme: WindowTheme): string {
  return CANVAS_BACKGROUND[theme];
}

function sharedWindowOptions(
  theme: WindowTheme,
  preload?: string,
): BrowserWindowConstructorOptions {
  return {
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: TRAFFIC_LIGHT_POSITION,
    backgroundColor: canvasBackground(theme),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      ...(preload === undefined ? {} : { preload }),
    },
  };
}

export function mainWindowOptions(theme: WindowTheme): BrowserWindowConstructorOptions {
  return {
    ...sharedWindowOptions(theme),
    width: MAIN_WINDOW_WIDTH,
    height: MAIN_WINDOW_HEIGHT,
    minWidth: MAIN_WINDOW_MIN_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
  };
}

export function setupWindowOptions(
  theme: WindowTheme,
  preloadPath: string,
): BrowserWindowConstructorOptions {
  return {
    ...sharedWindowOptions(theme, preloadPath),
    width: SETUP_WINDOW_WIDTH,
    height: SETUP_WINDOW_HEIGHT,
    resizable: false,
  };
}
