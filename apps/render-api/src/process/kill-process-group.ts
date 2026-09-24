export function killProcessGroup(pid: number, signal: NodeJS.Signals = 'SIGKILL'): void {
  try {
    process.kill(-pid, signal);
  } catch (groupError) {
    void groupError;
    try {
      process.kill(pid, signal);
    } catch (pidError) {
      void pidError;
    }
  }
}
