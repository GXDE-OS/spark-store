import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const SUPER_USER_COMMAND_CANDIDATES = [
  "/usr/bin/pkexec",
  "/run/wrappers/bin/pkexec",
];

const WHICH_TIMEOUT_MS = 5000;

export const findExecutable = async (command: string): Promise<string> => {
  if (path.isAbsolute(command)) {
    try {
      await fs.promises.access(command, fs.constants.X_OK);
      return command;
    } catch {
      return "";
    }
  }

  return await new Promise<string>((resolve) => {
    const child = spawn("which", [command]);
    let stdout = "";
    let settled = false;

    const timer = setTimeout(() => {
      child.kill();
      finish("");
    }, WHICH_TIMEOUT_MS);

    function finish(result: string) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    child.on("close", (code) => {
      finish(code === 0 ? stdout.trim() : "");
    });
    child.on("error", () => {
      finish("");
    });
  });
};
