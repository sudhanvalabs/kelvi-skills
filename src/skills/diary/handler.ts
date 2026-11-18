import type { SkillContext, SkillDocument, SkillPicked } from "../../kit";
import { asked, sameWords, DIARY, DIARY_HELP, diaryCommand, diaryList, entryFrom, entryOf, entryText, FIND_INSTRUCTIONS, fallbackTitle, foundReply, matchEntries, readIds, readTitle, savedReply, TITLE_INSTRUCTIONS, type Entry } from "./logic";

// Diary: reached by "diary: …", "diary" after a recording, "my diary", and the
// sorting step for questions such as "when did I dream about Appaji?".
export async function handle(ctx: SkillContext): Promise<void> {
  const reg = await ctx.registers.open(DIARY);
  if (ctx.picked) return picked(ctx, reg, ctx.picked);
  const cmd = diaryCommand(ctx.text);

  if (cmd?.kind === "help") return ctx.reply(DIARY_HELP);
  if (cmd?.kind === "write") return write(ctx, reg, cmd.text, ctx.heard ? "Voice note" : "Typed");
  if (cmd?.kind === "file") {
    const doc = latest(await ctx.documents.recent(24 * 60, { transcripts: true }));
    if (!doc) return ctx.reply('Send or forward the recording first. When I have sent you its text, reply "diary" and I\'ll keep it in your diary.');
    return write(ctx, reg, doc.text, doc.kind === "document" ? "Typed" : "Recording", doc);
  }

  // Sent here by the sorting step with none of the diary's words: an entry to keep,
  // unless it is a question.
  if (!cmd && !asked(ctx.text)) {
    const text = entryFrom(ctx.text);
    if (text.length > 1) return write(ctx, reg, text, ctx.heard ? "Voice note" : "Typed");
  }
  const play = cmd?.kind === "find" && cmd.play === true;
  const entries = (await reg.list()).map(entryOf);
  if (cmd?.kind === "list") {
    const l = diaryList(entries, cmd.period, ctx.person.today);
    return "text" in l ? ctx.reply(l.text) : ctx.replyList(l);
  }
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
  await ctx.reply(foundReply(found, query));
  // The recording itself, as it was told: the entry asked to be played, or the one
  // entry found.
  const hear = play ? found.slice(0, 1) : found.length === 1 ? found : [];
  for (const e of hear) {
    if (e.audio) await ctx.documents.send(e.audio, `🎙 ${e.title}`);
    else if (play) await ctx.reply(`I don't have a recording of *${e.title}*; it was typed, or kept before I saved recordings.`);
  }
}

// Keeps an entry: saved at once with a plain title, so nothing is lost if the AI
// cannot run, then given its English text and a title by the AI.
async function write(ctx: SkillContext, reg: Awaited<ReturnType<SkillContext["registers"]["open"]>>, text: string, source: "Voice note" | "Recording" | "Typed", doc?: SkillDocument): Promise<void> {
  const heard = source === "Voice note" ? ctx.heard ?? null : null;
  text = text.trim().replace(/^./u, (c) => c.toUpperCase());
  // The same recording kept again ("diary" twice, or sent again to add its audio):
  // the entry it already made is brought up to date, not copied.
  const earlier = source === "Recording" ? (await reg.list()).find((r) => [r.data.entry, r.data.original].some((v) => typeof v === "string" && sameWords(v, text))) : undefined;
  // The recording itself, kept in the person's stored documents (folder Diary).
  const keepAs = { folder: "Diary", subfolder: null, title: fallbackTitle(text), kind: "Recording", date: ctx.person.today };
  const keepAudio = () => (source === "Voice note" ? ctx.documents.keepVoiceNote(keepAs) : doc && source === "Recording" ? ctx.documents.keep(doc, keepAs) : Promise.resolve(null));
  if (earlier) {
    const e = entryOf(earlier);
    const audio = e.audio ? null : await keepAudio();
    if (audio) {
      await reg.update(earlier.id, { audio });
      return ctx.reply(`*${e.title}* was already in your diary; I've added its recording, so you can hear it again: "play the ${e.title}".`);
    }
    return ctx.reply(`*${e.title}* is already in your diary, from ${e.writtenOn}.`);
  }
  const audio = await keepAudio();
  const rec = await reg.add({
    title: fallbackTitle(text),
    entry: text,
    written_on: ctx.person.today,
    at: ctx.person.now,
    language: heard?.language ?? "",
    // The spoken "diary:" taken off the original too, in whatever language it was said.
    original: heard?.original.replace(/^\s*[^\s:：,]{1,20}(?:\s+[^\s:：,]{1,20})?\s*[:：,]\s*/u, "") ?? "",
    source,
    audio: audio ?? "",
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

// The latest thing to keep: a recording's transcript, in the language it was told
// (the entry is kept in English with it, and the recording found through it), before
// Kelvi's translation of it, before a document.
function latest(docs: SkillDocument[]): SkillDocument | null {
  const withText = docs.filter((d) => d.text.trim());
  return withText.find((d) => d.kind === "transcript") ?? withText.find((d) => d.kind === "translation") ?? withText[0] ?? null;
}

// A reply by number to "my diary" (kit 0.5.0): show, play, rename or delete the
// entries picked. A delete has been confirmed by the person already.
async function picked(ctx: SkillContext, reg: Awaited<ReturnType<SkillContext["registers"]["open"]>>, p: SkillPicked): Promise<void> {
  const all = (await reg.list()).map(entryOf);
  const chosen = p.ids.map((id) => all.find((e) => e.id === id)).filter((e): e is Entry => !!e);
  if (!chosen.length) return ctx.reply('That entry is no longer in your diary. "my diary" lists what is.');
  switch (p.verb) {
    case "show":
    case "send":
      for (const e of chosen) {
        await ctx.reply(entryText(e));
        if (e.audio) await ctx.documents.send(e.audio, `🎙 ${e.title}`);
      }
      return;
    case "play":
      for (const e of chosen) {
        if (e.audio) await ctx.documents.send(e.audio, `🎙 ${e.title}`);
        else await ctx.reply(`I don't have a recording of *${e.title}*; it was typed, or kept before I saved recordings.`);
      }
      return;
    case "rename": {
      if (chosen.length > 1 || !p.target) return ctx.reply('Rename one at a time, for example "rename 2 to Appaji dream".');
      const title = p.target.trim().slice(0, 80);
      await reg.update(chosen[0].id, { title });
      return ctx.reply(`Renamed to *${title}*.`);
    }
    case "delete":
      for (const e of chosen) await reg.remove(e.id);
      return ctx.reply(chosen.length === 1 ? `Deleted *${chosen[0].title}* from your diary.` : `Deleted ${chosen.length} entries from your diary: ${chosen.map((e) => e.title).join(", ")}.`);
    default:
      return ctx.reply('Reply with numbers: "show 2", "play 2", "rename 2 to …", "delete 2".');
  }
}
