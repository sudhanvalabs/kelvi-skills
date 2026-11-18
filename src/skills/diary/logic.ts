import type { RegisterDef, SkillRecord } from "../../kit";

// Diary: entries the person dictates, forwards or types, kept with the date and
// time and a title, in English with the original language kept, and found again by
// asking ("when did I dream about Appaji?"). The rules, with no model and no
// database, so they are tested on their own (test/diary.test.ts).

export const DIARY: RegisterDef = {
  type: "skill_diary",
  name: "Diary",
  fields: [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "entry", label: "Entry", type: "text", required: true },
    { key: "written_on", label: "Date", type: "date" },
    { key: "at", label: "Time", type: "text" },
    { key: "language", label: "Spoken in", type: "text" },
    { key: "original", label: "Original", type: "text" },
    { key: "source", label: "From", type: "select", options: ["Voice note", "Recording", "Typed"] },
    // The recording itself, in the person's stored documents (folder Diary), so the
    // entry can be heard as it was told, in its own language (PE, 18 November 2026).
    { key: "audio", label: "Recording", type: "text" },
  ],
};

export interface Entry {
  id: string;
  title: string;
  entry: string;
  writtenOn: string;
  at: string;
  language: string | null;
  original: string | null;
  // The stored recording's id, when the entry was spoken.
  audio: string | null;
}

export function entryOf(r: SkillRecord): Entry {
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return { id: r.id, title: s(r.data.title) || "Diary entry", entry: s(r.data.entry), writtenOn: s(r.data.written_on).slice(0, 10), at: s(r.data.at), language: s(r.data.language) || null, original: s(r.data.original) || null, audio: s(r.data.audio) || null };
}

// ─── What the person wrote ───────────────────────────────────────────────────

export type Period = "today" | "yesterday" | "week" | "last_week" | "month" | "last_month" | "all";

export type DiaryCommand =
  | { kind: "write"; text: string }
  | { kind: "file" }
  | { kind: "list"; period: Period }
  | { kind: "find"; query: string; play?: boolean }
  | { kind: "help" };

const PERIODS: [RegExp, Period][] = [
  [/^today$/, "today"],
  [/^yesterday$/, "yesterday"],
  [/^(this week)$/, "week"],
  [/^(last week)$/, "last_week"],
  [/^(this month)$/, "month"],
  [/^(last month)$/, "last_month"],
];

