//! The little ZIP reader the launcher-side tools need.
//!
//! A `.hmod` and a `.hnmod` are ZIP files; the tools read two or three
//! entries out of them and nothing else. Node has no ZIP reader in its
//! standard library, so this is one: the central directory, then the entry
//! itself, stored or deflated.

import { inflateRawSync } from "node:zlib";

const END_OF_CENTRAL = 0x06054b50;
const CENTRAL_FILE = 0x02014b50;
const LOCAL_FILE = 0x04034b50;

/** The names of the entries a ZIP holds, in the order its directory has. */
export function names(buffer) {
  const end = findEnd(buffer);
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(at) !== CENTRAL_FILE) break;
    const length = buffer.readUInt16LE(at + 28);
    const extra = buffer.readUInt16LE(at + 30);
    const comment = buffer.readUInt16LE(at + 32);
    out.push(buffer.toString("utf8", at + 46, at + 46 + length));
    at += 46 + length + extra + comment;
  }
  return out;
}

/** The bytes of one entry, or null when the ZIP has no such entry. */
export function read(buffer, name) {
  const end = findEnd(buffer);
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(at) !== CENTRAL_FILE) break;
    const method = buffer.readUInt16LE(at + 10);
    const compressed = buffer.readUInt32LE(at + 20);
    const length = buffer.readUInt16LE(at + 28);
    const extra = buffer.readUInt16LE(at + 30);
    const comment = buffer.readUInt16LE(at + 32);
    const local = buffer.readUInt32LE(at + 42);
    const entry = buffer.toString("utf8", at + 46, at + 46 + length);
    if (entry === name) {
      if (buffer.readUInt32LE(local) !== LOCAL_FILE) return null;
      const nameLength = buffer.readUInt16LE(local + 26);
      const extraLength = buffer.readUInt16LE(local + 28);
      const start = local + 30 + nameLength + extraLength;
      const bytes = buffer.subarray(start, start + compressed);
      if (method === 0) return Buffer.from(bytes);
      if (method === 8) return inflateRawSync(bytes);
      throw new Error(`${name}: compression method ${method} is not read`);
    }
    at += 46 + length + extra + comment;
  }
  return null;
}

/** Where the ZIP's directory ends. */
function findEnd(buffer) {
  const from = Math.max(0, buffer.length - 0x10000 - 22);
  for (let at = buffer.length - 22; at >= from; at -= 1) {
    if (buffer.readUInt32LE(at) === END_OF_CENTRAL) return at;
  }
  throw new Error("not a ZIP file");
}
