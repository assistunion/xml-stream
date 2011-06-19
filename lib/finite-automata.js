module.exports = FiniteAutomata;
function FiniteAutomata() {
  this._symbols = {};
  this._states = {};
  this._deterministic = true;
  this._state = {};
  this._callbacks = [];
  this._stack = [];
  this._stackPtr = -1;
}

function extend(target, source) {
  for (var key in source) {
    if (source.hasOwnProperty(key)) {
      target[key] = source[key];
    }
  }
}

FiniteAutomata.prototype.isDeterministic = function() {
  return this._deterministic;
}

FiniteAutomata.prototype.on = function(state, cb) {
  this._callbacks[state] = cb;
  return this;
}

FiniteAutomata.prototype._run = function(state, args) {
  for (var cb in state) {
    if (state.hasOwnProperty(cb)) {
      if (this._callbacks.hasOwnProperty(cb)) {
        this._callbacks[cb].apply(global, args);
      }
    }
  }
  return this;
}

FiniteAutomata.prototype.setState = function(state, args) {
  this._state = state;
  this._run(state, args);
  return this;
}

FiniteAutomata.prototype.nextState = function(symbol) {
  var newState = {};
  for (var st in this._state) {
    if (this._state.hasOwnProperty(st)) {
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
  }
  return newState;
}

FiniteAutomata.prototype.go = function(symbol, args) {
  var next = this.nextState(symbol)
  this.setState(next, args);
  return this;
};

FiniteAutomata.prototype.pop = function(args) {
  this._stack[this._stackPtr] = undefined;
  this._run(this._state, args);
  this._state = this._stack[--this._stackPtr];
  return this;
};

FiniteAutomata.prototype.push = function(symbol) {
  var next = this.nextState(symbol);
  this._stack[++this._stackPtr] = next;
  this._state = next;
  return this;
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
