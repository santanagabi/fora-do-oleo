import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type AgentSkill = {
  name: string;
  description: string;
  instructions: string;
};

const availableSkills = ["air-fryer-cook", "recipe-adjuster"] as const;

function normalize(text: string) {
  return text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function shouldLoadAdjustmentSkill(prompt: string) {
  const normalized = normalize(prompt);
  const adjustmentIntents = [
    "ajuste", "ajusta", "troque", "troca", "substitua", "substituicao",
    "converta", "converter", "conversao", "quantidade", "nao tenho",
    "sem ", "em colher", "em xicara", "adapte", "mais doce", "menos doce",
  ];

  return adjustmentIntents.some((intent) => normalized.includes(intent));
}

async function loadSkill(skillId: (typeof availableSkills)[number]): Promise<AgentSkill> {
  if (!availableSkills.includes(skillId)) throw new Error(`Unknown skill: ${skillId}`);
  const source = await readFile(join(process.cwd(), "skills", skillId, "SKILL.md"), "utf8");
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (!frontmatter) throw new Error(`Skill ${skillId} has no YAML frontmatter.`);

  const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1].trim();
  const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1].trim();
  if (!name || !description || name !== skillId) {
    throw new Error(`Skill ${skillId} has invalid name or description metadata.`);
  }

  return { name, description, instructions: source.slice(frontmatter[0].length).trim() };
}

/** Load the cooking skill for every request and add adjustment guidance when needed. */
export async function loadSkillsForPrompt(prompt: string): Promise<AgentSkill[]> {
  const selected: (typeof availableSkills)[number][] = ["air-fryer-cook"];
  if (shouldLoadAdjustmentSkill(prompt)) selected.push("recipe-adjuster");
  return Promise.all(selected.map(loadSkill));
}
