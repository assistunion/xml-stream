var fs        = require('fs')
  , path      = require('path')
  , XmlStream = require('../lib/xml-stream')
  ;

// Create a file stream and pass it to XmlStream
function setup(encoding) {
  var stream = fs.createReadStream(path.join(__dirname, 'encoding.xml'));
  var xml = new XmlStream(stream, encoding);
  return xml;
}

// Try to parse as UTF-8.
var xml = setup('utf8');
xml.on('endElement: node', function(node) {
  console.log(node);
});
xml.on('error', function(message) {
  console.log('Parsing as UTF-8 failed: ' + message);
});

// Try to parse as ISO 8859-5.
var xml = setup('iso-8859-5');
xml.on('endElement: node', function(node) {
  console.log(node);
});
