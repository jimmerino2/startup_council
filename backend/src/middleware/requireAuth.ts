import type { NextFunction, Request, Response } from "express";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAnonClient, createUserScopedClient } from "../supabase/client.js";

export interface AuthedRequest extends Request {
  user: User;
  supabase: SupabaseClient;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const anonClient = createAnonClient();
  const { data, error } = await anonClient.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  (req as AuthedRequest).user = data.user;
  (req as AuthedRequest).supabase = createUserScopedClient(token);
  next();
}
