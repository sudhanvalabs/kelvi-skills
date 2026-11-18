import { test } from "node:test";
import assert from "node:assert/strict";
import { asked, diaryCommand, entryFrom, fallbackTitle, inPeriod, isDiaryText, matchEntries, readTitle, type Entry } from "../src/skills/diary/logic";
import { bench } from "../bench/bench";

test("what the person wrote is read", () => {
  assert.deepEqual(diaryCommand("Diary: last night I dreamt about Grandma"), { kind: "write", text: "last night I dreamt about Grandma" });
  assert.deepEqual(diaryCommand("dear diary, today was hard"), { kind: "write", text: "today was hard" });
  assert.deepEqual(diaryCommand("diary"), { kind: "file" });
  assert.deepEqual(diaryCommand("store this in my diary"), { kind: "file" });
  assert.deepEqual(diaryCommand("put it in my diary"), { kind: "file" });
  assert.deepEqual(diaryCommand("my diary"), { kind: "list", period: "all" });
  assert.deepEqual(diaryCommand("my diary last week"), { kind: "list", period: "last_week" });
  assert.deepEqual(diaryCommand("when did I dream about Grandma?"), { kind: "find", query: "dream about grandma" });
  assert.deepEqual(diaryCommand("what did I write about the interview?"), { kind: "find", query: "the interview" });
  assert.deepEqual(diaryCommand("find Grandma in my diary"), { kind: "find", query: "grandma" });
  assert.equal(diaryCommand("remind me to call Grandma"), null);
});

test("only the diary's own words skip the sorting step", () => {
  assert.ok(isDiaryText("diary: had a long day") && isDiaryText("diary") && isDiaryText("my diary") && isDiaryText("find Grandma in my diary"));
  assert.ok(!isDiaryText("when did I dream about Grandma?"), "a question without the word diary goes through the sorting step");
  assert.ok(!isDiaryText("note: the wifi password is …"));
});

test("an entry is found by its words, a dream by dreamt", () => {
  const e = (id: string, title: string, entry: string, on: string): Entry => ({ id, title, entry, writtenOn: on, at: "21:00", language: null, original: null, audio: null });
  const all = [e("1", "Grandma dream", "Last night I dreamt Grandma was smiling at the old house.", "2026-11-10"), e("2", "Interview at Infosys", "The interview went well.", "2026-11-12"), e("3", "Temple visit", "Went to the temple with Grandma's photo.", "2026-11-15")];
  assert.deepEqual(matchEntries(all, "dream about grandma").map((x) => x.id), ["1"]);
  assert.deepEqual(matchEntries(all, "the interview").map((x) => x.id), ["2"]);
  assert.deepEqual(matchEntries(all, "grandma").map((x) => x.id), ["1", "3"]);
  assert.deepEqual(matchEntries(all, "holiday in goa"), []);
});

test("periods, titles and the AI's answer", () => {
  assert.ok(inPeriod("2026-11-17", "week", "2026-11-18") && !inPeriod("2026-11-15", "week", "2026-11-18") && inPeriod("2026-11-15", "last_week", "2026-11-18") && inPeriod("2026-10-03", "last_month", "2026-11-18"));
  assert.equal(fallbackTitle("last night, I dreamt about Grandma at home"), "Last night I dreamt about");
  assert.deepEqual(readTitle('{"title":"Grandma dream","english":"I dreamt about Grandma.","language":"Telugu"}'), { title: "Grandma dream", english: "I dreamt about Grandma.", language: "Telugu" });
  assert.equal(readTitle("no json"), null);
});

