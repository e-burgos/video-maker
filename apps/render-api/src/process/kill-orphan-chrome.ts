import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ProcessEntry {
  readonly pid: number;
  readonly ppid: number;
  readonly command: string;
}

const PS_LINE_PATTERN = /^(\d+)\s+(\d+)\s+(.*)$/u;

export function parsePsOutput(stdout: string): readonly ProcessEntry[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .flatMap((line) => {
      const match = PS_LINE_PATTERN.exec(line);
      if (match === null) {
        return [];
      }
      const [, pid, ppid, command] = match;
      return [{ pid: Number(pid), ppid: Number(ppid), command: command ?? '' }];
    });
}

export type ListProcesses = () => Promise<readonly ProcessEntry[]>;

export const listSystemProcesses: ListProcesses = async () => {
  const { stdout } = await execFileAsync('ps', ['-Ao', 'pid=,ppid=,command=']);
  return parsePsOutput(stdout);
};

export function directChildrenByCommand(
  entries: readonly ProcessEntry[],
  parentPid: number,
  commandNeedle: string,
): readonly number[] {
  return entries
    .filter((entry) => entry.ppid === parentPid && entry.command.includes(commandNeedle))
    .map((entry) => entry.pid);
}

export interface KillOrphanableChromeInput {
  readonly parentPid: number;
  readonly browserExecutablePath: string | null;
  readonly killProcessGroup: (pid: number) => void;
  readonly listProcessesFn?: ListProcesses;
}

export async function killOrphanableChromeChildren(input: KillOrphanableChromeInput): Promise<void> {
  if (input.browserExecutablePath === null) {
    return;
  }

  const listProcessesFn = input.listProcessesFn ?? listSystemProcesses;
  let entries: readonly ProcessEntry[];
  try {
    entries = await listProcessesFn();
  } catch (error) {
    void error;
    return;
  }

  const pids = directChildrenByCommand(entries, input.parentPid, input.browserExecutablePath);
  for (const pid of pids) {
    input.killProcessGroup(pid);
  }
}
