// Installed by the engine, including explore and MCP, before each document.
// Evidence contains resource origins/paths only; never request headers or bodies.
export function auditNetwork() {
  const send = (entries: { url: string; blocked?: boolean }[]) => {
    if (entries.length)
      void fetch('/__fixture/network', {
        method: 'POST',
        body: JSON.stringify(entries),
        keepalive: true,
      });
  };
  new PerformanceObserver((list) => {
    send(
      list
        .getEntries()
        .filter((entry) => !entry.name.includes('/__fixture/network'))
        .map((entry) => ({ url: entry.name })),
    );
  }).observe({ type: 'resource', buffered: true });
  window.addEventListener('securitypolicyviolation', (event) => {
    if (/^https?:/.test(event.blockedURI)) send([{ url: event.blockedURI, blocked: true }]);
  });
}
