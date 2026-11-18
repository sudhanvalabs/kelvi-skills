import { test } from "node:test";
import assert from "node:assert/strict";
import { asked, diaryCommand, entryFrom, fallbackTitle, inPeriod, isDiaryText, matchEntries, readTitle, type Entry } from "../src/skills/diary/logic";
import { bench } from "../bench/bench";

test("what the person wrote is read", () => {
  assert.deepEqual(diaryCommand("Diary: last night I dreamt about Appaji"), { kind: "write", text: "last night I dreamt about Appaji" });
  assert.deepEqual(diaryCommand("dear diary, today was hard"), { kind: "write", text: "today was hard" });
  assert.deepEqual(diaryCommand("diary"), { kind: "file" });
  assert.deepEqual(diaryCommand("store this in my diary"), { kind: "file" });
  assert.deepEqual(diaryCommand("put it in my diary"), { kind: "file" });
  assert.deepEqual(diaryCommand("my diary"), { kind: "list", period: "all" });
  assert.deepEqual(diaryCommand("my diary last week"), { kind: "list", period: "last_week" });
  assert.deepEqual(diaryCommand("when did I dream about Appaji?"), { kind: "find", query: "dream about appaji" });
  assert.deepEqual(diaryCommand("what did I write about the interview?"), { kind: "find", query: "the interview" });
  assert.deepEqual(diaryCommand("find Appaji in my diary"), { kind: "find", query: "appaji" });
  assert.equal(diaryCommand("remind me to call Appaji"), null);
});

test("only the diary's own words skip the sorting step", () => {
  assert.ok(isDiaryText("diary: had a long day") && isDiaryText("diary") && isDiaryText("my diary") && isDiaryText("find Appaji in my diary"));
  assert.ok(!isDiaryText("when did I dream about Appaji?"), "a question without the word diary goes through the sorting step");
  assert.ok(!isDiaryText("note: the wifi password is …"));
});

test("an entry is found by its words, a dream by dreamt", () => {
  const e = (id: string, title: string, entry: string, on: string): Entry => ({ id, title, entry, writtenOn: on, at: "21:00", language: null, original: null, audio: null });
  const all = [e("1", "Appaji dream", "Last night I dreamt Appaji was smiling at the old house.", "2026-11-10"), e("2", "Interview at Infosys", "The interview went well.", "2026-11-12"), e("3", "Temple visit", "Went to the temple with Appaji's photo.", "2026-11-15")];
  assert.deepEqual(matchEntries(all, "dream about appaji").map((x) => x.id), ["1"]);
  assert.deepEqual(matchEntries(all, "the interview").map((x) => x.id), ["2"]);
  assert.deepEqual(matchEntries(all, "appaji").map((x) => x.id), ["1", "3"]);
  assert.deepEqual(matchEntries(all, "holiday in goa"), []);
});

test("periods, titles and the AI's answer", () => {
  assert.ok(inPeriod("2026-11-17", "week", "2026-11-18") && !inPeriod("2026-11-15", "week", "2026-11-18") && inPeriod("2026-11-15", "last_week", "2026-11-18") && inPeriod("2026-10-03", "last_month", "2026-11-18"));
  assert.equal(fallbackTitle("last night, I dreamt about Appaji at home"), "Last night I dreamt about");
  assert.deepEqual(readTitle('{"title":"Appaji dream","english":"I dreamt about Appaji.","language":"Telugu"}'), { title: "Appaji dream", english: "I dreamt about Appaji.", language: "Telugu" });
  assert.equal(readTitle("no json"), null);
});

