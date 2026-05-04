export const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "identity", // CRITICAL: Stops Cloudflare from crashing on broken gzip
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

export const config = {
  BASE_URL: "https://app.ktu.edu.in",
  LOGIN_URL: "https://app.ktu.edu.in/login.htm",
  GRADE_CARD_URL: "https://app.ktu.edu.in/eu/res/semesterGradeCardListing.htm",
  USER_AGENT: "Mozilla/5.0",
};
