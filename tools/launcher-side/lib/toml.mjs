//! The little TOML reader the launcher-side tools need.
//!
//! A mod's manifest (`horizon-mod.toml`) and a native mod's mixin file
//! (`horizon-mixin.toml`) are TOML, but only the parts the tools read:
//! strings, numbers, booleans and arrays of strings, in sections.

/** Reads the TOML in a text. */
export function parse(source) {
  const out = {};
  let section = out;
  const lines = source.split(/\r?\n/);
  for (let at = 0; at < lines.length; at += 1) {
    let line = stripComment(lines[at]).trim();
    if (!line) continue;
    if (line.startsWith("[")) {
      const name = line.slice(1, line.indexOf("]")).trim();
      section = out[name] ?? (out[name] = {});
      continue;
    }
    const equals = line.indexOf("=");
    if (equals < 0) continue;
    const key = line.slice(0, equals).trim().replace(/^["']|["']$/g, "");
    let text = line.slice(equals + 1).trim();
    // An array may run over several lines.
    while (unbalanced(text) && at + 1 < lines.length) {
      at += 1;
      text += " " + stripComment(lines[at]).trim();
    }
    section[key] = readValue(text);
  }
  return out;
}

/** A value: a string, a number, a boolean or an array of them. */
function readValue(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    const items = splitArray(trimmed.slice(1, trimmed.lastIndexOf("]")));
    return items.map((item) => readValue(item));
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return unescape(trimmed.slice(1, -1));
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^[-+]?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^[-+]?\d*\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  return trimmed;
}

/** The items of an array, commas between them. */
function splitArray(text) {
  const items = [];
  let current = "";
  let quote = null;
  for (const character of text) {
    if (quote) {
      current += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === ",") {
      if (current.trim()) items.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

/** Whether an array is not closed yet. */
function unbalanced(text) {
  let depth = 0;
  let quote = null;
  for (const character of text) {
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "[") depth += 1;
    else if (character === "]") depth -= 1;
  }
  return depth > 0;
}

/** A line without its comment. */
function stripComment(line) {
  let quote = null;
  for (let at = 0; at < line.length; at += 1) {
    const character = line[at];
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "#") return line.slice(0, at);
  }
  return line;
}

/** The escapes a TOML string holds. */
function unescape(text) {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}
