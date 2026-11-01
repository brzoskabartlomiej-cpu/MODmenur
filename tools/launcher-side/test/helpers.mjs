//! What the tests need: a folder to work in and a ZIP to put in it.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** A folder of its own, for one test. */
export function tempDir(name) {
  return mkdtempSync(join(tmpdir(), `modmenur-${name}-`));
}

/** A ZIP file with the given entries, as bytes. */
export function writeZip(files) {
  const dir = tempDir("zip");
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  const out = join(dir, "archive.zip");
  execFileSync("zip", ["-q", "-r", "-X", out, "."], { cwd: dir });
  return readFileSync(out);
}

/** A mod's manifest, as the game reads it. */
export function manifest({
  id,
  name = id,
  version = "1.0.0",
  description = "",
  authors = [],
  capabilities = ["hud"],
  api = "0.1",
}) {
  const list = authors.map((author) => `"${author}"`).join(", ");
  return [
    `id = "${id}"`,
    `name = "${name}"`,
    `version = "${version}"`,
    `description = "${description}"`,
    `authors = [${list}]`,
    `api = "${api}"`,
    `capabilities = [${capabilities.map((c) => `"${c}"`).join(", ")}]`,
    "",
  ].join("\n");
}
