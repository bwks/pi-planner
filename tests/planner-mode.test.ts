import assert from "node:assert/strict";
import test from "node:test";

import {
	PLAN_MODE_TOOL_NAMES,
	getModeSwitchMessage,
	getPlannerStatusText,
	parsePlannerMode,
	renderPlannerStatus,
	shouldAllowToolInPlanMode,
} from "../src/planner-mode";

test("parsePlannerMode supports plan and build", () => {
	assert.equal(parsePlannerMode("plan"), "plan");
	assert.equal(parsePlannerMode("build"), "build");
	assert.equal(parsePlannerMode("act"), "build");
	assert.equal(parsePlannerMode("toggle"), undefined);
});

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

test("renderPlannerStatus makes BUILD mode bright green with robot icons", () => {
	const theme = {
		fg: (color: "success" | "warning", text: string) => `<${color}>${text}</${color}>`,
		bold: (text: string) => `<bold>${text}</bold>`,
	};

	assert.equal(renderPlannerStatus(theme, "build"), "\u001b[92m<bold>🤖 BUILD 🤖</bold>\u001b[39m");
	assert.equal(renderPlannerStatus(theme, "plan"), "<warning>⏸ PLAN</warning>");
});
