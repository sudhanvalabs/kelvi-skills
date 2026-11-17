// The skills in this package, which Forge installs and Kelvi loads.
import type { SkillManifest } from "./kit";
import { links } from "./skills/links/skill";

export const SKILLS: SkillManifest[] = [links];

export * from "./kit";
