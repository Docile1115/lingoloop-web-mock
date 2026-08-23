import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function startServer(port) {
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: backendDirectory,
    env: {
      ...process.env,
      GOOGLE_CLOUD_PROJECT: "lingoloop-test",
      IDENTITY_API_KEY: "test-identity-key",
      PROXY_SHARED_SECRET: "test-proxy-secret",
      APP_ORIGIN: "http://localhost:5174",
      COOKIE_SECURE: "false",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  await new Promise((resolve, reject) => {
    const fail = (error) => {
      child.kill();
      reject(error);
    };
    const timer = setTimeout(() => fail(new Error("server startup timed out: " + stderr)), 30_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      fail(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      fail(new Error("server exited before startup with code " + code + ": " + stderr));
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      if (chunk.includes('"status":"listening"')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  return child;
}

test("HTTP boundary rejects bypasses and serves only non-mock metadata", async (context) => {
  const port = await freePort();
  const child = await startServer(port);
  context.after(() => child.kill());
  const baseUrl = "http://127.0.0.1:" + port;

  const missingProxy = await fetch(baseUrl + "/api/languages");
  assert.equal(missingProxy.status, 403);
  assert.equal((await missingProxy.json()).error.code, "INVALID_PROXY");

  const languages = await fetch(baseUrl + "/api/languages", {
    headers: { "x-lingoloop-proxy": "test-proxy-secret" },
  });
  const languageBody = await languages.json();
  assert.equal(languages.status, 200);
  assert.equal(languageBody.meta.mock, false);
  assert.equal(languageBody.meta.persistent, true);
  assert.ok(languageBody.data.some((language) => language.code === "ko"));

  const invalidOrigin = await fetch(baseUrl + "/api/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.example",
      "x-lingoloop-proxy": "test-proxy-secret",
    },
    body: JSON.stringify({ email: "person@example.com", password: "password-123", name: "Person" }),
  });
  assert.equal(invalidOrigin.status, 403);
  assert.equal((await invalidOrigin.json()).error.code, "INVALID_ORIGIN");

  const invalidJson = await fetch(baseUrl + "/api/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5174",
      "x-lingoloop-proxy": "test-proxy-secret",
    },
    body: "{not-json",
  });
  assert.equal(invalidJson.status, 400);
  assert.equal((await invalidJson.json()).error.code, "INVALID_JSON");

  const malformedCookie = await fetch(baseUrl + "/api/auth/me", {
    headers: {
      cookie: "lingoloop_session=%",
      "x-lingoloop-proxy": "test-proxy-secret",
    },
  });
  assert.equal(malformedCookie.status, 401);
  assert.equal((await malformedCookie.json()).error.code, "AUTH_REQUIRED");
});
