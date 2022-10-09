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
}