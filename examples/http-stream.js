var http = require('http');
var XmlStream = require('../lib/xml-stream');

// Request an RSS for a Twitter stream
var request = http.get({
  host: 'twitter.com',
  path: '/statuses/user_timeline/289849522.rss' // @dimituri
}).on('response', function(response) {
  // Pass the response as UTF-8 to XmlStream
  response.setEncoding('utf8');
  var xml = new XmlStream(response);

  // When each item node is completely parsed, buffer its contents
  xml.on('updateElement: item', function(item) {
    // Change <title> child to a new value, composed of its previous value
    // and the value of <pubDate> child.
    item.title = item.title.match(/^[^:]+/)[0] + ' on ' +
      item.pubDate.replace(/ \+[0-9]{4}/, '');
  });

  // When <item>'s <description> descendant text is completely parsed,
  // buffer it and pass the containing node
  xml.on('text: item > description', function(element) {
    // Modify the <description> text to make it more readable,
    // highlight Twitter-specific and other links
    var url = /(^|\s+)([a-z]+(?:\/\/)?:[^\s]+)/ig;
    var hashtag = /(^|\s+)(#[\w]+)/g;
    var username = /(^|\s+)@([\w]+)/g;
    element.$text = element.$text
      .replace(/^[^:]+:\s+/, '')
      .replace(url, '$1<a href="$2">$2</a>')
      .replace(hashtag, '$1<a href="https://twitter.com/search/$2">$2</a>')
      .replace(username, '$1<a href="https://twitter.com/$2">@$2</a>');
  });

  // When each chunk of unselected on unbuffered data is returned,
  // pass it to stdout
  xml.on('data', function(data) {
    process.stdout.write(data);
  });
});
