import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type ExtensionAPI, type ExtensionContext, DynamicBorder, withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { Container, matchesKey, type SelectItem, SelectList, Text, visibleWidth } from "@mariozechner/pi-tui";
import {
	buildAcceptedPlanExecutionPrompt,
	buildAdditionalWorkPrompt,
	buildPlanAutosavePath,
	buildSavedPlanSelectorLabel,
	extractPlanSection,
	extractTextContent,
	formatSavedPlanMarkdown,
	listSavedPlans,
	type SavedPlanRecord,
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
const SAVE_PLAN_FOR_LATER_CHOICE = "💾 Save plan for later";
const REFINE_PLAN_CHOICE = "✏️ Refine plan";
const DISCARD_PLAN_CHOICE = "❌ Discard plan";
const IMPLEMENT_SAVED_PLAN_CHOICE = "✅ Switch to BUILD mode and implement saved plan";
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

	const savePlan = async (plan: string, ctx: ExtensionContext) => {
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

	const showRequiredActionSelector = async (title: string, choices: string[], ctx: ExtensionContext) => {
		const items: SelectItem[] = choices.map((choice) => ({ value: choice, label: choice }));

		ctx.ui.setWorkingMessage("User input...");
		try {
			return await ctx.ui.custom<string>((tui, theme, _kb, done) => {
				const container = new Container();

				container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
				container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));

				const selectList = new SelectList(items, Math.min(items.length, 10), {
					selectedPrefix: (text) => theme.fg("accent", text),
					selectedText: (text) => theme.fg("accent", text),
					description: (text) => theme.fg("muted", text),
					scrollInfo: (text) => theme.fg("dim", text),
					noMatch: (text) => theme.fg("warning", text),
				});
				selectList.onSelect = (item) => done(item.value);
				container.addChild(selectList);

				container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select"), 1, 0));
				container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));

				return {
					render: (width: number) => container.render(width),
					invalidate: () => container.invalidate(),
					handleInput: (data: string) => {
						selectList.handleInput(data);
						tui.requestRender();
					},
				};
			});
		} finally {
			ctx.ui.setWorkingMessage();
		}
	};

	const showSavedPlansPopover = async (ctx: ExtensionContext) => {
		const savedPlans = await listSavedPlans(ctx.cwd);
		const savedPlanByPath = new Map(savedPlans.map((savedPlan) => [savedPlan.filePath, savedPlan]));
		const items: SelectItem[] = savedPlans.map((savedPlan) => ({
			value: savedPlan.filePath,
			label: buildSavedPlanSelectorLabel(savedPlan),
			description: buildPlanPreview(savedPlan.plan),
		}));

		ctx.ui.setWorkingMessage("User input...");
		try {
			return await ctx.ui.custom<SavedPlanRecord | undefined>(
				(tui, theme, _kb, done) => {
					const container = new Container();
					const border = (text: string) => theme.fg("accent", text);

					container.addChild(new Text(theme.fg("accent", theme.bold("Saved Plans")), 1, 0));

					if (items.length === 0) {
						container.addChild(new Text(theme.fg("muted", "No saved plans yet."), 1, 0));
						container.addChild(new Text(theme.fg("dim", "enter close • esc cancel"), 1, 0));

						return {
							render: (width: number) => renderBorderedPanel(container.render(Math.max(1, width - 2)), width, border),
							invalidate: () => container.invalidate(),
							handleInput: (data: string) => {
								if (matchesKey(data, "return") || matchesKey(data, "escape")) {
									done(undefined);
									return;
								}
							},
						};
					}

					const selectList = new SelectList(items, Math.min(items.length, 10), {
						selectedPrefix: (text) => theme.fg("accent", text),
						selectedText: (text) => theme.fg("accent", text),
						description: (text) => theme.fg("muted", text),
						scrollInfo: (text) => theme.fg("dim", text),
						noMatch: (text) => theme.fg("warning", text),
					});
					selectList.onSelect = (item) => done(savedPlanByPath.get(String(item.value)));
					selectList.onCancel = () => done(undefined);
					container.addChild(selectList);

					container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel"), 1, 0));

					return {
						render: (width: number) => renderBorderedPanel(container.render(Math.max(1, width - 2)), width, border),
						invalidate: () => container.invalidate(),
						handleInput: (data: string) => {
							selectList.handleInput(data);
							tui.requestRender();
						},
					};
				},
				{
					overlay: true,
					overlayOptions: {
						anchor: "center",
						width: "70%",
						minWidth: 60,
						maxHeight: "80%",
						margin: 1,
					},
				},
			);
		} finally {
			ctx.ui.setWorkingMessage();
		}
	};

	const promptForSavedPlanNextStep = async (savedPlan: SavedPlanRecord, ctx: ExtensionContext) => {
		if (!ctx.hasUI) return;

		const choice = await showRequiredActionSelector("Saved plan — what next?", [
			IMPLEMENT_SAVED_PLAN_CHOICE,
			REFINE_PLAN_CHOICE,
			KEEP_SAVED_PLAN_CHOICE,
		], ctx);

		if (choice === IMPLEMENT_SAVED_PLAN_CHOICE) {
			activeAcceptedPlanPath = savedPlan.filePath;
			activeAcceptedPlanText = savedPlan.plan;
			cleanupReviewPending = true;

			const implementationPrompt = buildAcceptedPlanExecutionPrompt({
				plan: savedPlan.plan,
				savedPlanPath: savedPlan.filePath,
			});
			setPlannerMode("build", ctx);
			ctx.ui.notify(`Resuming saved plan ${savedPlan.filePath}. Starting implementation...`, "success");
			sendBuildFollowUp(implementationPrompt, ctx);
			return;
		}

		if (choice === REFINE_PLAN_CHOICE) {
			const feedback = await ctx.ui.editor("How should the plan be refined?", "");
			if (!feedback?.trim()) {
				ctx.ui.notify("Refinement feedback is required.", "warning");
				return;
			}

			isRefiningPlan = true;
			pi.sendUserMessage(buildPlanRefinementPrompt(savedPlan.plan, feedback.trim()));
			return;
		}

		if (choice === KEEP_SAVED_PLAN_CHOICE) {
			ctx.ui.notify(`Kept saved plan ${savedPlan.filePath}`, "info");
		}
	};

	const promptForPlanNextStep = async (plan: string, ctx: ExtensionContext) => {
		if (!ctx.hasUI) return;

		const choice = await showRequiredActionSelector("Plan ready — what next?", [
			ACCEPT_PLAN_CHOICE,
			SAVE_PLAN_FOR_LATER_CHOICE,
			REFINE_PLAN_CHOICE,
			DISCARD_PLAN_CHOICE,
		], ctx);

		if (choice === ACCEPT_PLAN_CHOICE) {
			try {
				const filePath = await savePlan(plan, ctx);
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

		if (choice === SAVE_PLAN_FOR_LATER_CHOICE) {
			try {
				const filePath = await savePlan(plan, ctx);
				ctx.ui.notify(`Plan saved for later at ${filePath}.`, "success");
			} catch (error) {
				ctx.ui.notify(`Could not save the plan for later: ${getErrorMessage(error)}`, "error");
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

		const choice = await showRequiredActionSelector("Completed plan — what next?", [
			DELETE_COMPLETED_PLAN_CHOICE,
			KEEP_SAVED_PLAN_CHOICE,
			ADDITIONAL_WORK_CHOICE,
		], ctx);

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
		description: "Switch to plan mode, or use /plan list to browse saved plans",
		handler: async (args, ctx) => {
			if (args.trim() === "list") {
				setPlannerMode("plan", ctx);
				if (!ctx.hasUI) return;
				const savedPlan = await showSavedPlansPopover(ctx);
				if (!savedPlan) return;
				await promptForSavedPlanNextStep(savedPlan, ctx);
				return;
			}

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

function buildPlanPreview(plan: string): string {
	const firstLine = plan
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line.length > 0);

	if (!firstLine) {
		return "Saved plan";
	}

	return firstLine.length > 96 ? `${firstLine.slice(0, 93)}...` : firstLine;
}

function renderBorderedPanel(lines: string[], width: number, border: (text: string) => string): string[] {
	const innerWidth = Math.max(1, width - 2);
	const top = border(`┌${"─".repeat(innerWidth)}┐`);
	const body = lines.map((line) => {
		const padding = Math.max(0, innerWidth - visibleWidth(line));
		return `${border("│")}${line}${" ".repeat(padding)}${border("│")}`;
	});
	const bottom = border(`└${"─".repeat(innerWidth)}┘`);
	return [top, ...body, bottom];
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
