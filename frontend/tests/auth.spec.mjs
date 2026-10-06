import { test, expect } from "@playwright/test";

const alice = { id: "3dbd608d-a59b-4ee2-b91e-e0d48108fd48", aud: "authenticated", role: "authenticated", email: "alice@example.com", user_metadata: { display_name: "Alice" }, app_metadata: { provider: "email", providers: ["email"] }, created_at: "2026-01-01T00:00:00Z" };
const bob = { ...alice, id: "db61176f-5590-427a-8f3c-ff8ecedc3f39", email: "bob@example.com", user_metadata: { display_name: "Bob" } };
function session(user = alice) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", role: "authenticated", exp: expires, iat: expires - 3600 })}.test-signature`;
  return { access_token: token, refresh_token: "fake-refresh-token", expires_in: 3600, expires_at: expires, token_type: "bearer", user };
}
function recoveryUrl() {
  const current = session();
  return `/?auth=reset#access_token=${current.access_token}&refresh_token=${current.refresh_token}&expires_in=3600&token_type=bearer&type=recovery`;
}

async function mockAuth(page) {
  const calls = [];
  const state = { password: "Password123!", failLogin: false, rateLimit: false };
  await page.addInitScript(() => {
    localStorage.setItem("ai-agreement-accepted", "true");
    localStorage.setItem("shifts-onboarding-complete", "true");
  });
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.route("https://shifts-auth-test.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const data = request.postDataJSON();
    calls.push({ path: url.pathname, method: request.method(), url, data });
    const reply = (json, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "x-supabase-api-version": "2024-01-01", "access-control-expose-headers": "x-supabase-api-version" }, body: JSON.stringify(json) });
    if (state.rateLimit) return reply({ code: "over_email_send_rate_limit", message: "Rate limited" }, 429);
    if (url.pathname.endsWith("/token")) {
      if (state.failLogin || (url.searchParams.get("grant_type") === "password" && data.password !== state.password)) return reply({ code: "invalid_credentials", message: "Invalid login credentials" }, 400);
      return reply(session(data?.email === bob.email ? bob : alice));
    }
    if (url.pathname.endsWith("/signup")) return reply({ ...alice, identities: [{ id: "identity" }] });
    if (url.pathname.endsWith("/user")) {
      if (request.headers().authorization === "Bearer broken") return reply({ code: "bad_jwt", message: "Invalid token" }, 401);
      if (request.method() === "PUT") state.password = data.password;
      return reply(alice);
    }
    if (url.pathname.endsWith("/authorize")) return route.fulfill({ contentType: "text/html", body: "<p>Mock Google authorization page</p>" });
    return reply({});
  });
  await page.route("**/test-api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/modes/list")) return route.fulfill({ json: { modes: { default: "Aisha", neo: "Neo" } } });
    calls.push({ path: url.pathname, headers: route.request().headers(), data: route.request().postDataJSON() });
    return route.fulfill({ json: { reply: "Hello from your Shift." } });
  });
  return { calls, state };
}

async function login(page, email = alice.email, password = "Password123!") {
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Your account" })).toBeVisible();
}

test("mobile composer returns to one line after sending and clearing long prompts", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await mockAuth(page);
  await page.goto("/");
  await login(page);
  await page.getByRole("button", { name: "Switch to Chatbot mode" }).click();
  await page.getByRole("button", { name: "Switch", exact: true }).click();
  const field = page.getByRole("textbox", { name: "Message Assistant" });
  const height = () => field.evaluate((el) => el.getBoundingClientRect().height);
  const initialHeight = await height();
  const prompt = "A long prompt that wraps across multiple lines. ".repeat(30);
  await field.fill(prompt);
  await expect.poll(height).toBeGreaterThan(initialHeight + 40);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(field).toHaveValue("");
  await expect.poll(height).toBeLessThanOrEqual(initialHeight + 1);
  await expect(field).toBeEnabled();
  await field.fill(prompt);
  await expect.poll(height).toBeGreaterThan(initialHeight + 40);
  await page.getByRole("button", { name: "Clear input text" }).click();
  await expect.poll(height).toBeLessThanOrEqual(initialHeight + 1);
  await field.fill(prompt);
  await expect.poll(height).toBeGreaterThan(initialHeight + 40);
  await field.fill("Short");
  await expect.poll(height).toBeLessThanOrEqual(initialHeight + 1);
  await field.fill("A prompt that changes line count when the viewport changes. ".repeat(4));
  const mobileHeight = await height();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(height).toBeLessThan(mobileHeight);
  await page.setViewportSize({ width: 360, height: 740 });
  await expect.poll(height).toBeGreaterThanOrEqual(mobileHeight - 1);
  await field.press("Enter");
  await expect(field).toHaveValue("");
  await expect.poll(height).toBeLessThanOrEqual(initialHeight + 1);
});

