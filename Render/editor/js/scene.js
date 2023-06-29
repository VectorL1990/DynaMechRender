function Scene() {
  this._root = null;
  this._time = 0;
  this._cameras = [];
}

Object.defineProperty(Scene.prototype, "root", {
  get: function () {
    return this._root;
  },
  set: function (v) {
    throw ("Root node cannot be replaced");
  },
  enumerable: true,
});

Object.defineProperty(Scene.prototype, "time", {
  get: function () {
  },
});

Scene.prototype.init = function () {
  
}



