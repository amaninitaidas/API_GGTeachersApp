export const GOOGLE_REDIRECT_URI =
  "https://api-nkdsadhnatool.nityakrishnadas-pnc.workers.dev/oauth/callback";

export const GOOGLE_SCOPES =
  "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/script.send_mail";

export const GOOGLE_SCRIPT_ID =
  "1Qbs3XsZvEFDW9vol10og9V4BqPjhu7w6AuhVuGO5BADFFfEUdt32RVaa";

// Google Sheet Configuration
export const SPREADSHEET_ID = "12RLRK6PjQVeysGskGu6Zanpx6AFU7QwMbU__Ec8JjWI";
export const USER_MASTER_SPREADSHEET_ID =
  "1Lgl9QLwqmaCIAyOJAJ_StUH_H0BHIf0jNgaGFcFgpzo";
export const APPS_SCRIPT_SPREADSHEET_ID =
  "1jdrhL1fsLj-I1p1UtwkK4EfLh8QwszhFMe2uCu1qk7k";
export const CREDIT_ACTIVITY_SPREADSHEET_ID =
  "1gQ7VYdkUFbur38wCXqLcJBwSbOyVQu0apK7_QPg3M78";
export const CREDIT_ACTIVITY_MASTER_SHEET_ID =
  "1gQ7VYdkUFbur38wCXqLcJBwSbOyVQu0apK7_QPg3M78";

export async function READ_SECRET(env, name) {
  const value = env[name];

  if (typeof value === "string") {
    return value;
  }

  const binding = env[`${name}_STORE`] || value;

  if (binding && typeof binding.get === "function") {
    const value = await binding.get();

    if (typeof value === "string") {
      return value;
    }
  }

  if (binding == null) {
    return undefined;
  }

  throw new Error(
    `${name} must be a string or a readable Secrets Store binding`,
  );
}

// Google Authentication
export async function getGoogleAccessToken(env) {
  const [clientEmail, privateKey] = await Promise.all([
    READ_SECRET(env, "API_EMAIL"),
    READ_SECRET(env, "API_PRIVATE_KEY"),
  ]);

  if (!clientEmail) {
    throw new Error("API_EMAIL is missing");
  }

  if (!privateKey) {
    throw new Error("API_PRIVATE_KEY is missing");
  }

  const formattedPrivateKey = privateKey
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "")
    .trim();

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: clientEmail,
    scope:
      "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  const unsignedToken = encodedHeader + "." + encodedPayload;

  const privateKeyObject = await importPrivateKey(formattedPrivateKey);

  const signatureBuffer = await crypto.subtle.sign(
    {
      name: "RSASSA-PKCS1-v1_5",
    },
    privateKeyObject,
    new TextEncoder().encode(unsignedToken),
  );

  const signature = base64UrlEncodeBytes(new Uint8Array(signatureBuffer));

  const jwt = unsignedToken + "." + signature;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body:
      "grant_type=" +
      encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") +
      "&assertion=" +
      encodeURIComponent(jwt),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error("Google Token Error:", tokenData);

    throw new Error(
      tokenData.error_description ||
        tokenData.error ||
        "Unable to get Google access token",
    );
  }

  if (!tokenData.access_token) {
    throw new Error("Google access token was not returned");
  }

  return tokenData.access_token;
}

// Import Private Key

async function importPrivateKey(pem) {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  if (!pemContents) {
    throw new Error("API_PRIVATE_KEY is empty after formatting");
  }

  let binaryDerString;

  try {
    binaryDerString = atob(pemContents);
  } catch (error) {
    throw new Error("API_PRIVATE_KEY is not a valid Base64 PKCS8 private key");
  }

  const binaryDer = new Uint8Array(binaryDerString.length);

  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
}

// Base64 URL Encoding

function base64UrlEncode(value) {
  const bytes = new TextEncoder().encode(value);
  return base64UrlEncodeBytes(bytes);
}

// Base64 URL Encode Bytes

function base64UrlEncodeBytes(bytes) {
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Test Google Private Key

export async function TEST_KEY(env) {
  const binding = env.API_PRIVATE_KEY;

  if (!binding) {
    return {
      status: false,
      message: "API_PRIVATE_KEY is missing",
    };
  }

  const privateKey = await READ_SECRET(env, "API_PRIVATE_KEY");

  if (!privateKey) {
    return {
      status: false,
      message: "API_PRIVATE_KEY is missing",
    };
  }

  const key = String(privateKey);

  return {
    status: true,
    diagnostics: {
      length: key.length,
      startsWithBegin: key.includes("-----BEGIN PRIVATE KEY-----"),
      endsWithEnd: key.includes("-----END PRIVATE KEY-----"),
      containsLiteralSlashN: key.includes("\\n"),
      containsActualNewLine: key.includes("\n"),
      containsDots: key.includes("..."),
      startsWithQuote: key.startsWith('"'),
      endsWithQuote: key.endsWith('"'),
    },
  };
}

export async function runAppsScriptFunction(
  env,
  functionName,
  parameters = [],
) {
  const accessToken = await getGoogleAccessTokenAppscript(env);

  const response = await fetch(
    `https://script.googleapis.com/v1/scripts/${GOOGLE_SCRIPT_ID}:run`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        function: functionName,
        parameters: [parameters],
      }),
    },
  );

  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Apps Script API returned invalid JSON (HTTP ${response.status}): ${responseText.slice(0, 1000)}`,
    );
  }

  if (!response.ok || data.error) {
    const apiError = data.error || data;
    const executionError = apiError.details?.find(
      (detail) => detail.errorMessage || detail.scriptStackTraceElements,
    );
    const details = executionError
      ? `; execution=${JSON.stringify(executionError)}`
      : "";
    throw new Error(
      `Apps Script API failed (HTTP ${response.status}): ${JSON.stringify(apiError)}${details}`,
    );
  }

  return data;
}

async function getGoogleAccessTokenAppscript(env) {
  const clientId = await READ_SECRET(env, "API_CLIENT_ID");
  const clientSecret = await READ_SECRET(env, "API_CLIENT_SECRET");
  const refreshToken = await READ_SECRET(env, "API_REFRESH_TOKEN");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(
      `Google access token refresh failed: ${JSON.stringify(data)}`,
    );
  }

  return data.access_token;
}
