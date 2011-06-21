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

// XML entities.
var entities = {
  '"': '&quot;',
  '&': '&amp;',
  '\'': '&apos;',
  '<': '&lt;',
  '>': '&gt;'
};

// Escapes text for XML.
function escape(value) {
  return value.replace(/"|&|'|<|>/g, function(entity) {
    return entities[entity];
  });
}

// Parser events to finite automata events mapping.
var faModes = {
  'startElement': 'enter',
  'endElement': 'leave',
  'text': 'state'
};

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
  this._emitData = false;
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
// * `data` on outgoing data chunk,
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
  if (event === 'data') {
    this._emitData = true;
  }
  var eventParts = event.match(/^(startElement|endElement|text):?(.*)/);
  if (eventParts !== null) {
    // If we're dealing with a selector event,
    // continue with selector-specific processing logic.
    var evtType = eventParts[1];
    var selector = eventParts[2];
    var parts = selector.match(/[a-z0-9\:]+|>/ig);
    selector = parts.join(' ');
    event = evtType + ': ' + selector;
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
    this._fa.on(faModes[evtType], finalState, function(item, context, trace) {
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
  var trace = {};
  var curr = {
    node: {
      element: {},
      text: '',
      name: 'root'
    },
    fullText: '',
    path: '',
    context: {}
  };
  var fa = this._fa;
  fa.setState(this._startState);

  // A listener is assigned on opening tag encounter.
  // Here we traverse the configured finite automata use the stack
  // to form the context and trace for selector event emission.
  xml.on('startElement', function(name, attr) {
    stack.push(curr);
    trace[curr.path] = curr.node.element;
    var context = Object.create(curr.context);
    var element = {$: attr};
    curr.node.element[name] = element;
    curr = {
      node: {
        element: element,
        text: '',
        name: name
      },
      fullText: '',
      path: curr.path + '/' + name
    };
    context[name] = curr.node.element;
    curr.context = context;
    fa.enter(name, [curr.node, curr.context, trace]);
    if (self._emitData) {
      self.emit('data', '<' + curr.node.name);
      var attrs = curr.node.element.$;
      for (var attr in attrs) if (attrs.hasOwnProperty(attr)) {
        self.emit('data', ' ' + attr + '="' + escape(attrs[attr]) + '"');
      }
      self.emit('data', '>');
    }
    if (isEmpty(curr.node.element.$)) {
      delete curr.node.element.$;
    }
  });

  // A listener is assigned on closing tag encounter.
  // Current node structure object is finalized. A selector listener is
  // invoked with current node, context, and trace; these arguments are
  // removed from the stack afterwards.
  xml.on('endElement', function(name) {
    var prev = stack.pop();
    var node = curr.node;
    node.text = curr.fullText;
    var val;
    if (isEmpty(node.element)) {
      val = node.text;
    } else if (node.text !== '') {
      val = new String(node.text);
      for(var prop in node.element) if (node.element.hasOwnProperty(prop)) {
        val[prop] = node.element[prop];
      }
    } else {
      val = node.element;
    }
    curr.context[name] = val;
    prev.node.element[node.name] = val;
    fa.leave([node, curr.context, trace]);
    if (self._emitData) {
      self.emit('data', '</' + node.name + '>');
    }
    curr = prev;
  });

  // Collect node text part by part
  // (and trim leading and trailing whitespace).
  xml.on('text', function(text) {
    curr.node.text = text;
    fa.run([curr.node, curr.context, trace]);
    if (self._emitData) {
      self.emit('data', escape(curr.node.text));
    }
    curr.fullText += curr.node.text.trim();
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
