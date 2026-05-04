import { Hono } from "hono";
import authRouter from "./routes/auth";
import gradesRouter from "./routes/grades";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const app = new Hono();

app.get("/echo", async (c) => {
  return c.json({ message: "Echoing request" });
});

app.route("/", authRouter);
app.route("/", gradesRouter);

// export default app;

async function startServer() {
  const args = process.argv.slice(2);
  let port = process.env.PORT || 3000;

  if (args.includes("-p")) {
    port = args[args.indexOf("-p") + 1];
    if (!port || isNaN(Number(port))) {
      console.error("Invalid port number");
      process.exit(1);
    }
  }

  Bun.serve({
    port,
    fetch: app.fetch,
  });
  console.log(`Server is running on http://localhost:${port}`);
}

startServer();
