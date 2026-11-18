import type { SkillContext, SkillPicked } from "../../kit";
import { foundReply, hostOf, LINKS, LINKS_HELP, linkOf, linksCommand, linksList, match, ordered, pick, tagOf, tidyTitle, type Link } from "./logic";

// Links: reached by "my links" and the like, a message that is a link, and the
// sorting step.
export async function handle(ctx: SkillContext): Promise<void> {
  const reg = await ctx.registers.open(LINKS);
  const links = (await reg.list()).map(linkOf);
  if (ctx.picked) return picked(ctx, reg, links, ctx.picked);
  const cmd = linksCommand(ctx.text);

  if (!cmd || cmd.kind === "help") return ctx.reply(LINKS_HELP);
  if (cmd.kind === "list") {
    const l = linksList(links, cmd.about);
    return "text" in l ? ctx.reply(l.text) : ctx.replyList(l);
  }
  if (cmd.kind === "find") return ctx.reply(foundReply(match(links, cmd.words), cmd.words));

  if (cmd.kind === "save") {
    const lines: string[] = [];
    for (const url of cmd.urls) {
      const have = links.find((l) => l.url.replace(/\/+$/, "") === url.replace(/\/+$/, ""));
      if (have) {
        lines.push(`Already saved as *${have.name}*.`);
        continue;
      }
      const name = (cmd.urls.length === 1 && cmd.name) || tidyTitle((await ctx.web.title(url)) ?? "", url) || hostOf(url);
      const rec = await reg.add({ name, url, tag: tagOf(url), saved_on: ctx.person.today });
      links.push(linkOf(rec));
      lines.push(`Saved *${name}*${tagOf(url) === "Websites" ? "" : ` (${tagOf(url).toLowerCase()})`}.`);
    }
    const tail = cmd.urls.length === 1 && !cmd.name ? ' To name it yourself, "rename 1 to …".' : "";
    return ctx.reply(`${lines.join("\n")}${tail} "my links" lists them.`);
  }

  const found = pick(links, cmd.which);
  if (!found.length) return ctx.reply(`I couldn't find a saved link for "${cmd.which}". "my links" lists them, numbered.`);
  if (found.length > 1) return ctx.reply(`Which one? ${found.slice(0, 5).map((l) => `${ordered(links).indexOf(l) + 1}. ${l.name}`).join("; ")}. Write its number, for example "${cmd.kind} ${ordered(links).indexOf(found[0]) + 1}${cmd.kind === "rename" ? ` to ${cmd.to}` : ""}".`);
  const l = found[0];
  if (cmd.kind === "delete") {
    await reg.remove(l.id);
    return ctx.reply(`Deleted *${l.name}*.`);
  }
  await reg.update(l.id, { name: cmd.to });
  return ctx.reply(`Renamed *${l.name}* to *${cmd.to}*.`);
}

// A reply by number to "my links" (kit 0.5.0): show, rename or delete the links
// picked. A delete has been confirmed by the person already.
async function picked(ctx: SkillContext, reg: Awaited<ReturnType<SkillContext["registers"]["open"]>>, links: Link[], p: SkillPicked): Promise<void> {
  const chosen = p.ids.map((id) => links.find((l) => l.id === id)).filter((l): l is Link => !!l);
  if (!chosen.length) return ctx.reply('That link is no longer saved. "my links" lists them.');
  if (p.verb === "show" || p.verb === "send") return ctx.reply(chosen.map((l) => `*${l.name}*\n${l.url}`).join("\n\n"));
  if (p.verb === "rename") {
    if (chosen.length > 1 || !p.target) return ctx.reply('Rename one at a time, for example "rename 2 to Team Meet".');
    await reg.update(chosen[0].id, { name: p.target.slice(0, 80) });
    return ctx.reply(`Renamed *${chosen[0].name}* to *${p.target.slice(0, 80)}*.`);
  }
  if (p.verb === "delete") {
    for (const l of chosen) await reg.remove(l.id);
    return ctx.reply(`Deleted ${chosen.map((l) => `*${l.name}*`).join(", ")}.`);
  }
  return ctx.reply('Reply with numbers: "show 2", "rename 2 to …", "delete 2".');
}
