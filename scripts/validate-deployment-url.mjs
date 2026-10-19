import {
  isAllowedDeploymentUrl,
  isAllowedReleaseCheckTarget,
} from '../e2e/fixtures/deployedSmokeConfig.js';

// node validate-deployment-url.mjs <protected-preview> <frontend-url>
// node validate-deployment-url.mjs <production|staging> <frontend-url> <api-url> <mcp-url>
const [mode, deploymentUrl, apiUrl, mcpUrl] = process.argv.slice(2);

const diagnosticOrigin = (candidate) => {
  try {
    return new URL(candidate).origin;
  } catch {
    return '<redacted-invalid-url>';
  }
};

const allowed =
  mode === 'protected-preview'
    ? isAllowedDeploymentUrl(deploymentUrl, mode)
    : ['production', 'staging'].includes(mode) &&
      isAllowedReleaseCheckTarget(mode, { frontend: deploymentUrl, api: apiUrl, mcp: mcpUrl });

if (!allowed) {
  const origins =
    mode === 'protected-preview'
      ? `origin=${JSON.stringify(diagnosticOrigin(deploymentUrl))}`
      : `frontend=${JSON.stringify(diagnosticOrigin(deploymentUrl))} api=${JSON.stringify(
          diagnosticOrigin(apiUrl),
        )} mcp=${JSON.stringify(diagnosticOrigin(mcpUrl))}`;
  console.error(`Rejected deployment URL: mode=${JSON.stringify(mode ?? '<missing>')} ${origins}`);
  process.exitCode = 1;
}
