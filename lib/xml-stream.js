var expat = require('node-expat');

module.exports = XmlStream;
function XmlStream() {
}

XmlStream.prototype.on = function(selector, cb) {
  this._callbacks[selector] = cb;
};

XmlStream.prototype.parse = function(source) {
};
