import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, () => {
  console.info(`API запущен: http://localhost:${env.port}`);
});
