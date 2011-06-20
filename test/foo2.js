var XmlStream = require('../lib/xml-stream');
var fs = require('fs');

var xml = new XmlStream(fs.createReadStream(__dirname + '/pandalog.xml'));
xml.on('match: channel > title', function(item, context, trace) {
  console.log(item);
  console.log(context.rss.channel.title == context.channel.title);
  console.log(trace);
});
xml.on('match: rss', function(rss) {
  console.log(rss['@']['xmlns:atom']);
});
