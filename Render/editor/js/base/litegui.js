var LiteGUI = {
  root: null,

  /**
   * 
   */
  init: function(options)
  {
    options = options || {};

    this.container = null;
    if (!this.container)
    {
      this.container = document.body;
    }

    this.root = this.content = this.container;
    this.root.className = "litegui-wrap fullscreen";
    this.content.className = "litegui-maincontent";

    window.addEventListener("beforeunload", function(e)
    {
      for (var i in LiteGUI.windows)
      {
        LiteGUI.windows[i].close();
      }
      LiteGUI.windows = [];
    });
  },

  /**
   * 
   * @param {*} element 
   * @param {*} event 
   * @param {*} callback 
   */
  bind: function(element, event, callback)
  {
    if (!element)
    {
      throw("can not bind to null");
    }
    if (!event)
    {
      throw("event bind missing");
    }
    if (!callback)
    {
      throw("bind callback missing");
    }

    function inner(element)
    {
      if (element.addEventListener)
      {
        element.addEventListener(event, callback);
      }
    }
  },

}