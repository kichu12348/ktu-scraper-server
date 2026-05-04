import { Hono } from "hono";
import { config, BROWSER_HEADERS } from "../config/constants";
import { parseGradeCard } from "../parsers/gradeCardParser";
import { resilientFetch } from "../utils/reFetch";

const gradesRouter = new Hono();

gradesRouter.post("/grade-card", async (c) => {
  try {
    const { sessionCookie, semester, csrfToken } = await c.req.json<{
      sessionCookie: string;
      semester: string;
      csrfToken: string;
    }>();
    const formCsrf = csrfToken;

    if (!formCsrf) {
      console.error("Couldn't find the form CSRF token!");
      throw new Error("Needed CSRF token to fetch grade card results");
    }

    const searchPayload = new URLSearchParams({
      CSRF_TOKEN: formCsrf.toString(),
      form_name: "semesterGradeCardListingSearchForm",
      semesterId: semester,
      stdId: "",
      search: "Search",
    });

    let gradePostRes;
    try {
      gradePostRes = await resilientFetch(config.GRADE_CARD_URL, {
        method: "POST",
        headers: {
          ...BROWSER_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: sessionCookie,
        },
        body: searchPayload.toString(),
        signal: AbortSignal.timeout(8000), // Give it 8 seconds to process the DB query
      });
    } catch (e) {
      console.error(
        "Server 502/Timeout on POST. Retry loop should kick in here!",
      );
      throw new Error("Failed to fetch grade card results", { cause: e });
    }
    const resultsHtml = await gradePostRes.text();
    // --- 3. PARSE THE RESULTS ---
    try {
      const gradeCardData = parseGradeCard(resultsHtml, semester);
      return c.json(gradeCardData);
    } catch (e) {
      console.error("Error parsing grade card results:", (e as Error).message);
      throw new Error("Failed to parse grade card results", { cause: e });
    }
  } catch (e) {
    console.error("Error occurred while fetching grade card:", e);
    return c.json(
      { error: "Failed to fetch grade card: " + (e as Error).message },
      500,
    );
  }
});

gradesRouter.post("/get-grade-card-token", async (c) => {
  try {
    const { sessionCookie } = await c.req.json<{ sessionCookie: string }>();
    const res = await resilientFetch(config.GRADE_CARD_URL, {
      headers: { ...BROWSER_HEADERS, Cookie: sessionCookie },
      signal: AbortSignal.timeout(5000),
    });

    const html = await res.text();

    const patten =
      /<input[^>]*name="CSRF_TOKEN"[^>]*id="semesterGradeCardListingSearchForm_CSRF_TOKEN"[^>]*value="([^"]+)"[^>]*>/;
    const match = html.match(patten);
    const formCsrf = match && match[1] ? match[1] : null;

    if (!formCsrf) {
      console.error("Couldn't find the form CSRF token!");
      throw new Error("Failed to extract CSRF token");
    }

    return c.json({ csrfToken: formCsrf.toString() });
  } catch (e) {
    console.error("Error occurred while fetching CSRF token:", e);
    return c.json({ error: "Failed to fetch CSRF token" }, 500);
  }
});

export default gradesRouter;
