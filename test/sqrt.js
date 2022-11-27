'use strict';
const { Big, MC } = require('../lib/bigdecimal.js');
const chai = require('chai');
const testCases = require('../util/output/sqrtTestCases.json');
chai.should();

describe('Sqrt test TAG_SLOW', function () {

    it('should calculate sqrt correctly', function () {
        for (let i = 0; i < testCases.length; i++) {
            if (process.env["PROGRESS"] && i % Number(process.env["PROGRESS"]) === 0) {
                console.error(`[progress] ${i}/${testCases.length}`);
            }
            const test = testCases[i];
            const sqrtOp = () => {
                return Big(test.args[0]).sqrt(
                    new MC(test.args[1], test.args[2])
                ).toString();
            };
            if (test.result === 'errorThrown') {
                sqrtOp.should.throw(undefined, undefined, `expected '${test.args[0]}'.sqrt() to throw`);
                continue;
            }
            const actual = sqrtOp();
            const expected = test.result;
            actual.should.be.equal(expected, `expected '${test.args[0]}'.sqrt() to be '${expected}'`);
        }
    });
});
