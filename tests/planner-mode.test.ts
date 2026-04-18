import assert from "node:assert/strict";
import test from "node:test";

import {
	PLAN_MODE_TOOL_NAMES,
	getModeSwitchMessage,
	getPlannerStatusText,
	renderPlannerStatus,
	shouldAllowToolInPlanMode,
} from "../src/planner-mode";

test("shouldAllowToolInPlanMode only allows the read-only planner toolset", () => {
	assert.deepEqual(PLAN_MODE_TOOL_NAMES, ["read", "grep", "find", "ls"]);
	assert.equal(shouldAllowToolInPlanMode("read"), true);
	assert.equal(shouldAllowToolInPlanMode("grep"), true);
	assert.equal(shouldAllowToolInPlanMode("find"), true);
	assert.equal(shouldAllowToolInPlanMode("ls"), true);
	assert.equal(shouldAllowToolInPlanMode("bash"), false);
	assert.equal(shouldAllowToolInPlanMode("write"), false);
	assert.equal(shouldAllowToolInPlanMode("edit"), false);
});

test("planner mode strings are user friendly", () => {
	assert.equal(getPlannerStatusText("plan"), "PLAN");
	assert.equal(getPlannerStatusText("build"), "BUILD");
	assert.match(getModeSwitchMessage("plan"), /changes blocked/i);
	assert.match(getModeSwitchMessage("build"), /changes enabled/i);
});

test("renderPlannerStatus uses vibrant orange BUILD and vibrant blue PLAN identifiers", () => {
	const theme = {
		bold: (text: string) => `<bold>${text}</bold>`,
	};

	assert.equal(renderPlannerStatus(theme, "build"), "\u001b[38;5;208m<bold>🤖 BUILD 🤖</bold>\u001b[39m");
	assert.equal(renderPlannerStatus(theme, "plan"), "\u001b[94m📋 PLAN 📋\u001b[39m");
});
