import { Store } from "./store.js";
import { createTempoServer } from "./server.js";
const store = new Store();
try {
  await store.migrate();
  const server = createTempoServer(store);
  server.listen(
    Number(process.env.PORT || 8787),
    process.env.HOST || "127.0.0.1",
    () => console.log("Tempo account and cloud workspace API ready"),
  );
  const stop = () =>
    server.close(() => {
      void store.pool.end().then(() => process.exit(0));
    });
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
} catch {
  console.error(
    "Could not connect to account storage. Check DATABASE_URL and start PostgreSQL.",
  );
  await store.pool.end();
  process.exitCode = 1;
}
