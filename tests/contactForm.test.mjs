import assert from "node:assert/strict";
import test from "node:test";
import {
  validateContactForm,
  CONTACT_EMAIL,
  CONTACT_LIMITS,
  CONTACT_TOPICS,
} from "../app/contact/contactForm.ts";

const validInput = {
  name: "Jane Smith",
  email: "jane@example.com",
  topic: "general",
  message: "I need help with my account.",
  language: "en",
};

test("validation trims fields and returns only normalized contact values", () => {
  assert.equal(CONTACT_EMAIL, "info@bluedeck.app");
  const result = validateContactForm({
    ...validInput,
    name: "  Jane Smith  ",
    email: " jane@example.com ",
    topic: " general ",
    message: "  I need help.\r\nMore details.  ",
    status: "archived",
    is_admin: true,
  });
  assert.deepEqual(result, {
    ok: true,
    value: { ...validInput, message: "I need help.\nMore details." },
  });
});

test("validation accepts each supported topic and language combination", () => {
  assert.deepEqual(CONTACT_TOPICS, ["account", "recruitment", "yacht-os", "general"]);
  for (const language of ["en", "tr"]) {
    for (const topic of CONTACT_TOPICS) {
      const result = validateContactForm({ ...validInput, language, topic });
      assert.deepEqual(result, {
        ok: true,
        value: { ...validInput, language, topic },
      });
    }
  }
});

test("missing values and incorrect JSON types return field errors without throwing", () => {
  for (const input of [undefined, null, true, 42, "message", [], {}]) {
    assert.deepEqual(validateContactForm(input), { ok: false, field: "name" });
  }
  for (const field of ["name", "email", "topic", "message", "language"]) {
    for (const value of [undefined, null, true, 42, [], {}, "   "]) {
      assert.deepEqual(validateContactForm({ ...validInput, [field]: value }), {
        ok: false,
        field,
      });
    }
  }
});

test("unsupported topics, languages and malformed email addresses fail validation", () => {
  for (const topic of ["billing", "__proto__", "general&bcc=elsewhere@example.com", "general\r\nBcc: attacker@example.com"]) {
    assert.deepEqual(validateContactForm({ ...validInput, topic }), {
      ok: false,
      field: "topic",
    });
  }
  for (const language of ["de", "EN", "__proto__"]) {
    assert.deepEqual(validateContactForm({ ...validInput, language }), {
      ok: false,
      field: "language",
    });
  }
  for (const email of ["jane", "jane@", "jane@example", "jane smith@example.com", "jane@example.com?bcc=other@example.com", "jane@example.com,other@example.com"]) {
    assert.deepEqual(validateContactForm({ ...validInput, email }), {
      ok: false,
      field: "email",
    });
  }
});

test("field lengths accept the boundary and reject values above shared limits", () => {
  const emailAtLimit = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  assert.equal(emailAtLimit.length, CONTACT_LIMITS.email);
  for (const [field, value] of [
    ["name", "a".repeat(CONTACT_LIMITS.name)],
    ["email", emailAtLimit],
    ["message", "a".repeat(CONTACT_LIMITS.message)],
  ]) {
    assert.equal(validateContactForm({ ...validInput, [field]: value }).ok, true);
    assert.deepEqual(validateContactForm({ ...validInput, [field]: `${value}a` }), {
      ok: false,
      field,
    });
  }
});

test("raw CR/LF and other controls are rejected before name or email trimming", () => {
  for (const field of ["name", "email"]) {
    for (const suffix of ["\r\nBcc: attacker@example.com", "\n", "\r", "\t", "\u0000", "\u007f", "\u2028", "\u2029"]) {
      assert.deepEqual(validateContactForm({ ...validInput, [field]: validInput[field] + suffix }), {
        ok: false,
        field,
      });
    }
  }
});

test("Unicode, emoji and tabs survive message validation with normalized newlines", () => {
  const result = validateContactForm({
    ...validInput,
    name: "Çağrı Öztürk",
    message: "Türkçe: görüşelim. ⚓ 🛥️\n日本語\r\n\tİkinci satır\rSon satır",
    language: "tr",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.name, "Çağrı Öztürk");
  assert.equal(result.value.message, "Türkçe: görüşelim. ⚓ 🛥️\n日本語\n\tİkinci satır\nSon satır");
});

test("message controls and malformed Unicode are rejected", () => {
  for (const character of ["\u0000", "\u000b", "\u001b", "\u007f", "\u0085", "\ud800"]) {
    assert.deepEqual(validateContactForm({ ...validInput, message: `Hello${character}world` }), {
      ok: false,
      field: "message",
    });
  }
  assert.deepEqual(validateContactForm({ ...validInput, name: "Jane\ud800" }), {
    ok: false,
    field: "name",
  });
});

test("literal message content is preserved without accepting administrative fields", () => {
  const message = "<b>Help</b> + details &bcc=attacker@example.com?subject=changed#fragment\nBcc: someone@example.com\n%0D%0ABcc: other@example.com";
  const result = validateContactForm({
    ...validInput,
    name: "Jane & Co? #team",
    email: "jane+crew@example.com",
    message,
    id: "attacker-chosen-id",
    status: "read",
    read_at: "2026-09-27T12:00:00Z",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.value).sort(), ["email", "language", "message", "name", "topic"]);
  assert.equal(result.value.email, "jane+crew@example.com");
  assert.equal(result.value.message, message);
});
