import {
  LOCALE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  formatStepStatus,
  oppositeTheme,
  stepIndexAfterMove,
  tabIndexForKey,
  writeStorage,
} from './site-logic.mjs';

function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function prefersReducedMotion() {
  return window.matchMedia !== undefined && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function syncThemeToggle(button, theme) {
  button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
}

function enableThemeToggle(storage) {
  const root = document.documentElement;
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    button.hidden = false;
    syncThemeToggle(button, root.getAttribute('data-theme'));
    button.addEventListener('click', () => {
      const nextTheme = oppositeTheme(root.getAttribute('data-theme'));
      root.setAttribute('data-theme', nextTheme);
      writeStorage(storage, THEME_STORAGE_KEY, nextTheme);
      for (const toggle of document.querySelectorAll('[data-theme-toggle]')) {
        syncThemeToggle(toggle, nextTheme);
      }
    });
  }
}

function rememberLocaleOnSwitch(storage) {
  for (const link of document.querySelectorAll('[data-locale-switch]')) {
    link.addEventListener('click', () => {
      writeStorage(storage, LOCALE_STORAGE_KEY, link.getAttribute('data-locale-switch'));
    });
  }
}

function enableMobileMenu() {
  const header = document.querySelector('[data-site-header]');
  const toggle = document.querySelector('[data-menu-toggle]');
  if (header === null || toggle === null) {
    return;
  }
  toggle.hidden = false;
  header.classList.add('site-header--collapsible');
  const setOpen = (isOpen) => {
    header.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
}

function revealOnScroll() {
  const targets = document.querySelectorAll('.reveal');
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    return;
  }
  document.documentElement.classList.add('reveal-ready');
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  for (const target of targets) {
    observer.observe(target);
  }
}

function enableTabs(container) {
  const tablist = container.querySelector('[role="tablist"]');
  const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')));
  if (tablist === null || tabs.length === 0 || panels.includes(null)) {
    return;
  }
  const select = (index, moveFocus) => {
    tabs.forEach((tab, tabIndex) => {
      const isSelected = tabIndex === index;
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      tab.tabIndex = isSelected ? 0 : -1;
      panels[tabIndex].hidden = !isSelected;
    });
    if (moveFocus) {
      tabs[index].focus();
    }
  };
  tablist.hidden = false;
  container.classList.add('is-enhanced');
  for (const panel of panels) {
    panel.setAttribute('role', 'tabpanel');
    panel.tabIndex = 0;
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index, false));
    tab.addEventListener('keydown', (event) => {
      const nextIndex = tabIndexForKey(event.key, index, tabs.length);
      if (nextIndex !== null) {
        event.preventDefault();
        select(nextIndex, true);
      }
    });
  });
  select(0, false);
}

function enableStepper(stepper) {
  const steps = Array.from(stepper.querySelectorAll('[data-step]'));
  const controls = stepper.querySelector('[data-stepper-controls]');
  if (steps.length === 0 || controls === null) {
    return;
  }
  const previousButton = controls.querySelector('[data-stepper-previous]');
  const nextButton = controls.querySelector('[data-stepper-next]');
  const status = controls.querySelector('[data-stepper-status]');
  const dots = Array.from(controls.querySelectorAll('[data-stepper-dot]'));
  const statusTemplate = status.getAttribute('data-template');
  let currentIndex = 0;

  const show = (index) => {
    currentIndex = index;
    steps.forEach((step, stepIndex) => {
      step.hidden = stepIndex !== index;
    });
    dots.forEach((dot, dotIndex) => {
      dot.setAttribute('aria-current', dotIndex === index ? 'step' : 'false');
    });
    previousButton.disabled = index === 0;
    nextButton.disabled = index === steps.length - 1;
    status.textContent = formatStepStatus(statusTemplate, index, steps.length);
  };

  controls.hidden = false;
  stepper.classList.add('is-enhanced');
  previousButton.addEventListener('click', () => show(stepIndexAfterMove(currentIndex, -1, steps.length)));
  nextButton.addEventListener('click', () => show(stepIndexAfterMove(currentIndex, 1, steps.length)));
  dots.forEach((dot, dotIndex) => dot.addEventListener('click', () => show(dotIndex)));
  stepper.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLElement && event.target.closest('[role="tab"]') !== null) {
      return;
    }
    if (event.key === 'ArrowRight') {
      show(stepIndexAfterMove(currentIndex, 1, steps.length));
    } else if (event.key === 'ArrowLeft') {
      show(stepIndexAfterMove(currentIndex, -1, steps.length));
    }
  });
  show(0);
}

function boot() {
  const storage = safeLocalStorage();
  enableThemeToggle(storage);
  rememberLocaleOnSwitch(storage);
  enableMobileMenu();
  document.querySelectorAll('[data-tabs]').forEach(enableTabs);
  document.querySelectorAll('[data-stepper]').forEach(enableStepper);
  revealOnScroll();
}

boot();
