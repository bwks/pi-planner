import path from "node:path";

const PLAN_HEADER_PATTERN = /^\s*(?:\*\*|__)?Plan:(?:\*\*|__)?\s*$/i;
const MARKDOWN_HEADING_PATTERN = /^\s*#{1,6}\s+\S/;
const SECTION_HEADER_PATTERN = /^\s*(?:\*\*|__)?[A-Z][A-Za-z0-9 /()&-]{0,80}:(?:\*\*|__)?\s*$/;
const NUMBERED_STEP_PATTERN = /^\s*\d+[.)]\s+\S/;

export type SavedPlanOptions = {
	plan: string;
	savedAt: Date;
	sessionId: string;
	sessionName?: string;
};

export type PlanAutosavePathOptions = {
	cwd: string;
	savedAt: Date;
	sessionId: string;
	sessionName?: string;
};

export type AcceptedPlanExecutionPromptOptions = {
	plan: string;
	savedPlanPath: string;
};

export function extractTextContent(content: unknown): string {
	if (typeof content === "string") {
		return content;
	}

	if (!Array.isArray(content)) {
		return "";
	}

	return content
		.filter((block): block is { type?: string; text?: string } => !!block && typeof block === "object")
		.filter((block) => block.type === "text" && typeof block.text === "string")
		.map((block) => block.text)
		.join("\n");
}

export function extractPlanSection(text: string): string | undefined {
	const lines = text.replace(/\r\n/g, "\n").split("\n");
	const planHeaderIndex = lines.findIndex((line) => PLAN_HEADER_PATTERN.test(line));
	if (planHeaderIndex === -1) return undefined;

	const planLines: string[] = [];
	let sawNumberedStep = false;

	for (let i = planHeaderIndex + 1; i < lines.length; i += 1) {
		const line = lines[i].trimEnd();
		const trimmed = line.trim();

		if (planLines.length === 0 && trimmed.length === 0) {
			continue;
		}

		if (trimmed.length === 0) {
			if (sawNumberedStep) {
				const nextNonEmptyLine = findNextNonEmptyLine(lines, i + 1);
				if (nextNonEmptyLine && isSectionHeader(nextNonEmptyLine)) {
					break;
				}
			}
			planLines.push("");
			continue;
		}

		if (sawNumberedStep && isSectionHeader(trimmed)) {
			break;
		}

		if (NUMBERED_STEP_PATTERN.test(trimmed)) {
			sawNumberedStep = true;
		}

		planLines.push(line);
	}

	if (!sawNumberedStep) return undefined;

	const normalizedPlan = trimEmptyLines(planLines).join("\n");
	return normalizedPlan.length > 0 ? normalizedPlan : undefined;
}

export function formatSavedPlanMarkdown({ plan, savedAt, sessionId, sessionName }: SavedPlanOptions): string {
	const lines = [
		"# Saved Plan",
		"",
		`- Saved: ${formatTimestampForDisplay(savedAt)}`,
		`- Session: ${getSessionLabel(sessionName, sessionId)}`,
		`- Session ID: ${sessionId}`,
		"",
		"## Plan",
		"",
		plan.trim(),
		"",
	];

	return lines.join("\n");
}

export function buildPlanAutosavePath({ cwd, savedAt, sessionId, sessionName }: PlanAutosavePathOptions): string {
	const sessionLabel = getSessionLabel(sessionName, sessionId);
	const slug = slugify(sessionLabel) || slugify(sessionId) || "plan";
	return path.join(cwd, ".pi", "plans", `${formatTimestampForFilename(savedAt)}-${slug}.md`);
}

export function buildAcceptedPlanExecutionPrompt({
	plan,
	savedPlanPath,
}: AcceptedPlanExecutionPromptOptions): string {
	return [
		"The plan was accepted and you are now in BUILD mode.",
		`The accepted plan was saved to: ${savedPlanPath}`,
		"Implement the plan now.",
		"",
		"Plan:",
		plan.trim(),
	].join("\n");
}

function findNextNonEmptyLine(lines: string[], startIndex: number): string | undefined {
	for (let i = startIndex; i < lines.length; i += 1) {
		const trimmed = lines[i].trim();
		if (trimmed.length > 0) {
			return trimmed;
		}
	}

	return undefined;
}

function isSectionHeader(line: string): boolean {
	if (PLAN_HEADER_PATTERN.test(line)) return false;
	return MARKDOWN_HEADING_PATTERN.test(line) || SECTION_HEADER_PATTERN.test(line);
}

function trimEmptyLines(lines: string[]): string[] {
	let start = 0;
	let end = lines.length;

	while (start < end && lines[start].trim().length === 0) {
		start += 1;
	}

	while (end > start && lines[end - 1].trim().length === 0) {
		end -= 1;
	}

	return lines.slice(start, end);
}

function getSessionLabel(sessionName: string | undefined, sessionId: string): string {
	const trimmedName = sessionName?.trim();
	return trimmedName && trimmedName.length > 0 ? trimmedName : sessionId;
}

function slugify(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

function formatTimestampForDisplay(date: Date): string {
	const year = date.getUTCFullYear();
	const month = pad(date.getUTCMonth() + 1);
	const day = pad(date.getUTCDate());
	const hours = pad(date.getUTCHours());
	const minutes = pad(date.getUTCMinutes());
	const seconds = pad(date.getUTCSeconds());
	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

function formatTimestampForFilename(date: Date): string {
	const year = date.getUTCFullYear();
	const month = pad(date.getUTCMonth() + 1);
	const day = pad(date.getUTCDate());
	const hours = pad(date.getUTCHours());
	const minutes = pad(date.getUTCMinutes());
	const seconds = pad(date.getUTCSeconds());
	return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}
