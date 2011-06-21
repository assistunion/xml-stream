var FiniteAutomata = require('../lib/finite-automata');

var fa = new FiniteAutomata();

[
  [1,'a',2],
  [2,'b',3],
  [3,'c',4],
  [4,'d',1],
  [2,'',2]
].forEach(function(t) {
  fa.transition.apply(fa, t);
});

fa.on(1, function(x) {
  console.log(x + '*** OK');
});

fa.setState({1: true}, 'test');

var graph = [{
  a: [{
    b: [{
      c: [{
        d: []
      },{
        d: []
      },{
        d: [{
          e: [{
            b: [{
              c: [{
                d: []
              }]
            }]
          }]
        }]
      }]
    }]
  }]
}];

function walk(list, indent) {
  for(var i=0; i < list.length; i++) {
    var obj = list[i];
    for (var tag in obj) if (obj.hasOwnProperty(tag)) {
      console.log(indent + '<' + tag + '>');
      fa.push(tag);
      walk(obj[tag], indent + '  ');
      console.log(indent + '</' + tag + '>');
      fa.pop(indent);
    }
  }
}

walk(graph,'');
