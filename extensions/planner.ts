import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
	getModeSwitchMessage,
	PLAN_MODE_TOOL_NAMES,
	renderPlannerStatus,
	shouldAllowToolInPlanMode,
	type PlannerMode,
} from "../src/planner-mode";

type PlannerStateEntry = {
	mode?: PlannerMode;
	activeToolsBeforePlanMode?: string[];
};

export default function plannerExtension(pi: ExtensionAPI) {
	let plannerMode: PlannerMode = "plan";
	let activeToolsBeforePlanMode: string[] | undefined;

	pi.registerFlag("plan", {
		description: "Start in plan mode",
		type: "boolean",
		default: false,
	});

	const updateStatus = (ctx: ExtensionContext) => {
		if (!ctx.hasUI) return;
		ctx.ui.setStatus("planner-mode", renderPlannerStatus(ctx.ui.theme, plannerMode));
	};

	const applyPlannerToolMode = () => {
		if (plannerMode === "plan") {
			const toolNames = pi
				.getAllTools()
				.map((tool) => tool.name)
				.filter((name) => shouldAllowToolInPlanMode(name));
			pi.setActiveTools(toolNames);
			return;
		}

		if (activeToolsBeforePlanMode) {
			pi.setActiveTools(activeToolsBeforePlanMode);
		}
	};

	const persistPlannerState = () => {
		pi.appendEntry("planner-mode", {
			mode: plannerMode,
			activeToolsBeforePlanMode,
		});
	};

	const setPlannerMode = (mode: PlannerMode, ctx: ExtensionContext) => {
		if (plannerMode === mode) {
			updateStatus(ctx);
			return;
		}

		if (mode === "plan") {
			activeToolsBeforePlanMode = pi.getActiveTools();
		}

		plannerMode = mode;
		applyPlannerToolMode();
		updateStatus(ctx);
		persistPlannerState();
		if (ctx.hasUI) {
			ctx.ui.notify(getModeSwitchMessage(plannerMode), plannerMode === "plan" ? "warning" : "success");
		}
	};

	const restorePlannerMode = (ctx: ExtensionContext) => {
		plannerMode = "plan";
		activeToolsBeforePlanMode = undefined;

		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "custom" || entry.customType !== "planner-mode") continue;
			const data = entry.data as PlannerStateEntry | undefined;
			if (data?.mode) plannerMode = data.mode;
			if (Array.isArray(data?.activeToolsBeforePlanMode)) {
				activeToolsBeforePlanMode = data.activeToolsBeforePlanMode;
			}
		}

		if (plannerMode === "plan" && !activeToolsBeforePlanMode) {
			activeToolsBeforePlanMode = pi.getActiveTools();
		}

		applyPlannerToolMode();
		updateStatus(ctx);
	};

	pi.on("session_start", async (_event, ctx) => {
		restorePlannerMode(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		restorePlannerMode(ctx);
	});

	pi.on("before_agent_start", async (event) => {
		if (plannerMode !== "plan") return;

		return {
			systemPrompt:
				event.systemPrompt +
				"\n\nPlanner mode guidance:\n- You are currently in PLAN mode.\n- Focus on analysis, exploration, and producing a plan.\n- Do not attempt to modify files, run shell commands, or use non-read-only tools.\n- If the user wants implementation work, tell them to switch back to BUILD mode with /build.\n- The only allowed tools in PLAN mode are: " +
				PLAN_MODE_TOOL_NAMES.join(", ") +
				".",
		};
	});

	pi.on("tool_call", async (event) => {
		if (plannerMode !== "plan") return;
		if (shouldAllowToolInPlanMode(event.toolName)) return;

		return {
			block: true,
			reason: `Planner mode is active. ${event.toolName} is blocked until you switch back to BUILD mode with /build.`,
		};
	});

	pi.on("user_bash", async () => {
		if (plannerMode !== "plan") return;
		return {
			result: {
				output: "Planner mode is active. User shell commands are blocked until you switch back to BUILD mode with /build.",
				exitCode: 1,
				cancelled: false,
				truncated: false,
			},
		};
	});

	pi.registerCommand("plan", {
		description: "Switch to plan mode",
		handler: async (_args, ctx) => {
			setPlannerMode("plan", ctx);
		},
	});

	pi.registerCommand("build", {
		description: "Switch to build mode",
		handler: async (_args, ctx) => {
			setPlannerMode("build", ctx);
		},
	});
}
