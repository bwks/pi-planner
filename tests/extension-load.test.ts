import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { transform } from "esbuild";

test("planner extension source parses as valid TypeScript", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	await assert.doesNotReject(async () => {
		await transform(source, { loader: "ts", format: "esm" });
	});
});

test("planner extension registers /plan and /build commands", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(source, /registerCommand\("plan"/);
	assert.match(source, /registerCommand\("build"/);
	assert.doesNotMatch(source, /registerCommand\("mode"/);
});

test("planner extension defaults to plan mode", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(source, /let plannerMode: PlannerMode = "plan"/);
	assert.match(source, /const restorePlannerMode = \(ctx: ExtensionContext\) => \{\s*plannerMode = "plan";/s);
});
