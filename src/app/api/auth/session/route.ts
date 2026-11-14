import { NextRequest, NextResponse } from "next/server";
import {
  authenticateUser,
  createUserAccount,
  readStore,
  resolveUserFromStore,
  toPublicUser,
  writeStore,
} from "@/lib/store";
import {
  clearSessionUserCookie,
  getSessionUserId,
  setSessionUserCookie,
} from "@/lib/auth-session";

export async function GET(req: NextRequest) {
  const store = readStore();
  const user = resolveUserFromStore(store, getSessionUserId(req));
  return NextResponse.json({ user: toPublicUser(user) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = String(body.mode ?? "login");
    const identifier = String(body.email ?? body.identifier ?? "").trim();
    const email = identifier.toLowerCase();
    const password = String(body.password ?? "");

    if (mode === "register") {
      const name = String(body.name ?? "").trim() || email.split("@")[0];
      const workspace = String(body.workspace ?? "").trim() || `${name}'s Workspace`;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { error: "Please enter a valid email address." },
          { status: 400 }
        );
      }
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters." },
          { status: 400 }
        );
      }

      const created = createUserAccount({
        name,
        email,
        role: "member",
        plan: "free",
        workspace,
        password,
        makeActive: true,
      });

      const res = NextResponse.json({ user: toPublicUser(created.user) }, { status: 201 });
      setSessionUserCookie(res, created.user.id);
      return res;
    }

    if (mode === "oauth_demo") {
      const store = readStore();
      const targetEmail = email || "studio@saktts.ai";
      let user = store.users.find((u) => u.email.toLowerCase() === targetEmail);
      if (user) {
        if (user.status === "suspended") {
          return NextResponse.json(
            { error: "This account is suspended. Reactivate it in Users & Credits." },
            { status: 403 }
          );
        }
        user.lastActiveAt = new Date().toISOString();
        store.activeUserId = user.id;
        writeStore(store);
      } else {
        const created = createUserAccount({
          name: String(body.name ?? "").trim() || "Google Studio User",
          email: targetEmail,
          role: "member",
          plan: "free",
          workspace: "SAKTTS Google Studio",
          makeActive: true,
        });
        user = created.user;
      }

      const res = NextResponse.json({ user: toPublicUser(user) });
      setSessionUserCookie(res, user.id);
      return res;
    }

    // Default: credential login (supports email or username)
    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Email or username and password are required." },
        { status: 400 }
      );
    }

    const { user } = authenticateUser(identifier, password);
    const res = NextResponse.json({ user: toPublicUser(user) });
    setSessionUserCookie(res, user.id);
    return res;
  } catch (err) {
    const code = err instanceof Error ? err.message : "Failed to sign in";
    if (code === "AUTH_NOT_FOUND" || code === "AUTH_INVALID_PASSWORD") {
      return NextResponse.json(
        { error: "No matching active account found, or incorrect password." },
        { status: 401 }
      );
    }
    if (code === "AUTH_SUSPENDED") {
      return NextResponse.json(
        { error: "This account has been suspended by an administrator." },
        { status: 403 }
      );
    }
    if (code.toLowerCase().includes("already exists")) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: code }, { status: 400 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearSessionUserCookie(res);
  return res;
}
