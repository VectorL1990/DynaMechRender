
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

SceneNode.prototype.init = function (keep_components, keep_info)
{

}

Object.defineProperty(SceneNode.prototype, 'name', {
  set: function (name)
  {
    this.setName(name);
  },
  get: function ()
  {
    return this._name;
  },
  enumerable: true
});

Object.defineProperty(SceneNode.prototype, 'fullname', {
  set: function (name)
  {
    throw ("You cannot set fullname because it depends on parent nodes");
  },
  get: function ()
  {
    return this.getPathName();
  },
  enumerable: false
});

Object.defineProperty(SceneNode.prototype, 'uid', {
  set: function (uid)
  {
    if (!uid)
    {
      return;
    }
    if (uid[0] != LS._uid_prefix)
    {
      uid = LS._uid_prefix + uid;
      console.warn("invalid uid, rename to : " + uid);
    }

    SceneNode._last_uid_changed = this._uid;

    if (this._in_tree && this._in_tree._nodes_by_uid[this.uid])
    {
      delete this._in_tree._nodes_by_uid[this.uid];
    }
    this._uid = uid;
    if (this._in_tree)
    {
      this._in_tree._nodes_by_uid[this._uid] = this;
    }
    LEvent.trigger(this, "uid_changed", uid);
    if (this._in_tree)
    {
      LEvent.trigger(this._in_tree, "node_uid_changed", this);
    }
  },
  get: function ()
  {
    return this._uid;
  },
  enumerable: true
});
