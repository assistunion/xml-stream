
const fs = require('fs');
const xmlStream = require('../');

const input = fs.createReadStream('json.xml');
const parse = new xmlStream({
  element: 'media',
  attributes: false,
  output:'json',
  preserve: {},
  collect:['id']
});

parse.on('data', function(data) {
  console.log(data);
});


input
  .pipe(parse);
