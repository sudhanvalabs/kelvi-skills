// The skills in this package, which Forge installs and Kelvi loads.
import type { SkillManifest } from "./kit";
import { links } from "./skills/links/skill";
import { diary } from "./skills/diary/skill";

export const SKILLS: SkillManifest[] = [links, diary];

export * from "./kit";
