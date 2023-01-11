var LiteGUI = {
  root: null,
  content: null,

  init: function (options) {
    console.log("trigger litegui init!");
    options = options || {};

    if (options.widget && options.height) {
      this.setWindowSize(options.width, options.height);
    }

    this.container = document.body;
    this.content = this.container;
    this.root = this.container;
    this.root.className = "litegui-wrap fullscreen";
    this.content.className = "litegui-maincontent";
    console.log(this);
  },

  trigger: function (element, event_name, params, origin) {
    var evt = document.createEvent('CustomEvent');
    if (element.dispatchEvent) {
      element.dispatchEvent(evt);
    } else if (element.__events) {
      element.__events.dispatchEvent(evt);
    }
    return evt;
  },

  bind: function (element, event, callback) {
    if (!element) {
      throw ("cannot bind to null");
    }
    if (!event) {
      throw ("event cannot be null");
    }
    if (!callback) {
      throw ("bind callback cannot be null");
    }

    if (element.constructor === String) {
      element = document.querySelectorAll(element);
    }
			
    if (element.constructor === NodeList || element.constructor === Array) {
      for (var i = 0; i < element.length; ++i)
        inner(element[i]);
    }
    else {
      inner(element);
    }

    function inner(element) {
      if (element.addEventListener) {
        element.addEventListener(event, callback);
      } else if (element.__events) {
        element.__events.addEventListener(event, callback);
      } else {
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

  add: function (element) {
    console.log("add this is:")
    console.log(this);
    //this.content.appendChild(element.root || element);
    document.body.appendChild(element.root || element);
    //LiteGUI.content.appendChild(element.root || element);
  },

  remove: function (element) {
    if (!element) {
      return;
    }

    if (element.constructor === String) {
      var elements = document.querySelectorAll(element);
      for (var i = 0; i < elements.length; ++i) {
        var element = elements[i];
        if (element && element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }
    }
    if (element.constructor === Array || element.constructor === NodeList) {
      for (var i = 0; i < element.length; ++i) {
        LiteGUI.remove(element[i]);
      }
    } else if (element.root && element.root.parentNode) {
      element.root.parentNode.removeChild(element.root);
    } else if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  },

  setWindowSize: function (width, height) {
    var style = this.root.style;

    if (width && height) {
      style.width = width + "px";
      style.height = height + "px";
      style.boxShadow = "0 0 4px black";
      this.root.classList.remove("fullscreen");
    } else {
      if (this.root.classList.contains("fullscreen")) {
        return;
      }
      this.root.classList.add("fullscreen");
      style.width = "100%";
      style.height = "100%";
      style.boxShadow = "0 0 0";
    }
    LiteGUI.trigger(LiteGUI, "resized");
  }
};
