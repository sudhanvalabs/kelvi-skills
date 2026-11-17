// Each skill imports only the toolkit and its own folder, and declares a manifest
// Forge can load. Run by `npm run check`, and again by Forge.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SKILLS, KIT_VERSION } from "../src/index";

let bad = 0;
const fail = (m: string) => {
  bad++;
  console.error(`✗ ${m}`);
};
for (const dir of readdirSync("src/skills")) {
  for (const f of readdirSync(join("src/skills", dir)).filter((x) => x.endsWith(".ts"))) {
    const src = readFileSync(join("src/skills", dir, f), "utf8");
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)) {
      if (m[1] !== "../../kit" && !m[1].startsWith("./")) fail(`src/skills/${dir}/${f} imports "${m[1]}": a skill may import only "../../kit" and its own files`);
    }
    if (/\b(fetch|process\.env|require)\s*\(|\bprocess\.env\b/.test(src)) fail(`src/skills/${dir}/${f} reaches outside the toolkit (fetch, process.env or require)`);
  }
}
const keys = new Set<string>();
const types = new Set<string>();
for (const s of SKILLS) {
  if (keys.has(s.key) || keys.has(s.route)) fail(`two skills use "${s.key}"`);
  keys.add(s.key);
  if (s.kit.split(".")[0] !== KIT_VERSION.split(".")[0]) fail(`${s.key} is built for toolkit ${s.kit}, not ${KIT_VERSION}`);
  if (!/^[a-z]+$/.test(s.menu.command)) fail(`${s.key}: the command must be lowercase letters`);
  if (s.menu.helpLine.length > 120) fail(`${s.key}: the help line is over 120 characters`);
  if (s.page && (!s.page.icon || [...s.page.icon].length !== 1)) fail(`${s.key}: the sidebar icon must be one character`);
  if (s.page && !s.page.path && !s.page.register) fail(`${s.key}: the sidebar entry needs a path or a register`);
  if (s.page?.path) fail(`${s.key}: a skill outside Forge has no page of its own in Forge; give its register instead`);
  const defs = readFileSync(`src/skills/${s.key}/logic.ts`, "utf8").matchAll(/type: "(skill_[a-z_]+)"/g);
  for (const d of defs) {
    if (types.has(d[1])) fail(`register type ${d[1]} is used twice`);
    types.add(d[1]);
  }
}
console.log(bad ? `\n${bad} problem(s)` : `✓ ${SKILLS.length} skill(s): ${SKILLS.map((s) => s.key).join(", ")}`);
process.exit(bad ? 1 : 0);
