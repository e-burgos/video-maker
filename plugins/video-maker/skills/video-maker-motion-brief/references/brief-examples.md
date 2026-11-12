# Brief examples

All products below are fictional. Copy the shape, never the claims: every sentence of a real brief comes
from the host repo or from the user.

## 1. A REST API (16:9, 60 s, developers)

```json
{
  "version": 1,
  "brand": "shipline",
  "title": "Shipline API in one minute",
  "format": "16:9",
  "beatSync": false,
  "music": "auto",
  "goal": "Developers understand they can quote and book shipments with one API and go to the docs.",
  "audience": "Backend developers of online stores",
  "script": "How many carrier integrations does your store maintain today?\nEach one has its own format, its own errors and its own outage.\nShipline puts every carrier behind a single API.\nYou send the package once, and you get every quote back in one answer.\nPick the best one, and the label is ready to print.\nTracking events arrive at your webhook, already in the same format.\nThe sandbox is free, and the docs have a working example in five languages.\nCreate your key and send your first shipment today.",
  "images": []
}
```

Why it works: one pain, one promise, the flow in three sentences, a real offer from the docs (sandbox),
one call to action. No URL spoken.

## 2. A library (9:16, 30 s, developers)

```json
{
  "version": 1,
  "brand": "tinyforms",
  "title": "Tinyforms in 30 seconds",
  "format": "9:16",
  "beatSync": true,
  "music": "auto",
  "goal": "Front-end developers try the library.",
  "audience": "React developers",
  "script": "Tired of writing the same form validation again?\nTinyforms validates as you type, with one hook.\nThe errors come translated, and the bundle stays tiny.\nInstall it with one command and try it on your next form.",
  "images": [{ "file": "playground.png", "caption": "The online playground with a signup form showing a red email error" }]
}
```

## 3. A CLI (16:9, 45 s)

Script shape: the repetitive task → the one command (on screen, literal from the README) → what it does in
three steps → the before/after → install. Use `beatSync: false` so each step gets its time.

## 4. A sales pitch to a local shop (16:9, 50 s, business owners)

```json
{
  "version": 1,
  "brand": "stockly",
  "title": "Stockly for neighborhood stores",
  "format": "16:9",
  "beatSync": true,
  "music": "auto",
  "goal": "Store owners ask for a demo.",
  "audience": "Owners of small hardware and household stores who count stock by hand",
  "script": "How long does it take you to know what is missing on the shelves?\nCounting by hand eats your Sunday, and you still run out of what sells.\nThis is Stockly: your store's stock, always up to date on your phone.\nEach sale updates it at once, from the counter.\nWhen something is running low, it warns you before it runs out.\nAnd the supplier order is ready in one tap.\nThe first month is free, and we help you load your products.\nAsk for your demo today; the link is below this video.",
  "images": [
    { "file": "low-stock.png", "caption": "Phone screen with a low stock alert for paint rollers" },
    { "file": "order.png", "caption": "Supplier order screen with five products and a send button" }
  ]
}
```

Sources the agent would show next to the script: the hero line and "first month free" (landing page),
low-stock alerts and supplier orders (docs/features.md), help loading products (onboarding page). The
phone screenshots were captured from the product's web app in a mobile viewport.

## 5. Team instructions (16:9, up to 2 min)

One step per sentence, in the real order ("Plug the cable…", "Open the settings…"), `beatSync: false`, the
step scene kind fits best; screenshots of each step as images with precise captions.

## Storyboard review checklist

- Scene count 6–12, order of the script kept.
- Each `scenes[].vo` is a line of the script (it may be polished for the voice, never extended with new
  claims).
- Titles and bullets on screen are short (≤ 6 words) and are true.
- The call to action scene is last and matches the narration.
