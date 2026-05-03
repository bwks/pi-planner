import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("README documents deleting saved plans from the saved-plan browser", async () => {
	const readme = await readFile(path.resolve(process.cwd(), "README.md"), "utf8");

	assert.match(readme, /delete saved plans/i);
	assert.match(readme, /\/plan list/);
});

test("README documents planner clarifying questions", async () => {
	const readme = await readFile(path.resolve(process.cwd(), "README.md"), "utf8");

	assert.match(readme, /clarifying questions/i);
	assert.match(readme, /tabbed/i);
});