export function diaryCommand(text: string): DiaryCommand | null {
  const raw = text.trim();
  const t = raw.toLowerCase().replace(/[.!?]+$/, "").trim();
  // "diary: last night I dreamt …", "dear diary, …": an entry in the same message.
  const write = raw.match(/^(?:dear\s+)?diary\s*[:,\-–]\s*([\s\S]+)$/i) ?? raw.match(/^(?:note|write|add)\s+(?:this\s+)?(?:in|to)\s+(?:my\s+)?diary\s*[:,\-–]\s*([\s\S]+)$/i);
  if (write && write[1].trim().length > 1) return { kind: "write", text: write[1].trim() };
  // "diary", "store in diary", "put it in my diary": the latest recording or text sent.
  if (/^(?:dear\s+)?diary$|^(?:store|save|put|add|keep|file|write)\s+(?:it\s+|this\s+|that\s+)?(?:in|to|into)\s+(?:my\s+|the\s+)?diary$|^diary (?:it|this|that)$|^(?:to|for) (?:my\s+)?diary$/.test(t)) return { kind: "file" };
  // "store the audio file", "keep the original recording too", "save the audio in my
  // diary" (PE, 18 November 2026): the recording kept with its entry.
  if (/^(?:please\s+)?(?:store|save|keep|add|attach|put|file)\s+(?:the\s+|my\s+|its\s+|this\s+)?(?:original\s+)?(?:audio(?:\s+files?)?|recordings?|voice\s*notes?|sound|mp3)(?:\s+files?)?(?:\s+(?:too|also|as well))?(?:\s+(?:in|to|into|with)\s+(?:my\s+|the\s+)?(?:diary|entry|diary entry))?(?:\s+(?:too|also|as well))?$/.test(t)) return { kind: "file" };
  const list =
    t.match(/^(?:my|show(?: me)?(?: my| the)?|read(?: me)?(?: my| the)?|open(?: my| the)?|list(?: my| the)?|see(?: my| the)?|view(?: my| the)?)\s+(?:diary|diaries|journal)(?:\s+entries)?(?:\s+(?:for|from|of)?\s*(.+))?$/) ??
    t.match(/^(?:my\s+)?diary\s+(?:entries|list)()$/);
  if (list) {
    const when = (list[1] ?? "").trim().replace(/^(?:entry|entries|note|notes)\s+/, "");
    if (!when) return { kind: "list", period: "all" };
    const p = PERIODS.find(([re]) => re.test(when));
    if (p) return { kind: "list", period: p[1] };
    return { kind: "find", query: when.replace(/^(?:about|on)\s+/, "") };
  }
  if (/^(?:diary help|help with (?:my )?diary)$/.test(t)) return { kind: "help" };
  // "when did I dream about Appaji?", "what did I write about the interview?",
  // "find Appaji in my diary".
  const find =
    t.match(/^(?:when\s+did\s+i|did\s+i\s+ever|have\s+i\s+ever)\s+(.+)$/) ??
    t.match(/^what\s+did\s+i\s+write\s+(?:about|on)\s+(.+)$/) ??
    t.match(/^(?:find|search(?:\s+for)?|look\s+for)\s+(.+?)\s+in\s+(?:my\s+)?diary$/) ??
    t.match(/^(?:search|find in)\s+(?:my\s+)?diary\s+(?:for\s+)?(.+)$/) ??
    t.match(/^(?:show|give|send)(?:\s+me)?\s+(?:my\s+|the\s+)?diary\s+(?:entry|note|notes|entries)\s+(?:about|on|for)\s+(.+)$/);
  // "play the Appaji dream", "play my diary entry about Appaji": heard as it was told.
  const play = t.match(/^(?:play|listen to|hear)\s+(?:me\s+)?(?:my\s+|the\s+)?(?:diary\s+)?(?:entry\s+|recording\s+)?(?:about\s+|on\s+)?(.+?)(?:\s+(?:from|in)\s+(?:my\s+)?diary)?$/);
  if (play) return { kind: "find", query: play[1].trim(), play: true };
  if (find) return { kind: "find", query: find[1].replace(/\s+in\s+(?:my\s+)?diary$/, "").trim() };
  return null;
}

// A message the sorting step sent to the diary with none of its fixed words: a
// question to search by ("which day did I meet Ravi?"), or else an entry to keep,
// without the words asking for that ("…, want to remember this in my diary").
export function asked(text: string): boolean {
  const t = text.trim();
  return /\?\s*$/.test(t) || /^(?:when|what|which|did|have|find|show|search|tell me|give me|read)\b/i.test(t);
}
export function entryFrom(text: string): string {
  return text
    .trim()
    .replace(/[,;.\s-]*(?:i\s+)?(?:want\s+to|wanna|please|pls)?\s*(?:remember|keep|save|store|put|note|write|add)\s+(?:this|it|that)?\s*(?:in|to|into)\s+(?:my\s+)?diary[.!]?\s*$/i, "")
    .replace(/^(?:please\s+)?(?:add|put|save|write|note)\s+(?:this\s+)?(?:in|to)\s+(?:my\s+)?diary\s*[:,\-–]?\s*/i, "")
    .trim();
}

// The words that reach the diary with no model call: an entry ("diary: …"), filing
// the latest recording ("diary"), the list, and searches that name the diary. A
// question such as "when did I dream about Appaji?" goes through the sorting step.
export function isDiaryText(text: string): boolean {
  const c = diaryCommand(text);
  if (!c) return false;
  if (c.kind === "find") return /\bdiary\b/i.test(text);
  return true;
}

// ─── Finding entries ─────────────────────────────────────────────────────────

const SMALL = new Set(["the", "a", "an", "i", "me", "my", "did", "do", "have", "had", "about", "of", "on", "in", "when", "what", "was", "were", "is", "ever", "write", "wrote", "diary", "entry", "note", "time", "last"]);
const stem = (w: string) => w.replace(/(ing|ed|es|s|t)$/, "");
const wordsOf = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !SMALL.has(w));

