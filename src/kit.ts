// The Kelvi skills toolkit.
//
// A skill is a Kelvi feature in its own folder under src/skills/, with a manifest
// (skill.ts) and a handler that sees only this toolkit, never Forge's own code.
// Forge installs this package, and Kelvi fills the toolkit in for each message,
// with Forge's rules applied inside it: the person's own registers through Forge's
// guards, AI calls masked, billed to the workspace's credits and logged, documents
// stored through Forge's own store. A skill has no network, database or file access
// of its own; what it needs from the outside world is a part of this toolkit.
//
// Rule for a skill's files: import only from "../../kit" (this file) and from the
// skill's own folder. `npm run check` enforces it, and Forge checks it again.

// The version of the toolkit's contract. Forge refuses a skill built for another
// major version.
export const KIT_VERSION = "0.1.0";

// A record in one of the skill's registers.
export interface SkillRecord {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
}

// A register the skill declares: its fields, as Forge's registers have them (text,
// number, currency, date, select). Created for the person the first time it is
// opened and kept as data, so a skill never needs a database migration; a field
// added in a later version joins existing registers when they are next opened.
export interface RegisterDef {
  // Unique across skills, such as "skill_links".
  type: string;
  name: string;
  fields: { key: string; label: string; type: "text" | "number" | "currency" | "date" | "select"; options?: string[]; required?: boolean }[];
}

export interface SkillRegister {
  id: string;
  list(): Promise<SkillRecord[]>;
  add(data: Record<string, unknown>): Promise<SkillRecord>;
  update(id: string, patch: Record<string, unknown>): Promise<void>;
  remove(id: string): Promise<void>;
}

// A document the person sent Kelvi recently: its text (a photo's, as read), and
// whether it is already in their stored documents.
export interface SkillDocument {
  id: string;
  filename: string;
  text: string;
  sentAt: string;
  storedId: string | null;
}

export interface SkillContext {
  // The message, or the document's caption.
  text: string;
  person: { userId: string; orgId: string; firstName: string; today: string; timezone: string };
  reply(text: string): Promise<void>;
  // One model call that reads text into JSON: masked before the model (and the
  // masked values put back in the answer), billed and logged as `operation`. Null
  // when it could not run (no credits, or the call failed); the person has then
  // been told, and the skill should stop.
  ai: { read(o: { operation: string; instructions: string; text: string }): Promise<string | null> };
  registers: { open(def: RegisterDef): Promise<SkillRegister> };
  documents: {
    // Documents sent within the last `minutes`, newest first.
    recent(minutes: number): Promise<SkillDocument[]>;
    // Keeps the original in the person's stored documents; its id, or null when
    // storage is not set up or the original is no longer available.
    keep(doc: SkillDocument, o: { folder: string; subfolder: string | null; title: string; kind: string; date: string | null }): Promise<string | null>;
  };
  // An action in the person's My actions, which Kelvi reminds them of.
  actions: { add(what: string, due: string): Promise<void> };
  // Exchange rates: rupees for one unit of a currency on a date, or null.
  rates: { inr(currency: string, date: string): Promise<number | null> };
  // The web, read-only: a public page's title, or null. Only http and https
  // addresses on the public internet; nothing about the person is sent.
  web: { title(url: string): Promise<string | null> };
}

// How the skill appears in Kelvi's menu, its "commands" list and its help.
export interface SkillMenu {
  // The slash command, without the slash: "links" is /links.
  command: string;
  title: string;
  // One short line, under the title in the menu.
  description: string;
  // What the command does on its own: the words Kelvi treats it as ("my links").
  runs: string;
  // How to use it, shown when the person taps the menu row.
  howTo: string;
  // One line in Kelvi's help ("help"), kept short: the help must fit one message.
  helpLine: string;
  // Words people use for it, for "add links to my menu".
  aliases: string[];
}

// What Kelvi needs to know about a skill to send it messages.
export interface SkillManifest {
  key: string;
  title: string;
  kit: string;
  // The sorting step's destination: its route name and description, with examples.
  route: string;
  routeDescription: string;
  // Fixed words that reach the skill with no model call, such as "my links".
  matches(text: string): boolean;
  menu: SkillMenu;
  handle(ctx: SkillContext): Promise<void>;
}