test("on the bench: a voice note in Telugu, a forwarded recording, and finding them", async () => {
  const b = bench({
    today: "2026-11-18",
    now: "21:42",
    heard: { language: "Telugu", original: "డైరీ: నిన్న రాత్రి అమ్మమ్మ కలలో వచ్చారు" },
    docs: [{ id: "t1", filename: "Recording.opus", text: "ఈరోజు ఇంటర్వ్యూ బాగా జరిగింది", sentAt: new Date().toISOString(), storedId: null, kind: "transcript" }],
    ai: (op, text) =>
      op === "diary_title"
        ? text.includes("Grandma")
          ? '{"title":"Grandma dream","english":"Last night Grandma came in my dream.","language":"English"}'
          : '{"title":"Interview went well","english":"Today the interview went well.","language":"Telugu"}'
        : '{"ids":[]}',
  });
  assert.match((await b.send("Diary: last night Grandma came in my dream", "diary"))[0], /^Saved in your diary: \*Grandma dream\*, Wed 18 Nov 2026, 9:42 pm, translated from Telugu\./);
  const first = b.registers.get("skill_diary")![0];
  assert.equal(first.data.language, "Telugu");
  assert.equal(first.data.original, "నిన్న రాత్రి అమ్మమ్మ కలలో వచ్చారు");
  assert.match((await b.send("diary", "diary"))[0], /^Saved in your diary: \*Interview went well\*.*translated from Telugu/);
  const second = b.registers.get("skill_diary")![1];
  assert.equal(second.data.entry, "Today the interview went well.");
  assert.equal(second.data.original, "ఈరోజు ఇంటర్వ్యూ బాగా జరిగింది");
  const found = (await b.send("when did I dream about Grandma?", "diary"))[0];
  assert.match(found, /^You wrote about it on Wed 18 Nov 2026 at 9:42 pm:/);
  assert.match(found, /Last night Grandma came in my dream/);
  assert.match((await b.send("my diary", "diary"))[0], /^\*Your diary\* \(2\)/);
  assert.match((await b.send("what did I write about the holiday in Goa?", "diary"))[0], /couldn't find anything/);
});

test("an entry is told from a question when the sorting step sends one", () => {
  assert.ok(asked("when did I dream about Grandma?") && asked("which day did I meet Ravi") && !asked("Today I felt really happy after the call with mom"));
  assert.equal(entryFrom("Today I felt really happy after the call with mom, want to remember this in my diary"), "Today I felt really happy after the call with mom");
  assert.equal(entryFrom("add this to my diary: the kids won the match"), "the kids won the match");
});

test("my diary in other words", () => {
  for (const t of ["my diary", "My diaries", "show diary", "show my diary", "open the diary", "diary entries", "my diary entries", "list my diary", "my journal"]) assert.equal(diaryCommand(t)?.kind, "list", t);
  assert.deepEqual(diaryCommand("my diary last week"), { kind: "list", period: "last_week" });
});

test("play an entry", () => {
  assert.deepEqual(diaryCommand("play the Grandma dream"), { kind: "find", query: "grandma dream", play: true });
  assert.deepEqual(diaryCommand("play my diary entry about Grandma"), { kind: "find", query: "grandma", play: true });
  assert.equal(isDiaryText("play the Grandma dream from my diary"), true);
  assert.equal(isDiaryText("play some music"), false);
});

test("a recording kept in the diary keeps its audio, once, and plays", async () => {
  const { bench } = await import("../bench/bench");
  const doc = { id: "t1", filename: "Transcript", text: "ఐటీఎస్ అ బిగ్ హాల్", sentAt: new Date().toISOString(), storedId: null, kind: "transcript" as const };
  const ai = (op: string) => (op === "diary_title" ? JSON.stringify({ title: "Grandma dream", language: "Telugu", english: "It's a big hall" }) : "[]");
  const b = bench({ docs: [doc], ai, today: "2026-11-18" });
  const saved = await b.send("diary", "diary");
  assert.match(saved.join("\n"), /kept the recording too/);
  const again = await b.send("diary", "diary");
  assert.match(again.join("\n"), /already in your diary/);
  const list = await b.send("my diary", "diary");
  assert.match(list.join("\n"), /Grandma dream\* 🎙/);
  const played = await b.send("play the Grandma dream", "diary");
  assert.match(played.join("\n"), /\[file stored-t1: 🎙 Grandma dream\]/);
});

test("after my diary, entries are picked by number", async () => {
  const { bench } = await import("../bench/bench");
  const doc = { id: "t1", filename: "Transcript", text: "ఐటీఎస్ అ బిగ్ హాల్", sentAt: new Date().toISOString(), storedId: null, kind: "transcript" as const };
  const ai = (op: string, t: string) => (op !== "diary_title" ? "[]" : /interview/i.test(t) ? JSON.stringify({ title: "The interview", language: "English", english: t }) : JSON.stringify({ title: "Grandma dream", language: "Telugu", english: "It's a big hall" }));
  const b = bench({ docs: [doc], ai, today: "2026-11-18" });
  await b.send("diary", "diary");
  await b.send("diary: the interview went well", "diary");
  const list = (await b.send("my diary", "diary")).join("\n");
  assert.match(list, /Reply with numbers: "show 2", "play 2"/);
  // Both written the same minute, so in the order kept: the recording is 1.
  assert.match((await b.pick("play", [1], null, "diary")).join("\n"), /\[file stored-t1: 🎙 Grandma dream\]/);
  assert.match((await b.pick("play", [2], null, "diary")).join("\n"), /don't have a recording/);
  assert.match((await b.pick("rename", [1], "Dream of Grandma", "diary")).join("\n"), /Renamed to \*Dream of Grandma\*/);
  assert.match((await b.pick("delete", [2], null, "diary")).join("\n"), /Deleted \*The interview/);
  assert.equal(b.registers.get("skill_diary")!.length, 1);
});

test("store the audio file is keeping the recording; the same recording kept again is one entry", async () => {
  for (const t of ["store audio file", "Store the audio file", "keep the original recording too", "save the audio in my diary", "add the recording to the entry"]) assert.deepEqual(diaryCommand(t), { kind: "file" }, t);
  const { sameWords } = await import("../src/skills/diary/logic");
  assert.ok(sameWords("ఐటీఎస్ అ బిగ్ హాల్ ఒకే అండ్ అక్కడ పీపుల్ ఆర్ అసెంబుల్డ్ దేర్ అండ్ అమ్మమ్మ వాస్ దేర్", "ఐటీఎస్ అ బిగ్ హాల్, ఒకే, అండ్ అక్కడ పీపుల్ ఆర్ అసెంబుల్డ్ దేర్ అండ్ అమ్మమ్మ వాస్ దేర్!"));
  assert.ok(!sameWords("The interview went well", "The interview went badly today"));
  const { bench } = await import("../bench/bench");
  const sent = new Date().toISOString();
  const docs = [
    { id: "tr", filename: "Transcript, in English", text: "It's a big hall", sentAt: sent, storedId: "text-doc", kind: "translation" as const },
    { id: "t1", filename: "Transcript", text: "ఐటీఎస్ అ బిగ్ హాల్ ఒకే అండ్ అక్కడ పీపుల్ ఆర్ అసెంబుల్డ్ దేర్", sentAt: sent, storedId: null, kind: "transcript" as const },
  ];
  const ai = () => JSON.stringify({ title: "Grandma dream", language: "Telugu", english: "It's a big hall" });
  const b = bench({ docs, ai, today: "2026-11-18" });
  await b.send("diary", "diary");
  const e = b.registers.get("skill_diary")![0].data;
  assert.equal(e.original, docs[1].text, "the Telugu kept as the original");
  assert.equal(e.audio, "stored-t1", "the recording kept through the transcript, not the stored translation");
  assert.match((await b.send("store the audio file", "diary"))[0], /already in your diary/);
  assert.equal(b.registers.get("skill_diary")!.length, 1);
});

test("deleting an entry deletes its recording; a recording deleted elsewhere is forgotten", async () => {
  const { bench } = await import("../bench/bench");
  const doc = { id: "t1", filename: "Transcript", text: "ఐటీఎస్ అ బిగ్ హాల్ ఒకే అండ్ అక్కడ పీపుల్ ఆర్ అసెంబుల్డ్", sentAt: new Date().toISOString(), storedId: null, kind: "transcript" as const };
  const ai = () => JSON.stringify({ title: "Grandma dream", language: "Telugu", english: "It's a big hall" });
  const b = bench({ docs: [doc], ai, today: "2026-11-18" });
  await b.send("diary", "diary");
  await b.send("my diary", "diary");
  const out = (await b.pick("delete", [1], null, "diary")).join("\n");
  assert.match(out, /\[removed stored-t1\]/);
  assert.match(out, /Deleted \*Grandma dream\* and its recording from your diary/);
  assert.equal(b.registers.get("skill_diary")!.length, 0);
  // A recording the person deleted in My documents: the send fails, the link goes.
  b.registers.get("skill_diary")!.push({ id: "x", data: { title: "Old one", entry: "text", written_on: "2026-11-18", audio: "gone" }, createdAt: new Date().toISOString() });
  await b.send("my diary", "diary");
  const played = (await b.pick("play", [1], null, "diary")).join("\n");
  assert.match(played, /no longer in your documents/);
  assert.equal(b.registers.get("skill_diary")![0].data.audio, "");
});

test("a search of the diary is read with the conversation just before", async () => {
  const { bench } = await import("../bench/bench");
  const seen: string[] = [];
  const b = bench({ today: "2026-11-18", recent: "Person: I dreamt of the beach house again\nKelvi: Saved in your diary: *Beach house dream*", ai: (op, t) => (seen.push(`${op}: ${t}`), op === "diary_title" ? JSON.stringify({ title: "Beach house dream", language: "English", english: "" }) : '{"ids":[]}') });
  await b.send("diary: I dreamt of the beach house again", "diary");
  await b.send("when did I write about that before?", "diary");
  assert.ok(seen.some((s) => s.startsWith("diary_find:") && s.includes("beach house again")), "the search saw the conversation");
  assert.ok(seen.every((s) => !s.startsWith("diary_title:") || !s.includes("Kelvi:")), "a title is read without it");
});
