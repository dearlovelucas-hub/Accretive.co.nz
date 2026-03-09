export type AuthRole = "admin" | "member";

export type ResourceType =
  | "document"
  | "template"
  | "draft"
  | "job"
  | "matter"
  | "draft_output"
  | "activity"
  | "billing"
  | "demo_request";

export type ResourceAction = "read" | "write" | "download" | "run";

const POLICY: Record<ResourceType, Record<ResourceAction, readonly AuthRole[]>> = {
  document: {
    read: ["member", "admin"],
    write: ["member", "admin"],
    download: ["member", "admin"],
    run: ["admin"]
  },
  template: {
    read: ["member", "admin"],
    write: ["member", "admin"],
    download: ["member", "admin"],
    run: ["admin"]
  },
  draft: {
    read: ["member", "admin"],
    write: ["member", "admin"],
    download: ["member", "admin"],
    run: ["member", "admin"]
  },
  job: {
    read: ["member", "admin"],
    write: ["member", "admin"],
    download: ["member", "admin"],
    run: ["member", "admin"]
  },
  matter: {
    read: ["member", "admin"],
    write: ["member", "admin"],
    download: ["member", "admin"],
    run: ["member", "admin"]
  },
  draft_output: {
    read: ["member", "admin"],
    write: ["admin"],
    download: ["member", "admin"],
    run: ["admin"]
  },
  activity: {
    read: ["member", "admin"],
    write: ["admin"],
    download: ["admin"],
    run: ["admin"]
  },
  billing: {
    read: ["member", "admin"],
    write: ["member", "admin"],
    download: ["admin"],
    run: ["admin"]
  },
  demo_request: {
    read: ["admin"],
    write: ["member", "admin"],
    download: ["admin"],
    run: ["admin"]
  }
};

export function isRoleAllowed(resource: ResourceType, action: ResourceAction, role: AuthRole): boolean {
  const allowed = POLICY[resource]?.[action] ?? [];
  return allowed.includes(role);
}

