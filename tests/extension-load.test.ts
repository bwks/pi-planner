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
	assert.match(source, /args\.trim\(\) === "list"/);
	assert.doesNotMatch(source, /getArgumentCompletions/);
	assert.doesNotMatch(source, /registerCommand\("mode"/);
});


test("planner extension prompts users to accept, save, refine, or discard detected plans", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(source, /✅ Accept and switch to BUILD mode/);
	assert.match(source, /💾 Save plan for later/);
	assert.match(source, /✏️ Refine plan/);
	assert.match(source, /❌ Discard plan/);
	assert.match(source, /Plan discarded\./);
	assert.match(source, /How should the plan be refined\?/);
	assert.match(source, /withFileMutationQueue/);
});


test("planner extension uses a non-cancelable custom selector for required plan actions", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(source, /ctx\.ui\.custom/);
	assert.match(source, /new SelectList/);
	assert.match(source, /↑↓ navigate • enter select/);
	assert.doesNotMatch(source, /ctx\.ui\.select\("Plan ready — what next\?"/);
	assert.doesNotMatch(source, /ctx\.ui\.select\("Completed plan — what next\?"/);
});


test("planner extension shows a user input working message while required action selectors are open", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(
		source,
		/const showRequiredActionSelector = async[\s\S]*setWorkingMessage\("User input\.\.\."\)[\s\S]*return await ctx\.ui\.custom<string>\([\s\S]*finally \{\s*ctx\.ui\.setWorkingMessage\(\);\s*\}/s,
	);
});


test("planner extension saves plans for later without switching to build or starting implementation", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(
		source,
		/if \(choice === SAVE_PLAN_FOR_LATER_CHOICE\) \{[\s\S]*const filePath = await savePlan\(plan, ctx\);[\s\S]*Plan saved for later at \$\{filePath\}\.[\s\S]*return;\s*\}/s,
	);

	const saveForLaterStart = source.indexOf('if (choice === SAVE_PLAN_FOR_LATER_CHOICE) {');
	const refineStart = source.indexOf('if (choice === REFINE_PLAN_CHOICE) {', saveForLaterStart);
	const saveForLaterBlock = source.slice(saveForLaterStart, refineStart);

	assert.doesNotMatch(saveForLaterBlock, /setPlannerMode\("build", ctx\)/);
	assert.doesNotMatch(saveForLaterBlock, /sendBuildFollowUp\(/);
	assert.doesNotMatch(saveForLaterBlock, /activeAcceptedPlanPath = filePath/);
});


test("planner extension starts implementation after a plan is accepted", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(source, /buildAcceptedPlanExecutionPrompt/);
	assert.match(source, /ctx\.isIdle\(\)/);
	assert.match(source, /deliverAs: "followUp"/);
	assert.match(source, /pi\.sendUserMessage\(/);
});


test("planner extension customizes the working message while refining a plan", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(source, /setWorkingMessage\("✏️ Refining plan\.\.\."\)/);
	assert.match(source, /setWorkingMessage\(\)/);
});


test("planner extension registers an LLM clarifying questions tool", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(source, /registerTool\(/);
	assert.match(source, /ASK_CLARIFYING_QUESTIONS_TOOL_NAME/);
	assert.match(source, /Ask clarifying questions about the plan/);
	assert.match(source, /showClarifyingQuestionsBox/);
	assert.match(source, /Clarifying Questions/);
});


test("planner extension renders clarifying questions in a tabbed box", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(source, /Tab\/←→ navigate/);
	assert.match(source, /answers = new Map/);
	assert.match(source, /currentTab/);
	assert.match(source, /Key\.tab/);
	assert.match(source, /Key\.shift\("tab"\)/);
	assert.match(source, /renderBorderedPanel/);
	assert.match(source, /Submit/);
});


test("planner extension preserves typed clarifying answers when the editor submits", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(source, /const saveCurrentAnswer = \(answerText = editor\.getExpandedText\(\)\)/);
	assert.match(source, /editor\.onChange = \(value\) => \{\s*saveCurrentAnswer\(value\);\s*\}/s);
	assert.match(source, /editor\.onSubmit = \(value\) => \{\s*saveCurrentAnswer\(value\);\s*setCurrentTab\(Math\.min\(currentTab \+ 1, questions\.length\), \{ saveCurrent: false \}\);\s*\}/s);
});


test("planner mode guidance tells the LLM to ask clarifying questions before final plans", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(source, /ask clarifying questions/i);
	assert.match(source, /before producing a final plan/i);
});


test("planner extension supports browsing saved plans in a centered overlay popover", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(source, /\/plan list/);
	assert.match(source, /Saved Plans/);
	assert.match(source, /ctx\.ui\.custom<[\s\S]*>\([\s\S]*overlay: true/s);
	assert.match(source, /anchor: "center"/);
	assert.match(source, /listSavedPlans/);
	assert.match(source, /buildSavedPlanSelectorLabel/);
	assert.match(source, /theme\.fg\("borderAccent", text\)/);
	assert.match(source, /visibleWidth/);
	assert.match(source, /┌/);
	assert.match(source, /│/);
	assert.match(source, /└/);
	assert.doesNotMatch(source, /new Box\(1, 1, \(text\) => theme\.bg\("customMessageBg", text\)\)/);
});


test("planner extension can delete an arbitrary saved plan from the saved-plan menu", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(source, /🗑️ Delete saved plan/);
	assert.match(source, /DELETE_SAVED_PLAN_CHOICE/);
	assert.match(
		source,
		/promptForSavedPlanNextStep[\s\S]*DELETE_SAVED_PLAN_CHOICE[\s\S]*if \(choice === DELETE_SAVED_PLAN_CHOICE\) \{[\s\S]*await deleteSavedPlan\(savedPlan\.filePath\);[\s\S]*Deleted saved plan/s,
	);

	const deleteStart = source.indexOf("if (choice === DELETE_SAVED_PLAN_CHOICE) {");
	const nextBranchStart = source.indexOf("if (choice ===", deleteStart + 1);
	const deleteBlock = source.slice(deleteStart, nextBranchStart === -1 ? undefined : nextBranchStart);

	assert.doesNotMatch(deleteBlock, /setPlannerMode\("build", ctx\)/);
	assert.doesNotMatch(deleteBlock, /sendBuildFollowUp\(/);
	assert.doesNotMatch(deleteBlock, /activeAcceptedPlanPath =/);
});


test("planner extension reviews completed plans and supports additional work", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(source, /🗑️ Delete completed plan/);
	assert.match(source, /📁 Keep saved plan/);
	assert.match(source, /➕ Additional work/);
	assert.match(source, /What additional work is needed\?/);
	assert.match(source, /buildAdditionalWorkPrompt/);
	assert.match(source, /unlink/);
});

test("planner extension defaults to plan mode", async () => {
	const extensionPath = path.resolve(process.cwd(), "extensions/planner.ts");
	const source = await readFile(extensionPath, "utf8");

	assert.match(source, /let plannerMode: PlannerMode = "plan"/);
	assert.match(source, /const restorePlannerMode = \(ctx: ExtensionContext\) => \{\s*plannerMode = "plan";/s);
});
