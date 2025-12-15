const AI_API_BASE = "YOUR_AI_API_BASE_URL"; 
const AI_API_KEY = "YOUR_API_KEY";

const MAX_CONCURRENT_REQUESTS = 20;
const REQUEST_TIMEOUT = 60000;

let requestQueue = [];
let activeRequests = 0;

const SENSITIVE_PATHS = [
  '/.env',
  '/.env.dev',
  '/.env.prod',
  '/.env.local',
  '/.git',
  '/.git/config',
  '/wp-admin',
  '/wp-login.php',
  '/admin',
  '/config',
  '/backup',
  '/.ssh',
  '/phpinfo.php',
  '/.htaccess',
  '/.htpasswd'
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    const pathname = url.pathname.toLowerCase();
    for (const sensitivePath of SENSITIVE_PATHS) {
      if (pathname.includes(sensitivePath.toLowerCase())) {
        console.log(`[SECURITY] Blocked suspicious request from ${clientIP}: ${pathname}`);
        
        return new Response(JSON.stringify({ 
          error: { 
            message: "Not Found",
            type: "security_block"
          }
        }), { 
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }
    
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (url.pathname === "/" || url.pathname === "") {
      return new Response(JSON.stringify({ 
        status: "ok",
        message: "AI Worker is running",
        endpoint: "/v1/chat/completions",
        models_endpoint: "/v1/models",
        note: "This Worker proxies requests to the AI API. Use POST /v1/chat/completions to make requests."
      }), { 
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    if (url.pathname.includes("/v1/models")) {
      activeRequests++;
      try {
        const targetUrl = `${AI_API_BASE}/v1/models`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        try {
          const response = await fetch(targetUrl, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${AI_API_KEY}`
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          const responseBody = await response.text();

          const responseHeaders = new Headers();
          responseHeaders.set("Content-Type", "application/json");
          responseHeaders.set("Access-Control-Allow-Origin", "*");
          responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
          responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

          return new Response(responseBody, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error("Request timeout");
          }
          throw fetchError;
        }
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: { 
            message: error.message || "Failed to fetch models",
            type: "server_error"
          }
        }), { 
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } finally {
        activeRequests--;
      }
    }

    if (!url.pathname.includes("/v1/chat/completions")) {
      return new Response(JSON.stringify({ 
        error: { 
          message: "Invalid endpoint. Supported endpoints: /v1/chat/completions, /v1/models",
          available_endpoints: ["/v1/chat/completions", "/v1/models"]
        }
      }), { 
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    let requestBody = null;
    try {
      requestBody = await request.text();
    } catch (e) {
      return new Response(JSON.stringify({ 
        error: { message: "Failed to read request body: " + e.message }
      }), { 
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      return new Response(JSON.stringify({ 
        error: { 
          message: "Too many concurrent requests. Please try again later.",
          type: "rate_limit_error"
        }
      }), { 
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Retry-After": "5"
        }
      });
    }

    activeRequests++;

    try {
      const targetUrl = `${AI_API_BASE}/v1/chat/completions`;
      
      let requestData;
      try {
        requestData = JSON.parse(requestBody);
      } catch (e) {
        throw new Error("Invalid JSON in request body");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${AI_API_KEY}`
          },
          body: JSON.stringify(requestData),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const responseBody = await response.text();

        const responseHeaders = new Headers();
        responseHeaders.set("Content-Type", "application/json");
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        return new Response(responseBody, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });

      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error("Request timeout. The API took too long to respond.");
        }
        throw fetchError;
      }

    } catch (error) {
      console.error("AI Worker error:", error);
      
      return new Response(JSON.stringify({ 
        error: { 
          message: error.message || "Internal server error",
          type: "server_error"
        }
      }), { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } finally {
      activeRequests--;
    }
  }
};