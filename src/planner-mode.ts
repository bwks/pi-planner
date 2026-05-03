export type PlannerMode = "build" | "plan";

export const ASK_CLARIFYING_QUESTIONS_TOOL_NAME = "ask_clarifying_questions";

export const PLAN_MODE_TOOL_NAMES = ["read", "grep", "find", "ls", ASK_CLARIFYING_QUESTIONS_TOOL_NAME] as const;

const PLAN_MODE_TOOLS = new Set<string>(PLAN_MODE_TOOL_NAMES);

export type PlannerStatusTheme = {
	bold(text: string): string;
};

const VIBRANT_BLUE_ANSI = "\u001b[94m";
const VIBRANT_ORANGE_ANSI = "\u001b[38;5;208m";
const RESET_FG_ANSI = "\u001b[39m";

export function shouldAllowToolInPlanMode(toolName: string): boolean {
	return PLAN_MODE_TOOLS.has(toolName);
}

export function getPlannerStatusText(mode: PlannerMode): string {
	return mode === "plan" ? "PLAN" : "BUILD";
}

export function renderPlannerStatus(theme: PlannerStatusTheme, mode: PlannerMode): string {
	if (mode === "plan") {
		return `${VIBRANT_BLUE_ANSI}📋 ${getPlannerStatusText(mode)} 📋${RESET_FG_ANSI}`;
	}

	return `${VIBRANT_ORANGE_ANSI}${theme.bold(`🤖 ${getPlannerStatusText(mode)} 🤖`)}${RESET_FG_ANSI}`;
}

export function getModeSwitchMessage(mode: PlannerMode): string {
	return mode === "plan"
		? "Switched to PLAN mode — changes blocked."
		: "Switched to BUILD mode — changes enabled.";
}
