import { DurableObject } from "cloudflare:workers";
import {
  GOOGLE_REDIRECT_URI,
  GOOGLE_SCOPES,
  READ_SECRET,
  runAppsScriptFunction,
  TEST_KEY,
} from "./utils/googleConfig.js";
import {
  GET_ALL_USER_LIST_NEW,
  GET_DATA,
  SAVE_DATA,
  DELETE_DATA,
  SEARCH_VOUCHER,
} from "./api/ApplicationMethod.js";

async function getGoogleOAuthUrls(env, state) {
  const clientId = await READ_SECRET(env, "API_CLIENT_ID");
  const clientSecret = await READ_SECRET(env, "API_CLIENT_SECRET");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "select_account consent",
    scope: GOOGLE_SCOPES,
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function createOAuthState() {
  return crypto.randomUUID();
}

async function executeScriptFunction(env, functionName, inputData = {}) {
  try {
    const result = await runAppsScriptFunction(env, functionName, inputData);
    return {
      status: true,
      message: "Apps Script executed successfully",
      result,
    };
  } catch (error) {
    console.error(
      `${functionName} Apps Script error:`,
      error?.stack || error?.message || error,
    );
    return {
      status: false,
      message: error?.message || "Apps Script execution failed",
    };
  }
}

async function exchangeGoogleCode(code, env) {
  const clientId = await READ_SECRET(env, "API_CLIENT_ID");
  const clientSecret = await READ_SECRET(env, "API_CLIENT_SECRET");

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${JSON.stringify(data)}`);
  }

  return data;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // OAuth start
    if (request.method === "GET" && url.pathname === "/oauth/start") {
      const state = createOAuthState();
      const oauthUrl = await getGoogleOAuthUrls(env, state);

      return new Response(null, {
        status: 302,
        headers: {
          Location: oauthUrl,
          "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
        },
      });
    }

    // OAuth callback
    if (request.method === "GET" && url.pathname === "/oauth/callback") {
      try {
        const cookie = request.headers.get("Cookie") || "";
        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");

        const stateMatch = cookie.match(/oauth_state=([^;]+)/);
        const storedState = stateMatch?.[1];

        if (!code) {
          throw new Error("Authorization code missing");
        }

        if (!returnedState || !storedState || returnedState !== storedState) {
          throw new Error("Invalid OAuth state");
        }

        const tokenData = await exchangeGoogleCode(code, env);

        return new Response(
          JSON.stringify({
            status: true,
            message: "Google OAuth successful",
            accessTokenReceived: !!tokenData.access_token,
            refreshTokenReceived: !!tokenData.refresh_token,
            expiresIn: tokenData.expires_in,
            scope: tokenData.scope,
            refreshToken: tokenData.refresh_token || null,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie":
                "oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
            },
          },
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            status: false,
            message: error?.message || "OAuth callback failed",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }
    }
    if (request.method === "GET" && url.pathname === "/test-apps-script") {
      try {
        const result = await runAppsScriptFunction(env, "sendTestMail");

        return new Response(
          JSON.stringify({
            status: true,
            message: "Apps Script executed successfully",
            result,
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            status: false,
            message: error?.message || "Apps Script execution failed",
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }
    }

    // Health check
    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: true,
          message: "Cloudflare Worker is running",
          service: "Google Sheets API",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Only POST APIs

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          status: false,
          message: "Only GET, POST and OPTIONS methods are allowed",
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    try {
      const requestData = await request.json();

      const apiType = requestData.apiType;
      const inputData = requestData.inputData || {};

      let response;
      let functionName = "";

      // API routing

      switch (apiType) {
        case "GET_TODAY_CLASS_DETAILS_FOR_TEACHER":
          functionName = "GET_TEACHER_CLASS_SUBJECTS_AND_STUDENTS_BY_NAME_FUN";
          break;

        case "GET_TEACHER_ELIGIBLE_SUBJECTS":
          functionName = "TEACHER_HW_SUBJECTS";
          break;

        default:
          response = {
            status: false,
            message: "Invalid apiType",
            apiType: apiType,
          };
          break;
      }

      if (functionName !== "") {
        response = await executeScriptFunction(env, functionName, inputData);
      }

      response = {
        ...response,
        status: response?.status === false ? false : true,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Worker Error:", error);

      return new Response(
        JSON.stringify({
          status: false,
          message: error?.message || "Internal server error",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
  },
};
