var XmlStream = require('../lib/xml-stream');
var fs = require('fs');

var xml = new XmlStream(fs.createReadStream(__dirname + '/pandalog.xml'));
xml.on('startElement: item', function(node) {
  node.name = 'cake';
  node.element.$.foo = 'bar<>';
});
xml.on('text: item > description', function(node) {
  node.text = node.text.replace(/^[^:]+:\s+/, '');
});
xml.on('data', function(data) {
  process.stdout.write(data);
});
