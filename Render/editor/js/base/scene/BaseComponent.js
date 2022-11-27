function BaseComponent(o)
{
  if (o)
  {
    this.configure(o);
  }
}

BaseComponent.prototype.getRootNode = function ()
{
  return this._root;
}

BaseComponent.prototype.configure = function (o)
{
  
}
