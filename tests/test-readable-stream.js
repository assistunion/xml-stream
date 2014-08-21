#!/usr/bin/env node
'use strict';

var fs = require('fs')
	,	assert = require('assert')
	, filename = require('path').resolve(__dirname, '../examples/collect-preserve.xml')
  , XmlStream = require('../lib/xml-stream')
	,	Readable = require('stream').Readable || require('readable-stream');

/**
 * Creates a stream w/ data.
 */
function createStream (data) {
  var rs = new Readable();
  rs.push(data);
  rs.push(null);

  return rs;
}

describe('XmlStream', function() {
	var file = fs.readFileSync(filename, {encoding: 'utf8'});

	it('should deal with fake streams', function(done) {
		var stream = createStream(file);
		var results = [];
		var xml = new XmlStream(stream);

		xml.preserve('item', true);
		xml.collect('subitem');
		xml.on('endElement: item', function(item) {
			results.push(item);
		});

		xml.on('end', function () {
			assert(results.length);
			done();
		});

		xml.on('error', function (err) {
			done(err);
		});
	});
});
