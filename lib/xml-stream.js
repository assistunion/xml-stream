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
  this._collect = false;
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
//
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
XmlStream.prototype.on = function(eventName, listener) {
  XmlStream.super_.prototype.on.call(this, eventName, listener);
  if (eventName === 'data') {
    this._emitData = true;
  }
  var event = parseEvent(eventName);
  if (event !== null) {
    // If we're dealing with a selector event,
    // continue with selector-specific processing logic.
    var finalState = getFinalState.call(this, event.selector);
    var self = this;
    if (event.type === 'updateElement') {
      this._fa.on('enter', finalState, function() {
        self._bufferLevel++;
      });
      this._fa.on('leave', finalState, function(element, context, trace) {
        self.emit(event.name, element, context, trace);
        if (!--self._bufferLevel && self._emitData) {
           emitElement.call(self, element, self._name, true);
        }
      });
    } else {
      var fn = function(element, context, trace) {
        self.emit(event.name, element, context, trace);
      };
      this._fa.on(faModes[event.type], finalState, fn);
    }
  }
};

//
XmlStream.prototype.collect = function(selector) {
  selector = normalizeSelector(selector);
  var finalState = getFinalState.call(this, selector);
  var self = this;
  this._fa.on('flag', finalState, function() {
    self._collect = true;
  });
};

// Normalizes the selector and returns the new version and its parts.
function normalizeSelector(selector) {
  var parts = selector.match(/[^\s>]+|>/ig);
  selector = parts.join(' ');
  return {
    normalized: parts.join(' '),
    parts: parts
  };
}

// Parses the selector event string and returns event information.
function parseEvent(event) {
  var eventParts = event.match(/^((?:start|end|update)Element|text):?(.*)/);
  if (eventParts === null) {
    return null;
  }
  var eventType = eventParts[1];
  var selector = normalizeSelector(eventParts[2]);
  return {
    selector: selector,
    type: eventType,
    name: eventType + ': ' + selector.normalized
  };
}

// Compiles a given selector object to a finite automata
// and returns its last state.
function getFinalState(selector) {
  if (this._finalStates.hasOwnProperty(selector.normalized)) {
    finalState = this._finalStates[selector.normalized];
  } else {
    var n = selector.parts.length;
    var immediate = false;
    this._startState[this._lastState] = true;
    for (var i = 0; i < n; i++) {
      var part = selector.parts[i];
      if (part === '>') {
        immediate = true;
      } else {
        if (!immediate) {
          this._fa.transition(this._lastState, '', this._lastState);
        }
        this._fa.transition(this._lastState, part, ++this._lastState);
        immediate = false;
      }
    }
    finalState = this._lastState++;
    this._finalStates[selector.normalized] = finalState;
  }
  return finalState;
}

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
  this.emit('data', escape(text).trim());
}

// Emits a single element and its descendants, or an array of elements.
function emitElement(element, name, onLeave) {
  if (Array.isArray(element)) {
    var i;
    for (i = 0; i < element.length - 1; i++) {
      emitOneElement.call(this, element[i], name);
    }
    emitOneElement.call(this, element[i], name, onLeave);
  } else {
    emitOneElement.call(this, element, name, onLeave);
  }
}

// Recursively emits a given element and its descendants.
function emitOneElement(element, name, onLeave) {
  if (typeof element === 'object') {
    emitStart.call(this, name, element.$);
    var hasText = false;
    for (var child in element) {
      if (element.hasOwnProperty(child) && child !== '$' && child != '$name') {
        if (child === '$text') {
          hasText = true;
        } else {
          emitElement.call(this, element[child], child);
        }
      }
    }
    if (hasText) {
      emitText.call(this, element.$text);
    }
  } else {
    emitStart.call(this, name, element.$);
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
    element: {},
    collect: this._collect,
    fullText: '',
    space: 0,
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
    trace[curr.path] = curr.element;
    var context = Object.create(curr.context);
    var element = {
      $: attr,
      $name: name,
      $text: ''
    };
    var parent = curr.element;
    curr = {
      element: element,
      collect: false,
      fullText: '',
      space: 0,
      path: curr.path + '/' + name,
      context: context
    };
    self._collect = false;
    fa.enter(name, [element, context, trace]);
    name = element.$name;
    curr.collect = self._collect;
    if (curr.collect) {
      var container;
      if (Object.hasOwnProperty.call(parent, name)) {
        container = parent[name];
        container.push(element);
      } else {
        container = [element];
        parent[name] = container;
      }
    } else {
      parent[name] = element;
      context[name] = element;
    }
    if (self._bufferLevel === 0 && self._emitData) {
      emitStart.call(self, name, element.$);
    }
  });

  // A listener is assigned on closing tag encounter.
  // Current node structure object is finalized. A selector listener is
  // invoked with current node, context, and trace; these arguments are
  // removed from the stack afterwards.
  xml.on('endElement', function(name) {
    var prev = stack.pop();
    var element = curr.element;
    var text = curr.fullText;
    var attr = element.$;
    if (typeof attr !== 'object') {
      attr = {};
    }
    var name = element.$name;
    self._name = name;
    delete element.$;
    delete element.$text;
    delete element.$name;
    var val = element;
    if (isEmpty(element) && isEmpty(attr)) {
      val = text;
    } else if (!isEmpty(attr)) {
      element.$ = attr;
    }
    if (text !== '') {
      element.$text = text;
    }
    curr.context[name] = val;
    if (curr.collect) {
      var container = prev.element[name];
      container[container.length - 1] = val;
    } else {
      prev.element[name] = val;
    }
    fa.leave([element, curr.context, trace]);
    if (self._bufferLevel === 0 && self._emitData) {
      emitEnd.call(self, name);
    }
    curr = prev;
    this._collect = curr.collect;
  });

  // Collect node text part by part
  // (and trim leading and trailing whitespace).
  xml.on('text', function(text) {
    curr.element.$text = text;
    fa.run('state', [curr.element, curr.context, trace]);
    if (self._bufferLevel === 0 && self._emitData) {
      emitText.call(self, text);
    }
    var trimmed = curr.element.$text.trim();
    var spaced = curr.element.$text.substr(0, 1);
    spaced = (spaced !== '') && (spaced.trim() === '');
    var after = curr.element.$text.substr(-1, 1);
    after = (after !== '') && (after.trim() === '');
    switch (curr.space) {
      // No words yet (pass through spaces).
      case 0:
        if (trimmed !== '') {
          curr.space = after ? 2 : 1;
        }
        break;

      // Immediately after text or entity.
      case 1:
        if (trimmed === '') {
          curr.space = 2;
        } else {
          if (spaced) {
            curr.fullText += ' ';
          }
          if (after) {
            curr.space = 2;
          }
        }
        break;

      // Some words were emitted, pass through spaces again.
      // Emit spaces only when a word is encountered afterwards.
      case 2:
        if (trimmed !== '') {
          curr.fullText += ' ';
          curr.space = 1;
        }
        break;
    }
    curr.fullText += trimmed;
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
}
