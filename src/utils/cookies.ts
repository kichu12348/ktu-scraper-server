export const extractCookiesToJar = (
  res: Response,
  cookieJar: Map<string, string>,
) => {
  const setCookies = res.headers.get("set-cookie")?.split(",") || [];
  for (const cookieStr of setCookies) {
    const primary = cookieStr.split(";")[0];
    const [key, ...valParts] = primary.split("=");
    const val = valParts.join("=");
    if (key && val) {
      cookieJar.set(key.trim(), val.trim());
    }
  }
};

export const getCookieString = (cookieJar: Map<string, string>) => {
  return Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
};
