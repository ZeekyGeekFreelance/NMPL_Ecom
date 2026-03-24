const assert = require("node:assert/strict");

const JSON_CONTENT_TYPE = "application/json";

const getSetCookieHeaders = (headers) => {
  if (!headers) {
    return [];
  }

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const singleHeader = headers.get("set-cookie");
  return singleHeader ? [singleHeader] : [];
};

class HttpSession {
  constructor(baseUrl) {
    this.baseUrl = String(baseUrl || "").replace(/\/+$/, "");
    this.cookies = new Map();
    this.csrfToken = null;
  }

  updateFromResponse(response) {
    const setCookieHeaders = getSetCookieHeaders(response.headers);
    for (const rawCookie of setCookieHeaders) {
      const [nameValue] = String(rawCookie || "").split(";");
      const separatorIndex = nameValue.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const name = nameValue.slice(0, separatorIndex).trim();
      const value = nameValue.slice(separatorIndex + 1).trim();
      if (!name) {
        continue;
      }

      this.cookies.set(name, value);
    }

    const csrfHeader = response.headers.get("x-csrf-token");
    if (csrfHeader) {
      this.csrfToken = csrfHeader;
    }
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  async request(path, options = {}) {
    const url = new URL(path, `${this.baseUrl}/`).toString();
    const method = String(options.method || "GET").toUpperCase();
    const headers = new Headers(options.headers || {});

    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }

    if (options.json !== undefined) {
      headers.set("content-type", JSON_CONTENT_TYPE);
    }

    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
      this.csrfToken &&
      !headers.has("x-csrf-token")
    ) {
      headers.set("x-csrf-token", this.csrfToken);
    }

    const response = await fetch(url, {
      method,
      headers,
      body:
        options.json !== undefined
          ? JSON.stringify(options.json)
          : options.body,
      redirect: "manual",
    });

    this.updateFromResponse(response);
    return response;
  }

  async requestJson(path, options = {}) {
    const response = await this.request(path, options);
    const rawText = await response.text();
    const payload = rawText ? JSON.parse(rawText) : null;
    return { response, payload, rawText };
  }

  async bootstrapCsrf() {
    const { response } = await this.requestJson("/api/v1/csrf");
    assert.equal(response.status, 204, "CSRF bootstrap must return 204");
    assert.ok(this.csrfToken, "CSRF bootstrap must expose x-csrf-token");
    assert.ok(
      this.cookies.has("csrf-token"),
      "CSRF bootstrap must set the csrf-token cookie"
    );
    return this.csrfToken;
  }
}

module.exports = {
  HttpSession,
};
