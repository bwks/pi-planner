import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
	buildAcceptedPlanExecutionPrompt,
	buildPlanAutosavePath,
	extractPlanSection,
	formatSavedPlanMarkdown,
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
