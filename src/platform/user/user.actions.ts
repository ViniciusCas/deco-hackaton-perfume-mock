import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { APIError } from "better-auth/api";
import { getAuth } from "~/db/auth";
import type { Person } from "./user.types";
import { validateEmail, validatePassword } from "./user.validation";

interface AuthUser {
  id: string;
  email: string;
  givenName?: string | null;
  familyName?: string | null;
}

function toPerson(u: AuthUser | null | undefined): Person | null {
  if (!u) return null;
  return {
    "@id": u.id,
    email: u.email,
    givenName: u.givenName ?? undefined,
    familyName: u.familyName ?? undefined,
  };
}

// Better Auth's server API doesn't run inside an HTTP handler here, so it
// can't set the response's Set-Cookie header itself — forward whatever it
// produced (session cookie on sign-in/up, its clearing on sign-out) onto
// this server fn's own response, same idea as the old Shopify token cookie.
function forwardSetCookie(headers: Headers) {
  const cookies = headers.getSetCookie?.() ?? [];
  if (cookies.length) setResponseHeader("set-cookie", cookies);
}

async function rethrowAsPlainError<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof APIError) {
      throw new Error(err.body?.message ?? err.message ?? "Something went wrong.");
    }
    throw err;
  }
}

export const getUserServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Person | null> => {
    const request = getRequest();
    const auth = getAuth();
    const result = await auth.api.getSession({ headers: request.headers });
    return toPerson(result?.user as AuthUser | null | undefined);
  },
);

export const signInServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => input)
  .handler(async (ctx): Promise<Person | null> => {
    const auth = getAuth();
    const { headers, response } = await rethrowAsPlainError(() =>
      auth.api.signInEmail({
        body: { email: ctx.data.email, password: ctx.data.password },
        returnHeaders: true,
      }),
    );
    forwardSetCookie(headers);
    return toPerson(response?.user as AuthUser | null | undefined);
  });

export const signUpServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { email: string; password: string; firstName?: string; lastName?: string }) => input,
  )
  .handler(async (ctx): Promise<Person | null> => {
    const emailError = validateEmail(ctx.data.email);
    if (emailError) throw new Error(emailError);
    const passwordError = validatePassword(ctx.data.password);
    if (passwordError) throw new Error(passwordError);

    const auth = getAuth();
    const name =
      [ctx.data.firstName, ctx.data.lastName].filter(Boolean).join(" ").trim() || ctx.data.email;

    const { headers, response } = await rethrowAsPlainError(() =>
      auth.api.signUpEmail({
        body: {
          email: ctx.data.email,
          password: ctx.data.password,
          name,
          givenName: ctx.data.firstName,
          familyName: ctx.data.lastName,
        },
        returnHeaders: true,
      }),
    );
    forwardSetCookie(headers);
    return toPerson(response?.user as AuthUser | null | undefined);
  });

export const signOutServerFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<null> => {
    const request = getRequest();
    const auth = getAuth();
    const { headers } = await auth.api.signOut({
      headers: request.headers,
      returnHeaders: true,
    });
    forwardSetCookie(headers);
    return null;
  },
);
