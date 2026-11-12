# Capabilities reference

Generated from libs/studio-capabilities/src/describe-video-maker-capabilities.ts with the repo SFX bank — do not edit by hand; run `pnpm nx run plugin-references:plugin-references`.

Voices depend on each machine: call the `list_voices` tool (or `get_capabilities`) to get the live list.

```json
{
  "projectModes": [
    "footage",
    "motion"
  ],
  "assetRoles": [
    "aroll",
    "broll",
    "image",
    "audio",
    "voice",
    "logo",
    "reference"
  ],
  "brandFileKinds": [
    "logo",
    "image",
    "font",
    "music",
    "device"
  ],
  "formats": [
    "reels-9x16",
    "tiktok-9x16",
    "shorts-9x16",
    "youtube-16x9"
  ],
  "jobKinds": [
    "render",
    "montage",
    "storyboard",
    "voice",
    "photo-aroll",
    "motion",
    "reference"
  ],
  "montage": {
    "presets": [
      "software-demo",
      "hardware",
      "recipe",
      "educational"
    ],
    "transitions": {
      "kinds": [
        "fade",
        "slide",
        "whip-pan",
        "light-leak",
        "wipe",
        "flip",
        "clock-wipe",
        "iris"
      ],
      "directions": [
        "from-left",
        "from-right",
        "from-top",
        "from-bottom"
      ]
    },
    "captionStyles": [
      "bold-impact",
      "clean-sans",
      "outline-pop",
      "subtle-lower",
      "brand",
      "off"
    ]
  },
  "motion": {
    "sceneKinds": [
      "hook",
      "problem",
      "brand-reveal",
      "feature",
      "remote-update",
      "schedule",
      "dashboard",
      "ai-generate",
      "context",
      "suggestion",
      "product",
      "gallery",
      "step",
      "connections",
      "ui-walkthrough",
      "do-dont",
      "cta"
    ],
    "sceneExits": [
      "blur-up",
      "slide-left",
      "scale-down",
      "wipe",
      "iris",
      "drop"
    ],
    "titleStyles": [
      "split-chars",
      "split-words",
      "split-lines",
      "mask-up",
      "scramble"
    ],
    "animations": [
      "delivery",
      "payment",
      "orders",
      "secure-cloud",
      "domain",
      "publish"
    ],
    "icons": [
      "alert",
      "bell",
      "box",
      "cable",
      "calendar",
      "chart",
      "check",
      "clock",
      "cloud",
      "dollar",
      "image",
      "lock",
      "message",
      "monitor-off",
      "phone",
      "pin",
      "play",
      "plug",
      "router",
      "shield",
      "signal",
      "sparkles",
      "sun",
      "trending-up",
      "tv",
      "usb",
      "users",
      "wifi",
      "wifi-off",
      "x",
      "zap"
    ]
  },
  "bumpers": {
    "backgrounds": [
      "solid",
      "gradient",
      "noise",
      "shapes",
      "glow"
    ],
    "reveals": [
      "fade",
      "zoom",
      "slide-up",
      "wipe",
      "blur-in",
      "pop"
    ],
    "animations": [
      "fade",
      "zoom",
      "slide-up"
    ],
    "sfxKinds": [
      "whoosh",
      "impact",
      "shimmer",
      "click"
    ],
    "durationMs": {
      "min": 500,
      "max": 6000
    },
    "maxCaptionLength": 60
  },
  "textOverlays": {
    "kinds": [
      "lower-third",
      "chapter-title",
      "kinetic-text"
    ],
    "variantsByKind": {
      "lower-third": [
        "slide-underline",
        "accent-bar",
        "plate-wipe"
      ],
      "chapter-title": [
        "blur-rise",
        "mask-wipe",
        "word-stagger"
      ],
      "kinetic-text": [
        "word-rise",
        "word-pop",
        "word-blur"
      ]
    },
    "variants": [
      "slide-underline",
      "accent-bar",
      "plate-wipe",
      "blur-rise",
      "mask-wipe",
      "word-stagger",
      "word-rise",
      "word-pop",
      "word-blur"
    ],
    "placements": [
      "bottom-left",
      "bottom-right",
      "top-left",
      "top-right",
      "top-center",
      "bottom-center"
    ],
    "maxPerVideo": 40,
    "maxTextLength": 70
  },
  "sfx": {
    "kinds": [
      "whoosh",
      "impact",
      "shimmer",
      "riser",
      "typing",
      "click"
    ],
    "bank": [
      {
        "id": "whoosh-1",
        "kind": "whoosh",
        "durationMs": 579,
        "peakMs": 240
      },
      {
        "id": "whoosh-2",
        "kind": "whoosh",
        "durationMs": 690,
        "peakMs": 230
      },
      {
        "id": "whoosh-3",
        "kind": "whoosh",
        "durationMs": 710,
        "peakMs": 210
      },
      {
        "id": "impact-1",
        "kind": "impact",
        "durationMs": 2080,
        "peakMs": 80
      },
      {
        "id": "impact-2",
        "kind": "impact",
        "durationMs": 1660,
        "peakMs": 50
      },
      {
        "id": "impact-3",
        "kind": "impact",
        "durationMs": 2960,
        "peakMs": 60
      },
      {
        "id": "shimmer-1",
        "kind": "shimmer",
        "durationMs": 2220,
        "peakMs": 270
      },
      {
        "id": "shimmer-2",
        "kind": "shimmer",
        "durationMs": 2120,
        "peakMs": 290
      },
      {
        "id": "shimmer-3",
        "kind": "shimmer",
        "durationMs": 2460,
        "peakMs": 150
      },
      {
        "id": "riser-1",
        "kind": "riser",
        "durationMs": 1570,
        "peakMs": 1510
      },
      {
        "id": "riser-2",
        "kind": "riser",
        "durationMs": 2000,
        "peakMs": 990
      },
      {
        "id": "riser-3",
        "kind": "riser",
        "durationMs": 2410,
        "peakMs": 2230
      },
      {
        "id": "typing-1",
        "kind": "typing",
        "durationMs": 2500,
        "peakMs": 820
      },
      {
        "id": "typing-2",
        "kind": "typing",
        "durationMs": 2500,
        "peakMs": 210
      },
      {
        "id": "typing-3",
        "kind": "typing",
        "durationMs": 2500,
        "peakMs": 770
      },
      {
        "id": "click-1",
        "kind": "click",
        "durationMs": 266,
        "peakMs": 90
      },
      {
        "id": "click-2",
        "kind": "click",
        "durationMs": 410,
        "peakMs": 70
      },
      {
        "id": "click-3",
        "kind": "click",
        "durationMs": 300,
        "peakMs": 60
      }
    ]
  },
  "voices": []
}
```
