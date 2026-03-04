import type { DraftJobRecord } from "./draftJobsStore";

const DEFAULT_PREVIEW_LENGTH = 600;

export function buildDraftResultPayload(args: {
  job: DraftJobRecord;
  entitlement?: { active: boolean; plan: string; expiresAt?: string };
  previewLength?: number;
  upgradeUrlOrRoute?: string;
}) {
  const { job } = args;
  const previewLength = args.previewLength ?? DEFAULT_PREVIEW_LENGTH;
  const upgradeUrlOrRoute = args.upgradeUrlOrRoute ?? "/pricing";

  return {
    previewLength,
    upgradeUrlOrRoute,
    content: job.generatedOutput,
    plan: args.entitlement?.plan ?? "free",
    canDownload: true
  };
}
