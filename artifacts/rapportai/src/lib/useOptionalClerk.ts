import { useUser as clerkUseUser, useClerk as clerkUseClerk } from "@clerk/react";

const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function noopUseUser() {
  return { user: null as null, isLoaded: true as const, isSignedIn: false as const };
}

function noopUseClerk() {
  return {
    signOut: async (_opts?: unknown) => {},
    user: null,
    session: null,
  };
}

export const useOptionalUser  = CLERK_ENABLED ? clerkUseUser  : noopUseUser;
export const useOptionalClerk = CLERK_ENABLED ? clerkUseClerk : noopUseClerk;
