var expat = require('node-expat');
var FiniteAutomata = require('./finite-automata');

function isEmpty(obj) {
  for (var key in obj) if (obj.hasOwnProperty(key)) {
    return false;
  }
  return true;
}

function createVersion(proto) {
  var obj = {};
  obj.__proto__ = proto;
  return obj;
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
  var objects = {};
  var curr = {
    obj: {},
    attr: {},
    text: '',
    prop: 'root',
    path: '',
    items: {}
  };
  var fa = this._fa;
  fa.setState(this._startState);

  xml.on('startElement', function(elem, attr) {
    fa.push(elem);
    stack.push(curr);
    objects[curr.path] = curr;
    var items = createVersion(curr.items);
    var obj = isEmpty(attr) ? {} : {'@': attr};
    curr.obj[elem] = obj;
    curr = {
      obj: obj,
      attr: attr,
      text: '',
      prop: elem,
      path: curr.path + '/' + elem,
    };
    items[elem] = curr.obj;
    curr.items = items;
  });

  xml.on('endElement', function(elem) {
    var prev = stack.pop();
    var val;
    if (isEmpty(curr.obj) && isEmpty(curr.attr)) {
      val  = curr.text;
    } else if (isEmpty(curr.obj)) {
      val = new String(curr.text);
    } else if (curr.text != '') {
      val = new String(curr.text);
      for(var x in curr.obj) if (curr.obj.hasOwnProperty(x)) {
        val[x] = curr.obj[x];
      }
    } else {
      val = curr.obj;
    }
    curr.items[elem] = val;
    prev.obj[curr.prop] = val
    fa.pop([val, curr.items, objects]);
    curr = prev;
  });

  xml.on('text', function(text) {
    curr.text += text.replace(/^\s*(\S*(\s+\S+)*)\s*$/, '$1');
  });

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
