import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";

const root = process.cwd();
const cases = JSON.parse(await readFile(resolve(root, "evals/recipe-agent.cases.json"), "utf8"));
const { createRecipeMcpServer } = await import("../../src/lib/recipe-mcp.ts");
const { loadSkillsForPrompt } = await import("../../src/lib/skill-loader.ts");
const server = createRecipeMcpServer();
const client = new Client({ name: "fora-do-oleo-agent-eval", version: "1.0.0" });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const failures = [];

try {
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const { tools } = await client.listTools();

  for (const scenario of cases.scenarios) {
    try {
      if (scenario.type === "tools") {
        const available = new Set(tools.map((tool) => tool.name));
        for (const expected of scenario.expectedTools) assert.ok(available.has(expected), `Missing MCP tool: ${expected}`);
      } else if (scenario.type === "mcp-call") {
        const result = await client.callTool({ name: scenario.tool, arguments: scenario.arguments });
        assert.equal(Boolean(result.isError), Boolean(scenario.expectedError), "Unexpected MCP error state");
        const text = result.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
        for (const expected of scenario.expectedText ?? []) assert.ok(text.includes(expected), `Expected output to include: ${expected}`);
      } else if (scenario.type === "skills") {
        const skills = await loadSkillsForPrompt(scenario.prompt);
        assert.deepEqual(skills.map((skill) => skill.name), scenario.expectedSkills);
      } else {
        throw new Error(`Unsupported scenario type: ${scenario.type}`);
      }

      console.log(`PASS ${scenario.id}`);
    } catch (error) {
      failures.push(scenario.id);
      console.error(`FAIL ${scenario.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} finally {
  await Promise.allSettled([client.close(), server.close()]);
}

console.log(`\n${cases.scenarios.length - failures.length}/${cases.scenarios.length} evals passaram.`);
if (failures.length) process.exitCode = 1;
