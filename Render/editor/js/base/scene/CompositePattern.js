

function CompositePattern()
{

}

CompositePattern.prototype.addChild = function (node, index, options)
{
  if (!node)
  {
    throw ("cannot addChild of null");
  }

  if (node.constructor !== this.constructor)
  {
    throw ("add child must be same type");
  }

  var currentNode = this;
  while (currentNode._parentNode)
  {
    if (currentNode._parentNode == node)
    {
      console.error("can not insert a node as his own child");
      return false;
    }
    currentNode = currentNode._parentNode;
  }

  if (node._parentNode && node._parentNode == this && index !== undefined)
  {
    var prev_index = this._children.indexOf(node);
    if (prev_index < index)
    {
      index--;
    }
  }

  node._parentNode = this;
  if (!this._children)
  {
    this._children = [node];
  }
  else if (index == undefined)
  {
    this._children.push(node);
  }
  else
  {
    this._children.slice(index, 0, node);
  }

  var tree = this._in_tree;

  if (tree && node._in_tree && node._in_tree != tree)
  {
    throw ("can not add a node that belongs to another tree");
  }

  node_in_tree = tree;

  if (this._onChildAdded)
  {
    this._onChildAdded(node, options);
  }

  LEvent.trigger(this, "childAdded", node);
  if (tree)
  {
    LEvent.trigger(tree, "treeItemAdded", node);
    inner_recursive(node);
  }


  function inner_recursive(item)
  {
    if (!item._children)
    {
      return;
    }
    for (var i in item._children)
    {
      var child = item._children[i];
      if (!child._in_tree)
      {
        LEvent.trigger(tree, "treeItemAdded", child);
        child._in_tree = tree;
      }
      inner_recursive(child);
    }
  }
}

/**
 * 
 * @param {*} node 
 * @param {*} param1 
 * @param {*} param2 
 * @returns 
 */
CompositePattern.prototype.removeChild = function (node, param1, param2)
{
  if (!node)
  {
    throw ("can not removeChild of null");
  }

  if (!this._children)
  {
    console.warn("can not removeChild if children is null");
    return false;
  }
  if (node._parentNode != this)
  {
    console.warn("can not removeChild if input node's parent not equal to this");
    return false;
  }

  var pos = this._children.indexOf(node);
  if (pos == -1)
  {
    console.warn("which means input node is not child of this node, can not remove");
    return false;
  }

  this._children.splice(pos, 1);

  if (this._onChildRemoved)
  {
    this._onChildRemoved(node, param1, param2);
  }

  LEvent.trigger(this, "childRemoved", node);

  if (node._in_tree)
  {
    LEvent.trigger(node._in_tree, "treeItemRemoved", node);
    inner_recursive(node);
  }
  node._in_tree = null;

  function inner_recursive(item)
  {
    if (!item._children)
    {
      return;
    }
    for (var i = 0; i < item._children.length; i++)
    {
      var child = item._children[i];
      if (child._in_tree)
      {
        LEvent.trigger(child._in_tree, "treeItemRemoved", child);
        child._in_tree = null;
      }
      inner_recursive(child);
    }
  }

  return true;
}

CompositePattern.prototype.removeAllChildren = function(param1, param2)
{
  if (this._children)
  {
    while (this._children.length > 0)
    {
      this.removeChild(this._children[0], param1, param2);
    }
  }
}

CompositePattern.prototype.serializeChildren = function(simplified)
{
  var r = [];
  if (this._children)
  {
    for (var i in this._children)
    {
      r.push(this._children[i].serialize(false, simplified))
    }
  }
  return r;
}

CompositePattern.prototype.configureChildren = function(serialized_data, components_aside)
{
  if (!serialized_data.children)
  {
    return;
  }

  for (var i=0; i<serialized_data.children.length; i++)
  {
    var child = serialized_data.children[i];

    var node = new this.constructor(child.id);

    if (child.uid)
    {
      node.uid = child.uid;
    }
    if (child.editor)
    {
      node._editor = child.editor;
    }
    this.addChild(node);
    node.configure(child, components_aside);
  }
}