test("on the bench: a voice note in Telugu, a forwarded recording, and finding them", async () => {
  const b = bench({
    today: "2026-11-18",
    now: "21:42",
    heard: { language: "Telugu", original: "డైరీ: నిన్న రాత్రి అప్పాజీ కలలో వచ్చారు" },
    docs: [{ id: "t1", filename: "Recording.opus", text: "ఈరోజు ఇంటర్వ్యూ బాగా జరిగింది", sentAt: new Date().toISOString(), storedId: null, kind: "transcript" }],
    ai: (op, text) =>
      op === "diary_title"
        ? text.includes("Appaji")
          ? '{"title":"Appaji dream","english":"Last night Appaji came in my dream.","language":"English"}'
          : '{"title":"Interview went well","english":"Today the interview went well.","language":"Telugu"}'
        : '{"ids":[]}',
  });
  assert.match((await b.send("Diary: last night Appaji came in my dream", "diary"))[0], /^Saved in your diary: \*Appaji dream\*, Wed 18 Nov 2026, 9:42 pm, translated from Telugu\./);
  const first = b.registers.get("skill_diary")![0];
  assert.equal(first.data.language, "Telugu");
  assert.equal(first.data.original, "నిన్న రాత్రి అప్పాజీ కలలో వచ్చారు");
  assert.match((await b.send("diary", "diary"))[0], /^Saved in your diary: \*Interview went well\*.*translated from Telugu/);
  const second = b.registers.get("skill_diary")![1];
  assert.equal(second.data.entry, "Today the interview went well.");
  assert.equal(second.data.original, "ఈరోజు ఇంటర్వ్యూ బాగా జరిగింది");
  const found = (await b.send("when did I dream about Appaji?", "diary"))[0];
  assert.match(found, /^You wrote about it on Wed 18 Nov 2026 at 9:42 pm:/);
  assert.match(found, /Last night Appaji came in my dream/);
  assert.match((await b.send("my diary", "diary"))[0], /^\*Your diary\* \(2\)/);
  assert.match((await b.send("what did I write about the holiday in Goa?", "diary"))[0], /couldn't find anything/);
});

test("an entry is told from a question when the sorting step sends one", () => {
  assert.ok(asked("when did I dream about Appaji?") && asked("which day did I meet Ravi") && !asked("Today I felt really happy after the call with mom"));
  assert.equal(entryFrom("Today I felt really happy after the call with mom, want to remember this in my diary"), "Today I felt really happy after the call with mom");
  assert.equal(entryFrom("add this to my diary: the kids won the match"), "the kids won the match");
});

test("my diary in other words", () => {
  for (const t of ["my diary", "My diaries", "show diary", "show my diary", "open the diary", "diary entries", "my diary entries", "list my diary", "my journal"]) assert.equal(diaryCommand(t)?.kind, "list", t);
  assert.deepEqual(diaryCommand("my diary last week"), { kind: "list", period: "last_week" });
});

test("play an entry", () => {
  assert.deepEqual(diaryCommand("play the Appaji dream"), { kind: "find", query: "appaji dream", play: true });
  assert.deepEqual(diaryCommand("play my diary entry about Appaji"), { kind: "find", query: "appaji", play: true });
  assert.equal(isDiaryText("play the Appaji dream from my diary"), true);
  assert.equal(isDiaryText("play some music"), false);
});

test("a recording kept in the diary keeps its audio, once, and plays", async () => {
  const { bench } = await import("../bench/bench");
  const doc = { id: "t1", filename: "Transcript", text: "ఐటీఎస్ అ బిగ్ హాల్", sentAt: new Date().toISOString(), storedId: null, kind: "transcript" as const };
  const ai = (op: string) => (op === "diary_title" ? JSON.stringify({ title: "Appaji dream", language: "Telugu", english: "It's a big hall" }) : "[]");
  const b = bench({ docs: [doc], ai, today: "2026-11-18" });
  const saved = await b.send("diary", "diary");
  assert.match(saved.join("\n"), /kept the recording too/);
  const again = await b.send("diary", "diary");
  assert.match(again.join("\n"), /already in your diary/);
  const list = await b.send("my diary", "diary");
  assert.match(list.join("\n"), /Appaji dream\* 🎙/);
  const played = await b.send("play the Appaji dream", "diary");
  assert.match(played.join("\n"), /\[file stored-t1: 🎙 Appaji dream\]/);
});

test("after my diary, entries are picked by number", async () => {
  const { bench } = await import("../bench/bench");
  const doc = { id: "t1", filename: "Transcript", text: "ఐటీఎస్ అ బిగ్ హాల్", sentAt: new Date().toISOString(), storedId: null, kind: "transcript" as const };
  const ai = (op: string, t: string) => (op !== "diary_title" ? "[]" : /interview/i.test(t) ? JSON.stringify({ title: "The interview", language: "English", english: t }) : JSON.stringify({ title: "Appaji dream", language: "Telugu", english: "It's a big hall" }));
  const b = bench({ docs: [doc], ai, today: "2026-11-18" });
  await b.send("diary", "diary");
  await b.send("diary: the interview went well", "diary");
  const list = (await b.send("my diary", "diary")).join("\n");
  assert.match(list, /Reply with numbers: "show 2", "play 2"/);
  // Both written the same minute, so in the order kept: the recording is 1.
  assert.match((await b.pick("play", [1], null, "diary")).join("\n"), /\[file stored-t1: 🎙 Appaji dream\]/);
  assert.match((await b.pick("play", [2], null, "diary")).join("\n"), /don't have a recording/);
  assert.match((await b.pick("rename", [1], "Dream of Appaji", "diary")).join("\n"), /Renamed to \*Dream of Appaji\*/);
  assert.match((await b.pick("delete", [2], null, "diary")).join("\n"), /Deleted \*The interview/);
  assert.equal(b.registers.get("skill_diary")!.length, 1);
});
