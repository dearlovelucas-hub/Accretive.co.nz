import * as crypto from "node:crypto";
import { query } from "../../src/server/db/index.ts";

export type DemoRequestRecord = {
  id: string;
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
  submittedAt: string;
};

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapRow(row: Record<string, unknown>): DemoRequestRecord {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    organisation: String(row.organisation),
    role: String(row.role),
    practiceAreas: Array.isArray(row.practice_areas) ? row.practice_areas.map((value) => String(value)) : [],
    firmSize: String(row.firm_size),
    docTypes: String(row.doc_types),
    currentProcess: String(row.current_process),
    securityRequirements: Array.isArray(row.security_requirements)
      ? row.security_requirements.map((value) => String(value))
      : [],
    notes: String(row.notes),
    submittedAt: toIso(row.submitted_at)
  };
}

export async function createDemoRequest(input: Omit<DemoRequestRecord, "id" | "submittedAt">): Promise<DemoRequestRecord> {
  const records = await query(
    `INSERT INTO demo_requests (
      id,
      full_name,
      email,
      organisation,
      role,
      practice_areas,
      firm_size,
      doc_types,
      current_process,
      security_requirements,
      notes,
      consent
    ) VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10::text[], $11, $12)
    RETURNING *`,
    [
      crypto.randomUUID(),
      input.fullName,
      input.email,
      input.organisation,
      input.role,
      input.practiceAreas,
      input.firmSize,
      input.docTypes,
      input.currentProcess,
      input.securityRequirements,
      input.notes,
      true
    ],
    (row) => mapRow(row as Record<string, unknown>)
  );

  return records[0];
}

export async function listDemoRequests(): Promise<DemoRequestRecord[]> {
  return query(`SELECT * FROM demo_requests ORDER BY submitted_at DESC`, [], (row) => mapRow(row as Record<string, unknown>));
}
