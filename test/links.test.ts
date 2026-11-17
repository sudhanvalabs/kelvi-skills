import { test } from "node:test";
import assert from "node:assert/strict";
import { hostOf, isLinksText, linksCommand, linksIn, match, nameGiven, tagOf, tidyTitle, type Link } from "../src/skills/links/logic";
import { bench } from "../bench/bench";

test("links are found in a message, with or without https", () => {
  assert.deepEqual(linksIn("my meet link: meet.google.com/abc-defg-hij"), ["https://meet.google.com/abc-defg-hij"]);
  assert.deepEqual(linksIn("see https://www.forgeprivate.com/kelvi."), ["https://www.forgeprivate.com/kelvi"]);
  assert.deepEqual(linksIn("www.example.com and https://x.com/a/status/1"), ["https://www.example.com", "https://x.com/a/status/1"]);
  assert.deepEqual(linksIn("call Ravi at 5.30 today"), []);
  assert.deepEqual(linksIn("pay 1.5 lakh by Friday"), []);
});

test("the name given is kept, without the link and filler words", () => {
  assert.equal(nameGiven("my google meet link: meet.google.com/abc-defg-hij"), "Google meet");
  assert.equal(nameGiven("save this https://example.com"), "");
  assert.equal(nameGiven("https://example.com"), "");
  assert.equal(nameGiven("Kelvi intro post https://www.linkedin.com/posts/x"), "Kelvi intro post");
});

test("the kind of link comes from where it points", () => {
  assert.equal(tagOf("https://meet.google.com/abc"), "Meetings");
  assert.equal(tagOf("https://us02web.zoom.us/j/123"), "Meetings");
  assert.equal(tagOf("https://www.linkedin.com/posts/x"), "Posts");
  assert.equal(tagOf("https://youtu.be/abc"), "Videos");
  assert.equal(tagOf("https://docs.google.com/document/d/1"), "Documents");
  assert.equal(tagOf("https://www.forgeprivate.com"), "Websites");
  assert.equal(hostOf("https://www.forgeprivate.com/kelvi"), "forgeprivate.com");
  assert.equal(tidyTitle("Kelvi is live | LinkedIn"), "Kelvi is live");
});

test("what the person wrote is read", () => {
  assert.deepEqual(linksCommand("my links"), { kind: "list", about: null });
  assert.deepEqual(linksCommand("/links"), { kind: "list", about: null });
  assert.deepEqual(linksCommand("my links about AI"), { kind: "list", about: "ai" });
  assert.deepEqual(linksCommand("send me my meet link"), { kind: "find", words: "meet" });
  assert.deepEqual(linksCommand("what's my zoom link?"), { kind: "find", words: "zoom" });
  assert.deepEqual(linksCommand("link to the kelvi post"), { kind: "find", words: "kelvi post" });
  assert.deepEqual(linksCommand("delete the Zoom link"), { kind: "delete", which: "zoom" });
  assert.deepEqual(linksCommand("rename 3 to Team standup"), { kind: "rename", which: "3", to: "Team standup" });
  assert.equal(linksCommand("remind me to call the bank"), null);
});

test("only a link, its name and the fixed words skip the sorting step", () => {
  assert.ok(isLinksText("meet.google.com/abc-defg-hij"));
  assert.ok(isLinksText("my meet link: meet.google.com/abc-defg-hij"));
  assert.ok(isLinksText("my links") && isLinksText("send me my meet link"));
  assert.ok(!isLinksText("summarise this article for me and tell me what it says about pricing https://example.com/a"));
  assert.ok(!isLinksText("delete the Zoom link"), "a change goes through the sorting step, so 'delete the report' elsewhere is not taken");
  assert.ok(!isLinksText("remind me at 5 to join the standup"));
});

test("a description finds the best links", () => {
  const ls: Link[] = [
    { id: "1", name: "Google meet", url: "https://meet.google.com/abc", tag: "Meetings", savedOn: "2026-11-17", addedAt: "2026-11-17T10:00:00Z" },
    { id: "2", name: "Kelvi intro post", url: "https://www.linkedin.com/posts/x", tag: "Posts", savedOn: "2026-11-16", addedAt: "2026-11-16T10:00:00Z" },
    { id: "3", name: "Zoom room", url: "https://zoom.us/j/1", tag: "Meetings", savedOn: "2026-11-15", addedAt: "2026-11-15T10:00:00Z" },
  ];
  assert.deepEqual(match(ls, "meet").map((l) => l.id), ["1"]);
  assert.deepEqual(match(ls, "kelvi post").map((l) => l.id), ["2"]);
  assert.deepEqual(match(ls, "linkedin").map((l) => l.id), ["2"]);
  assert.deepEqual(match(ls, "meetings").map((l) => l.id), ["1", "3"]);
  assert.deepEqual(match(ls, "budget"), []);
});

test("on the bench: save, list, find, rename, delete", async () => {
  const b = bench({ today: "2026-11-17", titles: { "https://www.linkedin.com/posts/x": "Kelvi is live | LinkedIn" } });
  assert.match((await b.send("my google meet link: meet.google.com/abc-defg-hij"))[0], /^Saved \*Google meet\* \(meetings\)\./);
  assert.match((await b.send("https://www.linkedin.com/posts/x"))[0], /^Saved \*Kelvi is live\* \(posts\)\./);
  assert.match((await b.send("https://example.org/page"))[0], /^Saved \*example\.org\*\./);
  assert.match((await b.send("meet.google.com/abc-defg-hij"))[0], /^Already saved as \*Google meet\*/);
  const list = (await b.send("my links"))[0];
  assert.match(list, /^\*Your links\* \(3\)/);
  assert.match(list, /\n1\. \*example\.org\*\nhttps:\/\/example\.org\/page\n\n2\. \*Kelvi is live\*/, "newest first");
  assert.equal((await b.send("send me my meet link"))[0], "*Google meet*\nhttps://meet.google.com/abc-defg-hij");
  assert.match((await b.send("rename 1 to Example site"))[0], /^Renamed \*example\.org\* to \*Example site\*/);
  assert.match((await b.send("delete the example site link"))[0], /^Deleted \*Example site\*/);
  assert.equal(b.registers.get("skill_links")?.length, 2);
  assert.match((await b.send("send me the budget link"))[0], /couldn't find/);
});
