import { isAllowedDeploymentUrl } from '../e2e/fixtures/deployedSmokeConfig.js';

const mode = process.argv[2];
const deploymentUrl = process.argv[3];

if (
  !['production', 'protected-preview'].includes(mode) ||
  !isAllowedDeploymentUrl(deploymentUrl, mode)
) {
  process.exitCode = 1;
}
