# Reading the host project

Goal: in 5–10 minutes, know enough to propose the video without asking the user what their own product
does. Read, do not run anything heavy. Write down the source file of every fact you will use.

## 1. Identity and purpose

- `README*` at the root and in the main app folders.
- `docs/`, `documentation/`, `wiki/`, `*.mdx` content folders, `CHANGELOG*` (recent features).
- Package manifest: `package.json` (name, description, homepage, keywords), `pyproject.toml`,
  `Cargo.toml`, `go.mod`, `composer.json`, `pubspec.yaml`, `*.gemspec`, `pom.xml`, `build.gradle`.
- Mobile store texts: `fastlane/metadata/`, `store/`, `app.json` / `app.config.*` (Expo).
- Marketing pages: look for routes or files named `landing`, `home`, `index`, `pricing`, `features`,
  `about`, `faq`, `customers`, `case-studies`, and for CMS content folders.

Search patterns (adapt to the stack):

```bash
git ls-files | grep -iE 'readme|landing|pricing|feature|about|faq|marketing|hero|testimonial' | head -50
git ls-files | grep -iE '(^|/)(locales?|i18n|lang|messages)/' | head -20
```

## 2. Audience and claims

- Who it is for: the hero sentence, the "for X" phrases, onboarding copy, sign-up form fields.
- Proof points: numbers, customer logos, integrations, reviews. Use only what is literally written.
- Pricing: plan names and what each includes. Prices change: quote them only when the user wants them
  and confirm they are current.
- Calls to action: the button texts on the landing page ("Start free", "Book a demo") and their URLs.

## 3. Brand

- Logos: `public/`, `static/`, `assets/`, `images/`, `branding/`, `brand/`, favicons, `manifest.json` /
  `site.webmanifest` icons (often the cleanest square mark), `apple-touch-icon*`, store icons.
- Colors: CSS custom properties (`--primary`, `--accent`, `--background`), Tailwind
  `theme.extend.colors`, CSS-in-JS theme files, design tokens JSON, the manifest `theme_color` and
  `background_color`, mobile `colors.xml` / asset catalogs.
- Fonts: `@font-face`, Google Fonts links, `next/font` calls, font files in the repo.
- Tone: how the README and landing copy talk (formal or close, technical or plain).

The brand sub-skill turns this into a brand manifest.

## 4. Can it be recorded?

- Web UI present? Look for a front-end framework, routes, a `dev`/`start` script, a docker compose file.
- How to run it locally: the README "getting started", package scripts, `.env.example` (which variables
  are required), seed or fixture scripts that create demo data.
- A demo, staging or preview URL in the docs. Never record production with real data.
- Login: is there a demo user in seeds or env examples? Credentials only come from the repo's env vars.
- No web UI (API, library, CLI, mobile-only, embedded): the video is motion, or the user records their
  own screen or device (see the raw-material sub-skill).

## 5. What to bring to the question round

A short summary for yourself:

```text
Product: <name> — <one-line purpose> (README)
Audience: <who> (landing hero)
Top 3 benefits: <...> (features page)
Proof: <only literal facts, with source>
CTA: <button text + url> (landing)
Brand: logo <file>, colors <hexes>, font <family> (theme file)
Recordable UI: yes/no — how to run: <command>, login: <env var names>
Language: <language of the UI and audience>
```
