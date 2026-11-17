# Build your first Kelvi skill

This guide takes a new developer from nothing to a skill live in Kelvi. Read `AGENTS.md` for the
rules; this is the path through them. Your first skill should be small: we suggest
[Lent and borrowed](briefs/lent-and-borrowed.md), then [Expenses](briefs/expenses.md).

## What you are building

Kelvi is the personal AI assistant in Forge, used on WhatsApp and the website. A **skill** is one
kind of work Kelvi does for a person, such as saving links. It is a folder of TypeScript that sees
only the toolkit (`src/kit.ts`). Forge installs this package at a tagged version and compiles it
with its own code, so your skill runs inside Forge, but you never need Forge's code, database or
WhatsApp to build and test it.

Each skill has three files:

| File | What it holds |
|---|---|
| `skill.ts` | The manifest: which messages are yours, your menu row and help line, your sidebar entry |
| `handler.ts` | `handle(ctx)`: one message in, Kelvi's replies out, using only the toolkit |
| `logic.ts` | Your rules as plain functions: parsing what the person wrote, sums, matching, replies |

Kelvi decides which skill a message is for in two ways. Your `matches(text)` catches fixed words
with no AI ("my links"). Everything else goes through Kelvi's sorting step, an AI call that reads
your `routeDescription` beside every other feature's and picks one. So the description is part of
your code: it decides what reaches you.

## 1. Set up

```
git clone https://github.com/sudhanvalabs/kelvi-skills.git   # or your fork
cd kelvi-skills
npm install
npm test && npm run check
npm run try -- links "my Meet link: meet.google.com/abc-defg-hij" "my links"
```

`npm run try` is the test bench: a stand-in Kelvi that prints replies, keeps registers in memory and
needs no network.

## 2. Copy the example

```
cp -r src/skills/links src/skills/lent
```

Rename everything inside: the manifest's `key`, `route`, `menu.command` (one lowercase word, such as
`lent`) and the register's `type` (`skill_lent`). Add your skill to `SKILLS` in `src/index.ts`.

## 3. Design before code

Write down, in plain sentences:

- **The messages** people will send, with real examples, and what Kelvi replies to each.
- **The data**: one register, its fields (text, number, currency, date, select). Keep it to what
  the replies need.
- **What is not yours**: messages that look similar but belong to another feature. Reminders are
  Kelvi's actions; recurring payments are Subscriptions; invoices the person raises are Invoices;
  filing a document is "store it"; medical papers are Health records.

## 4. Write `logic.ts` first, with tests

Put everything that can be wrong in pure functions: reading "lent Ravi 2,000 for the hotel" into
fields, totals per person, matching a name, the wording of each reply. Test each in
`test/<name>.test.ts` with Node's test runner, as `test/links.test.ts` does. Sums, dates and
matching are always code, never the AI.

## 5. Write `handler.ts`

Open your register with `ctx.registers.open(DEF)`, read what the person wrote with your logic, do
it, and reply with `ctx.reply`. Use only what `src/kit.ts` offers:

| You want to | Use |
|---|---|
| Keep the person's data | `ctx.registers.open(def)`: `list`, `add`, `update`, `remove` |
| Read a photo or document into fields | `ctx.documents.recent(minutes)` for its text, then `ctx.ai.read` for JSON |
| Keep the original document | `ctx.documents.keep(doc, …)` |
| Add something Kelvi reminds them of | `ctx.actions.add(what, due)` |
| Convert a currency | `ctx.rates.inr(currency, date)` |
| Name a web link | `ctx.web.title(url)` |

`ctx.ai.read` returns `null` when it cannot run (no credits, or a failure); Kelvi has already told
the person, so stop. If you need something the toolkit lacks (sending a file back, a message on a
schedule), say so in your pull request: Forge adds it to the toolkit for everyone, rather than one
skill reaching around it.

## 6. Write the manifest

- `routeDescription`: what belongs to you, with examples in brackets, and what does not, naming the
  feature it belongs to. Read `src/skills/links/skill.ts` for the style.
- `matches(text)`: only the fixed words that are surely yours ("my loans", "/lent"). A match takes
  the message from every other feature.
- `menu`: the command, a title, one line for the menu, what the bare command does (`runs`), how to
  use it (`howTo`), one help line under 120 characters, and aliases.
- `page`: `{ icon: "₹", register: "skill_lent" }` gives you a sidebar entry on the website.

## 7. Try it on the bench

```
npm run try -- lent "lent Ravi 2000 for the hotel" "Ravi paid back 500" "who owes me?"
```

Read every reply as the person would on a phone: short, plain, the number they need first. Then
`npm test` and `npm run check` must pass.

## 8. Send it

Open a pull request with what the skill does, its register, example conversations, and anything you
could not do. A maintainer reviews the code and the routing description, merges it, and tags a
version. Forge then moves to that version in a reviewed change, adds your examples to Kelvi's
routing test set, and runs it; your skill goes live in Kelvi with its menu row, command, help line
and sidebar entry, with no change to Forge's own files.

## Writing what Kelvi says

- Plain sentences, short enough for a phone. *Single asterisks* for the few words that matter; no
  tables, headings or emoji.
- Number any list the person might answer by number.
- Never invent a fact. When the data does not answer, say so and say how to fix it.
- Answer only your skill's messages. Kelvi is not an open chatbot.
