import test from "node:test";
import assert from "node:assert/strict";
import { revealResponse } from "../src/lib/revealResponse.js";

test("word reveal preserves spaces, newlines and code punctuation", async () => {
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const updates = [];
  const text = "Hello  world\n`<div>`";
  await revealResponse(text, new AbortController().signal, (value) => updates.push(value));
  assert.equal(updates.at(-1), text);
  assert.ok(updates.length > 1);
  assert.ok(updates.every((value) => text.startsWith(value)));
});

test("Stop prevents every subsequent word from being revealed", async () => {
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const controller = new AbortController();
  const updates = [];
  await revealResponse("One two three", controller.signal, (value) => {
    updates.push(value);
    controller.abort();
  });
  assert.deepEqual(updates, ["One"]);
});

test("an already stopped request produces no updates", async () => {
  const controller = new AbortController();
  controller.abort();
  await revealResponse("Hidden", controller.signal, () => assert.fail("Unexpected update"));
});

test("reduced motion displays the complete response immediately", async () => {
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  const updates = [];
  await revealResponse("Hello world", new AbortController().signal, (value) => updates.push(value));
  assert.deepEqual(updates, ["Hello world"]);
});
