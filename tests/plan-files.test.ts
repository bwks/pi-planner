import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
	buildAcceptedPlanExecutionPrompt,
	buildAdditionalWorkPrompt,
	buildPlanAutosavePath,
	buildSavedPlanSelectorLabel,
	extractPlanSection,
	formatSavedPlanMarkdown,
	listSavedPlans,
	parseSavedPlanMarkdown,
} from "../src/plan-files";

test("extractPlanSection returns the numbered Plan block without trailing sections", () => {
	const text = [
		"I inspected the codebase and found the extension entry point.",
		"",
		"**Plan:**",
		"1. Add an autosave helper for accepted plans.",
		"2. Prompt the user to accept or refine the plan.",
		"3. Save the accepted plan before switching to BUILD mode.",
		"",
		"Risks:",
		"- Watch out for duplicate prompts.",
	].join("\n");

	assert.equal(
		extractPlanSection(text),
		[
			"1. Add an autosave helper for accepted plans.",
			"2. Prompt the user to accept or refine the plan.",
			"3. Save the accepted plan before switching to BUILD mode.",
		].join("\n"),
	);
});

test("extractPlanSection returns undefined when no plan header is present", () => {
	assert.equal(extractPlanSection("No structured plan yet."), undefined);
});

test("formatSavedPlanMarkdown includes plan metadata and steps", () => {
	const markdown = formatSavedPlanMarkdown({
		plan: ["1. Inspect the extension.", "2. Save the accepted plan."].join("\n"),
		savedAt: new Date("2026-04-18T09:10:11.000Z"),
		sessionId: "session-123",
		sessionName: "Save accepted plans",
	});

	assert.match(markdown, /^# Saved Plan\n/);
	assert.match(markdown, /- Saved: 2026-04-18 09:10:11 UTC/);
	assert.match(markdown, /- Session: Save accepted plans/);
	assert.match(markdown, /- Session ID: session-123/);
	assert.match(markdown, /## Plan\n\n1\. Inspect the extension\.\n2\. Save the accepted plan\./);
});

test("buildPlanAutosavePath uses a timestamped slug in .pi\/plans", () => {
	const filePath = buildPlanAutosavePath({
		cwd: "/repo",
		savedAt: new Date("2026-04-18T09:10:11.000Z"),
		sessionId: "session-123",
		sessionName: "Save accepted plans!",
	});

	assert.equal(filePath, path.join("/repo", ".pi", "plans", "20260418-091011-save-accepted-plans.md"));
});

test("buildPlanAutosavePath falls back to the session id when the session name is blank", () => {
	const filePath = buildPlanAutosavePath({
		cwd: "/repo",
		savedAt: new Date("2026-04-18T09:10:11.000Z"),
		sessionId: "session-123",
		sessionName: "   ",
	});

	assert.equal(filePath, path.join("/repo", ".pi", "plans", "20260418-091011-session-123.md"));
});

test("parseSavedPlanMarkdown extracts metadata and plan text", () => {
	const parsed = parseSavedPlanMarkdown([
		"# Saved Plan",
		"",
		"- Saved: 2026-04-18 09:10:11 UTC",
		"- Session: Save accepted plans",
		"- Session ID: session-123",
		"",
		"## Plan",
		"",
		"1. Inspect the extension.",
		"2. Save the accepted plan.",
	].join("\n"));

	assert.deepEqual(parsed, {
		savedAt: "2026-04-18 09:10:11 UTC",
		sessionLabel: "Save accepted plans",
		sessionId: "session-123",
		plan: ["1. Inspect the extension.", "2. Save the accepted plan."].join("\n"),
	});
});

test("parseSavedPlanMarkdown returns undefined for malformed saved plans", () => {
	assert.equal(parseSavedPlanMarkdown("# Saved Plan\n\nMissing plan section"), undefined);
});

test("buildSavedPlanSelectorLabel uses the session label and timestamp", () => {
	assert.equal(
		buildSavedPlanSelectorLabel({
			savedAt: "2026-04-18 09:10:11 UTC",
			sessionLabel: "Save accepted plans",
			sessionId: "session-123",
			plan: "1. Inspect the extension.",
		}),
		"Save accepted plans — 2026-04-18 09:10:11 UTC",
	);
});

test("listSavedPlans loads saved plans newest-first and skips malformed files", async () => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-planner-"));
	const plansDir = path.join(cwd, ".pi", "plans");
	await mkdir(plansDir, { recursive: true });

	await writeFile(
		path.join(plansDir, "20260418-091011-old-plan.md"),
		formatSavedPlanMarkdown({
			plan: "1. Old plan.",
			savedAt: new Date("2026-04-18T09:10:11.000Z"),
			sessionId: "session-old",
			sessionName: "Old session",
		}),
		"utf8",
	);
	await writeFile(
		path.join(plansDir, "20260418-101011-new-plan.md"),
		formatSavedPlanMarkdown({
			plan: "1. New plan.",
			savedAt: new Date("2026-04-18T10:10:11.000Z"),
			sessionId: "session-new",
			sessionName: "New session",
		}),
		"utf8",
	);
	await writeFile(path.join(plansDir, "20260418-111011-bad-plan.md"), "not a saved plan", "utf8");

	try {
		const savedPlans = await listSavedPlans(cwd);

		assert.equal(savedPlans.length, 2);
		assert.equal(path.basename(savedPlans[0]!.filePath), "20260418-101011-new-plan.md");
		assert.equal(savedPlans[0]!.sessionLabel, "New session");
		assert.equal(savedPlans[1]!.sessionLabel, "Old session");
	} finally {
		await rm(cwd, { recursive: true, force: true });
	}
});

test("buildAcceptedPlanExecutionPrompt tells pi to start implementing the accepted plan", () => {
	const prompt = buildAcceptedPlanExecutionPrompt({
		plan: ["1. Update the extension.", "2. Run the test suite."].join("\n"),
		savedPlanPath: ".pi/plans/20260418-091011-session-123.md",
	});

	assert.match(prompt, /accepted/i);
	assert.match(prompt, /build mode/i);
	assert.match(prompt, /implement/i);
	assert.match(prompt, /\.pi\/plans\/20260418-091011-session-123\.md/);
	assert.match(prompt, /Plan:\n1\. Update the extension\.\n2\. Run the test suite\./);
});

test("buildAdditionalWorkPrompt carries the saved plan path and user feedback into the next build turn", () => {
	const prompt = buildAdditionalWorkPrompt({
		plan: ["1. Update the extension.", "2. Run the test suite."].join("\n"),
		savedPlanPath: ".pi/plans/20260418-091011-session-123.md",
		feedback: "Also handle cleanup of completed plans.",
	});

	assert.match(prompt, /continue/i);
	assert.match(prompt, /additional work/i);
	assert.match(prompt, /Also handle cleanup of completed plans\./);
	assert.match(prompt, /\.pi\/plans\/20260418-091011-session-123\.md/);
	assert.match(prompt, /Plan:\n1\. Update the extension\.\n2\. Run the test suite\./);
});
