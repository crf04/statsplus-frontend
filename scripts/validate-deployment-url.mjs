import { isAllowedDeploymentUrl } from '../e2e/fixtures/deployedSmokeConfig.js';

const mode = process.argv[2];
const deploymentUrl = process.argv[3];

if (
  !['production', 'protected-preview'].includes(mode) ||
  !isAllowedDeploymentUrl(deploymentUrl, mode)
) {
  console.error(
    `Rejected deployment URL: mode=${JSON.stringify(mode ?? '<missing>')} url=${JSON.stringify(
      deploymentUrl ?? '<missing>',
    )}`,
  );
  process.exitCode = 1;
}
