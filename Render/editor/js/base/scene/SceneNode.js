
function SceneNode(name)
{
  if (name && name.constructor !== String)
  {
    name = null;
    console.warn("SceneNode constructor first parameter must be a string");
  }

  this._name = name || ("node_" + (Math.random() * 10000).toFixed(0));
  this._uid = LS.generateUId("NODE-");
  this._classList = {};
  this.layers = 3|0;
  this.node_type = null;

  this._prefab = null;
  this._material = null;

  this._components = [];

  this._parentNode = null;
  this._children = null;
  this._in_tree = null;
  this._instances = [];

  this.flags = {
    visible: true,
    is_static: false,
    selectable: true,
    locked: false
  };
}