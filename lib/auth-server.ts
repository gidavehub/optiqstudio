import { NextRequest } from "next/server";
import { adminAuth } from "./firebase-admin";

export interface AuthedUser {
  uid: string;
  email?: string;
  name?: string;
}

export class AuthError extends Error {
  status = 401;
}

/**
 * Verifies the Firebase ID token sent by the client as a Bearer header.
 * Token verification only needs Google's public certs, so this works even
 * before service-account credentials are configured.
 */
export async function requireUser(req: NextRequest): Promise<AuthedUser> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new AuthError("Missing Authorization bearer token");
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: (decoded.name as string) || undefined,
    };
  } catch {
    throw new AuthError("Invalid or expired session token");
  }
}
