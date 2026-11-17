import type { SkillContext } from "../../kit";
import { foundReply, hostOf, LINKS, LINKS_HELP, linkOf, linksCommand, listReply, match, ordered, pick, tagOf, tidyTitle } from "./logic";

// Links: reached by "my links" and the like, a message that is a link, and the
// sorting step.
export async function handle(ctx: SkillContext): Promise<void> {
  const reg = await ctx.registers.open(LINKS);
  const links = (await reg.list()).map(linkOf);
  const cmd = linksCommand(ctx.text);

  if (!cmd || cmd.kind === "help") return ctx.reply(LINKS_HELP);
  if (cmd.kind === "list") return ctx.reply(listReply(links, cmd.about));
  if (cmd.kind === "find") return ctx.reply(foundReply(match(links, cmd.words), cmd.words));

  if (cmd.kind === "save") {
    const lines: string[] = [];
    for (const url of cmd.urls) {
      const have = links.find((l) => l.url.replace(/\/+$/, "") === url.replace(/\/+$/, ""));
      if (have) {
        lines.push(`Already saved as *${have.name}*.`);
        continue;
      }
      const name = (cmd.urls.length === 1 && cmd.name) || tidyTitle((await ctx.web.title(url)) ?? "") || hostOf(url);
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
