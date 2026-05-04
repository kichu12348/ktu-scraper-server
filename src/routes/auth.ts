import { Hono } from "hono";
import { config, BROWSER_HEADERS } from "../config/constants";
import { extractCookiesToJar, getCookieString } from "../utils/cookies";
import { resilientFetch } from "../utils/reFetch";

const authRouter = new Hono();

authRouter.get("/login-token", async (c) => {
  try {
    const cookieJar = new Map<string, string>();
    const res = await resilientFetch(config.LOGIN_URL, {
      method: "GET",
      headers: BROWSER_HEADERS,
    });
    if (res.status === 526) {
      return c.json(
        {
          error:
            "KTU has not Updated their SSL certificate. Please try again later.",
          isOverLoaded: false,
          isSSLError: true,
        },
        {
          status: 502,
        },
      );
    }

    if (res.status >= 500 && res.status < 600) {
      return c.json(
        {
          error: "Failed to connect to KTU (Server error)",
          isOverLoaded: true,
        },
        { status: 502 },
      );
    }

    const html = await res.text();
    const csrfMatch = html.match(
      /<input[^>]*name="CSRF_TOKEN"[^>]*value="([^"]+)"/i,
    );
    const formCsrf = csrfMatch ? csrfMatch[1] : "";
    if (!formCsrf) {
      return c.json(
        { error: "Failed to connect to KTU (No CSRF found)" },
        { status: 502 },
      );
    }
    extractCookiesToJar(res, cookieJar);
    const cookies = getCookieString(cookieJar);

    return c.json({ csrfToken: formCsrf.toString(), sessionCookie: cookies });
  } catch (e) {
    console.error("Error occurred while fetching login CSRF token:", e);
    return c.json({ error: "Failed to fetch login CSRF token" }, 500);
  }
});

authRouter.post("/login", async (c) => {
  try {
    const bodyArgs = (await c.req.json().catch(() => null)) as {
      username?: string;
      password?: string;
      csrfToken?: string;
      sessionCookie?: string;
    } | null;

    const username = bodyArgs?.username;
    const password = bodyArgs?.password;
    const preToken = bodyArgs?.csrfToken;
    const preSessionCookie = bodyArgs?.sessionCookie;

    let token = preToken;
    let sessionCookie = preSessionCookie;

    if (!username || !password) {
      return c.json({ error: "Missing credentials" }, { status: 400 });
    }

    // --- VIRTUAL COOKIE JAR ---
    const cookieJar = new Map<string, string>();
    let currentUrl = config.LOGIN_URL;
    let response;

    // Backward compatibility: fetch CSRF and session if not provided
    if (!token || !sessionCookie) {
      response = await resilientFetch(currentUrl, {
        method: "GET",
        headers: BROWSER_HEADERS,
      });

      if (response.status === 526) {
        return c.json(
          {
            error:
              "KTU has not Updated their SSL certificate. Please try again later.",
            isOverLoaded: false,
            isSSLError: true,
          },
          {
            status: 502,
          },
        );
      }

      if (response.status >= 500 && response.status < 600) {
        return c.json(
          {
            error: "Failed to connect to KTU (Server error)",
            isOverLoaded: true,
          },
          { status: 502 },
        );
      }

      extractCookiesToJar(response, cookieJar);
      let html = await response.text();

      const csrfMatch = html.match(
        /<input[^>]*name="CSRF_TOKEN"[^>]*value="([^"]+)"/i,
      );
      token = csrfMatch ? csrfMatch[1] : "";

      if (!token) {
        return c.json(
          { error: "Failed to connect to KTU (No CSRF found)" },
          { status: 502 },
        );
      }
    } else {
      // Populate cookieJar from provided session cookie string
      sessionCookie.split(";").forEach((cookieStr) => {
        const [name, ...rest] = cookieStr.trim().split("=");
        if (name && rest.length > 0) {
          cookieJar.set(name, rest.join("="));
        } else if (name) {
          cookieJar.set(name, "");
        }
      });
    }

    if (!token) {
      return c.json(
        { error: "Failed to connect to KTU (Missing CSRF)" },
        { status: 502 },
      );
    }
    // STEP 2: The Attack Payload
    const payload = new URLSearchParams({
      CSRF_TOKEN: token,
      username: username,
      password: password,
    });

    // STEP 3: The Redirect Chaser
    let fetchOptions: RequestInit = {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: getCookieString(cookieJar),
        Origin: config.BASE_URL,
        Referer: config.LOGIN_URL,
      },
      body: payload.toString(),
      redirect: "manual", // Stop auto-redirects so we can manually catch cookies
    };

    let maxRedirects = 5;
    let redirectCount = 0;
    let loginSuccessful = false;

    while (redirectCount < maxRedirects) {
      response = await resilientFetch(currentUrl, fetchOptions);

      // Update our jar with any cookies dropped on this hop
      extractCookiesToJar(response, cookieJar);

      // If KTU throws a 301, 302, 303, 307, or 308, we must follow it!
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        let location = response.headers.get("location");
        if (!location) break;

        // Handle relative URLs (e.g. "/eu/stu/studentDashboard.htm")
        if (location.startsWith("/")) {
          currentUrl = config.BASE_URL + location;
        } else {
          currentUrl = location;
        }

        // Check if we reached the promised land (Dashboard)
        if (
          currentUrl.includes("dashboard.htm") ||
          currentUrl.includes("home.htm")
        ) {
          loginSuccessful = true;
        }

        // Standard browser behavior: Turn the POST into a GET for the next hop
        fetchOptions = {
          method: "GET",
          headers: {
            ...BROWSER_HEADERS,
            Cookie: getCookieString(cookieJar), // Pass the updated jar to the next hop!
          },
          redirect: "manual",
        };

        redirectCount++;
      } else {
        // Reached a 200 OK or an Error page
        if (
          response.status === 200 &&
          (currentUrl.includes("dashboard.htm") ||
            response.url.includes("dashboard.htm"))
        ) {
          loginSuccessful = true;
        }
        break;
      }
    }

    // STEP 4: Verification
    const finalCookies = getCookieString(cookieJar);

    if (!loginSuccessful || !finalCookies.includes("JSESSIONID")) {
      return c.json({ error: "Invalid KTU ID or Password" }, { status: 401 });
    }

    return c.json({
      message: "Login successful",
      sessionCookie: finalCookies,
    });
  } catch (e) {
    console.error("Error occurred while logging in:", e);
    return c.json({ error: "Login failed: " + (e as Error).message }, 500);
  }
});

export default authRouter;
