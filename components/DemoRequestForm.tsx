"use client";

import { FormEvent, useMemo, useState } from "react";

type FormState = {
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

const roles = [
  "Partner",
  "Senior Associate",
  "Associate",
  "Junior Lawyer",
  "PSL/Knowledge",
  "IT/Security",
  "Operations",
  "Other"
];

const practiceOptions = ["Corporate/M&A", "Banking & Finance", "Real Estate", "Litigation", "Employment", "Other"];
const securityOptions = ["SSO/SAML", "Data residency", "Audit logs", "On-prem preference", "NDA required"];

const initialState: FormState = {
  fullName: "",
  email: "",
  organisation: "",
  role: "",
  practiceAreas: [],
  firmSize: "",
  docTypes: "",
  currentProcess: "",
  securityRequirements: [],
  notes: ""
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function DemoRequestForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(form.fullName.trim() && emailRegex.test(form.email) && form.organisation.trim()),
    [form]
  );

  function updateArrayField(field: "practiceAreas" | "securityRequirements", option: string, checked: boolean) {
    setForm((prev) => {
      const currentValues = prev[field];
      return {
        ...prev,
        [field]: checked ? [...currentValues, option] : currentValues.filter((value) => value !== option)
      };
    });
  }

  function validate() {
    const nextErrors: Record<string, string> = {};

    if (!form.fullName.trim()) nextErrors.fullName = "Full name is required.";
    if (!form.email.trim()) nextErrors.email = "Work email is required.";
    else if (!emailRegex.test(form.email)) nextErrors.email = "Enter a valid email address.";
    if (!form.organisation.trim()) nextErrors.organisation = "Firm or organisation is required.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage("");
    setToastMessage("");
    setSubmitError("");

    if (!validate()) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const body = (await response.json().catch(() => null)) as
        | { error?: string; warning?: string; notificationStatus?: string }
        | null;
      if (!response.ok) {
        setSubmitError(body?.error ?? "Unable to submit your request right now.");
        return;
      }

      setSuccessMessage(body?.warning ?? "Your request has been submitted. We will contact you shortly.");
      setToastMessage("Demo request submitted.");
      setForm(initialState);
      window.setTimeout(() => setToastMessage(""), 3200);
    } catch {
      setSubmitError("Unable to submit your request right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-6 top-20 z-50 rounded-lg border border-emerald-300/30 bg-emerald-900/80 px-4 py-3 text-sm text-emerald-100"
        >
          {toastMessage}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-8" noValidate>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">Full name *</span>
            <input
              required
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
            />
            {errors.fullName && <span className="mt-1 block text-sm text-rose-300">{errors.fullName}</span>}
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">Work email *</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
            />
            {errors.email && <span className="mt-1 block text-sm text-rose-300">{errors.email}</span>}
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm text-slate-700">Firm / organisation *</span>
            <input
              required
              value={form.organisation}
              onChange={(event) => setForm({ ...form, organisation: event.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
            />
            {errors.organisation && <span className="mt-1 block text-sm text-rose-300">{errors.organisation}</span>}
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">Role</span>
            <select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">Firm size</span>
            <select
              value={form.firmSize}
              onChange={(event) => setForm({ ...form, firmSize: event.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
            >
              <option value="">Select size</option>
              <option value="1-10">1-10</option>
              <option value="11-50">11-50</option>
              <option value="51-200">51-200</option>
              <option value="200+">200+</option>
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="mb-3 text-sm text-slate-700">Practice area</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {practiceOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.practiceAreas.includes(option)}
                  onChange={(event) => updateArrayField("practiceAreas", option, event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 bg-white accent-[#10243F]"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-700">Document types of interest</span>
          <input
            value={form.docTypes}
            onChange={(event) => setForm({ ...form, docTypes: event.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
            placeholder="e.g. Share purchase agreement, board resolutions"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-700">Current drafting tooling/process</span>
          <textarea
            value={form.currentProcess}
            onChange={(event) => setForm({ ...form, currentProcess: event.target.value })}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
          />
        </label>

        <fieldset>
          <legend className="mb-3 text-sm text-slate-700">Security requirements</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {securityOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.securityRequirements.includes(option)}
                  onChange={(event) => updateArrayField("securityRequirements", option, event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 bg-white accent-[#10243F]"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-700">Notes/message</span>
          <textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            rows={4}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="rounded-full border border-[#10243F] bg-[#10243F] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#0d1d33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Submitting..." : "Submit request"}
        </button>

        {submitError && (
          <p role="alert" className="rounded-lg border border-rose-300/30 bg-rose-900/40 p-3 text-sm text-rose-100">
            {submitError}
          </p>
        )}

        {successMessage && (
          <p role="status" aria-live="polite" className="rounded-lg border border-emerald-300/30 bg-emerald-900/40 p-3 text-sm text-emerald-100">
            {successMessage}
          </p>
        )}
      </form>
    </>
  );
}
