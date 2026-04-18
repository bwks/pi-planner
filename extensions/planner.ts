import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type ExtensionAPI, type ExtensionContext, withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import {
	buildAcceptedPlanExecutionPrompt,
	buildAdditionalWorkPrompt,
	buildPlanAutosavePath,
	extractPlanSection,
	extractTextContent,
	formatSavedPlanMarkdown,
} from "../src/plan-files";
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
	activeAcceptedPlanPath?: string;
	activeAcceptedPlanText?: string;
	cleanupReviewPending?: boolean;
};

type PlannerMessage = {
	role?: string;
	content?: unknown;
};

const ACCEPT_PLAN_CHOICE = "✅ Accept and switch to BUILD mode";
const REFINE_PLAN_CHOICE = "✏️ Refine plan";
const DISCARD_PLAN_CHOICE = "❌ Discard plan";
const DELETE_COMPLETED_PLAN_CHOICE = "🗑️ Delete completed plan";
const KEEP_SAVED_PLAN_CHOICE = "📁 Keep saved plan";
const ADDITIONAL_WORK_CHOICE = "➕ Additional work";

export default function plannerExtension(pi: ExtensionAPI) {
	let plannerMode: PlannerMode = "plan";
	let activeToolsBeforePlanMode: string[] | undefined;
	let activeAcceptedPlanPath: string | undefined;
	let activeAcceptedPlanText: string | undefined;
	let cleanupReviewPending = false;
	let isRefiningPlan = false;

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
			activeAcceptedPlanPath,
			activeAcceptedPlanText,
			cleanupReviewPending,
		});
	};

	const clearCompletedPlanState = () => {
		activeAcceptedPlanPath = undefined;
		activeAcceptedPlanText = undefined;
		cleanupReviewPending = false;
		persistPlannerState();
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

	const saveAcceptedPlan = async (plan: string, ctx: ExtensionContext) => {
		const savedAt = new Date();
		const sessionId = ctx.sessionManager.getSessionId();
		const sessionName = ctx.sessionManager.getSessionName();
		const filePath = buildPlanAutosavePath({
			cwd: ctx.cwd,
			savedAt,
			sessionId,
			sessionName,
		});
		const markdown = formatSavedPlanMarkdown({
			plan,
			savedAt,
			sessionId,
			sessionName,
		});

		await withFileMutationQueue(filePath, async () => {
			await mkdir(dirname(filePath), { recursive: true });
			await writeFile(filePath, markdown, "utf8");
		});

		return filePath;
	};

	const deleteSavedPlan = async (filePath: string) => {
		await withFileMutationQueue(filePath, async () => {
			try {
				await unlink(filePath);
			} catch (error) {
				if (!isFileNotFoundError(error)) {
					throw error;
				}
			}
		});
	};

	const sendBuildFollowUp = (message: string, ctx: ExtensionContext) => {
		if (ctx.isIdle()) {
			pi.sendUserMessage(message);
			return;
		}

		pi.sendUserMessage(message, { deliverAs: "followUp" });
	};

	const promptForPlanNextStep = async (plan: string, ctx: ExtensionContext) => {
		if (!ctx.hasUI) return;

		const choice = await ctx.ui.select("Plan ready — what next?", [
			ACCEPT_PLAN_CHOICE,
			REFINE_PLAN_CHOICE,
			DISCARD_PLAN_CHOICE,
		]);

		if (choice === ACCEPT_PLAN_CHOICE) {
			try {
				const filePath = await saveAcceptedPlan(plan, ctx);
				activeAcceptedPlanPath = filePath;
				activeAcceptedPlanText = plan;
				cleanupReviewPending = true;

				const implementationPrompt = buildAcceptedPlanExecutionPrompt({
					plan,
					savedPlanPath: filePath,
				});
				setPlannerMode("build", ctx);
				ctx.ui.notify(`Accepted plan saved to ${filePath}. Starting implementation...`, "success");
				sendBuildFollowUp(implementationPrompt, ctx);
			} catch (error) {
				ctx.ui.notify(`Could not save the accepted plan: ${getErrorMessage(error)}`, "error");
			}
			return;
		}

		if (choice === REFINE_PLAN_CHOICE) {
			const feedback = await ctx.ui.editor("How should the plan be refined?", "");
			if (!feedback?.trim()) {
				ctx.ui.notify("Refinement feedback is required.", "warning");
				return;
			}

			isRefiningPlan = true;
			pi.sendUserMessage(buildPlanRefinementPrompt(plan, feedback.trim()));
			return;
		}

		if (choice === DISCARD_PLAN_CHOICE) {
			ctx.ui.notify("Plan discarded.", "info");
		}
	};

	const promptForCompletedPlanNextStep = async (ctx: ExtensionContext) => {
		if (!ctx.hasUI || !cleanupReviewPending || !activeAcceptedPlanPath) return;

		const choice = await ctx.ui.select("Completed plan — what next?", [
			DELETE_COMPLETED_PLAN_CHOICE,
			KEEP_SAVED_PLAN_CHOICE,
			ADDITIONAL_WORK_CHOICE,
		]);

		if (choice === DELETE_COMPLETED_PLAN_CHOICE) {
			try {
				const filePath = activeAcceptedPlanPath;
				await deleteSavedPlan(filePath);
				clearCompletedPlanState();
				ctx.ui.notify(`Deleted completed plan ${filePath}`, "success");
			} catch (error) {
				ctx.ui.notify(`Could not delete completed plan: ${getErrorMessage(error)}`, "error");
			}
			return;
		}

		if (choice === KEEP_SAVED_PLAN_CHOICE) {
			const filePath = activeAcceptedPlanPath;
			clearCompletedPlanState();
			ctx.ui.notify(`Kept saved plan ${filePath}`, "info");
			return;
		}

		if (choice === ADDITIONAL_WORK_CHOICE) {
			const feedback = await ctx.ui.editor("What additional work is needed?", "");
			if (!feedback?.trim()) {
				ctx.ui.notify("Additional work feedback is required.", "warning");
				return;
			}

			const prompt = buildAdditionalWorkPrompt({
				plan: activeAcceptedPlanText ?? "",
				savedPlanPath: activeAcceptedPlanPath,
				feedback: feedback.trim(),
			});
			cleanupReviewPending = true;
			persistPlannerState();
			sendBuildFollowUp(prompt, ctx);
		}
	};

	const restorePlannerMode = (ctx: ExtensionContext) => {
		plannerMode = "plan";
		activeToolsBeforePlanMode = undefined;
		activeAcceptedPlanPath = undefined;
		activeAcceptedPlanText = undefined;
		cleanupReviewPending = false;

		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "custom" || entry.customType !== "planner-mode") continue;
			const data = entry.data as PlannerStateEntry | undefined;
			if (data?.mode) plannerMode = data.mode;
			if (Array.isArray(data?.activeToolsBeforePlanMode)) {
				activeToolsBeforePlanMode = data.activeToolsBeforePlanMode;
			}
			if (typeof data?.activeAcceptedPlanPath === "string") {
				activeAcceptedPlanPath = data.activeAcceptedPlanPath;
			}
			if (typeof data?.activeAcceptedPlanText === "string") {
				activeAcceptedPlanText = data.activeAcceptedPlanText;
			}
			if (typeof data?.cleanupReviewPending === "boolean") {
				cleanupReviewPending = data.cleanupReviewPending;
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

	pi.on("agent_start", async (_event, ctx) => {
		if (!ctx.hasUI || !isRefiningPlan) return;
		ctx.ui.setWorkingMessage("✏️ Refining plan...");
	});

	pi.on("before_agent_start", async (event) => {
		if (plannerMode !== "plan") return;

		return {
			systemPrompt:
				event.systemPrompt +
				"\n\nPlanner mode guidance:\n- You are currently in PLAN mode.\n- Focus on analysis, exploration, and producing a plan.\n- Do not attempt to modify files, run shell commands, or use non-read-only tools.\n- If the user wants implementation work, tell them to switch back to BUILD mode with /build.\n- When you propose work, format it as a numbered plan under a `Plan:` heading.\n- The only allowed tools in PLAN mode are: " +
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

	pi.on("agent_end", async (event, ctx) => {
		if (ctx.hasUI && isRefiningPlan) {
			ctx.ui.setWorkingMessage();
			isRefiningPlan = false;
		}

		if (plannerMode === "build") {
			await promptForCompletedPlanNextStep(ctx);
			return;
		}

		if (plannerMode !== "plan" || !ctx.hasUI) return;

		const plan = getLatestPlanFromMessages(event.messages as PlannerMessage[]);
		if (!plan) return;

		await promptForPlanNextStep(plan, ctx);
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

function getLatestPlanFromMessages(messages: PlannerMessage[]): string | undefined {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const message = messages[i];
		if (message.role !== "assistant") continue;
		const plan = extractPlanSection(extractTextContent(message.content));
		if (plan) return plan;
	}

	return undefined;
}

function buildPlanRefinementPrompt(plan: string, feedback: string): string {
	return [
		"Please refine the current plan using this feedback:",
		"",
		feedback,
		"",
		"Current plan:",
		"Plan:",
		plan,
		"",
		"Return an updated Plan: section with numbered steps.",
	].join("\n");
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return "Unknown error";
}

function isFileNotFoundError(error: unknown): boolean {
	return !!error && typeof error === "object" && "code" in error && error.code === "ENOENT";
}
