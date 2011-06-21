var XmlStream = require('../lib/xml-stream');
var fs = require('fs');

var xml = new XmlStream(fs.createReadStream(__dirname + '/pandalog.xml'));
xml.on('endElement: channel > title', function(item, context, trace) {
  console.log(trace);
});
xml.on('endElement: rss', function(rss) {
  console.log(rss.$['xmlns:atom']);
});
xml.on('text: channel > title', function(item) {
  console.log(item);
  item.text = '[changed]';
});
xml.on('startElement: channel > title', function(item) {
  item.$.answer = 42;
});
