// The test bench: a stand-in Kelvi with no WhatsApp, no Forge and no database.
// Registers live in memory, replies are printed, the date can be set, and the web
// and the AI give fixed answers unless told otherwise.
//
//   npm run try -- links "my Meet link: meet.google.com/abc-defg-hij" "my links" "send me my meet link"
//   npm run try -- links --today 2026-11-20 --web "https://example.com=Example Domain" "https://example.com"
//
// Each message after the skill's key is sent in turn, with the same registers, as
// one person writing to Kelvi.
import { SKILLS } from "../src/index";
import type { RegisterDef, SkillContext, SkillRecord, SkillRegister } from "../src/kit";

export interface Bench {
  send(text: string, key?: string): Promise<string[]>;
  registers: Map<string, SkillRecord[]>;
  actions: { what: string; due: string }[];
}

export function bench(
  o: {
    today?: string;
    now?: string;
    titles?: Record<string, string>;
    ai?: (operation: string, text: string) => string | null;
    liveWeb?: boolean;
    heard?: { language: string; original: string } | null;
    docs?: import("../src/kit").SkillDocument[];
  } = {},
): Bench {
  const registers = new Map<string, SkillRecord[]>();
  const actions: { what: string; due: string }[] = [];
  let n = 0;
  const open = async (def: RegisterDef): Promise<SkillRegister> => {
    if (!registers.has(def.type)) registers.set(def.type, []);
    const rows = registers.get(def.type)!;
    return {
      id: def.type,
      list: async () => rows.map((r) => ({ ...r, data: { ...r.data } })),
      add: async (data) => {
        const r = { id: `r${++n}`, data: { ...data }, createdAt: new Date(Date.now() + n).toISOString() };
        rows.push(r);
        return { ...r, data: { ...r.data } };
      },
      update: async (id, patch) => {
        const r = rows.find((x) => x.id === id);
        if (r) r.data = { ...r.data, ...patch };
      },
      remove: async (id) => {
        const i = rows.findIndex((x) => x.id === id);
        if (i >= 0) rows.splice(i, 1);
      },
    };
  };
  return {
    registers,
    actions,
    send: async (text, key) => {
      const out: string[] = [];
      // The skill named, else the one whose fixed words the message is, else the first.
      const skill = SKILLS.find((s) => s.key === key) ?? SKILLS.find((s) => s.matches(text)) ?? SKILLS[0];
      const ctx: SkillContext = {
        text,
        person: { userId: "bench-user", orgId: "bench-org", firstName: "Priya", today: o.today ?? new Date().toISOString().slice(0, 10), now: o.now ?? "21:30", timezone: "Asia/Kolkata" },
        heard: o.heard ?? null,
        reply: async (t) => {
          out.push(t);
        },
        ai: { read: async ({ operation, text: t }) => o.ai?.(operation, t) ?? null },
        registers: { open },
        documents: { recent: async (_m, opt) => (o.docs ?? []).filter((d) => opt?.transcripts || (d.kind ?? "document") === "document"), keep: async () => null },
        actions: { add: async (what, due) => void actions.push({ what, due }) },
        rates: { inr: async (c) => (c === "INR" ? 1 : null) },
        web: {
          title: async (url) => {
            if (o.titles && url in o.titles) return o.titles[url];
            if (!o.liveWeb) return null;
            try {
              const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
              return (await res.text()).match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
            } catch {
              return null;
            }
          },
        },
      };
      await skill.handle(ctx);
      return out;
    },
  };
}

// From the command line.
if (process.argv[1]?.endsWith("bench.ts")) {
  const args = process.argv.slice(2);
  const key = args.shift();
  const skill = SKILLS.find((s) => s.key === key);
  if (!skill) {
    console.error(`Name a skill: ${SKILLS.map((s) => s.key).join(", ")}`);
    process.exit(1);
  }
  let today: string | undefined;
  const titles: Record<string, string> = {};
  let liveWeb = false;
  const messages: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--today") today = args[++i];
    else if (args[i] === "--web") {
      const [u, t] = args[++i].split(/=(.*)/s);
      titles[u] = t;
    } else if (args[i] === "--live-web") liveWeb = true;
    else messages.push(args[i]);
  }
  const b = bench({ today, titles, liveWeb });
  for (const m of messages) {
    console.log(`\n> ${m}${skill.matches(m) ? "" : "   (not one of this skill's fixed words: on WhatsApp the sorting step decides)"}`);
    for (const r of await b.send(m, skill.key)) console.log(r);
  }
}
