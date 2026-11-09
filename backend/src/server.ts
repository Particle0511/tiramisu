import { app } from "./app";
import { env } from "./config/env";
import { startWorker } from "./jobs/worker";

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
  startWorker();
});