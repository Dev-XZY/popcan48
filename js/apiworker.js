export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*", 
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const targetUrl = "https://pocketapi.48.cn" + url.pathname + url.search;

    let bodyContent = null;
    if (request.method === "POST" || request.method === "PUT") {
      bodyContent = await request.text();
    }
    
    const newHeaders = new Headers();
    
    const token = request.headers.get("token");
    const appInfo = request.headers.get("appInfo");
    const pa = request.headers.get("pa");
    
    newHeaders.set("Host", "pocketapi.48.cn");
    newHeaders.set("Content-Type", "application/json;charset=utf-8");
    newHeaders.set("Accept", "*/*");
    newHeaders.set("Accept-Encoding", "gzip, deflate, br");
    newHeaders.set("Connection", "keep-alive");
    newHeaders.set("User-Agent", "PocketFans201807/7.1.10 (iPhone; iOS 16.2; Scale/3.00)");
    newHeaders.set("Accept-Language", "zh-Hans-CN;q=1, zh-Hant-TW;q=0.9, ja-CN;q=0.8");
    
    if (pa) {
      newHeaders.set("pa", pa);
    } else {
      newHeaders.set("pa", "MTcwODkyNDc2MjAwMCw4MTM1LDMwNTk2QTA3NTZBOTNBRjY2MDAxNzkxRDkzREFGOTU1LA==");
    }
    
    if (appInfo) {
      newHeaders.set("appInfo", appInfo);
    } else {
      newHeaders.set("appInfo", '{"vendor":"huaweiphone","deviceId":"F2BA149C-06DB-9843-31DE-36BF375E36F2","appVersion":"7.1.10","appBuild":"24020203","osVersion":"16.2.0","osType":"ios","deviceName":"My HuaweiPhone","os":"ios"}');
    }
    
    if (token) {
      newHeaders.set("token", token);
    }
    
    if (bodyContent) {
      newHeaders.set("Content-Length", new TextEncoder().encode(bodyContent).length.toString());
    }

    const newRequest = new Request(targetUrl, {
      method: request.method,
      headers: newHeaders,
      body: bodyContent,
    });

    try {
      const response = await fetch(newRequest);

      const responseBody = await response.text();
      
      const newResponseHeaders = new Headers();
      
      for (const [key, value] of response.headers) {
        if (!key.toLowerCase().startsWith('access-control-')) {
          newResponseHeaders.set(key, value);
        }
      }
      
      newResponseHeaders.set("Access-Control-Allow-Origin", "*");
      newResponseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      newResponseHeaders.set("Access-Control-Allow-Headers", "*");
      newResponseHeaders.set("Access-Control-Expose-Headers", "*");

      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: newResponseHeaders
      });
      
    } catch (e) {
      console.error("Worker fetch error:", e);
      return new Response(JSON.stringify({ 
        status: 500,
        message: "代理请求失败",
        error: e.message,
        stack: e.stack
      }), { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }
};
