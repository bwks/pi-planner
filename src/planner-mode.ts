export type PlannerMode = "build" | "plan";

export const PLAN_MODE_TOOL_NAMES = ["read", "grep", "find", "ls"] as const;

const PLAN_MODE_TOOLS = new Set<string>(PLAN_MODE_TOOL_NAMES);

export type PlannerStatusTheme = {
	fg(color: "success" | "warning", text: string): string;
	bold(text: string): string;
};

const BRIGHT_GREEN_ANSI = "\u001b[92m";
const RESET_FG_ANSI = "\u001b[39m";

export function shouldAllowToolInPlanMode(toolName: string): boolean {
	return PLAN_MODE_TOOLS.has(toolName);
}

export function getPlannerStatusText(mode: PlannerMode): string {
	return mode === "plan" ? "PLAN" : "BUILD";
}

export function renderPlannerStatus(theme: PlannerStatusTheme, mode: PlannerMode): string {
	if (mode === "plan") {
		return theme.fg("warning", `⏸ ${getPlannerStatusText(mode)}`);
	}

	return `${BRIGHT_GREEN_ANSI}${theme.bold(`🤖 ${getPlannerStatusText(mode)} 🤖`)}${RESET_FG_ANSI}`;
}

export function getModeSwitchMessage(mode: PlannerMode): string {
	return mode === "plan"
		? "Switched to PLAN mode — changes blocked."
		: "Switched to BUILD mode — changes enabled.";
}

export function parsePlannerMode(value: string | undefined): PlannerMode | undefined {
	const normalized = value?.trim().toLowerCase();
	if (!normalized) return undefined;
	if (normalized === "plan") return "plan";
	if (normalized === "build" || normalized === "act") return "build";
	return undefined;
}
