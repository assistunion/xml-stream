var fs = require('fs')
  , path = require('path')
  ,	assert = require('assert')
  , XmlStream = require('../lib/xml-stream');


describe('XmlStream', function() {

	it('should deal nicely with preserve and collect when reading from file', function(done) {
		var stream = fs.createReadStream(path.resolve(__dirname, '../examples/collect-preserve.xml'));
		var fileExpected = fs.readFileSync(path.resolve(__dirname, 'fixtures/collect-preserve.json'));
		var xml = new XmlStream(stream);
		var results = [];

		xml.preserve('item', true);
		xml.collect('subitem');
		xml.on('endElement: item', function(item) {
		  results.push(item);
		});

		xml.on('end', function () {

			var expected = JSON.parse(fileExpected);

			assert.deepEqual(results, expected);
			done();
		});

		xml.on('error', function (err) {
			done(err);
		});
	});
});
