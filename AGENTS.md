# Building a Kelvi skill

Kelvi is the personal AI assistant in Forge, used on WhatsApp and on the website. A skill adds one
kind of work to Kelvi, such as saving links, tracking expenses or recording a small business's
orders. You write it in TypeScript in this repository, against the toolkit in `src/kit.ts`, and
Forge adds it to Kelvi after review. You never need Forge's own code or database.

These instructions are for people and AI coding agents alike.

## Structure

```
src/kit.ts                  the toolkit: everything a skill may use (do not change it without Forge)
src/index.ts                the list of skills in this package
src/skills/<name>/
  skill.ts                  the manifest: route, description, fixed words, menu and help
  handler.ts                handle(ctx): one message in, Kelvi's replies out
  logic.ts                  the skill's own rules, as pure functions with no toolkit calls
test/<name>.test.ts         unit tests of logic.ts, and conversations on the bench
bench/bench.ts              the test bench: a stand-in Kelvi with no WhatsApp and no Forge
scripts/check.ts            the checks Forge also runs
```

`src/skills/links/` is a complete, small example to copy.

## The manifest (`skill.ts`)

- `key` and `route`: one lowercase word, unique (`links`).
- `routeDescription`: what messages belong to the skill, with examples in brackets, and what looks
  similar but belongs elsewhere. Kelvi's sorting step reads it to decide where a message goes.
- `matches(text)`: the fixed words that reach the skill with no model call ("my links", "/links").
  Keep them narrow: a match takes the message from every other feature.
- `menu`: the command, the title, one line for the menu, what the bare command does, how to use it,
  and one line for Kelvi's help, under 120 characters.
- `kit`: the toolkit version the skill was built for (`KIT_VERSION`).

## The handler (`handler.ts`)

`handle(ctx)` gets one message and replies with `ctx.reply`. The toolkit (`src/kit.ts`):

- `ctx.text`, `ctx.person` (first name, today's date, time zone)
- `ctx.registers.open(def)`: the person's own register, created the first time; `list`, `add`,
  `update`, `remove`
- `ctx.ai.read({ operation, instructions, text })`: one AI call that returns text (ask for JSON);
  masked, billed and logged by Forge. `null` means Kelvi has already told the person it could not
  run, so stop.
- `ctx.documents.recent(minutes)` and `ctx.documents.keep(doc, …)`: documents the person sent
- `ctx.actions.add(what, due)`: an action in their My actions, which Kelvi reminds them of
- `ctx.rates.inr(currency, date)` and `ctx.web.title(url)`: the outside world, read-only

## Rules

1. Import only `../../kit` and files in your own skill folder. No `fetch`, no `process.env`, no file
   or database access: `npm run check` fails on them, and Forge checks again.
2. Never write a database migration. Declare data as registers (`RegisterDef`). If it does not fit a
   register, say so in your pull request; Forge decides.
3. Use the AI only through `ctx.ai`. Never put arithmetic, totals or matching in a prompt: do them in
   `logic.ts`, in code, with tests.
4. Kelvi is not an open chatbot. Handle only your skill's messages.
5. Write what Kelvi says in plain sentences, short enough for a phone screen. Use *single asterisks*
   for the few words that matter; no tables, no headings, no emoji. Number any list the person may
   answer by number.
6. Never invent a fact. When the data does not answer, say so.
7. Store nothing about a person except in their registers.

## Testing

- `npm test`: the unit tests and bench conversations.
- `npm run try -- <skill> "message" "message" …`: send messages to a skill on the bench and read
  Kelvi's replies. `--today 2026-11-20` sets the date; `--web "https://…=Page title"` gives a page's
  title; `--live-web` reads real pages.
- `npm run check`: the import rules, the manifest and the types.

## Done means

- `npm test` and `npm run check` pass.
- The pull request says what the skill does, its registers, and anything it could not do.
- A maintainer tags a version (`v0.2.0`). Forge moves to that version in a reviewed change, adds the
  skill's messages to Kelvi's routing test set, and switches it on for a test workspace, then for
  everyone.
