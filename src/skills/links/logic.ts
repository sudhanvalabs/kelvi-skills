import type { RegisterDef, SkillRecord } from "../../kit";

// Links: the person's saved links, such as their Google Meet link, a website or a
// post, saved by sending them to Kelvi and got back by asking. The rules, with no
// model and no database, so they are tested on their own (test/links.test.ts).

export const LINKS: RegisterDef = {
  type: "skill_links",
  name: "Links",
  fields: [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "url", label: "Link", type: "text", required: true },
    { key: "tag", label: "Kind", type: "select", options: ["Meetings", "Posts", "Videos", "Documents", "Websites"] },
    { key: "saved_on", label: "Saved on", type: "date" },
  ],
};

export interface Link {
  id: string;
  name: string;
  url: string;
  tag: string;
  savedOn: string;
  // When it was saved, to the moment, for the order of "my links".
  addedAt: string;
}

export function linkOf(r: SkillRecord): Link {
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return { id: r.id, name: s(r.data.name), url: s(r.data.url), tag: s(r.data.tag) || "Websites", savedOn: s(r.data.saved_on).slice(0, 10), addedAt: r.createdAt };
}

// ─── Finding links in a message ──────────────────────────────────────────────

// "https://…", "www.…", and bare addresses with a path such as
// "meet.google.com/abc-defg-hij", as WhatsApp sends them.
const URL_RE = /\b(?:https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/[^\s<>"']*)/gi;

export function linksIn(text: string): string[] {
  const found = [...text.matchAll(URL_RE)].map((m) => m[0].replace(/[.,;:!?)\]]+$/, ""));
  return [...new Set(found.map((u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)))];
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// The kind of link, from where it points.
export function tagOf(url: string): string {
  const h = hostOf(url).toLowerCase();
  if (/(^|\.)(meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|webex\.com|whereby\.com|meet\.jit\.si)$/.test(h)) return "Meetings";
  if (/(^|\.)(linkedin\.com|x\.com|twitter\.com|instagram\.com|facebook\.com|threads\.net|reddit\.com|medium\.com|substack\.com)$/.test(h)) return "Posts";
  if (/(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/.test(h)) return "Videos";
  if (/(^|\.)(docs\.google\.com|drive\.google\.com|notion\.so|dropbox\.com|onedrive\.live\.com|sharepoint\.com)$/.test(h)) return "Documents";
  return "Websites";
}

// The name the person gave in the message, with the link and filler words taken
// out: "my google meet link: meet.google.com/abc" is "Google Meet".
export function nameGiven(text: string): string {
  let t = text.replace(URL_RE, " ");
  t = t.replace(/^\s*(please\s+)?(save|store|keep|add|remember)(\s+(this|it|the|my))?(\s+link)?\b/i, " ");
  t = t.replace(/\b(here'?s|here is|this is|it'?s)\b/gi, " ");
  t = t.replace(/\b(link|url)s?\b/gi, " ").replace(/\bmy\b/gi, " ").replace(/\b(is|for|to)\s*$/i, " ");
  t = t.replace(/[:\-–—|]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > 80 ? `${t.slice(0, 79).trimEnd()}…` : t.charAt(0).toUpperCase() + t.slice(1);
}

// A page's own title, tidied: "Kelvi | LinkedIn" is "Kelvi".
export function tidyTitle(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  const cut = t.replace(/\s+[|·–—-]\s+(LinkedIn|YouTube|X|Twitter|Instagram|Facebook|Medium|Reddit)$/i, "");
  return cut.length > 80 ? `${cut.slice(0, 79).trimEnd()}…` : cut;
}

// ─── What the person wrote ───────────────────────────────────────────────────

export type LinksCommand =
  | { kind: "save"; urls: string[]; name: string }
  | { kind: "list"; about: string | null }
  | { kind: "find"; words: string }
  | { kind: "delete"; which: string }
  | { kind: "rename"; which: string; to: string }
  | { kind: "help" };

export function linksCommand(text: string): LinksCommand | null {
  const raw = text.trim();
  const t = raw.toLowerCase().replace(/[.!?]+$/, "").trim();
  if (/^\/links?$/.test(t) || /^(my |all my |show (me )?my |list my )?(saved )?links$/.test(t)) return { kind: "list", about: null };
  const about = t.match(/^(?:my |show (?:me )?my )?(?:saved )?links (?:about|on|for|from) (.+)$/);
  if (about) return { kind: "list", about: about[1] };
  if (/^(links help|help with links)$/.test(t)) return { kind: "help" };
  const urls = linksIn(raw);
  if (urls.length) return { kind: "save", urls, name: urls.length === 1 ? nameGiven(raw) : "" };
  const del = t.match(/^(?:delete|remove|forget) (?:the |my )?(.+?)(?: link)?$/);
  if (del) return { kind: "delete", which: del[1] };
  const ren = t.match(/^rename (?:the |my )?(.+?)(?: link)? (?:to|as) (.+)$/);
  if (ren) return { kind: "rename", which: ren[1], to: raw.slice(raw.toLowerCase().lastIndexOf(ren[2])).trim() };
  const find = t.match(/^(?:send (?:me )?|share |give (?:me )?|what'?s |what is |where'?s )?(?:the |my )?(.+?) (?:link|url)$/) ?? t.match(/^(?:send (?:me )?|give (?:me )?)?(?:the |my )?link (?:to|for) (.+)$/);
  if (find) return { kind: "find", words: find[1].replace(/^(?:the|my) /, "") };
  return null;
}

// The words that reach Links with no model call: "my links", "/links", a message
// that is a link with at most a few words of name, and "… link" requests.
export function isLinksText(text: string): boolean {
  const c = linksCommand(text);
  if (!c) return false;
  if (c.kind === "save") return nameGiven(text).split(/\s+/).filter(Boolean).length <= 6;
  return c.kind === "list" || c.kind === "help" || c.kind === "find";
}

// ─── Finding a saved link ────────────────────────────────────────────────────

const SMALL = new Set(["the", "my", "a", "an", "of", "to", "for", "and", "on", "about", "that", "this", "saved"]);
const wordsOf = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !SMALL.has(w));

// The links a description fits, best first: every word of it in the name, kind or
// address scores highest.
export function match(links: Link[], description: string): Link[] {
  const want = wordsOf(description);
  if (!want.length) return [];
  const scored = links
    .map((l) => {
      const have = new Set([...wordsOf(l.name), ...wordsOf(l.tag), ...wordsOf(hostOf(l.url).replace(/\./g, " "))]);
      // A whole word counts fully; the start of one ("meet" in "meetings") half.
      const hits = want.reduce((n, w) => n + (have.has(w) ? 1 : w.length >= 3 && [...have].some((h) => h.startsWith(w)) ? 0.5 : 0), 0);
      return { l, score: hits / want.length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.l.addedAt.localeCompare(a.l.addedAt));
  const best = scored[0]?.score ?? 0;
  return scored.filter((x) => x.score === best).map((x) => x.l);
}

// A link the person names: by its number in "my links", else by description.
export function pick(links: Link[], which: string): Link[] {
  const n = which.match(/^(?:number |no\.? )?(\d{1,3})$/);
  if (n) {
    const l = ordered(links)[Number(n[1]) - 1];
    return l ? [l] : [];
  }
  return match(links, which);
}

// Newest first, the order "my links" numbers them in.
export const ordered = (links: Link[]) => [...links].sort((a, b) => b.addedAt.localeCompare(a.addedAt) || a.name.localeCompare(b.name));

// ─── Replies ─────────────────────────────────────────────────────────────────

export function listReply(links: Link[], about: string | null): string {
  const all = ordered(links);
  const shown = about ? all.filter((l) => match([l], about).length) : all;
  if (!links.length) return "No links yet. Send me a link, with a name if you like, such as \"my Meet link: meet.google.com/abc-defg-hij\".";
  if (!shown.length) return `No saved links about ${about}. "my links" lists them all.`;
  const lines = shown.slice(0, 30).map((l) => `${all.indexOf(l) + 1}. *${l.name}*\n${l.url}`);
  const more = shown.length > 30 ? `\n\n…and ${shown.length - 30} more on the website, under Links.` : "";
  return `*${about ? `Your links about ${about}` : "Your links"}* (${shown.length})\n\n${lines.join("\n\n")}${more}`;
}

// Found: the link on its own line, easy to tap or forward.
export function foundReply(found: Link[], words: string): string {
  if (!found.length) return `I couldn't find a saved link for "${words}". "my links" lists them.`;
  if (found.length === 1) return `*${found[0].name}*\n${found[0].url}`;
  return [`A few links fit "${words}":`, ...found.slice(0, 5).map((l) => `• *${l.name}*\n${l.url}`)].join("\n\n");
}

export const LINKS_HELP = [
  "*Links*",
  '• Save: send a link, with a name if you like: "my Meet link: meet.google.com/abc-defg-hij". With no name, I use the page\'s title.',
  '• Get one back: "send me my Meet link", "the Kelvi post link".',
  '• "my links" lists them; "my links about AI" only those. "rename 3 to Team standup", "delete the Zoom link".',
].join("\n");
