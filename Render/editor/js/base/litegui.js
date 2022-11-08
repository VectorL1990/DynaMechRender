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
   * @param {*} element 
   * @param {*} event 
   * @param {*} callback 
   */
  unbind: function(element, event, callback)
  {
    if (element.removeEventListener)
    {
      element.removeEventListener(event, callback);
    }
    else if (element.__events && element.__events.removeEventListener)
    {
      element.__events.removeEventListener(event, callback);
    }
  },

  removeClass: function(element, className)
  {
    var selector = "." + className;
    var list = (element || document).querySelectorAll(selector);
    for(var i = 0; i<list.length; i++)
    {
      list[i].classList.remove(className);
    }
  },

  /**
   * 
   * @param {*} element 
   * @param {*} event_name 
   * @param {*} params 
   * @param {*} origin 
   */
  trigger: function(element, event_name, params, origin)
  {
    var event = document.createEvent('CustomEvent');
    event.initCustomEvent(event_name, true, true, params);
    if (element.dispatchEvent)
    {
      element.dispatchEvent(event);
    }
    else if (element.__events)
    {
      element.__events.dispatchEvent(event);
    }
    return event;
  },

  /**
   * 
   * @param {*} litegui_element 
   */
  add: function(litegui_element)
  {
    document.body.appendChild(litegui_element);
  },

  /**
   * 
   * @param {*} element 
   * @returns 
   */
  remove: function(element)
  {
    if (!element)
    {
      return;
    }
    if (element.constructor === String)
    {
      var elements = document.querySelectorAll(element);
      for (var i=0; i<elements.length; i++)
      {
        var element = elements[i];
        if (element && element.parentNode)
        {
          element.parentNode.removeChild(element);
        }
      }
    }
    if (element.constructor === Array || element.constructor === NodeList)
    {
      for (var i=0; i<element.length; i++)
      {
        LiteGUI.remove(element[i]);
      }
    }
    else if (element.root && element.root.parentNode)
    {
      element.root.parentNode.removeChild(element.root);
    }
    else if (element.parentNode)
    {
      element.parentNode.removeChild(element);
    }

  },

  getById: function(id)
  {
    return document.getElementById(id);
  },

  setWindowSize: function(w, h)
  {
    var style = document.body.style;

    if (w && h)
    {
      style.width = w + "px";
      style.height = h + "px";
      style.boxShadow = "0 0 4px black";
      document.body.classList.remove("fullscreen");
    }
    else
    {
      if (document.body.classList.contains("fullscreen"))
      {
        return;
      }
      document.body.classList.add("fullscreen");
      style.width = "100%";
      style.height = "100%";
      style.boxShadow = "0 0 0";
    }
    LiteGUI.trigger(LiteGUI, "resized");
  },

  maximizeWindow: function()
  {
    this.setWindowSize();
  },

  /**
   * 
   * @param {*} name 
   */
  setCursor: function(name)
  {
    document.body.style.cursor = name;
  },

  isCursorOverElement: function(event, element)
  {
    var left = event.pageX;
    var top = event.pageY;
    var rect = element.getBoundingClientRect();
    if (!rect)
    {
      return false;
    }
    if (top > rect.top && top < (rect.top + rect.height) &&
        left > rect.left && left < (rect.left + rect.width))
    {
      return true;
    }
    return false;
  },

  getRect: function(element)
  {
    return element.getBoundingClientRect();
  },

  newWindow: function (title, width, height, options)
  {
    options = options || {}
    var new_window = window.open("", "", "width=" + width + ", height=" + height + ", location=no, status=no, menubar=no, titlebar=no, fullscreen=yes");
    

  },

}