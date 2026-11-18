import type { SkillContext, SkillDocument } from "../../kit";
import { asked, DIARY, DIARY_HELP, diaryCommand, entryFrom, entryOf, FIND_INSTRUCTIONS, fallbackTitle, foundReply, listReply, matchEntries, readIds, readTitle, savedReply, TITLE_INSTRUCTIONS, type Entry } from "./logic";

// Diary: reached by "diary: …", "diary" after a recording, "my diary", and the
// sorting step for questions such as "when did I dream about Appaji?".
export async function handle(ctx: SkillContext): Promise<void> {
  const reg = await ctx.registers.open(DIARY);
  const cmd = diaryCommand(ctx.text);

  if (cmd?.kind === "help") return ctx.reply(DIARY_HELP);
  if (cmd?.kind === "write") return write(ctx, reg, cmd.text, ctx.heard ? "Voice note" : "Typed");
  if (cmd?.kind === "file") {
    const doc = latest(await ctx.documents.recent(24 * 60, { transcripts: true }));
    if (!doc) return ctx.reply('Send or forward the recording first. When I have sent you its text, reply "diary" and I\'ll keep it in your diary.');
    return write(ctx, reg, doc.text, doc.kind === "document" ? "Typed" : "Recording");
  }

  // Sent here by the sorting step with none of the diary's words: an entry to keep,
  // unless it is a question.
  if (!cmd && !asked(ctx.text)) {
    const text = entryFrom(ctx.text);
    if (text.length > 1) return write(ctx, reg, text, ctx.heard ? "Voice note" : "Typed");
  }
  const entries = (await reg.list()).map(entryOf);
  if (cmd?.kind === "list") return ctx.reply(listReply(entries, cmd.period, ctx.person.today));
  const query = cmd?.kind === "find" ? cmd.query : ctx.text;
  if (!entries.length) return ctx.reply(`Your diary is empty. ${DIARY_HELP.split("\n")[1].slice(2)}`);
  let found = matchEntries(entries, query);
  // By meaning, when the words alone find nothing ("the dream about my father").
  if (!found.length) {
    const list = entries
      .sort((a, b) => b.writtenOn.localeCompare(a.writtenOn))
      .slice(0, 150)
      .map((e) => `${e.id} | ${e.writtenOn} | ${e.title} | ${e.entry.slice(0, 160).replace(/\s+/g, " ")}`)
      .join("\n");
    const out = await ctx.ai.read({ operation: "diary_find", instructions: FIND_INSTRUCTIONS, text: `Question: ${ctx.text}\n\nEntries:\n${list}` });
    if (out === null) return;
    const ids = readIds(out);
    found = ids.map((id) => entries.find((e) => e.id === id)).filter((e): e is Entry => !!e);
  }
  return ctx.reply(foundReply(found, query));
}

// Keeps an entry: saved at once with a plain title, so nothing is lost if the AI
// cannot run, then given its English text and a title by the AI.
async function write(ctx: SkillContext, reg: Awaited<ReturnType<SkillContext["registers"]["open"]>>, text: string, source: "Voice note" | "Recording" | "Typed"): Promise<void> {
  const heard = source === "Voice note" ? ctx.heard ?? null : null;
  text = text.trim().replace(/^./u, (c) => c.toUpperCase());
  const rec = await reg.add({
    title: fallbackTitle(text),
    entry: text,
    written_on: ctx.person.today,
    at: ctx.person.now,
    language: heard?.language ?? "",
    // The spoken "diary:" taken off the original too, in whatever language it was said.
    original: heard?.original.replace(/^\s*[^\s:：,]{1,20}(?:\s+[^\s:：,]{1,20})?\s*[:：,]\s*/u, "") ?? "",
    source,
  });
  const out = await ctx.ai.read({ operation: "diary_title", instructions: TITLE_INSTRUCTIONS, text });
  const t = readTitle(out);
  // A voice note arrives already in English (Kelvi translated it); a recording or a
  // typed entry may not, and is kept in the original with its English translation.
  const translated = !heard && t?.english && t.language && !/^english$/i.test(t.language);
  const patch: Record<string, unknown> = {};
  if (t) patch.title = t.title;
  if (translated) {
    patch.entry = t!.english;
    patch.original = text;
    patch.language = t!.language;
  }
  if (Object.keys(patch).length) await reg.update(rec.id, patch);
  const entry = entryOf({ ...rec, data: { ...rec.data, ...patch } });
  // When the AI could not run, Kelvi has already said why; the entry is still kept.
  if (out === null) return ctx.reply(`Saved in your diary with the title "${entry.title}". I couldn't read it with the AI just now, so it isn't translated or titled properly.`);
  return ctx.reply(savedReply(entry));
}

// The latest thing to keep: a transcript or its translation before a document.
function latest(docs: SkillDocument[]): SkillDocument | null {
  const withText = docs.filter((d) => d.text.trim());
  return withText.find((d) => d.kind === "translation") ?? withText.find((d) => d.kind === "transcript") ?? withText[0] ?? null;
}