// Entries whose title or text holds the query's words, best first. "dream about
// Appaji" finds an entry titled "Appaji dream", and "dreamt" finds "dream".
export function matchEntries(entries: Entry[], query: string): Entry[] {
  const want = wordsOf(query).map(stem);
  if (!want.length) return [];
  return entries
    .map((e) => {
      const have = new Set(wordsOf(`${e.title} ${e.entry}`).map(stem));
      const titleWords = new Set(wordsOf(e.title).map(stem));
      const hits = want.filter((w) => have.has(w)).length;
      const inTitle = want.filter((w) => titleWords.has(w)).length;
      return { e, score: hits / want.length + inTitle * 0.1 };
    })
    // Every word of a short search, most of a longer one.
    .filter((x) => x.score >= (want.length <= 2 ? 1 : 0.6))
    .sort((a, b) => b.score - a.score || b.e.writtenOn.localeCompare(a.e.writtenOn))
    .map((x) => x.e);
}

export function inPeriod(on: string, period: Period, today: string): boolean {
  if (period === "all") return true;
  const day = 86_400_000;
  const t = Date.parse(today);
  const d = Date.parse(on);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Monday 0
  const weekStart = t - dow * day;
  if (period === "today") return on === today;
  if (period === "yesterday") return d === t - day;
  if (period === "week") return d >= weekStart && d <= t;
  if (period === "last_week") return d >= weekStart - 7 * day && d < weekStart;
  const ym = today.slice(0, 7);
  if (period === "month") return on.startsWith(ym);
  const prev = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
  return on.startsWith(prev);
}

// ─── The AI's part ───────────────────────────────────────────────────────────

export const TITLE_INSTRUCTIONS = `You prepare a personal diary entry. You are given its text, which may be in English or in another language. Reply with JSON only, no prose:
{"title": "...", "english": "...", "language": "..."}
- "title": two to five words naming what the entry is about, specific and plain ("Appaji dream", "Interview at Infosys", "Fight with Ravi"). No date, no quotation marks.
- "english": the whole entry in English, complete and faithful, in the first person as written. If it is already English, copy it as it is. Never summarise, shorten or add anything.
- "language": the language the text was in, in English ("Telugu", "Hindi", "English").`;

export const FIND_INSTRUCTIONS = `A person asks about their own diary. You are given their question and a list of entries, each with an id, a date, a title and the start of its text. Reply with JSON only: {"ids": ["…"]}, the ids of the entries that answer the question, best first, at most five; an empty list when none does. Choose by meaning, not only words: "the dream about my father" matches an entry about "Appaji" if it says he is the person's father.`;

