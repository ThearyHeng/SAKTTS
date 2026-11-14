import { NextRequest, NextResponse } from "next/server";
import {
  createUserAccount,
  deleteUserAccount,
  normalizePlan,
  readStore,
  resolveUserFromStore,
  toPublicUser,
  updateUserAccount,
  writeStore,
  isUserAdmin,
  type UserRole,
  type UserStatus,
} from "@/lib/store";
import { getSessionUserId, setSessionUserCookie } from "@/lib/auth-session";

const VALID_ROLES = new Set<UserRole>(["owner", "admin", "user", "member", "billing"]);
const VALID_STATUSES = new Set<UserStatus>(["active", "suspended"]);

export async function GET(req: NextRequest) {
  const store = readStore();
  const sessionId = getSessionUserId(req);
  const active = resolveUserFromStore(store, sessionId);
  const isAdmin = isUserAdmin(active.role);

  // If user is not admin, only return active user's own profile and restricted summary
  if (!isAdmin) {
    return NextResponse.json({
      users: [toPublicUser(active)],
      activeUserId: active.id,
      activeUser: toPublicUser(active),
      creditPolicy: store.creditPolicy,
      summary: {
        totalUsers: 1,
        activeUsers: active.status === "active" ? 1 : 0,
        suspendedUsers: active.status === "suspended" ? 1 : 0,
        totalCreditsPool: active.creditsBalance,
        totalCreditsUsed: active.creditsUsedTotal,
        lowBalanceUsers: 0,
      },
    });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const roleFilter = req.nextUrl.searchParams.get("role") ?? "";
  const statusFilter = req.nextUrl.searchParams.get("status") ?? "";

  const allPublic = store.users.map(toPublicUser);
  const filtered = allPublic.filter((u) => {
    if (roleFilter && roleFilter !== "all" && u.role !== roleFilter) return false;
    if (statusFilter && statusFilter !== "all" && u.status !== statusFilter) return false;
    if (
      q &&
      !u.name.toLowerCase().includes(q) &&
      !u.email.toLowerCase().includes(q) &&
      !u.workspace.toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  const threshold = store.creditPolicy.lowBalanceThreshold ?? 500;
  return NextResponse.json({
    users: filtered,
    activeUserId: active.id,
    activeUser: toPublicUser(active),
    creditPolicy: store.creditPolicy,
    summary: {
      totalUsers: allPublic.length,
      activeUsers: allPublic.filter((u) => u.status === "active").length,
      suspendedUsers: allPublic.filter((u) => u.status === "suspended").length,
      totalCreditsPool: allPublic.reduce((sum, u) => sum + u.creditsBalance, 0),
      totalCreditsUsed: allPublic.reduce((sum, u) => sum + u.creditsUsedTotal, 0),
      lowBalanceUsers: allPublic.filter(
        (u) => u.status === "active" && u.plan !== "enterprise" && u.creditsBalance <= threshold
      ).length,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = readStore();
    const actor = resolveUserFromStore(store, getSessionUserId(req));

    if (!isUserAdmin(actor.role)) {
      return NextResponse.json(
        { error: "Administrator privileges required to create user accounts." },
        { status: 403 }
      );
    }

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const role: UserRole = VALID_ROLES.has(body.role) ? body.role : "member";
    const status: UserStatus = VALID_STATUSES.has(body.status) ? body.status : "active";
    const plan = normalizePlan(body.plan);
    const workspace = typeof body.workspace === "string" ? body.workspace.trim() : undefined;
    const password = typeof body.password === "string" ? body.password.trim() : undefined;
    const initialCredits =
      typeof body.initialCredits === "number" && Number.isFinite(body.initialCredits)
        ? body.initialCredits
        : undefined;
    const makeActive = Boolean(body.makeActive);

    if (!name) {
      return NextResponse.json({ error: "User full name is required" }, { status: 400 });
    }
    if (password && password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const created = createUserAccount({
      name,
      email,
      role,
      status,
      plan,
      workspace,
      password,
      initialCredits,
      makeActive,
      actorEmail: actor.email,
    });

    const res = NextResponse.json(
      {
        user: toPublicUser(created.user),
        activeUserId: created.store.activeUserId,
      },
      { status: 201 }
    );
    if (makeActive) {
      setSessionUserCookie(res, created.user.id);
    }
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create user";
    const status = msg.toLowerCase().includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const store = readStore();
    const actor = resolveUserFromStore(store, getSessionUserId(req));

    if (!isUserAdmin(actor.role)) {
      return NextResponse.json(
        { error: "Administrator privileges required to manage user accounts." },
        { status: 403 }
      );
    }

    if (body.action === "switchActive") {
      const targetId = String(body.userId ?? "").trim();
      const target = store.users.find((u) => u.id === targetId);
      if (!target) {
        return NextResponse.json({ error: "User account not found" }, { status: 404 });
      }
      if (target.status === "suspended") {
        return NextResponse.json(
          { error: "Cannot switch into a suspended user account. Activate it first." },
          { status: 403 }
        );
      }
      target.lastActiveAt = new Date().toISOString();
      store.activeUserId = target.id;
      writeStore(store);

      const res = NextResponse.json({
        activeUserId: target.id,
        activeUser: toPublicUser(target),
      });
      setSessionUserCookie(res, target.id);
      return res;
    }

    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "User id is required" }, { status: 400 });
    }
    if (body.password && String(body.password).trim().length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const updated = updateUserAccount(
      id,
      {
        name: body.name,
        email: body.email,
        role: VALID_ROLES.has(body.role) ? body.role : undefined,
        status: VALID_STATUSES.has(body.status) ? body.status : undefined,
        plan: typeof body.plan === "string" ? normalizePlan(body.plan) : undefined,
        workspace: body.workspace,
        password: typeof body.password === "string" ? body.password : undefined,
        resetCreditsToPlan: Boolean(body.resetCreditsToPlan),
      },
      actor.email
    );

    return NextResponse.json({
      user: toPublicUser(updated.user),
      activeUserId: updated.store.activeUserId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update user";
    const status = msg.toLowerCase().includes("already uses") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const store = readStore();
    const actor = resolveUserFromStore(store, getSessionUserId(req));

    if (!isUserAdmin(actor.role)) {
      return NextResponse.json(
        { error: "Administrator privileges required to delete user accounts." },
        { status: 403 }
      );
    }

    const id = req.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }
    const updated = deleteUserAccount(id);
    const res = NextResponse.json({
      ok: true,
      activeUserId: updated.activeUserId,
      users: updated.users.map(toPublicUser),
    });
    const sessionUid = getSessionUserId(req);
    if (sessionUid === id) {
      setSessionUserCookie(res, updated.activeUserId);
    }
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete user";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
