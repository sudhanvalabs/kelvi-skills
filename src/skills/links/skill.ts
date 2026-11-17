import { KIT_VERSION, type SkillManifest } from "../../kit";
import { handle } from "./handler";
import { isLinksText, LINKS_HELP } from "./logic";

export const links: SkillManifest = {
  key: "links",
  title: "Links",
  kit: KIT_VERSION,
  route: "links",
  routeDescription:
    'the person\'s saved links: saving one by sending it, with or without a name ("my Google Meet link: meet.google.com/abc-defg-hij", "save this https://…", a link on its own), getting one back ("send me my Meet link", "the link to the Kelvi post", "what\'s my Zoom link?"), listing them ("my links", "my links about AI"), or renaming or deleting one ("rename 3 to Team standup", "delete the Zoom link"). A link with an instruction to do something with the page, such as "summarise this article" or "review this", is "work"; a link as part of a reminder ("remind me to read https://… tomorrow") is "actions".',
  matches: isLinksText,
  menu: {
    command: "links",
    title: "Links",
    description: "your Meet link, websites and posts, saved",
    runs: "my links",
    howTo: LINKS_HELP,
    helpLine: 'Links: send me a link to save it; "send me my Meet link" gets it back.',
    aliases: ["link", "links", "bookmarks", "saved links"],
  },
  handle,
};
