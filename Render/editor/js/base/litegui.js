var LiteGUI = {
  root: null,

  /**
   * 
   */
  init: function(options)
  {
    options = options || {};

    this.container = document.body;

    this.container.className = "litegui-wrap fullscreen";
    this.container.className = "litegui-maincontent";

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

    if (element.constructor === String)
    {
      element = document.querySelectorAll(element);
    }

    if (element.constructor === NodeList || element.constructor === Array)
    {
      for (var i=0; i<element.length; i++)
      {
        inner(element[i]);
      }
    }
    else
    {
      inner(element);
    }

    function inner(element)
    {
      if (element.addEventListener)
      {
        element.addEventListener(event, callback);
      }
      else if (element.__events)
      {
        element.__events.addEventListener(event, callback);
      }
      else
      {
        var dummy = document.createElement("span");
        dummy.widget = element;
        Object.defineProperty(element, "__events", {
          enumerable: false,
          configurable: false,
          writable: false,
          value: dummy
        });
        element.__events.addEventListener(event, callback);
      }
    }
  },

  /**
   * 
   * @param {*} litegui_element 
   */
  add: function(litegui_element)
  {
    this.content.appendChild(litegui_element.root || litegui_element);
  },

  remove: function(element)
  {
    if (!element)
    {
      return;
    }

  },

  newWindow: function (title, width, height, options)
  {
    options = options || {}
    var new_window = window.open("", "", "width=" + width + ", height=" + height + ", location=no, status=no, menubar=no, titlebar=no, fullscreen=yes");
    

  },

}