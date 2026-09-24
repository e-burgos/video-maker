interface DownloadPlanEntry {
  readonly id: string;
  readonly sizeBytes: number;
}

interface DownloadProgressEvent {
  readonly id: string;
  readonly bytesDownloaded: number;
  readonly totalBytes: number;
  readonly overallBytesDownloaded: number;
  readonly overallTotalBytes: number;
}

interface DownloadOutcome {
  readonly id: string;
  readonly ok: boolean;
  readonly error?: string;
}

interface ClaudeStatusPayload {
  readonly found: boolean;
  readonly path: string | null;
  readonly version: string | null;
  readonly loggedIn: 'yes' | 'no' | 'unknown';
}

interface SetupInitialData {
  readonly locale: 'es' | 'en';
  readonly defaultProjectsFolder: string;
  readonly downloadPlan: readonly DownloadPlanEntry[];
  readonly alreadyInstalledIds: readonly string[];
}

interface SetupApi {
  getInitialData(): Promise<SetupInitialData>;
  startDownloads(): Promise<readonly DownloadOutcome[]>;
  onDownloadProgress(
    listener: (event: DownloadProgressEvent) => void,
  ): () => void;
  chooseProjectsFolder(): Promise<string | null>;
  setProjectsFolder(path: string): Promise<void>;
  checkClaude(): Promise<ClaudeStatusPayload>;
  openClaudeInstallDocs(): Promise<void>;
  finishSetup(): Promise<void>;
  continueWithoutClaude(): Promise<void>;
}

type Locale = 'es' | 'en';

