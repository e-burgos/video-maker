import type { LearnContent } from './learn-content';

export const LEARN_EN: LearnContent = {
  howItWorks: {
    title: 'How Video Maker works',
    lede: 'From idea to MP4 in five stages. Below, a tour of each path with real screenshots of the studio (shown with its Spanish interface).',
    pipelineTitle: 'The pipeline',
    stages: [
      {
        id: 'script',
        title: 'Idea & script',
        text: 'Tell the producer what video you want. With Claude Code or OpenRouter it drafts or polishes the script, and you approve it before a single minute of rendering.',
      },
      {
        id: 'voice',
        title: 'Voice',
        text: 'The voice-over is synthesized on your Mac with Spanish Piper voices (es_AR, es_ES, es_MX), or you use your own recording. whisper.cpp transcribes it word by word.',
      },
      {
        id: 'scenes',
        title: 'Scenes',
        text: 'For motion graphics the AI proposes the storyboard and the studio animates every scene with your brand. With raw footage it trims silences, picks B-roll by what is being said and adds kinetic captions.',
      },
      {
        id: 'music',
        title: 'Music',
        text: 'A brand track, cuts on the beat and automatic ducking: the music dips by itself whenever the voice speaks, with at least 15 dB of headroom.',
      },
      {
        id: 'render',
        title: 'Render',
        text: 'Remotion or HyperFrames draw the frames, FFmpeg mixes and masters to −14 LUFS, and an automatic review checks levels, black frames and captions before handing you the MP4.',
      },
    ],
    pathsTitle: 'Both paths, step by step',
    pathsLede: 'Pick a path and go through its steps. Tap a screenshot to enlarge it.',
    paths: [
      {
        id: 'motion',
        tabLabel: 'Motion graphics',
        title: 'Motion graphics: from script to animated video',
        intro:
          'Nothing to record. You write the script, add a few photos if you like, and the studio designs animated scenes with your brand, adds the voice and the music and cuts to the beat.',
        steps: [
          {
            title: 'New video → Motion graphics',
            text: 'From "My videos" you tap "New video" and pick the motion graphics path.',
            screenshot: { file: 'create-mode.png', alt: 'New video dialog with the Motion graphics and Raw footage options' },
          },
          {
            title: 'Fill in the brief',
            text: 'Brand, format (16:9 for YouTube or 9:16 for reels), music, goal, audience and script. If you add photos, write one line about what each one shows: the AI picks them by that description.',
            screenshot: { file: 'motion-brief.png', alt: 'Motion graphics brief with brand, format, music, title, goal, audience and script' },
          },
          {
            title: 'Storyboard and video',
            text: '"Build storyboard" asks the AI for the scenes; you review them. "Make video" synthesizes the voice, prepares the music and renders while showing progress. The music credit is ready for your description.',
            screenshot: { file: 'motion-video.png', alt: 'Finished motion graphics video on the Motion page, with the music credit' },
          },
          {
            title: 'Adjust it by chatting',
            text: '"Adjust with the producer": ask "lower the music" or "change the title of scene 3" and it redoes only what changed. Then publish it to YouTube from the app.',
            screenshot: { file: 'motion-adjust-chat.png', alt: 'Producer chat on a motion graphics video, with sample adjustment requests' },
          },
        ],
      },
      {
        id: 'footage',
        tabLabel: 'Raw footage',
        title: 'Raw footage: your recordings, edited',
        intro:
          'Bring screen recordings, camera clips, photos or music, and the producer builds the edit: it trims silences, places B-roll, adds captions and the voice-over.',
        steps: [
          {
            title: 'New video → Raw footage',
            text: 'The same "New video", choosing the recordings edit.',
            screenshot: { file: 'create-mode.png', alt: 'New video dialog with the Motion graphics and Raw footage options' },
          },
          {
            title: 'Drop your files',
            text: 'Drag your material onto the conversation. For each file the producer suggests a role (A-roll, B-roll, image, music, logo) and you confirm it.',
            screenshot: { file: 'proposal-card.png', alt: 'Card for a freshly uploaded file with the suggested B-roll role and Confirm and Discard buttons' },
          },
          {
            title: 'Review your material',
            text: 'The "Material" tab groups everything confirmed by category, with thumbnail and duration. Missing footage? The producer finds freely licensed media on Wikimedia Commons and NASA.',
            screenshot: { file: 'material-tab.png', alt: 'Material tab with thumbnails grouped by A-roll, B-roll, images, music and logo' },
          },
          {
            title: 'Chat and watch the preview',
            text: 'Pick a recipe (Tutorial, Vertical tutorial or Product ad) or just describe the video. The producer writes the script, the cuts and the voice, and the preview shows the render as soon as it finishes.',
            screenshot: { file: 'workspace-preview.png', alt: 'Conversation with the producer and the preview of a finished render' },
          },
          {
            title: 'Deliveries and publishing',
            text: 'Every confirmed render lands in "Deliveries" without overwriting the previous ones, ready to open in Finder or publish to YouTube. Your projects show up with their real thumbnails.',
            screenshot: { file: 'home-projects.png', alt: 'My videos: project list grouped by folder, with real thumbnails and their status' },
          },
        ],
      },
    ],
    whereTitle: 'What runs where',
    whereHeaders: ['Stage', 'Where it runs', 'With what'],
    whereRows: [
      { stage: 'Conversation, script and storyboard', where: 'On the AI you connected', with: 'Claude Code (your subscription) or OpenRouter (your key)' },
      { stage: 'Transcription', where: 'On your Mac', with: 'whisper.cpp with the large-v3-turbo model' },
      { stage: 'Voice', where: 'On your Mac', with: 'Piper voices on sherpa-onnx (optional: ElevenLabs with your key)' },
      { stage: 'Scenes and rendering', where: 'On your Mac', with: 'Remotion + headless Chrome (raw footage) · HyperFrames + GSAP (motion graphics)' },
      { stage: 'Mixing, mastering and review', where: 'On your Mac', with: 'FFmpeg / ffprobe' },
      { stage: 'Publishing', where: 'On your channel', with: 'YouTube Data API v3, only if you connect your account' },
    ],
  },
  tutorial: {
    title: 'From brand to finished video, in a little over two minutes',
    lede: 'A real walkthrough of the studio: create a brand, attach the photos, let the producer build the video and publish it. The long waits for the producer are sped up; narrated and captioned in Spanish.',
    credit: 'Voice: Malena · Music: Inspiring Advertising - Upbeat Summer Corporate, Rafael Krux, CC BY 4.0',
  },
  faq: {
    title: 'Frequently asked questions',
    entries: [
      {
        id: 'where-material',
        question: 'Where do my material and my videos live?',
        answer:
          'By default, in a folder inside `~/Library/Application Support/Video Maker`: you choose (or confirm) it on the first run and can change it later from the app menu ("Preferencias" → "Carpeta de proyectos…", the desktop menus are in Spanish). Every project is a folder with your raw material, what the producer makes and the final renders.',
      },
      {
        id: 'logs',
        question: 'Where are the logs if something fails?',
        answer:
          'From the app menu: "Ayuda" (Help) → "Abrir carpeta de logs" (Open logs folder). That is where the log of the local service doing the heavy lifting (transcription, rendering, etc.) lives, useful when reporting a problem.',
      },
      {
        id: 'uninstall',
        question: 'How do I uninstall it completely?',
        answer:
          'Three steps: (1) drag "Video Maker" from Applications to the Trash; (2) if you entered an OpenRouter key, open "Keychain Access", find the **Video Maker** item and delete it; (3) if you also want to delete your projects and the downloaded models, delete the whole `~/Library/Application Support/Video Maker` folder. Only do it if you do not mind losing your videos and their material.',
      },
      {
        id: 'update',
        question: 'How do I update to a new version?',
        answer:
          'Download the newest .dmg from the download page and drag it to Applications again, replacing the previous one. There is no auto-update (the ad hoc signature of Electron does not allow it on macOS). Your projects and settings are not touched, they live apart from the app.',
      },
      {
        id: 'privacy',
        question: 'Does any of my material go to the internet?',
        answer:
          'No. Transcription, voice generation and the final render run with binaries installed locally (ffmpeg, whisper.cpp, sherpa-onnx, Remotion, HyperFrames). What leaves your machine is the text of your conversation with the producer, to Claude or to OpenRouter depending on which one you connected and, only if you use them, the voice-over text to ElevenLabs and the video you choose to publish to YouTube.',
      },
      {
        id: 'open-source',
        question: 'Is the code open source?',
        answer:
          'Yes, under the MIT license. The repository is at https://github.com/e-burgos/video-maker, with how to run it and how to contribute.',
      },
      {
        id: 'music-credit',
        question: 'Why does the video not show the music credit?',
        answer:
          'Because it fits better in the description. The brand tracks are by Kevin MacLeod under CC BY 4.0, which requires naming the author: the exact text appears below the player on the Motion page and in `out/video.credits.txt` in every project. Paste it into the description every time you publish the video.',
      },
      {
        id: 'motion-needs',
        question: 'What do I need for a motion graphics video?',
        answer:
          'A script and, if you like, a few photos with one line saying what they show. The AI builds the storyboard with the engine you connected (Claude with your subscription or OpenRouter); the voice, the music and the render run on your Mac. A one-minute video takes a few minutes for the storyboard and another five to ten for voice and rendering.',
      },
      {
        id: 'motion-change',
        question: 'How do I change something in a motion graphics video I already made?',
        answer:
          'Open the video, tap "Adjust with the producer" and ask for the change in your own words (the music, a text, a line of the voice, the order of the scenes). The producer edits only those scenes and remakes the video; the voice is recorded again only where the text changed, so a small adjustment takes one or two minutes.',
      },
      {
        id: 'storyboard-engine',
        question: 'Does the storyboard work without Claude?',
        answer:
          'Yes. The storyboard (the proposed scenes of the video: what is said and what is shown in each one) is generated with the AI engine you connected in Settings, Claude Code or OpenRouter. You do not need Claude to use it: either one is enough.',
      },
    ],
  },
  gallery: {
    title: 'Real screenshots of the studio',
    lede: 'Tap a screenshot to enlarge it and move through the rest with the arrows.',
    shots: [
      { file: 'home-projects.png', caption: 'My videos: project list grouped by folder, with real thumbnails and their status' },
      { file: 'motion-video.png', caption: 'A finished motion graphics video, with the music credit for the description' },
      { file: 'workspace-preview.png', caption: 'Conversation with the producer and the preview of a finished render' },
      { file: 'proposal-card.png', caption: 'When you drop a file, the producer suggests a role to confirm or discard' },
      { file: 'create-mode.png', caption: 'New video dialog with the Motion graphics and Raw footage options' },
      { file: 'motion-brief.png', caption: 'Motion graphics brief with brand, format, music, title, goal, audience and script' },
      { file: 'material-tab.png', caption: 'Material tab with thumbnails grouped by A-roll, B-roll, images, music and logo' },
      { file: 'motion-adjust-chat.png', caption: 'Producer chat on a motion graphics video, with sample adjustment requests' },
      { file: 'settings-openrouter.png', caption: 'Settings: connecting the producer to OpenRouter' },
    ],
  },
};
