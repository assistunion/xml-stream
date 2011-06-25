var events         = require('events')
  , expat          = require('node-expat')
  , FiniteAutomata = require('./finite-automata')
  ;

// Tests if object is empty (has no own properties).
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
  this._bufferLevel = 0;
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
// * `updateElement[: selector]` on finished node for selector match
//   with its contents buffered,
// * `endElement[: selector]` on closing tag for selector match,
// * `text[: selector]` on tag text for selector match.
//
// When adding listeners for `startElement`, `updateElement`, and `text` the
// callback can modify the provided node, before it is sent to the consumer.
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
  var eventParts = event.match(/^((?:start|end|update)Element|text):?(.*)/);
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
    if (eventType === 'updateElement') {
      this._fa.on('enter', finalState, function() {
        self._bufferLevel++;
      });
      this._fa.on('leave', finalState, function(node, context, trace) {
        if (!--self._bufferLevel) {
          self.emit(event, node, context, trace);
          if (self._emitData) {
            emitElement.call(self, node.element, node.name, true);
          }
        }
      });
    } else {
      var fn = function(node, context, trace) {
        self.emit(event, node, context, trace);
      };
      this._fa.on(faModes[eventType], finalState, fn);
    }
  }
};


// Emits XML for element opening tag.
function emitStart(name, attrs) {
  this.emit('data', '<' + name);
  for (var attr in attrs) if (attrs.hasOwnProperty(attr)) {
    this.emit('data', ' ' + attr + '="' + escape(attrs[attr]) + '"');
  }
  this.emit('data', '>');
}

// Emits XML for element closing tag.
function emitEnd(name) {
  this.emit('data', '</' + name + '>');
}

// Emits XML for element text.
function emitText(text) {
  this.emit('data', escape(text));
}

// Recursively emits a given element and its descendants.
function emitElement(element, name, onLeave) {
  if (typeof element === 'object') {
    emitStart.call(this, name, element.$);
    for (var child in element) {
      if (element.hasOwnProperty(child) && child !== '$') {
        emitElement.call(this, element[child], child);
      }
    }
    if (element instanceof String) {
      emitText.call(this, element);
    }
  } else {
    emitStart.call(this, name, {});
    emitText.call(this, element);
  }
  if(!onLeave) {
    emitEnd.call(this, name);
  }
}

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
    var parent = curr.node.element;
    var node = {
      element: element,
      text: '',
      name: name
    };
    curr = {
      node: node,
      fullText: '',
      path: curr.path + '/' + name,
      context: context
    };
    fa.enter(name, [node, context, trace]);
    name = node.name;
    element = node.element;
    parent[name] = element;
    context[name] = element;
    if (Object.hasOwnProperty.call(element,'$')) {
      attr = element.$;
      if (isEmpty(attr)) {
        delete element.$;
      }
    } else {
      attr = {};
    }
    if (self._bufferLevel === 0 && self._emitData) {
      emitStart.call(self, name, attr);
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
    if (self._bufferLevel === 0 && self._emitData) {
      emitEnd.call(self, node.name);
    }
    curr = prev;
  });

  // Collect node text part by part
  // (and trim leading and trailing whitespace).
  xml.on('text', function(text) {
    curr.node.text = text;
    fa.run([curr.node, curr.context, trace]);
    if (self._bufferLevel === 0 && self._emitData) {
      emitText.call(self, curr.node.text);
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
