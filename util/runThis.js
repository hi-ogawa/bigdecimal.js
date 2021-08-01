'use strict';
// Run this script to generate all test cases in output folder
const fs = require('fs');
const path = require('path');

const oneOperatorRunner = require('./oneOperator');
const twoOperatorRunner = require('./twoOperator');

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

oneOperatorRunner(outputDir).then(() => {
    return twoOperatorRunner(outputDir);
}).catch(console.log);
