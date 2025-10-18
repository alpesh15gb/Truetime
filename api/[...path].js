const { URL } = require("url");

const ensureApiPath = (input) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

    const apiIndex = segments.findIndex((segment) => segment === "api");
    if (apiIndex === -1) {
      segments.push("api");
      parsed.pathname = `/${segments.join("/")}`;
    } else {
      parsed.pathname = `/${segments.slice(0, apiIndex + 1).join("/")}`;
    }

    parsed.search = "";
    parsed.hash = "";
    const normalized = parsed.toString().replace(/\/$/, "");
    return normalized;
  } catch (error) {
    console.error("Unable to parse TRUETIME_BACKEND_URL", error);
    return null;
  }
};

const normalizeBase = () => {
  const base = process.env.TRUETIME_BACKEND_URL;
  if (!base) {
    return null;
  }
  return ensureApiPath(base);
};

const readRequestBody = async (req) => {
  if (!req.method || req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }

  if (req.body) {
    if (Buffer.isBuffer(req.body)) {
      return req.body;
    }
    if (typeof req.body === "string") {
      return Buffer.from(req.body);
    }

    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("application/json")) {
      return Buffer.from(JSON.stringify(req.body));
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(req.body);
      return Buffer.from(params.toString());
    }

    return Buffer.from(String(req.body));
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return undefined;
  }
  return Buffer.concat(chunks);
};

const buildTargetUrl = (baseUrl, req) => {
  const { path } = req.query;
  const segments = Array.isArray(path)
    ? path
    : typeof path === "string"
    ? [path]
    : [];
  const suffix = segments.filter(Boolean).join("/");
  const searchIndex = req.url ? req.url.indexOf("?") : -1;
  const query = searchIndex !== -1 ? req.url.slice(searchIndex) : "";

  const target = suffix ? `${baseUrl}/${suffix}` : baseUrl;
  return `${target}${query}`;
};

const forwardHeaders = (req) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    if (key.toLowerCase() === "host") continue;
    if (Array.isArray(value)) {
      headers.set(key, value.join(","));
    } else {
      headers.set(key, value);
    }
  }
  return headers;
};

const handler = async (req, res) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.origin || "*";
    const requestHeaders =
      req.headers["access-control-request-headers"] || "authorization,content-type";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    res.setHeader("Access-Control-Allow-Headers", requestHeaders);
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
    return;
  }

  const baseUrl = normalizeBase();
  if (!baseUrl) {
    res.status(500).json({
      error:
        "TRUETIME_BACKEND_URL is not configured. Set this environment variable to your deployed FastAPI base URL before using the Truetime frontend."
    });
    return;
  }

  try {
    const incomingHost = req.headers.host;
    const backendHost = new URL(baseUrl).host;
    if (incomingHost && backendHost && incomingHost === backendHost) {
      res.status(500).json({
        error:
          "TRUETIME_BACKEND_URL points to this Vercel deployment. Configure it to your FastAPI backend instead to avoid proxy loops."
      });
      return;
    }
  } catch (error) {
    console.error("Unable to compare backend host", error);
  }

  const targetUrl = buildTargetUrl(baseUrl, req);

  try {
    const body = await readRequestBody(req);
    const headers = forwardHeaders(req);

    const backendResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body
    });

    res.status(backendResponse.status);
    backendResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      res.setHeader(key, value);
    });

    const buffer = Buffer.from(await backendResponse.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error("Error proxying Truetime request", error);
    res.status(502).json({
      error:
        "Unable to reach the Truetime backend. Confirm TRUETIME_BACKEND_URL points to an accessible FastAPI deployment."
    });
  }
};

module.exports = handler;
module.exports.default = handler;
module.exports.config = {
  api: {
    bodyParser: false
  }
};
