const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './desktop/e2e', timeout: 90000, workers: 1, fullyParallel: false,
  reporter: 'list', outputDir: 'test-results',
});
