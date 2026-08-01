import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Supabase Auth remains the sole CAPTCHA enforcement boundary", async () => {
  const config = await source("supabase/config.toml");
  assert.match(config, /\[auth\.captcha\][\s\S]*?enabled\s*=\s*true/);
  assert.match(config, /\[auth\.captcha\][\s\S]*?provider\s*=\s*"turnstile"/);
  assert.match(
    config,
    /\[auth\.captcha\][\s\S]*?secret\s*=\s*"env\(TURNSTILE_SECRET_KEY\)"/,
  );

  const contracts = [
    ["app/api/auth/login/route.ts", /signInWithPassword\([\s\S]*?options:\s*\{\s*captchaToken\s*\}/],
    ["app/api/auth/signup/route.ts", /signUp\([\s\S]*?captchaToken/],
    ["app/api/auth/forgot-password/route.ts", /resetPasswordForEmail\([\s\S]*?captchaToken/],
    ["app/api/auth/resend-confirmation/route.ts", /\.resend\([\s\S]*?captchaToken/],
  ];

  for (const [path, expectedForwarding] of contracts) {
    const route = await source(path);
    assert.doesNotMatch(route, /verifyTurnstileToken/);
    assert.match(route, expectedForwarding);
  }

  const settings = await source("app/settings/page.tsx");
  assert.doesNotMatch(settings, /auth\.signInWithPassword/);
  assert.match(settings, /current_password:\s*currentPassword/);
});
