const path = require("node:path");

const appDir = process.env.PERPULANGAN_APP_DIR || __dirname;
const appPort = process.env.APP_PORT || "3000";
const currentDir = path.join(appDir, "current");

module.exports = {
  apps: [
    {
      name: "perpulangan",
      cwd: currentDir,
      script: path.join(currentDir, "server.js"),
      interpreter: process.execPath,
      node_args: "--env-file=.env",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: appPort,
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
