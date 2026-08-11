import { isAllowedDeploymentUrl } from '../e2e/fixtures/deployedSmokeConfig.js';

const mode = process.argv[2];
const deploymentUrl = process.argv[3];

const diagnosticOrigin = (() => {
  try {
    return new URL(deploymentUrl).origin;
  } catch {
    return '<redacted-invalid-url>';
  }
})();

if (
  !['production', 'protected-preview'].includes(mode) ||
  !isAllowedDeploymentUrl(deploymentUrl, mode)
) {
  console.error(
    `Rejected deployment URL: mode=${JSON.stringify(mode ?? '<missing>')} origin=${JSON.stringify(
      diagnosticOrigin,
    )}`,
  );
  process.exitCode = 1;
}
