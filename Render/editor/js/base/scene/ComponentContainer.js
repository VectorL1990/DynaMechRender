function ComponentContainer()
{
  this.components = [];
}

ComponentContainer.prototype.configureComponents = function (info)
{
  if (!info.components)
  {
    return;
  }

  var to_configure_compAndCompInfo = [];

  for (var i = 0; i < info.components.length; i++)
  {
    var comp_info = info.components[i];
    var comp_class = comp_info[0];
    var comp = null;

    if (comp_class == "Transform" && i == 0 && this.transform)
    {
      comp = this.transform;
    }
    else
    {
      var classObject = LS.Components[comp_class];
      
      comp = new classObject();
      this.addComponent(comp);

    }

    to_configure_compAndCompInfo.push(comp, comp_info[1]);

    if (comp_info[1].editor)
    {
      comp._editor = comp_info[1].editor;
    }

    if (comp_info[1].uid && comp_info[1].uid !== comp.uid)
    {
      comp.uid = comp_info[1].uid;
    }
  }

  for (var i = 0; i < to_configure_compAndCompInfo.length; i += 2)
  {
    var comp = to_configure_compAndCompInfo[i];
    var data = to_configure_compAndCompInfo[i + 1];
    try
    {
      comp.configure(data);
    }
    catch (err)
    {
      console.error("Error found when configuring node of type");
      console.error(err);
    }
  }
}