# kelvi-skills

Skills for Kelvi, the personal AI assistant in [Forge](https://www.forgeprivate.com/kelvi), by
Sudhanva Labs. A skill adds one kind of work to Kelvi, such as saving links. Each is a small
TypeScript folder written against a toolkit (`src/kit.ts`) that gives it only what it needs:
the person's own registers, AI calls that Forge masks and bills, their recent documents, their
actions, and a read-only view of the web.

Forge installs this package at a tagged version and compiles it with its own code; Kelvi calls a
skill's handler for each message meant for it. A skill never sees Forge's code or database, and a
new version reaches people only through a reviewed change in Forge.

## Skills

| Skill | What it does |
|---|---|
| `links` | Saves links sent to Kelvi (a Meet link, a website, a post) and sends them back when asked |

## Working on a skill

```
npm install
npm test                      # unit tests and bench conversations
npm run check                 # import rules, manifests and types
npm run try -- links "my Meet link: meet.google.com/abc-defg-hij" "my links" "send me my meet link"
```

`AGENTS.md` has the structure, the toolkit and the rules, for people and AI coding agents.
