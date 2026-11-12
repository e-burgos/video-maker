# Sales and promo videos for a business audience

Use this when the video has to convince someone who runs a business (a shop, a store, a restaurant, a
clinic, an agency, an office) to try, buy or ask about the product.

## 1. Who is watching

- A busy owner or manager, often on a phone, between customers. They decide in the first 5 seconds whether
  to keep watching.
- They do not care how it is built. They care about: more sales, fewer hours, fewer mistakes, looking
  professional, being in control, not depending on someone else.
- They are not technical: no acronyms, no framework names, no internal feature names unless the UI shows
  them with that name.

## 2. The five beats

| Beat | Share of the video | What it says | Motion scene kinds that fit |
| --- | --- | --- | --- |
| Problem | 15–20 % | one concrete pain of their day, as a question or a scene | `hook`, `problem` |
| Solution | 15 % | the product, named with context: "This is X: <what it does in their words>" | `brand-reveal` |
| Proof | 35–45 % | 2–3 benefits, each with how it works in the product | `feature`, `product`, `ui-walkthrough`, `dashboard`, `schedule`, `step` |
| Offer | 10 % | what they get: a free trial, a plan, installation, support — only if the repo says so | `feature`, `context` |
| Call to action | 10 % | one action, real and specific | `cta` |

Use the live scene catalog from `get_capabilities`: the studio's storyboard AI chooses kinds by itself,
but a script written in these beats gives it the right material.

## 3. Rules for claims

- Every sentence must be traceable to the repo (landing copy, docs, pricing, i18n strings) or to the user.
- Never invent: prices, discounts, percentages, "X customers", testimonials, awards, guarantees, deadlines.
- A number in the repo can be used if the user confirms it is current. Prefer outcomes without numbers
  ("you change the offer in one minute") over invented precision.
- When you show the script to the user, list next to it the source of each claim. It is the fastest way to
  get a confident "yes".

## 4. Make it about their place

- Write scenes the owner recognizes: the counter, the shop window, the waiting room, the phone at closing
  time, the weekend rush.
- Show the product working there: real screenshots of the product (captured with the screen-capture
  sub-skill), the brand's device images (a screen, a kiosk, a terminal, a phone with the product's screen
  inside), or the user's own photos. Avoid generic stock that could advertise any product.
- If the product runs on a physical device, register that device in the brand (image + screen polygon) so
  scenes can put the product's UI inside it. See the brand sub-skill.

## 5. Length and format

| Destination | Format | Length | Words (~2.5 per second) |
| --- | --- | --- | --- |
| Landing page, sales call, email | 16:9 | 45–75 s | 110–180 |
| Social ad, reel, short | 9:16 | 20–40 s | 50–100 |
| Store or WhatsApp status | 9:16 | 15–25 s | 40–60 |

## 6. Script template (adapt, never copy literally)

```text
<A question about one concrete pain, in the owner's words>?
<The consequence they feel: lost sales, time, a bad impression>.
This is <Product>: <what it does for them, in one line>.
<Benefit 1 as an outcome>. <How: one product action>.
<Benefit 2 as an outcome>. <How>.
<Benefit 3 or proof that is written in the repo>.
<The offer, only if it exists>.
<One call to action: where and how to start>.
```

Brand-name rule for the generated voice: never put the brand name at the very start or the very end of a
line; give it context ("This is Acme: …"). If the voice mispronounces it, the brand's `spokenName` is
written the way it sounds.

## 7. Worked example (fictional product)

A booking app for hair salons, 16:9, 50 s, calm and close tone:

```text
How many appointments did you lose this week because nobody answered the phone?
Every missed call is an empty chair in the afternoon.
This is Turnito: your salon's agenda, open to your customers day and night.
They book from their phone in three taps, and you see it on yours at once.
A reminder goes out the day before, so fewer people forget.
And at closing time you know exactly how the week went.
Try it free today: the link is right under this video.
```

No URL is spoken: the address goes on screen (the call-to-action scene or the outro caption) and in the
publication's description.

Sources the agent would show: hero text (landing), reminders feature (docs/features.md), "free plan"
(pricing page). Nothing else is claimed.

## 8. Before the full render

- The storyboard keeps the beats in order and every scene's text is something the product really does.
- No scene shows a competitor, a real customer's data or a price the user did not approve.
- The call to action is readable for at least 3 seconds and is the same as the narration.
