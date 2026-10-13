import type { Actor, RequestRef, RoleHolderCounts, Parties, Person } from "@/lib/workflow";

export const DEPT_LAND = "dept-land";
export const DEPT_MALLS = "dept-malls";
export const BU_LAND = "bu-land";
export const BU_MALLS = "bu-malls";

export const requester: Actor = { id: "u-req", roles: [], hodDepartmentIds: [], buAdminBusinessUnitIds: [] };
export const hodLand: Actor = { id: "u-hod", roles: [], hodDepartmentIds: [DEPT_LAND], buAdminBusinessUnitIds: [] };
export const hodMalls: Actor = { id: "u-hod-m", roles: [], hodDepartmentIds: [DEPT_MALLS], buAdminBusinessUnitIds: [] };
export const lnd: Actor = { id: "u-lnd", roles: ["LND"], hodDepartmentIds: [], buAdminBusinessUnitIds: [] };
export const hr: Actor = { id: "u-hr", roles: ["HR_HEAD"], hodDepartmentIds: [], buAdminBusinessUnitIds: [] };
export const admin: Actor = { id: "u-admin", roles: ["SYS_ADMIN"], hodDepartmentIds: [], buAdminBusinessUnitIds: [] };
export const buAdminLand: Actor = { id: "u-bua", roles: [], hodDepartmentIds: [], buAdminBusinessUnitIds: [BU_LAND] };
export const buAdminMalls: Actor = { id: "u-bua-m", roles: [], hodDepartmentIds: [], buAdminBusinessUnitIds: [BU_MALLS] };
export const stranger: Actor = { id: "u-x", roles: [], hodDepartmentIds: [], buAdminBusinessUnitIds: [] };

export const counts: RoleHolderCounts = { lnd: 2, hrHead: 1 };

export function req(status: RequestRef["status"], over: Partial<RequestRef> = {}): RequestRef {
  return { status, requesterId: requester.id, departmentId: DEPT_LAND, businessUnitId: BU_LAND, ...over };
}

const p = (id: string, name: string): Person => ({ id, name, email: `${name.toLowerCase()}@wct.my` });
export const P = {
  requester: p("u-req", "Req"),
  hod: p("u-hod", "Hod"),
  lnd1: p("u-lnd", "Lnd1"),
  lnd2: p("u-lnd2", "Lnd2"),
  hr: p("u-hr", "Hr"),
  bua: p("u-bua", "Bua"),
};
export const parties: Parties = {
  requester: P.requester,
  hod: P.hod,
  lnd: [P.lnd1, P.lnd2],
  hrHeads: [P.hr],
  buAdmins: [P.bua],
};
