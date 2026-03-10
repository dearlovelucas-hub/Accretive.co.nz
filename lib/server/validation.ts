const allowedRoles = new Set([
  "",
  "Partner",
  "Senior Associate",
  "Associate",
  "Junior Lawyer",
  "PSL/Knowledge",
  "IT/Security",
  "Operations",
  "Other"
]);

const allowedPracticeAreas = new Set(["Corporate/M&A", "Banking & Finance", "Real Estate", "Litigation", "Employment", "Other"]);
const allowedSecurityRequirements = new Set(["SSO/SAML", "Data residency", "Audit logs", "On-prem preference", "NDA required"]);
const allowedFirmSizes = new Set(["", "1-10", "11-50", "51-200", "200+"]);

export type DemoRequestInput = {
  fullName: string;
  email: string;
  organisation: string;
  role: string;
  practiceAreas: string[];
  firmSize: string;
  docTypes: string;
  currentProcess: string;
  securityRequirements: string[];
  notes: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateDemoRequest(input: unknown):
  | { success: true; data: DemoRequestInput }
  | { success: false; message: string } {
  if (!input || typeof input !== "object") {
    return { success: false, message: "Invalid payload." };
  }

  const candidate = input as Record<string, unknown>;
  const fullName = String(candidate.fullName ?? "").trim();
  const email = String(candidate.email ?? "").trim();
  const organisation = String(candidate.organisation ?? "").trim();
  const role = String(candidate.role ?? "").trim();
  const firmSize = String(candidate.firmSize ?? "").trim();
  const docTypes = String(candidate.docTypes ?? "").trim();
  const currentProcess = String(candidate.currentProcess ?? "").trim();
  const notes = String(candidate.notes ?? "").trim();
  const practiceAreas = Array.isArray(candidate.practiceAreas)
    ? candidate.practiceAreas.map((value) => String(value))
    : [];
  const securityRequirements = Array.isArray(candidate.securityRequirements)
    ? candidate.securityRequirements.map((value) => String(value))
    : [];

  if (!fullName) return { success: false, message: "Full name is required." };
  if (!email || !emailRegex.test(email)) return { success: false, message: "Valid work email is required." };
  if (!organisation) return { success: false, message: "Firm or organisation is required." };
  if (!allowedRoles.has(role)) return { success: false, message: "Invalid role." };
  if (!allowedFirmSizes.has(firmSize)) return { success: false, message: "Invalid firm size." };
  if (practiceAreas.some((area) => !allowedPracticeAreas.has(area))) {
    return { success: false, message: "Invalid practice area selection." };
  }
  if (securityRequirements.some((item) => !allowedSecurityRequirements.has(item))) {
    return { success: false, message: "Invalid security requirement selection." };
  }

  return {
    success: true,
    data: {
      fullName,
      email,
      organisation,
      role,
      practiceAreas,
      firmSize,
      docTypes,
      currentProcess,
      securityRequirements,
      notes
    }
  };
}

export function validateDraftJobInput(input: {
  templateFileName: string;
  dealInfo: string;
  transactionDocumentCount: number;
}): { success: true } | { success: false; message: string } {
  const templateFileName = input.templateFileName.trim().toLowerCase();

  if (!templateFileName) return { success: false, message: "Template file is required." };
  if (!templateFileName.endsWith(".docx") && !templateFileName.endsWith(".pdf")) {
    return { success: false, message: "Template must be DOCX or PDF." };
  }
  if (input.transactionDocumentCount < 1) {
    return { success: false, message: "At least one transaction document is required." };
  }

  return { success: true };
}
