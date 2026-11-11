const {defineConfig} = require('@playwright/test');
module.exports = defineConfig({testDir:'.',testMatch:'site.spec.cjs',fullyParallel:false,workers:1,timeout:30000,
 use:{baseURL:process.env.TRAQU_SITE_TEST_URL || 'http://127.0.0.1:4174',headless:true,launchOptions:{args:['--no-sandbox']}},
 webServer:process.env.TRAQU_SITE_TEST_URL ? undefined : {command:'node serve.cjs',url:'http://127.0.0.1:4174',reuseExistingServer:false},
 outputDir:'test-results/site',reporter:'list'});
