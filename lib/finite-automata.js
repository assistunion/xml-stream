module.exports = FiniteAutomata;
function FiniteAutomata() {
  this._symbols = {};
  this._states = {};
  this._deterministic = true;
  this._state = {};
  this._callbacks = {
    enter: {},
    leave: {},
    state: {},
    flag: {}
  };
  this._stack = [];
  this._stackPtr = -1;
}

function extend(target, source) {
  for (var key in source) if (source.hasOwnProperty(key)) {
    target[key] = source[key];
  }
}

function run(type, args) {
  var cbs = this._callbacks[type];
  for (var cb in this._state) if (this._state.hasOwnProperty(cb)) {
    if (cbs.hasOwnProperty(cb)) {
      var length = cbs[cb].length;
      var cbList = cbs[cb];
      for (var i = 0; i < length; i++) {
        cbList[i].apply(global, args);
      }
    }
  }
}

FiniteAutomata.prototype.isDeterministic = function() {
  return this._deterministic;
};

FiniteAutomata.prototype.on = function(type, state, cb) {
  if (!this._callbacks.hasOwnProperty(type)) {
    this._callbacks[type] = {};
  }
  var typeCbs = this._callbacks[type];
  if (!typeCbs.hasOwnProperty(state)) {
    typeCbs[state] = [];
  }
  typeCbs[state].push(cb);
  return this;
};

FiniteAutomata.prototype.setState = function(state, args) {
  this._state = state;
  run.call(this, 'enter', args);
  run.call(this, 'state', args);
  return this;
};

FiniteAutomata.prototype.nextState = function(symbol) {
  var newState = {};
  for (var st in this._state) if (this._state.hasOwnProperty(st)) {
    if (this._states.hasOwnProperty(st)) {
      var next = this._states[st];
      if (next.hasOwnProperty(symbol)) {
        extend(newState, next[symbol]);
      }
      if (next.hasOwnProperty('')) {
        extend(newState, (next['']));
      }
    }
  }
  return newState;
};

FiniteAutomata.prototype.go = function(symbol, args) {
  var next = this.nextState(symbol)
  this.setState(next, args);
  return this;
};

FiniteAutomata.prototype.leave = function(args) {
  this._stack[this._stackPtr] = undefined;
  run.call(this, 'leave', args);
  this._state = this._stack[--this._stackPtr];
  return this;
};

FiniteAutomata.prototype.enter = function(symbol, args) {
  if (args == null) {
    args = [];
  }
  var next = this.nextState(symbol);
  this._stack[++this._stackPtr] = next;
  this._state = next;
  run.call(this, 'flag');
  run.call(this, 'enter', args);
  return this;
};

FiniteAutomata.prototype.run = function(state, args) {
  run.call(this, state, args);
};

FiniteAutomata.prototype.transition = function(stateFrom, symbol, stateTo) {
  this._symbols[symbol] = true;
  var s;
  if (this._states.hasOwnProperty(stateFrom)) {
    s = this._states[stateFrom];
  } else {
    s = this._states[stateFrom] = {};
  }
  var exists = s.hasOwnProperty(symbol);
  if (exists) {
    s = s[symbol];
  } else {
    s = s[symbol] = {};
  }
  if (!s.hasOwnProperty(stateTo)) {
    s[stateTo] = true;
    this._deterministic &= !exists;
  }
  return this;
};
