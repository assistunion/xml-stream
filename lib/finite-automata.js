module.exports = FiniteAutomata;
function FiniteAutomata() {
  this._symbols = {};
  this._states = {};
  this._deterministic = true;
  this._state = {};
  this._callbacks = [];
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

FiniteAutomata.prototype.setState = function(state) {
  this._state = state;
  for (var cb in state) {
    if (state.hasOwnProperty(state)) {
      if (this._callbacks.hasOwnProperty(cb)) {
        this._callbacks[cb]();
      }
    }
  }
  return this;
}

FiniteAutomata.prototype.go = function(symbol) {
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
  this.setState(newState);
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
    this._deterministic &&= !exists;
  }
  return this;
};
