var expat = require('node-expat');
var FiniteAutomata = require('./finite-automata');

module.exports = XmlStream;
function XmlStream() {
  this._fa = new FiniteAutomata();
  this._lastState = 0;
  this._startState = {};
}

XmlStream.prototype.on = function(selector, cb) {
  var parts = selector.match(/[a-z0-9]+|>/ig);
  var n = parts.length;
  var immediate = false;
  this._startState[this._lastState] = true;
  for (var i = 0; i < n; i++) {
    if (parts[i] == '>') {
      immediate = true;
    } else {
      if (!immediate) {
        this._fa.transition(this._lastState, '', this._lastState);
      }
      this._fa.transition(this._lastState, parts[i], ++this._lastState);
      immediate = false;
    }
  }
  this._fa.on(this._lastState, cb);
  this._lastState++;
};

XmlStream.prototype.parse = function(source, cb) {
  var xml = new expat.Parser();
  var stack = [];
  var path = "";
  var objects = {};
  var current = {};
  var property = 'root';
  var fa = this._fa;
  fa.setState(this._startState);
  xml.on('startElement', function(elem, attr) {
    fa.push(elem);
  });
  xml.on('endElement', function(elem) {
  });
  xml.on('text', function(elem) {
  })
  source.on('data', function(data) {
  });
  source.on('end', function() {
    cb();
  });
};
