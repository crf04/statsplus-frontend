export function protectProduction(environment, handler) {
  return (request, response) => {
    if (
      environment === "production" &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      !(request.method === "POST" && request.url === "/api/user/targets/preview")
    ) {
      response.writeHead(403, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          error:
            "Production verification permits read-only requests. Use QA for writes.",
        }),
      );
      return;
    }
    handler(request, response);
  };
}
