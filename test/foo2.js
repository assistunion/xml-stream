var XmlStream = require('../lib/xml-stream');
var fs = require('fs');

var xml = new XmlStream();
xml.on('channel > title', function(item, context, trace) {
  console.log(item);
  console.log(context.rss.channel.title == context.channel.title);
  console.log(trace);
});
xml.on('rss', function(rss) {
  console.log(rss['@']['xmlns:atom']);
});
xml.parse(fs.createReadStream(__dirname + '/pandalog.xml'));
