import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/auth/password";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(verifyPassword("wrong password", hash)).toBe(false);
  });

  it("produces a unique salt per hash", () => {
    const a = hashPassword("samepw");
    const b = hashPassword("samepw");
    expect(a).not.toBe(b);
    expect(verifyPassword("samepw", a)).toBe(true);
    expect(verifyPassword("samepw", b)).toBe(true);
  });

  it("rejects malformed stored hashes", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "nosalt")).toBe(false);
  });
});
