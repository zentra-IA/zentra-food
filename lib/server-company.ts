import { NextRequest } from "next/server";

export function getUserId(req: NextRequest) {
  return (
    req.cookies.get("zentra_user_id")?.value ||
    req.headers.get("x-user-id") ||
    null
  );
}

export function getCompanyId(req: NextRequest) {
  return (
    req.cookies.get("zentra_company_id")?.value ||
    req.headers.get("x-company-id") ||
    process.env.DEFAULT_COMPANY_ID ||
    null
  );
}

export function getBranchId(req: NextRequest) {
  return (
    req.cookies.get("zentra_branch_id")?.value ||
    req.headers.get("x-branch-id") ||
    null
  );
}

export function requireCompany(req: NextRequest) {
  const userId = getUserId(req);
  const companyId = getCompanyId(req);
  const branchId = getBranchId(req);

  if (!companyId) {
    throw new Error("Empresa não identificada");
  }

  return {
    userId,
    companyId,
    branchId,
  };
}