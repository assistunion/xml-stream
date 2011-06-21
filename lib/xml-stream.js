var events         = require('events')
  , expat          = require('node-expat')
  , FiniteAutomata = require('./finite-automata')
  ;

// Test if object is empty (has no own properties).
function isEmpty(obj) {
  for (var key in obj) if (obj.hasOwnProperty(key)) {
    return false;
  }
  return true;
}

// I accidentally the whole class.
module.exports = XmlStream;

// **XmlStream** is an XML stream filter based on Expat.
// It traverses a given stream and emits events for predefined selectors.
// Event listeners receive selected elements, context, and trace from root.
function XmlStream(stream) {
  events.EventEmitter.call(this);
  this._stream = stream;
  this._fa = new FiniteAutomata();
  this._lastState = 0;
  this._startState = {};
  this._finalStates = {};
  parse.call(this);
}

// Inherit events.EventEmitter.
XmlStream.super_ = events.EventEmitter;
XmlStream.prototype = Object.create(events.EventEmitter.prototype, {
  constructor: {
    value: XmlStream,
    enumerable: false
  }
});

// Adds a listener for the specified event.
//
// Supported events:
// * `end` when parsing has ended,
// * `startElement[: selector]` on opening tag for selector match,
// * `endElement[: selector]` on closing tag for selector match,
// * `text[: selector]` on tag text for selector match.
//
// When adding listeners for `startElement` and `text`, the callback
// can modify the provided node, before it is sent to the consumer.
//
// Selector syntax is CSS-like and currently supports:
//
// * `ancestor descendant`
// * `parent > child`
XmlStream.prototype.on = function(event, listener) {
  XmlStream.super_.prototype.on.call(this, event, listener);
  var eventParts = event.match(/^(startElement|endElement|text):?(.*)/);
  if (eventParts !== null) {
    // If we're dealing with a selector event,
    // continue with selector-specific processing logic.
    var eventType = eventParts[1];
    var selector = eventParts[2];
    var parts = selector.match(/[a-z0-9\:]+|>/ig);
    selector = parts.join(' ');
    event = eventType + ': ' + selector;
    var finalState;
    if (this._finalStates.hasOwnProperty(selector)) {
      finalState = this._finalStates[selector];
    } else {
      var n = parts.length;
      var immediate = false;
      this._startState[this._lastState] = true;
      for (var i = 0; i < n; i++) {
        if (parts[i] === '>') {
          immediate = true;
        } else {
          if (!immediate) {
            this._fa.transition(this._lastState, '', this._lastState);
          }
          this._fa.transition(this._lastState, parts[i], ++this._lastState);
          immediate = false;
        }
      }
      finalState = this._lastState++;
      this._finalStates[selector] = finalState;
    }
    var self = this;
    var on = eventType === 'startElement' ? 'onPush' : 'onPop';
    this._fa[on](finalState, function(item, context, trace) {
      self.emit(event, item, context, trace);
    });
  }
};

// Starts parsing the source stream and emitting various events.
// The Expat parser is assigned several listeners for this purpose.
function parse(stream) {
  var self = this;
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

  // A listener is assigned on opening tag encounter.
  // Here we traverse the configured finite automata use the stack
  // to form the context and trace for selector event emission.
  xml.on('startElement', function(elem, attr) {
    fa.push(elem);
    stack.push(curr);
    objects[curr.path] = curr;
    var items = Object.create(curr.items);
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

  // A listener is assigned on closing tag encounter.
  // Current node structure object is finalized. A selector listener is
  // invoked with current node, context, and trace; these arguments are
  // removed from the stack afterwards.
  xml.on('endElement', function(elem) {
    var prev = stack.pop();
    var val;
    if (isEmpty(curr.obj) && isEmpty(curr.attr)) {
      val  = curr.text;
    } else if (isEmpty(curr.obj)) {
      val = new String(curr.text);
    } else if (curr.text !== '') {
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

  // Collect node text part by part
  // (and trim leading and trailing whitespace).
  xml.on('text', function(text) {
    curr.text += text.trim();
  });

  // Pass data from stream to parser.
  this._stream.on('data', function(data) {
    xml.parse(data, false);
  });

  // End parsing on stream EOF and emit an *end* event ourselves.
  this._stream.on('end', function() {
    xml.parse('', true);
    self.emit('end');
  });
};
