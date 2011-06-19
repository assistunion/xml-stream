var expat = require('node-expat');
var FiniteAutomata = require('./finite-automata');

function isEmpty(obj) {
  for (var key in obj) {
    if (hasOwnProperty.call(obj, key)) {
      return false;
    }
  }
  return true;
}

module.exports = XmlStream;
function XmlStream() {
  this._fa = new FiniteAutomata();
  this._lastState = 0;
  this._startState = {};
}

XmlStream.prototype.on = function(selector, cb) {
  var parts = selector.match(/[a-z0-9\:]+|>/ig);
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
  var curr = {
    obj: {},
    attr: {},
    text: '',
    prop: 'root',
    path: ''
  };
  var fa = this._fa;
  fa.setState(this._startState);
  xml.on('startElement', function(elem, attr) {
    fa.push(elem);
    stack.push(curr);
    objects[curr.path] = curr;
    curr = {
      obj: {},
      attr: attr,
      text: '',
      prop: elem,
      path: curr.path + '/' + elem
    };
  });
  xml.on('endElement', function(elem) {
    var prev = stack.pop();
    var val;
    if (isEmpty(curr.obj) && isEmpty(curr.attr)) {
      val  = curr.text;
    } else if (isEmpty(curr.obj)) {
      val = new String(curr.text);
      val['@'] = curr.attr;
    } else if (curr.text != "") {
      val = new String(curr.text);
      for(var x in curr.obj) if (curr.obj.hasOwnProperty(x)) {
        val[x] = curr.obj[x];
      }
      val['@'] = curr.attr;
    } else {
      val = curr.obj;
      val['@'] = curr.attr;
    }
    fa.pop(val);
    prev.obj[curr.prop] = val
    curr = prev;
  });
  xml.on('text', function(text) {
    curr.text += text.replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1");
  })
  source.on('data', function(data) {
    xml.parse(data, false);
  });
  source.on('end', function() {
    xml.parse('', true);
    if (cb != null) {
      cb();
    }
  });
};
