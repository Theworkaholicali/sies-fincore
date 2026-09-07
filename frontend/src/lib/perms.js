// Frontend nav visibility mirrors backend view permissions (RBAC).
export const NAV_VIEW = {
  super_admin: "*",
  finance_manager: "*",
  management: ["dashboard", "finance", "accounting", "fees", "budget", "procurement", "assets", "grants", "analytics", "reports", "audit", "documents", "ai_assistant", "approvals"],
  auditor: ["dashboard", "finance", "accounting", "fees", "budget", "procurement", "assets", "grants", "analytics", "reports", "audit", "documents", "ai_assistant", "approvals"],
  principal: ["dashboard", "finance", "accounting", "fees", "budget", "procurement", "assets", "grants", "analytics", "reports", "audit", "documents", "ai_assistant", "approvals"],
  accountant: ["dashboard", "finance", "accounting", "fees", "budget", "procurement", "reports", "analytics", "documents", "ai_assistant", "approvals"],
  department_head: ["dashboard", "budget", "procurement", "finance", "reports", "analytics", "ai_assistant", "approvals"],
  procurement_officer: ["dashboard", "procurement", "finance", "budget", "documents", "reports", "approvals"],
  student: ["fees"],
  vendor: ["procurement"],
};

export function canView(role, moduleId) {
  const v = NAV_VIEW[role];
  if (!v) return false;
  if (v === "*") return true;
  return v.includes(moduleId);
}
