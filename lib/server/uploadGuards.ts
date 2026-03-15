export type UploadRule = {
  fieldName: string;
  label: string;
  required: boolean;
  minCount: number;
  maxCount: number;
  maxBytesPerFile: number;
  allowedExtensions: readonly string[];
  allowedMimeTypes: readonly string[];
};

export type UploadValidationFailure = {
  ok: false;
  status: 400 | 413;
  error: string;
  code: "missing" | "invalid_count" | "invalid_type" | "too_large";
};

export type UploadValidationSuccess = {
  ok: true;
  files: File[];
};

export type UploadValidationResult = UploadValidationSuccess | UploadValidationFailure;

const GENERIC_MIME_TYPES = new Set(["application/octet-stream"]);

export const TEMPLATE_UPLOAD_RULE: UploadRule = {
  fieldName: "templateFile",
  label: "Template file",
  required: true,
  minCount: 1,
  maxCount: 1,
  maxBytesPerFile: 20 * 1024 * 1024,
  allowedExtensions: [".docx"],
  allowedMimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
};

export const TRANSACTION_UPLOAD_RULE: UploadRule = {
  fieldName: "transactionFiles",
  label: "Transaction file",
  required: true,
  minCount: 1,
  maxCount: 10,
  maxBytesPerFile: 25 * 1024 * 1024,
  allowedExtensions: [".pdf", ".docx", ".txt"],
  allowedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain"
  ]
};

export const TERM_SHEET_UPLOAD_RULE: UploadRule = {
  fieldName: "termSheet",
  label: "Term sheet",
  required: false,
  minCount: 0,
  maxCount: 1,
  maxBytesPerFile: 20 * 1024 * 1024,
  allowedExtensions: [".pdf", ".docx", ".txt"],
  allowedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain"
  ]
};

export const MATTER_PRECEDENT_UPLOAD_RULE: UploadRule = {
  fieldName: "file",
  label: "Matter upload",
  required: true,
  minCount: 1,
  maxCount: 1,
  maxBytesPerFile: 50 * 1024 * 1024,
  allowedExtensions: [".pdf", ".docx"],
  allowedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ]
};

export const MATTER_TERMSHEET_UPLOAD_RULE: UploadRule = {
  fieldName: "file",
  label: "Matter upload",
  required: true,
  minCount: 1,
  maxCount: 1,
  maxBytesPerFile: 50 * 1024 * 1024,
  allowedExtensions: [".pdf", ".docx", ".txt"],
  allowedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain"
  ]
};

function normalizeMime(value: string): string {
  return value.trim().toLowerCase();
}

function getLowerExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }
  return fileName.slice(lastDot).toLowerCase();
}

function isAllowedMime(mimeType: string, allowedMimeTypes: readonly string[]): boolean {
  const normalized = normalizeMime(mimeType);
  if (!normalized || GENERIC_MIME_TYPES.has(normalized)) {
    return true;
  }
  return allowedMimeTypes.map((item) => item.toLowerCase()).includes(normalized);
}

function countErrorMessage(rule: UploadRule): string {
  if (rule.maxCount === 1) {
    return `${rule.label} must be provided exactly once.`;
  }
  return `${rule.label} count must be between ${rule.minCount} and ${rule.maxCount}.`;
}

export function validateUploadField(form: FormData, rule: UploadRule): UploadValidationResult {
  const values = form.getAll(rule.fieldName);
  const files = values.filter((value): value is File => value instanceof File);
  const hasNonFiles = values.some((value) => !(value instanceof File));

  if (!rule.required && values.length === 0) {
    return { ok: true, files: [] };
  }

  if (rule.required && values.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "missing",
      error: `${rule.label} is required.`
    };
  }

  if (hasNonFiles) {
    return {
      ok: false,
      status: 400,
      code: "invalid_type",
      error: `${rule.label} must be uploaded as file content.`
    };
  }

  if (files.length < rule.minCount || files.length > rule.maxCount) {
    return {
      ok: false,
      status: 400,
      code: "invalid_count",
      error: countErrorMessage(rule)
    };
  }

  for (const file of files) {
    if (file.size > rule.maxBytesPerFile) {
      return {
        ok: false,
        status: 413,
        code: "too_large",
        error: `${rule.label} exceeds maximum size of ${Math.floor(rule.maxBytesPerFile / (1024 * 1024))} MB.`
      };
    }

    const extension = getLowerExtension(file.name);
    if (!rule.allowedExtensions.includes(extension) || !isAllowedMime(file.type, rule.allowedMimeTypes)) {
      return {
        ok: false,
        status: 400,
        code: "invalid_type",
        error: `${rule.label} type is invalid. Allowed file types: ${rule.allowedExtensions.join(", ")}.`
      };
    }
  }

  return { ok: true, files };
}
