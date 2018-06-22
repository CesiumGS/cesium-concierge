'use strict';

var fs = require('fs');

describe('crontab', function () {
    it('has valid line endings.', function () {
        fs.readFile('crontab', function(err, data) {
            expect(err).toBe(null);
            var decodedData = data.toString('utf-8');
            var newLineIndex = decodedData.indexOf('\n');
            expect(decodedData[newLineIndex-1]==='\r').toBe(false);
        });
    });
});