(function main(): void {
  const setupApi = (window as unknown as { setupApi: SetupApi }).setupApi;

  const STRINGS: Record<Locale, Record<string, string>> = {
    es: {
      title: 'Preparando Video Maker',
      subtitle:
        'Esto solo pasa una vez. Podés cerrar la app y retomar donde quedaste.',
      downloadsTitle: 'Descargando lo necesario',
      totalLabel: 'Total',
      continueButton: 'Continuar',
      folderTitle: 'Carpeta de proyectos',
      folderHint:
        'Tus videos y proyectos se guardan acá. Si ya tenías una carpeta, la app la usa e importa lo que encuentre.',
      chooseFolderButton: 'Usar una carpeta existente…',
      backButton: 'Atrás',
      claudeTitle: 'Claude Code',
      claudeStatusLabel: 'Estado',
      claudeInstallDocsButton: 'Ver instrucciones de instalación',
      claudeRecheckButton: 'Volver a comprobar',
      claudeSkipButton: 'Continuar sin Claude',
      finishButton: 'Finalizar',
      claudeFound: 'Encontrado',
      claudeNotFound: 'No encontrado',
      claudeLoggedInYes: 'sesión iniciada',
      claudeLoggedInNo: 'sin sesión iniciada',
      claudeLoggedInUnknown: 'sesión sin confirmar',
    },
    en: {
      title: 'Setting up Video Maker',
      subtitle:
        'This only happens once. You can close the app and pick up where you left off.',
      downloadsTitle: 'Downloading what you need',
      totalLabel: 'Total',
      continueButton: 'Continue',
      folderTitle: 'Projects folder',
      folderHint:
        'Your videos and projects live here. If you already had a folder, the app will use it and import what it finds.',
      chooseFolderButton: 'Use an existing folder…',
      backButton: 'Back',
      claudeTitle: 'Claude Code',
      claudeStatusLabel: 'Status',
      claudeInstallDocsButton: 'See install instructions',
      claudeRecheckButton: 'Check again',
      claudeSkipButton: 'Continue without Claude',
      finishButton: 'Finish',
      claudeFound: 'Found',
      claudeNotFound: 'Not found',
      claudeLoggedInYes: 'signed in',
      claudeLoggedInNo: 'not signed in',
      claudeLoggedInUnknown: 'sign-in unconfirmed',
    },
  };

  const CLAUDE_INSTALL_DOCS_LABEL_ID = 'claude-install-docs';

  function byId<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (element === null) {
      throw new Error(`missing element #${id}`);
    }
    return element as T;
  }

  function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }

  function applyStrings(locale: Locale): void {
    const strings = STRINGS[locale];
    document.documentElement.lang = locale;
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
      const key = element.dataset.i18n;
      const value = key === undefined ? undefined : strings[key];
      if (value !== undefined) {
        element.textContent = value;
      }
    });
  }

  function setStep(step: 1 | 2 | 3): void {
    byId('step-downloads').classList.toggle('visible', step === 1);
    byId('step-folder').classList.toggle('visible', step === 2);
    byId('step-claude').classList.toggle('visible', step === 3);
    byId('step-dot-1').classList.toggle('active', step >= 1);
    byId('step-dot-2').classList.toggle('active', step >= 2);
    byId('step-dot-3').classList.toggle('active', step >= 3);
  }

  function renderDownloadRows(
    items: readonly { id: string; sizeBytes: number }[],
    alreadyInstalledIds: readonly string[],
  ): void {
    const container = byId('download-items');
    container.innerHTML = '';
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.id = `row-${item.id}`;
      const alreadyOk = alreadyInstalledIds.includes(item.id);
      row.innerHTML = `
      <div class="label"><span>${item.id}</span><span class="size">${alreadyOk ? formatBytes(item.sizeBytes) : `0 / ${formatBytes(item.sizeBytes)}`}</span></div>
      <div class="bar${alreadyOk ? ' ok' : ''}"><i style="width:${alreadyOk ? 100 : 0}%"></i></div>
    `;
      container.append(row);
    }
  }

  function updateRowProgress(event: DownloadProgressEvent): void {
    const row = document.getElementById(`row-${event.id}`);
    if (row === null) return;
    const percent =
      event.totalBytes === 0
        ? 100
        : Math.min(
            100,
            Math.round((event.bytesDownloaded / event.totalBytes) * 100),
          );
    const bar = row.querySelector<HTMLElement>('.bar > i');
    const size = row.querySelector<HTMLElement>('.size');
    if (bar !== null) bar.style.width = `${percent}%`;
    if (size !== null)
      size.textContent = `${formatBytes(event.bytesDownloaded)} / ${formatBytes(event.totalBytes)}`;
  }

  function updateTotalProgress(event: DownloadProgressEvent): void {
    const percent =
      event.overallTotalBytes === 0
        ? 100
        : Math.min(
            100,
            Math.round(
              (event.overallBytesDownloaded / event.overallTotalBytes) * 100,
            ),
          );
    const bar = document.querySelector<HTMLElement>('#total-bar > i');
    const label = byId('total-size-label');
    if (bar !== null) bar.style.width = `${percent}%`;
    label.textContent = `${formatBytes(event.overallBytesDownloaded)} / ${formatBytes(event.overallTotalBytes)}`;
  }

  function markRowResult(outcome: DownloadOutcome): void {
    const row = document.getElementById(`row-${outcome.id}`);
    if (row === null) return;
    const bar = row.querySelector<HTMLElement>('.bar');
    if (bar === null) return;
    bar.classList.toggle('ok', outcome.ok);
    if (!outcome.ok) {
      const size = row.querySelector<HTMLElement>('.size');
      if (size !== null) size.textContent = outcome.error ?? 'error';
    }
  }

  async function runDownloadsStep(): Promise<void> {
    const initial = await setupApi.getInitialData();
    applyStrings(initial.locale);
    renderDownloadRows(initial.downloadPlan, initial.alreadyInstalledIds);

    const continueButton = byId<HTMLButtonElement>('downloads-continue');
    const unsubscribe = setupApi.onDownloadProgress((event) => {
      updateRowProgress(event);
      updateTotalProgress(event);
    });

    const allAlreadyInstalled = initial.downloadPlan.every((item) =>
      initial.alreadyInstalledIds.includes(item.id),
    );
    if (allAlreadyInstalled) {
      continueButton.disabled = false;
    }

    const outcomes = await setupApi.startDownloads();
    unsubscribe();
    for (const outcome of outcomes) {
      markRowResult(outcome);
    }
    continueButton.disabled = !outcomes.every((outcome) => outcome.ok);

    continueButton.addEventListener('click', () => {
      setStep(2);
      void runFolderStep(initial.defaultProjectsFolder);
    });
  }

  async function runFolderStep(defaultFolder: string): Promise<void> {
    let chosenFolder = defaultFolder;
    byId('folder-path').textContent = chosenFolder;

    byId('choose-folder').addEventListener('click', () => {
      void (async () => {
        const picked = await setupApi.chooseProjectsFolder();
        if (picked !== null) {
          chosenFolder = picked;
          byId('folder-path').textContent = chosenFolder;
        }
      })();
    });

    byId('folder-back').addEventListener('click', () => setStep(1));
    byId('folder-continue').addEventListener('click', () => {
      void (async () => {
        await setupApi.setProjectsFolder(chosenFolder);
        setStep(3);
        void runClaudeStep();
      })();
    });
  }

  function renderClaudeStatus(
    status: ClaudeStatusPayload,
    locale: Locale,
  ): void {
    const strings = STRINGS[locale];
    const badge = byId('claude-status-badge');
    const detail = byId('claude-detail');
    const missingHelp = byId('claude-missing-help');
    const finishButton = byId<HTMLButtonElement>('claude-finish');

    badge.textContent =
      (status.found ? strings.claudeFound : strings.claudeNotFound) ?? '';
    badge.className = `status-badge ${status.found ? 'ok' : 'error'}`;
    missingHelp.style.display = status.found ? 'none' : 'flex';
    finishButton.style.display = status.found ? 'inline-block' : 'none';

    const loggedInText =
      status.loggedIn === 'yes'
        ? strings.claudeLoggedInYes
        : status.loggedIn === 'no'
          ? strings.claudeLoggedInNo
          : strings.claudeLoggedInUnknown;
    detail.textContent = status.found
      ? `${status.path ?? ''} · ${status.version ?? ''} · ${loggedInText}`
      : '';
  }

  async function runClaudeStep(): Promise<void> {
    const initial = await setupApi.getInitialData();
    const check = async () => {
      const status = await setupApi.checkClaude();
      renderClaudeStatus(status, initial.locale);
    };

    await check();

    byId(CLAUDE_INSTALL_DOCS_LABEL_ID).addEventListener('click', () => {
      void setupApi.openClaudeInstallDocs();
    });
    byId('claude-recheck').addEventListener('click', () => {
      void check();
    });
    byId('claude-back').addEventListener('click', () => setStep(2));
    byId('claude-skip').addEventListener('click', () => {
      void setupApi.continueWithoutClaude();
    });
    byId('claude-finish').addEventListener('click', () => {
      void setupApi.finishSetup();
    });
  }

  void runDownloadsStep();
})();
