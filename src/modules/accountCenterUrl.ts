export const FALLBACK_ACCOUNT_CENTER_URL =
  "https://account.spark-app.store/account";

export const buildAccountFrameUrl = (
  baseUrl: string,
  username: string,
): string => {
  let url: URL;

  try {
    url = new URL(baseUrl);
  } catch {
    url = new URL(FALLBACK_ACCOUNT_CENTER_URL);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    url = new URL(FALLBACK_ACCOUNT_CENTER_URL);
  }

  const allowedParams = new URLSearchParams();
  allowedParams.set("view", "management");
  allowedParams.set("user", username);
  url.search = allowedParams.toString();

  return url.toString();
};
