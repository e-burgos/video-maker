import { REPO_ISSUES_URL, REPO_LICENSE_URL, REPO_NOTICES_URL, REPO_URL, REMOTION_LICENSE_URL } from './about-content';
import type { AboutContent } from './about-content';

const SETUP_COMMANDS = `git clone ${REPO_URL}.git
cd video-maker
pnpm install
cp .env.example .env
brew install ffmpeg whisper-cpp
pnpm fetch:dev-voices
pnpm studio`;

const QUALITY_COMMANDS = `pnpm exec nx run-many -t lint test build
pnpm sdd:validate`;

export const ABOUT_EN: AboutContent = {
  requirements: {
    title: 'System requirements',
    lede: 'What Video Maker needs on your Mac to render, transcribe, synthesize voice and use the producer. The status comes live from the local service.',
    groups: {
      engine: 'Render engine',
      media: 'Audio and video tools',
      producer: 'Producer engines',
    },
    producerNote: 'The producer needs at least one of the two engines. With neither, you can still render, but you cannot chat with the AI.',
    items: {
      'media-local': {
        label: 'Media engine',
        purpose: 'Cuts, mixes and transcribes your material.',
        fix: 'Restart the app. If it still does not load, reinstall the latest version from the website.',
      },
      'composition-remotion/render': {
        label: 'Composition engine',
        purpose: 'Draws the video frames with Remotion.',
        fix: 'Restart the app. If it still does not load, reinstall the latest version from the website.',
      },
      ffmpeg: {
        label: 'FFmpeg',
        purpose: 'Encodes the MP4 and mixes the audio.',
        fix: 'Bundled with the installed app. In development: brew install ffmpeg and point FFMPEG_PATH to it.',
      },
      ffprobe: {
        label: 'FFprobe',
        purpose: 'Reads duration, resolution and tracks of your files.',
        fix: 'Comes with FFmpeg. In development: point FFPROBE_PATH to the Homebrew ffprobe.',
      },
      whisperCli: {
        label: 'whisper.cpp',
        purpose: 'Transcribes speech word by word.',
        fix: 'Bundled with the installed app. In development: brew install whisper-cpp and point WHISPER_CPP_PATH to whisper-cli.',
      },
      whisperModel: {
        label: 'Whisper model',
        purpose: 'The model whisper.cpp uses to recognize speech.',
        fix: 'The app downloads it on first run; if it is missing, reopen the app with internet. In development: download the model and point WHISPER_MODEL_PATH to it.',
      },
      ttsCli: {
        label: 'Speech synthesis',
        purpose: 'sherpa-onnx generates the narration with Piper voices, with no paid APIs.',
        fix: 'Bundled with the installed app. In development: point TTS_CLI_PATH to the sherpa-onnx-offline-tts executable.',
      },
      ttsVoicesDir: {
        label: 'Piper voices',
        purpose: 'The Spanish voices you can pick for the narration.',
        fix: 'The app downloads them on first run. In development: pnpm fetch:dev-voices and point TTS_VOICES_DIR to that folder.',
      },
      claudeCli: {
        label: 'Claude Code',
        purpose: 'Producer engine using your own Claude subscription.',
        fix: 'Install Claude Code (npm i -g @anthropic-ai/claude-code), sign in with claude and reopen the app.',
      },
      openrouter: {
        label: 'OpenRouter',
        purpose: 'Producer engine using your own key and the model you choose.',
        fix: 'Paste your key in Settings, Producer tab.',
      },
    },
  },
  licenses: {
    title: 'Licenses and technology',
    lede: 'Every piece of software, model and voice Video Maker uses or bundles, what it is for and the license it comes under.',
    ownCodeTitle: 'Our own code',
    ownCode: [
      'The Video Maker code is released under the ',
      { text: 'MIT license', href: REPO_LICENSE_URL },
      ' — © Esteban Burgos. You may use, copy, modify and redistribute it as long as you keep the copyright notice.',
    ],
    remotionTitle: 'About the Remotion license',
    remotion: [
      'Remotion is not open source: it has its ',
      { text: 'own license', href: REMOTION_LICENSE_URL },
      '. It is free for individuals and small companies under its thresholds; a company above those thresholds must buy a Remotion company license, even though the Video Maker code is MIT.',
    ],
    noticesTitle: 'Full notices',
    notices: [
      'The texts and notices for every binary, model, voice, font and music track are in ',
      { text: 'THIRD_PARTY_NOTICES.md', href: REPO_NOTICES_URL },
      '.',
    ],
    inventoryTitle: 'Technology inventory',
    inventoryLede: 'Name, version, license and use of each component.',
  },
  openSource: {
    title: 'Video Maker is open source',
    lede: 'The whole studio — the desktop app, the engine, the producer and the website — lives in a public repository. Read it, run it on your machine and propose improvements.',
    sections: [
      {
        id: 'license',
        title: 'MIT license',
        blocks: [
          {
            kind: 'paragraph',
            parts: [
              'The code is released under the ',
              { text: 'MIT license', href: REPO_LICENSE_URL },
              '. Third-party binaries, models, voices, fonts and music keep their own licenses; they are on the Licenses tab.',
            ],
          },
          { kind: 'paragraph', parts: ['Repository: ', { text: 'github.com/e-burgos/video-maker', href: REPO_URL }] },
        ],
      },
      {
        id: 'run',
        title: 'Run it on your machine',
        blocks: [
          {
            kind: 'paragraph',
            parts: [
              'You need Node 22 or later and pnpm 10. ',
              { code: '.env' },
              ' holds the absolute paths to ffmpeg, ffprobe, whisper-cli and the whisper model; ',
              { code: '.env.example' },
              ' explains each one.',
            ],
          },
          { kind: 'code', text: SETUP_COMMANDS },
          {
            kind: 'paragraph',
            parts: [
              { code: 'pnpm studio' },
              ' starts the local service and the Web Studio together; the desktop app is built with ',
              { code: 'pnpm desktop:dist' },
              ' (macOS Apple Silicon).',
            ],
          },
        ],
      },
      {
        id: 'contribute',
        title: 'How to contribute',
        blocks: [
          {
            kind: 'list',
            items: [
              ['Open an issue in ', { text: 'Issues', href: REPO_ISSUES_URL }, ' before writing code, so we can agree on the scope.'],
              ['Follow the SDD flow: every feature starts from a spec in ', { code: 'sdd/specs/' }, ' and every fix is recorded in ', { code: 'sdd/fixes.json' }, '.'],
              ['Self-explanatory code: no narrative comments, declarative names and short functions.'],
            ],
          },
          { kind: 'paragraph', parts: ['Everything green before the pull request:'] },
          { kind: 'code', text: QUALITY_COMMANDS },
          { kind: 'paragraph', parts: ['Open the pull request from your own branch, explaining what changes and how you tested it.'] },
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    lede: 'Video Maker is a video studio that runs on your computer. This explains what data it uses, what for and how to control it. Last updated: October 8, 2026. The Spanish version prevails if they differ.',
    sections: [
      {
        id: 'local',
        title: 'What stays on your computer',
        blocks: [
          {
            kind: 'paragraph',
            parts: [
              'Your material (videos, photos, audio), projects, brands and finished videos are stored in the folders you choose on your machine. Transcription, voice and rendering run locally. Video Maker has no servers of its own: we do not receive, store or see your material.',
            ],
          },
        ],
      },
      {
        id: 'youtube',
        title: 'YouTube connection',
        blocks: [
          {
            kind: 'paragraph',
            parts: ['If you connect your channel from Settings, Video Maker asks you, through Google sign-in, for two YouTube Data API permissions:'],
          },
          {
            kind: 'list',
            items: [
              ['Upload videos (', { code: 'youtube.upload' }, '): to publish to your channel only the videos you choose to publish, with the title, description, tags, visibility and date you confirm.'],
              ['View your YouTube account (', { code: 'youtube.readonly' }, '): to show your channel’s name and picture and your playlists when publishing.'],
            ],
          },
          {
            kind: 'paragraph',
            parts: [
              'The authorization Google grants is stored only on your computer (in the desktop app, in the system keychain) and is used only for those actions. We do not share it with anyone, we do not use it for advertising or to train models, and we do not read or modify other videos, comments or data in your account.',
            ],
          },
          {
            kind: 'paragraph',
            parts: [
              'The use of information received from Google APIs adheres to the ',
              { text: 'Google API Services User Data Policy', href: 'https://developers.google.com/terms/api-services-user-data-policy' },
              ', including the Limited Use requirements. When publishing to YouTube, the ',
              { text: 'YouTube Terms of Service', href: 'https://www.youtube.com/t/terms' },
              ' and the ',
              { text: 'Google Privacy Policy', href: 'https://policies.google.com/privacy' },
              ' also apply.',
            ],
          },
        ],
      },
      {
        id: 'disconnect',
        title: 'How to disconnect your channel',
        blocks: [
          {
            kind: 'paragraph',
            parts: [
              'In Settings → YouTube → "Disconnect" the authorization is revoked and deleted from your computer. You can also remove access at any time from ',
              { text: 'your Google account permissions page', href: 'https://myaccount.google.com/permissions' },
              '.',
            ],
          },
        ],
      },
      {
        id: 'ai',
        title: 'Artificial intelligence',
        blocks: [
          {
            kind: 'paragraph',
            parts: [
              'When you use the producer or ask it to write a video’s title and description, the necessary text (your conversation, the video script and your brand details) is sent to the AI service you connected: Claude, with your own subscription, or OpenRouter, with your own key. Those services process it under their own policies.',
            ],
          },
        ],
      },
      {
        id: 'contact',
        title: 'Contact',
        blocks: [
          {
            kind: 'paragraph',
            parts: ['Questions about this policy: ', { text: 'displayadsdigital@gmail.com', href: 'mailto:displayadsdigital@gmail.com' }, '.'],
          },
        ],
      },
    ],
  },
};
