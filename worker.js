import { GET_TODAY_CLASS_DETAILS_FOR_TEACHER } from "./api/ApplicationMethod.js";

export default {
  async fetch(request, env, ctx) {
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

      // API routing

      switch (apiType) {
        case "GET_TODAY_CLASS_DETAILS_FOR_TEACHER":
          response = await GET_TODAY_CLASS_DETAILS_FOR_TEACHER(inputData, env);
          break;

        default:
          response = {
            status: false,
            message: "Invalid apiType",
            apiType: apiType,
          };
          break;
      }

      return new Response(JSON.stringify(response), {
        status: response.status === false ? 400 : 200,
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
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
  },
};
