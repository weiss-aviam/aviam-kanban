#!/usr/bin/env node

const { spawn } = require("node:child_process");

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error(
    "Usage: node scripts/run-with-baseline-env.cjs <command> [...args]",
  );
  process.exit(1);
}

const suppressedFragments = [
  "[baseline-browser-mapping] The data in this module is over two months old.",
];

function shouldSuppress(line) {
  return suppressedFragments.some((fragment) => line.includes(fragment));
}

function pipeFiltered(stream, output) {
  let buffer = "";

  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (!shouldSuppress(line)) {
        output.write(`${line}\n`);
      }

      newlineIndex = buffer.indexOf("\n");
    }
  });

  stream.on("end", () => {
    if (buffer && !shouldSuppress(buffer)) {
      output.write(buffer);
    }
  });
}

const child = spawn(command, args, {
  stdio: ["inherit", "pipe", "pipe"],
  env: {
    ...process.env,
    BROWSERSLIST_IGNORE_OLD_DATA: "true",
    BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA: "true",
  },
});

pipeFiltered(child.stdout, process.stdout);
pipeFiltered(child.stderr, process.stderr);

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

child.on("close", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});