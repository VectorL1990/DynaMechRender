(function (global) {

  var UTILS = global.UTILS = {};

  global.getTime = UTILS.getTime = function getTime() {
    if (typeof(performance) != "undefined") {
      global.getTime = performance.now.bind(performance);
    } else {
      global.getTime = Date.now.bind(Date);
    }
  }

})(typeof (window) != "undefined" ? window : (typeof (self) != "undefined" ? self : global));