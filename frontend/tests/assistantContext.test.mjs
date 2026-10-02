import test from "node:test";
import assert from "node:assert/strict";
import { assistantContext } from "../src/lib/assistantContext.js";

const pair = (id, text = "complete", extra = {}) => [
  { id: `u${id}`, role: "user", content: `question ${id}` },
  { id: `a${id}`, role: "assistant", persona: "assistant", content: text, ...extra },
];
test("only complete assistant pairs enter context; no persona or stopped replies", () => {
  const history = [...pair(1, "secret persona", { persona: "neo" }), ...pair(2), ...pair(3, "partial", { stopped: true }), ...pair(4, "error", { failed: true })];
  assert.deepEqual(assistantContext(history), [{ role: "user", content: "question 2" }, { role: "assistant", content: "complete" }]);
});
test("retry excludes its original turn and later messages", () => {
  assert.deepEqual(assistantContext([...pair(1), ...pair(2), ...pair(3)], "a2"), assistantContext(pair(1)));
});
test("long code is preserved whole and only recent complete turns fit the budget", () => {
  const code = "a".repeat(32000);
  const context = assistantContext([...pair(1, code), ...pair(2, code)]);
  assert.equal(context.length, 2);
  assert.equal(context[1].content, code);
  assert.equal(context[0].content, "question 2");
});
test("context is limited to forty pairs and excludes old image data", () => {
  const history = Array.from({ length: 45 }, (_, i) => pair(i)).flat();
  history[history.length - 2].image = "data:image/png;base64,private";
  const context = assistantContext(history);
  assert.equal(context.length, 80);
  assert.match(context[78].content, /not retained/);
  assert.ok(!JSON.stringify(context).includes("base64"));
});