function jsonIn(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readTitle(out: string | null): { title: string; english: string | null; language: string | null } | null {
  const o = out ? jsonIn(out) : null;
  const title = typeof o?.title === "string" ? o.title.trim().replace(/^["']|["']$/g, "").slice(0, 60) : "";
  if (!title) return null;
  const english = typeof o?.english === "string" && o.english.trim() ? o.english.trim() : null;
  const language = typeof o?.language === "string" && o.language.trim() ? o.language.trim() : null;
  return { title, english, language };
}

export function readIds(out: string | null): string[] {
  const o = out ? jsonIn(out) : null;
  return Array.isArray(o?.ids) ? (o!.ids as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 5) : [];
}

// A title from the first words, when the AI could not give one.
export function fallbackTitle(text: string): string {
  const words = text.replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 5);
  return words.length ? words.join(" ").replace(/^./, (c) => c.toUpperCase()) : "Diary entry";
}

// ─── Replies ─────────────────────────────────────────────────────────────────

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAY[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function clock(at: string): string {
  const m = at.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return at;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "am" : "pm"}`;
}

export function savedReply(e: { title: string; writtenOn: string; at: string; language: string | null; audio?: string | null }): string {
  const lang = e.language && !/^english$/i.test(e.language) ? `, translated from ${e.language}` : "";
  const audio = e.audio ? ` I've kept the recording too: "play the ${e.title}" to hear it.` : "";
  return `Saved in your diary: *${e.title}*, ${longDate(e.writtenOn)}${e.at ? `, ${clock(e.at)}` : ""}${lang}.${audio} Ask me about it any time, for example "when did I write about ${e.title.split(" ")[0]}?".`;
}

export function entryText(e: Entry, full = true): string {
  const head = `*${e.title}*${e.audio ? " 🎙" : ""}\n${longDate(e.writtenOn)}${e.at ? `, ${clock(e.at)}` : ""}${e.language && !/^english$/i.test(e.language) ? ` (spoken in ${e.language})` : ""}`;
  return full ? `${head}\n\n${e.entry}` : head;
}

export function foundReply(found: Entry[], query: string): string {
  if (!found.length) return `I couldn't find anything in your diary about "${query}". "my diary" lists your entries.`;
  if (found.length === 1) return `You wrote about it on ${longDate(found[0].writtenOn)}${found[0].at ? ` at ${clock(found[0].at)}` : ""}:\n\n${entryText(found[0])}`;
  const [first, ...rest] = found;
  return [`${found.length} entries fit. The latest:`, entryText(first), `Others: ${rest.map((e) => `${e.title} (${longDate(e.writtenOn)})`).join("; ")}. Ask about one by its title to read it.`].join("\n\n");
}

export const PERIOD_LABEL: Record<Period, string> = { today: " for today", yesterday: " for yesterday", week: " this week", last_week: " last week", month: " this month", last_month: " last month", all: "" };

// "my diary": the entries of the period, newest first, for Kelvi's numbered list
// (kit 0.5.0 replyList), or the reply when there are none.
export function diaryList(entries: Entry[], period: Period, today: string): { heading: string; items: { id: string; line: string }[]; add: string[]; verbs: string[] } | { text: string } {
  if (!entries.length) return { text: DIARY_HELP };
  const shown = entries.filter((e) => inPeriod(e.writtenOn, period, today)).sort((a, b) => b.writtenOn.localeCompare(a.writtenOn) || b.at.localeCompare(a.at));
  if (!shown.length) return { text: `Nothing in your diary${PERIOD_LABEL[period]}. "my diary" lists every entry.` };
  return {
    heading: `Your diary${PERIOD_LABEL[period]}`,
    items: shown.map((e) => ({ id: e.id, line: `*${e.title}*${e.audio ? " 🎙" : ""}, ${longDate(e.writtenOn)}` })),
    add: ["diary: last night I dreamt about Appaji", 'a voice note starting "diary"', 'forward a recording, then "diary"'],
    verbs: shown.some((e) => e.audio) ? ["show 2", "play 2", "rename 2 to …", "delete 2"] : ["show 2", "rename 2 to …", "delete 2"],
  };
}

// The list as plain text, for the bench and for tests.
export function listReply(entries: Entry[], period: Period, today: string): string {
  const l = diaryList(entries, period, today);
  if ("text" in l) return l.text;
  return [`*${l.heading}* (${l.items.length})`, l.items.slice(0, 20).map((i, x) => `${x + 1}. ${i.line}`).join("\n"), `Add one: ${l.add.map((a) => `"${a}"`).join(", ")}.`, `Reply with numbers: ${l.verbs.map((v) => `"${v}"`).join(", ")}.`].join("\n\n");
}

export const DIARY_HELP = [
  "*Diary*",
  '• Write one: start a voice note or a message with "diary": "Diary: last night I dreamt about Appaji…". I keep it with the date, the time and a title, in the language you spoke and in English, with your voice note.',
  '• From a recording: forward it, or send it as a file (📎, then Document). When I have sent you its text, reply "diary".',
  '• Add the recording to an entry that has none: send the recording again, then reply "store the audio file".',
  '• See them: "my diary", "my diary last week". Entries with a recording are marked 🎙.',
  '• Then by number: "show 2" (the text and the recording), "play 2" (the recording only), "rename 2 to …", "delete 2".',
  '• By name: "play the Appaji dream", "show my diary entry about Appaji".',
  '• Find one: "when did I dream about Appaji?", "what did I write about the interview?".',
].join("\n");

// Whether two texts are the same recording's words: the same once letters alone are
// compared, or one starting the other, so a transcript made again matches the entry
// made from it the first time.
export function sameWords(a: string, b: string): boolean {
  const k = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const x = k(a);
  const y = k(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const n = Math.min(160, x.length, y.length);
  return n >= 40 && x.slice(0, n) === y.slice(0, n);
}
