import { computed, ref } from "vue";

import { setBackendToken } from "@/modules/backendApi";
import type { AuthSession, SparkUser } from "./typedefinition";

const AUTH_STORAGE_KEY = "spark-store-auth";

const isSparkUser = (value: unknown): value is SparkUser => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "number" &&
    typeof user.flarumUserId === "string" &&
    typeof user.username === "string" &&
    typeof user.displayName === "string" &&
    typeof user.avatarUrl === "string" &&
    typeof user.forumLevel === "string" &&
    Array.isArray(user.forumGroups) &&
    user.forumGroups.every((group) => typeof group === "string")
  );
};

const isAuthSession = (value: unknown): value is AuthSession => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.accessToken === "string" &&
    session.accessToken.length > 0 &&
    session.tokenType === "bearer" &&
    isSparkUser(session.user)
  );
};

const loadStoredSession = (): AuthSession | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isAuthSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const authSession = ref<AuthSession | null>(loadStoredSession());
export const currentUser = computed(() => authSession.value?.user ?? null);
export const isLoggedIn = computed(() => authSession.value !== null);

setBackendToken(authSession.value?.accessToken ?? null);

export const setAuthSession = (session: AuthSession): void => {
  authSession.value = session;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  setBackendToken(session.accessToken);
};

export const logout = (): void => {
  authSession.value = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  setBackendToken(null);
};
