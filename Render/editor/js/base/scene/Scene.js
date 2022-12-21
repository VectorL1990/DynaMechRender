function Scene()
{
  this.uid = LS.generateUId("TREE-");

  this._state = LS.STOPPED;

  this._root = new LS.SceneNode("root");
  this._root.removeAllComponents();
  this._root._is_root = true;
  this._in_tree = this;
  this._nodes = [this._root];
  this._nodes_by_name = { "root": this._root };
  this._nodes_by_uid = {};
  this._nodes_by_uid[this._root.uid] = this._root;
  this._components_by_uid = {};

  LEvent.bind(this, "treeItemAdded", this.onNodeAdded, this);
  LEvent.bind(this, "treeItemRemoved", this.onNodeRemoved, this);

  this.init();
}

Scene.prototype.init = function ()
{
  this._root.removeAllComponents();
  this._root.uid = LS.generateUId("NODE-");
  this._nodes_by_name = { "root": this._root };
  this._nodes_by_uid = {};
  this._nodes_by_uid[this._root.uid] = this._root;
  this._components_by_uid = {};
}

Scene.prototype.clear = function()
{
  while (this._root._children && this._root._children.length)
  {
    this._root.removeChild(this._root._children[0], false, true);
  }

  this.init();
}