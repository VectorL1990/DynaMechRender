(function (global) {
  var MATH_UTILS = global.MATH_UTILS = {};

  global.isPowerOfTwo = function isPowerOfTwo(v) {
    return ((Math.log(v) / Math.log(2)) % 1) == 0;
  }
})(typeof (window) != "undefined" ? window : (typeof (self) != "undefined" ? self : global));