import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { GuideRouteRedirect } from '../components/learn/guide-route-redirect';
import { LEARN_TABS } from '../components/learn/learn-tabs';
import { TUTORIAL_VIDEO_URL } from '../content/learn/learn-content';
import { LEARN_EN } from '../content/learn/learn-content-en';
import { LEARN_ES } from '../content/learn/learn-content-es';
import { LANGUAGE_STORAGE_KEY } from '../i18n/language';
import { LanguageProvider } from '../i18n/language-context';
import { LearnPage } from './learn-page';

function LocationProbe() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="location">{`${pathname}${search}${hash}`}</p>;
}

function renderLearn(entry: string) {
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/guide" element={<GuideRouteRedirect />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe('LearnPage', () => {
  it('offers the five tabs and opens on the guide', async () => {
    renderLearn('/learn');

    for (const tab of LEARN_TABS) {
      expect(screen.getByTestId(`learn-tab-${tab}`)).toBeTruthy();
    }
    await waitFor(() => expect(screen.getAllByTestId('guide-section').length).toBeGreaterThan(0));
    expect(screen.getByTestId('learn-panel-guide')).toBeTruthy();
  });

  it('sends the old guide route to the guide tab and keeps the section hash', async () => {
    renderLearn('/guide#youtube');

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/learn?tab=guide#youtube'));
    await waitFor(() => expect(screen.getAllByTestId('guide-section').length).toBeGreaterThan(0));
  });

  it('keeps the chosen tab in the url', async () => {
    renderLearn('/learn');

    fireEvent.click(screen.getByTestId('learn-tab-faq'));

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/learn?tab=faq'));
    expect(screen.getByTestId('learn-panel-faq')).toBeTruthy();
  });

  it('explains the pipeline, both paths and what runs where in spanish', async () => {
    renderLearn('/learn?tab=how-it-works');

    await waitFor(() => expect(screen.getByTestId('learn-pipeline')).toBeTruthy());
    expect(
      Array.from(screen.getByTestId('learn-pipeline').querySelectorAll('[data-pipeline-stage]')).map(
        (node) => (node as HTMLElement).dataset['pipelineStage'],
      ),
    ).toEqual(LEARN_ES.howItWorks.stages.map((stage) => stage.id));
    expect(screen.getByTestId('learn-path').dataset['learnPath']).toBe(LEARN_ES.howItWorks.paths[0]?.id);
    expect(screen.getAllByTestId('learn-path-step')).toHaveLength(LEARN_ES.howItWorks.paths[0]?.steps.length ?? -1);
    expect(screen.getByTestId('learn-where-table').querySelectorAll('tbody tr')).toHaveLength(
      LEARN_ES.howItWorks.whereRows.length,
    );
  });

  it('switches between the two creation paths', async () => {
    renderLearn('/learn?tab=how-it-works');

    await waitFor(() => expect(screen.getByTestId('learn-path')).toBeTruthy());
    fireEvent.click(screen.getByTestId('learn-path-footage'));

    expect(screen.getByTestId('learn-path').dataset['learnPath']).toBe('footage');
    expect(screen.getAllByTestId('learn-path-step')).toHaveLength(LEARN_ES.howItWorks.paths[1]?.steps.length ?? -1);
  });

  it('lists every frequently asked question in english when that is the language', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    renderLearn('/learn?tab=faq');

    await waitFor(() => expect(screen.getByTestId('learn-faq')).toBeTruthy());
    expect(screen.getAllByTestId('learn-faq-item').map((node) => node.dataset['faqId'])).toEqual(
      LEARN_EN.faq.entries.map((entry) => entry.id),
    );
    expect(screen.getByTestId('learn-faq').textContent).toContain(LEARN_EN.faq.entries[0]?.question);
  });

  it('points the tutorial video at the public url and shows no warning while it loads', async () => {
    renderLearn('/learn?tab=tutorial');

    await waitFor(() => expect(screen.getByTestId('learn-tutorial-video')).toBeTruthy());
    const video = screen.getByTestId('learn-tutorial-video') as HTMLVideoElement;

    expect(video.getAttribute('src')).toBe(TUTORIAL_VIDEO_URL);
    expect(video.hasAttribute('controls')).toBe(true);
    expect(screen.queryByTestId('learn-tutorial-offline')).toBeNull();
  });

  it('warns and links to the video when it cannot be loaded', async () => {
    renderLearn('/learn?tab=tutorial');

    await waitFor(() => expect(screen.getByTestId('learn-tutorial-video')).toBeTruthy());
    fireEvent.error(screen.getByTestId('learn-tutorial-video'));

    const warning = screen.getByTestId('learn-tutorial-offline');
    const link = within(warning).getByTestId('learn-tutorial-open');
    expect(link.getAttribute('href')).toBe(TUTORIAL_VIDEO_URL);
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('shows every screenshot with its caption and enlarges it on click', async () => {
    renderLearn('/learn?tab=gallery');

    await waitFor(() => expect(screen.getByTestId('learn-gallery')).toBeTruthy());
    const items = screen.getAllByTestId('learn-gallery-item');
    expect(items).toHaveLength(LEARN_ES.gallery.shots.length);
    expect(items[0]?.textContent).toContain(LEARN_ES.gallery.shots[0]?.caption);

    fireEvent.click(items[1]?.querySelector('button') as HTMLElement);

    await waitFor(() => expect(screen.getByTestId('learn-lightbox-image')).toBeTruthy());
    expect(screen.getByTestId('learn-lightbox-image').getAttribute('src')).toContain(
      LEARN_ES.gallery.shots[1]?.file ?? '',
    );
    fireEvent.click(screen.getByTestId('learn-lightbox-next'));
    expect(screen.getByTestId('learn-lightbox-image').getAttribute('src')).toContain(
      LEARN_ES.gallery.shots[2]?.file ?? '',
    );
  });

  it('only ships gallery files that exist in the content of both languages', () => {
    expect(LEARN_EN.gallery.shots.map((shot) => shot.file)).toEqual(LEARN_ES.gallery.shots.map((shot) => shot.file));
    expect(LEARN_EN.faq.entries.map((entry) => entry.id)).toEqual(LEARN_ES.faq.entries.map((entry) => entry.id));
  });
});
