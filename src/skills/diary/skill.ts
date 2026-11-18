import { KIT_VERSION, type SkillManifest } from "../../kit";
import { handle } from "./handler";
import { DIARY_HELP, isDiaryText } from "./logic";

export const diary: SkillManifest = {
  key: "diary",
  title: "Diary",
  kit: KIT_VERSION,
  route: "diary",
  routeDescription:
    'the person\'s diary: an entry spoken or typed for it ("diary: last night I dreamt about Appaji", "dear diary, today was hard"), keeping a recording or text they just received in it ("diary", "store this in my diary", "put it in my diary"), keeping the recording itself with its entry ("store the audio file", "keep the original recording too"), and asking about what they wrote ("when did I dream about Appaji?", "what did I write about the interview?", "my diary last week", "find Appaji in my diary"), and hearing the recording of an entry again ("play the Appaji dream", "play my diary entry about Appaji"). A dated personal record of what happened or what they felt. Information to keep on a topic ("note on the Goa trip: …") is "notes"; something to do is "actions"; a question about a stored document is not this.',
  matches: isDiaryText,
  menu: {
    command: "diary",
    title: "Diary",
    description: "entries spoken or typed, found again by asking",
    runs: "my diary",
    howTo: DIARY_HELP,
    helpLine: 'Diary: start a voice note with "diary:"; ask "when did I dream about Appaji?".',
    aliases: ["diary", "journal", "dear diary"],
  },
  page: { icon: "✎", register: "skill_diary" },
  handle,
};