test("mobile header and account stay inside the viewport with working actions", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/");
  await login(page);
  for (const width of [320, 360, 390, 480, 640, 768, 1280]) {
    await page.setViewportSize({ width, height: 740 });
    const header = await page.locator(".header").boundingBox();
    expect(header.height).toBeLessThanOrEqual(56);
    if (width > 680) await expect(page.getByRole("button", { name: "Chat options" })).toBeHidden();
    for (const control of await page.locator(".header button:visible").all()) {
      const box = await control.boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(header.y);
      expect(box.y + box.height).toBeLessThanOrEqual(header.y + header.height);
    }
    await page.getByRole("button", { name: "Your account" }).click();
    const panel = await page.locator(".account-panel").boundingBox();
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(width);
    expect(panel.y + panel.height).toBeLessThanOrEqual(740);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 360, height: 740 });
  const more = page.getByRole("button", { name: "Chat options" });
  await more.click();
  await page.screenshot({ path: "test-results/mobile-options-light-360.png" });
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await page.getByRole("button", { name: "Conversation History" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await more.click();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await more.click();
  await page.getByRole("textbox").click();
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Switch to Chatbot mode" }).click();
  await page.getByRole("button", { name: "Switch", exact: true }).click();
  await expect(page.getByText("Memory stays in this conversation.", { exact: false })).toHaveCount(0);
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 350 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(size);
    await page.getByRole("button", { name: "Your account" }).click();
    const panel = await page.locator(".account-panel").boundingBox();
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(size.width);
    expect(panel.y + panel.height).toBeLessThanOrEqual(size.height);
    await page.keyboard.press("Escape");
    const controls = await page.locator(".header-left, .header-right").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
    expect(controls[0].right).toBeLessThanOrEqual(controls[1].left);
  }
  await page.locator(".chat-messages").evaluate((el) => el.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "test-results/assistant-desktop.png" });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.locator(".chat-messages").evaluate((el) => el.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "test-results/mobile-assistant-360.png" });
  await page.getByRole("button", { name: "Your account" }).click();
  await page.screenshot({ path: "test-results/mobile-account-360.png" });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("persona changes share one conversation and preserve the draft without confirmation", async ({ page }) => {
  test.setTimeout(90000);
  const { calls } = await mockAuth(page);
  await page.goto("/");
  await login(page);
  await page.getByRole("textbox").fill("Keep my Aisha conversation");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Hello from your Shift.", { exact: true })).toBeVisible();
  await page.getByRole("textbox").fill("Keep this draft");
  const before = await page.evaluate((id) => JSON.parse(localStorage.getItem(`shifts-conversations-v2:${id}`)), alice.id);
  const choose = async (name) => {
    await page.getByRole("button", { name: "Choose a Shift" }).click();
    await page.locator(".shift-card").filter({ has: page.getByText(name, { exact: true }) }).click();
  };
  await choose("Aisha");
  await expect(page.locator(".switch-confirmation")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveValue("Keep this draft");
  await choose("Neo");
  await expect(page.locator(".switch-confirmation")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveValue("Keep this draft");
  await expect(page.locator(".current-persona-name")).toHaveText("Neo");
  await expect(page.getByText("Keep my Aisha conversation", { exact: true })).toBeVisible();
  const after = await page.evaluate((id) => JSON.parse(localStorage.getItem(`shifts-conversations-v2:${id}`)), alice.id);
  expect(after.active).toBe(before.active);
  expect(after.chats).toHaveLength(1);
  expect(after.chats[0]).toMatchObject({ context: before.chats[0].context, messages: before.chats[0].messages, persona: "neo" });
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Hello from your Shift.", { exact: true })).toHaveCount(2);
  expect(calls.filter((call) => call.path.endsWith("/chat")).map((call) => call.headers["x-conversation-id"]))
    .toEqual([before.chats[0].context, before.chats[0].context]);
  await expect(page.locator(".assistant-name")).toHaveText(["Aisha", "Neo"]);
  await choose("Aisha");
  await expect(page.locator(".switch-confirmation")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Hello from your Shift.", { exact: true })).toHaveCount(2);
  // Explicit new chats stay available, but opening an older persona chat needs no modal.
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: "+ New conversation", exact: true }).click();
  await choose("Neo");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: /Keep my Aisha conversation.*messages/ }).click();
  await expect(page.locator(".switch-confirmation")).toHaveCount(0);
  await expect(page.getByText("Keep my Aisha conversation", { exact: true })).toBeVisible();
  await expect(page.locator(".current-persona-name")).toHaveText("Aisha");
  // The last opened chat wins over the more recently created empty chat, even after reload.
  await page.getByRole("button", { name: "Switch to Chatbot mode" }).click();
  await page.getByRole("button", { name: "Switch", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Switch to Personas mode" }).click();
  await expect(page.getByText("Keep my Aisha conversation", { exact: true })).toBeVisible();
});

test("chatbot confirmation, isolated context, history restore, code and mobile layout", async ({ page }) => {
  test.setTimeout(90000);
  await mockAuth(page);
  const assistantCalls = [];
  await page.route("**/test-api/assistant/chat", (route) => {
    assistantCalls.push(route.request().postDataJSON());
    return route.fulfill({ json: { reply: "Here is your code:\n\n```python\nprint('hello')\n```\n\n```\nplain block\n```" } });
  });
  await page.goto("/");
  await login(page);
  await page.getByRole("textbox").fill("Persona private memory");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Hello from your Shift.", { exact: true })).toBeVisible();
  await page.getByRole("textbox").fill("Unsent draft");
  await page.getByRole("button", { name: "Switch to Chatbot mode" }).click();
  await page.locator(".switch-confirmation").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveValue("Unsent draft");
  await page.getByRole("button", { name: "Switch to Chatbot mode" }).click();
  await page.locator(".switch-confirmation").getByRole("button", { name: "Switch", exact: true }).click();
  await expect(page.getByLabel("Message Assistant")).toBeVisible();
  await expect(page.getByText("Persona private memory", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Council/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Choose a Shift" })).toHaveCount(0);
  await page.getByLabel("Message Assistant").fill("Explain this code " + "x".repeat(2100));
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copy", exact: true })).toHaveCount(2);
  expect(assistantCalls[0].history).toEqual([]);
  await page.getByLabel("Message Assistant").fill("Can you improve it?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copy", exact: true })).toHaveCount(4);
  expect(assistantCalls[1].history).toHaveLength(2);
  expect(JSON.stringify(assistantCalls)).not.toContain("Persona private memory");
  await page.getByRole("button", { name: "Regenerate", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copy", exact: true })).toHaveCount(4);
  expect(assistantCalls[2].history).toEqual(assistantCalls[1].history);
  await page.reload();
  await expect(page.getByLabel("Message Assistant")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy", exact: true })).toHaveCount(4);
  await page.getByRole("button", { name: "Switch to Personas mode" }).click();
  await expect(page.locator(".switch-confirmation")).toHaveCount(0);
  await expect(page.getByText("Persona private memory", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Switch to Chatbot mode" }).click();
  await page.locator(".switch-confirmation").getByRole("button", { name: "Switch", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copy", exact: true })).toHaveCount(4);
  const resumed = await page.evaluate((id) => JSON.parse(localStorage.getItem(`shifts-conversations-v2:${id}`)), alice.id);
  expect(resumed.chats).toHaveLength(2);
  await page.getByRole("button", { name: "Switch to Personas mode" }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: /Explain this code.*messages/ }).click();
  await page.locator(".switch-confirmation").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: /Explain this code.*messages/ }).click();
  await page.locator(".switch-confirmation").getByRole("button", { name: "Open chat", exact: true }).click();
  await expect(page.getByLabel("Message Assistant")).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("button", { name: "Switch to Personas mode" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".chat-messages").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await page.screenshot({ path: "test-results/assistant-mobile.png", fullPage: true });
});

test("switch stops in-flight replies and storage failure prevents mode change", async ({ page }) => {
  await mockAuth(page);
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  await page.route("**/test-api/assistant/chat", async (route) => {
    await pending;
    await route.fulfill({ json: { reply: "Late assistant reply" } }).catch(() => {});
  });
  await page.goto("/");
  await login(page);
  await page.getByRole("button", { name: "Switch to Chatbot mode" }).click();
  await page.locator(".switch-confirmation").getByRole("button", { name: "Switch", exact: true }).click();
  await page.getByLabel("Message Assistant").fill("Slow request");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("status", { name: "Assistant is thinking" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to Personas mode" }).click();
  finish();
  await expect(page.getByLabel("Message your Shift")).toBeVisible();
  await expect(page.getByText("Late assistant reply", { exact: true })).toHaveCount(0);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); }; });
  await page.getByRole("button", { name: "Switch to Chatbot mode" }).click();
  await page.locator(".switch-confirmation").getByRole("button", { name: "Switch", exact: true }).click();
  await expect(page.getByLabel("Message your Shift")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("History could not be saved");
});

test("legacy persona history migrates without loss and tab conflicts block switching", async ({ page }) => {
  test.setTimeout(60000);
  await mockAuth(page);
  await page.addInitScript((userId) => {
    localStorage.setItem(`shifts-conversations-v2:${userId}`, JSON.stringify({ active: "old-chat", chats: [{
      id: "old-chat", context: "old-context", title: "Existing conversation", updated: 1,
      messages: [{ id: "u1", role: "user", content: "Old question" }, { id: "a1", role: "assistant", persona: "neo", content: "Old answer" }],
    }] }));
  }, alice.id);
  await page.goto("/");
  await login(page);
  await expect(page.getByText("Old answer", { exact: true })).toBeVisible();
  await expect(page.locator(".current-persona-name")).toHaveText("Neo");
  await page.getByRole("button", { name: "Switch to Chatbot mode" }).click();
  await page.locator(".switch-confirmation").getByRole("button", { name: "Switch", exact: true }).click();
  const stored = await page.evaluate((userId) => JSON.parse(localStorage.getItem(`shifts-conversations-v2:${userId}`)), alice.id);
  const old = stored.chats.find((chat) => chat.id === "old-chat");
  expect(old.context).toBe("old-context");
  expect(old.messages[1].content).toBe("Old answer");
  expect(old.mode).toBe("personas");
  await page.evaluate((userId) => window.dispatchEvent(new StorageEvent("storage", { key: `shifts-conversations-v2:${userId}` })), alice.id);
  await page.getByRole("button", { name: "Switch to Personas mode" }).click();
  await expect(page.getByLabel("Message Assistant")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("another tab");
});

test("email login, authenticated request, account isolation, logout and session restore", async ({ page }) => {
  const { calls } = await mockAuth(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await login(page);
  await page.getByRole("textbox").fill("Alice private message");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText("Hello from your Shift.", { exact: true })).toBeVisible();
  const request = calls.find((call) => call.path === "/test-api/chat");
  expect(request.headers.authorization).toMatch(/^Bearer /);
  expect(request.headers["x-user-id"]).toBeUndefined();
  await page.reload();
  await expect(page.getByText("Alice private message", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Your account" }).click();
  await expect(page.getByText(alice.email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByText("Alice private message", { exact: true })).toHaveCount(0);
  await login(page, bob.email);
  await expect(page.getByText("Alice private message", { exact: true })).toHaveCount(0);
  await page.getByRole("textbox").fill("Bob private message");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText("Hello from your Shift.", { exact: true })).toBeVisible();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toContain(`shifts-conversations-v2:${alice.id}`);
  expect(keys).toContain(`shifts-conversations-v2:${bob.id}`);
});

test("wrong password is visible and login can be retried", async ({ page }) => {
  const { state } = await mockAuth(page);
  state.failLogin = true;
  await page.goto("/");
  await page.getByLabel("Email address").fill(alice.email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("don't match");
  state.failLogin = false;
  await login(page);
});

test("signup checks confirmation and offers email verification resend", async ({ page }) => {
  const { calls } = await mockAuth(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Alice");
  await page.getByLabel("Email address").fill(alice.email);
  await page.getByLabel("New password", { exact: true }).fill("Password123!");
  await page.getByLabel("Confirm password").fill("NotMatching!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("don't match");
  expect(calls.some((call) => call.path.endsWith("/signup"))).toBe(false);
  await page.getByLabel("Confirm password").fill("Password123!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("confirmation link");
  await page.getByRole("button", { name: "Resend confirmation email" }).click();
  await expect(page.getByRole("status")).toContainText("new link");
  expect(calls.find((call) => call.path.endsWith("/signup")).data.data.display_name).toBe("Alice");
  expect(calls.some((call) => call.path.endsWith("/resend"))).toBe(true);
});

test("Google button initiates provider redirect and callback opens chat", async ({ page }) => {
  const { calls } = await mockAuth(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/auth\/v1\/authorize/);
  const call = calls.find((item) => item.path.endsWith("/authorize"));
  expect(call.url.searchParams.get("provider")).toBe("google");
  expect(call.url.searchParams.get("redirect_to")).toBe("http://127.0.0.1:4175/");
  const current = session();
  await page.goto(`/#access_token=${current.access_token}&refresh_token=${current.refresh_token}&expires_in=3600&token_type=bearer&type=signup`);
  await expect(page.getByRole("button", { name: "Your account" })).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
});

test("forgot password sends redirect and recovery survives reload and updates password", async ({ page }) => {
  const { calls } = await mockAuth(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email address").fill(alice.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  const recovery = calls.find((call) => call.path.endsWith("/recover"));
  expect(recovery.url.searchParams.get("redirect_to")).toBe("http://127.0.0.1:4175/?auth=reset");
  expect(recovery.data.email).toBe(alice.email);
  await page.goto(recoveryUrl());
  await expect(page.getByRole("heading", { name: "Make it yours again." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Your account" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill("ChangedPassword456!");
  await page.getByLabel("Confirm password").fill("ChangedPassword456!");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("heading", { name: "You're all set." })).toBeVisible();
  expect(calls.find((call) => call.path.endsWith("/user") && call.method === "PUT").data.password).toBe("ChangedPassword456!");
  await page.getByRole("button", { name: "Continue to Shifts" }).click();
  await expect(page.getByRole("button", { name: "Your account" })).toBeVisible();
  await page.getByRole("button", { name: "Your account" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, alice.email, "ChangedPassword456!");
});

test("expired recovery link offers a new link and never opens chat", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/?auth=reset#error=access_denied&error_code=otp_expired&error_description=private-provider-detail");
  await expect(page.getByRole("alert")).toContainText("expired");
  await expect(page.getByText("private-provider-detail")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Your account" })).toHaveCount(0);
  await page.getByRole("button", { name: "Request a new reset link" }).click();
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
});

for (const { query, message } of [
  { query: "#error=server_error&error_code=unexpected_failure", message: "provider could not complete" },
  { query: "?error=access_denied", message: "denied or cancelled" },
  { query: "#error_code=otp_expired", message: "expired or has already been used" },
  { query: "#error=server_error&error_code=provider_disabled", message: "provider is not enabled" },
  { query: "#error_description=private-provider-detail", message: "provider could not complete" },
]) {
  test(`callback error is classified and login can be retried: ${query}`, async ({ page }) => {
    await mockAuth(page);
    await page.goto(`/${query}`);
    await expect(page.getByRole("alert")).toContainText(message);
    await expect(page.getByText("private-provider-detail")).toHaveCount(0);
    await expect(page).toHaveURL("http://127.0.0.1:4175/");
    await login(page);
  });
}

test("rate limits are shown without a false email sent message", async ({ page }) => {
  const { state } = await mockAuth(page);
  state.rateLimit = true;
  await page.goto("/");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email address").fill(alice.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("alert")).toContainText("Too many attempts");
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("signout propagates to another open tab", async ({ page, context }) => {
  await mockAuth(page);
  await page.goto("/");
  await login(page);
  const other = await context.newPage();
  await mockAuth(other);
  await other.goto("/");
  await expect(other.getByRole("button", { name: "Your account" })).toBeVisible();
  await page.getByRole("button", { name: "Your account" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(other.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(other.getByRole("button", { name: "Your account" })).toHaveCount(0);
});

test("API rejection signs out instead of continuing with an unverified account", async ({ page }) => {
  await mockAuth(page);
  await page.route("**/test-api/chat?**", (route) => route.fulfill({ status: 401, json: { detail: "Please sign in again." } }));
  await page.goto("/");
  await login(page);
  await page.getByRole("textbox").fill("Rejected request");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByText("Rejected request", { exact: true })).toHaveCount(0);
});

test("expired recovery while signed in still allows requesting another link", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/");
  await login(page);
  await page.goto("/?auth=reset#error=access_denied&error_code=otp_expired");
  await page.getByRole("button", { name: "Request a new reset link" }).click();
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Your account" })).toHaveCount(0);
});

test("failed token processing cannot reset a previously signed-in account", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/");
  await login(page);
  await page.goto("/?auth=reset#access_token=broken&refresh_token=broken&expires_in=3600&token_type=bearer&type=recovery");
  await expect(page.getByRole("button", { name: "Request a new reset link" })).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
});

for (const viewport of [{ width: 1440, height: 740 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`signup scrolls upward and its bottom stays reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await mockAuth(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: "Create an account" }).click();
    const panel = page.locator(".auth-panel");
    // A fitting card reaches the scroll limit with its bottom at the page padding.
    const bottomPadding = await page.locator(".auth-page").evaluate(node => parseFloat(getComputedStyle(node).paddingBottom));
    const fittingCardTop = viewport.height - (await panel.boundingBox()).height - bottomPadding;
    await expect.poll(async () => (await panel.boundingBox()).y).toBeLessThanOrEqual(Math.max(64, fittingCardTop + 1));
    await expect.poll(async () => (await panel.boundingBox()).y).toBeGreaterThanOrEqual(0);
    const scroller = page.locator(".auth-page");
    expect(await scroller.evaluate(node => node.clientHeight <= innerHeight && node.scrollHeight >= node.clientHeight)).toBe(true);
    await scroller.evaluate(node => node.scrollTo({ top: node.scrollHeight, behavior: "instant" }));
    await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeInViewport();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect.poll(() => scroller.evaluate(node => node.scrollTop)).toBe(0);
    await expect(page.getByRole("heading", { name: "Welcome back." })).toBeInViewport();
  });
}

test("desktop and mobile auth screens remain usable and do not overflow", async ({ page }, testInfo) => {
  await mockAuth(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("login-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByLabel("Confirm password")).toBeVisible();
  expect(await page.locator(".auth-page").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.locator(".auth-page").evaluate((node) => { node.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath("signup-mobile-top.png"), fullPage: true });
  await page.getByRole("button", { name: "Create account", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("signup-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.locator(".auth-page").evaluate((node) => { node.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath("forgot-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await login(page);
  expect(await page.locator(".header-content").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "Your account" }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("account-mobile.png"), fullPage: true });
});
