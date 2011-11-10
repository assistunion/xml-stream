var fs        = require('fs')
  , path      = require('path')
  , XmlStream = require('../lib/xml-stream')
  ;

// Create a file stream and pass it to XmlStream
function setup(encoding) {
  var stream = fs.createReadStream(path.join(__dirname, 'encoding.xml'));
  var xml = new XmlStream(stream, encoding);
  xml.on('endElement: node', function(node) {
    console.log(node);
  });
  xml.on('error', function(message) {
    console.log('Parsing as ' + (encoding || 'auto') + ' failed: ' + message);
  });
  return xml;
}

var xml = setup('utf8');       // Parse as UTF-8
var xml = setup('iso-8859-5'); // Parse as ISO 8859-5
var xml = setup();             // Detect on the fly.
