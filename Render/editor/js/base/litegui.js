var LiteGUI = {
  root: null,

  modalbg_div: null,

  /**
   * 
   */
  init: function(options)
  {
    options = options || {};

    this.container = document.body;

    this.container.className = "litegui-wrap fullscreen";
    this.container.className = "litegui-maincontent";

    var modalbg = this.modalbg_div = document.createElement("div");
    this.modalbg_div.className = "litemodalbg";
    this.root.appendChild(this.modalbg_div);
    modalbg.style.display = "none";

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

  toClipboard: function (object, force_local)
  {
    if (object && object.constructor !== String)
    {
      object = JSON.stringify(object);
    }

    var input = null;
    var in_clipboard = false;
    if (!force_local)
    {
      try
      {
        input = document.createElement("input");
        input.type = "text";
        input.style.opacity = 0;
        document.body.appendChild(input);
        input.select();
        console.log("save to clipboard");
        document.body.removeChild(input);
      }
      catch (error)
      {
        if (input)
        {
          document.body.removeChild(input);
        }
        console.warn("unable to copy to clipboard");
      }
    }

    try
    {
      this._safe_clipboard = null;
      localStorage.setItem("litegui_clipboard", object);
    }
    catch (error)
    {
      this._safe_clipboard = object;
      console.warn("clipboard quota exceeded");
    }
  },

  getLocalClipboard: function ()
  {
    var data = localStorage.getItem("litegui_clipboard");
    if (!data && this._safe_clipboard)
    {
      data = this._safe_clipboard;
    }
    if (!data)
    {
      return null;
    }
    if (data[0] == "{")
    {
      return JSON.parse(data);
    }
    return data;
  },

  addCSS: function (code)
  {
    if (!code)
    {
      return;
    }
    if (code.constructor === String)
    {
      var style = document.createElement('style');
      style.innerHTML = code;
      document.getElementsByTagName('head')[0].appendChild(style);
      return;
    }
  },

  requireCSS: function (url, on_complete)
  {
    if (typeof (url) == "string")
    {
      url = [url];
    }
    while (url.length)
    {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = url.shift(1);
      link.media = 'all';
      var head = document.getElementsByTagName('head')[0];
      head.appendChild(link);
      if (url.length == 0)
      {
        link.onload = on_complete;
      }
    }
  },

  request: function (request)
  {
    var dataType = request.dataType || "text";
    if (dataType == "json")
    {
      dataType = "text";
    }
    else if (dataType == "xml")
    {
      dataType = "text";
    }
    else if (dataType == "binary")
    {
			//request.mimeType = "text/plain; charset=x-user-defined";
			dataType = "arraybuffer";
			request.mimeType = "application/octet-stream";
		}


    var xhr = new XMLHttpRequest();
    xhr.open(request.data ? 'POST' : 'GET', request.url, true);
    if (dataType)
    {
      xhr.responseType = dataType;
    }
    if (request.mimeType)
    {
      xhr.overrideMimeType(request.mimeType);
    }
    if (request.nocache)
    {
      xhr.setRequestHeader('Cache-Control', 'no-cache');
    }

    xhr.onload = function (load) {
      var response = this.response;
      if (this.status != 200) {
        var err = "Error " + this.status;
        if (request.error) {
          request.error(err);
        }
        LEvent.trigger(xhr, "fail", this.status);
        return;
      }

      if (request.dataType == "json") {
        try {
          response = JSON.parse(response);
        }
        catch (error) {
          if (request.error) {
            request.error(error);
          }
          else {
            throw error;
          }
        }
      }
      else if (request.dataType == "xml") {
        try {
          var xmlparser = new DOMParser();
          response = xmlparser.parseFromString(response, "text/xml");
        }
        catch (err) {
          if (request.error)
            request.error(err);
          else
            throw err;
        }
      }
      if (request.success) {
        request.success.call(this, response, this);
      }
    };

    xhr.onerror = function (error)
    {
      if (request.error)
      {
        request.error(error);
      }
    }

    var data = new FormData();
    if (request.data)
    {
      for (var i in request.data)
      {
        data.append(i, request.data[i]);
      }
    }

    xhr.send(data);
    return xhr;
  },

  requestText: function(url, on_complete, on_error )
	{
		return this.request({ url: url, dataType:"text", success: on_complete, error: on_error });
  },
  
  requestJSON: function(url, on_complete, on_error )
	{
		return this.request({ url: url, dataType:"json", success: on_complete, error: on_error });
  },
  
  /**
   * 
   * @param {*} url 
   * @param {*} on_complete 
   * @param {*} on_error 
   * @returns 
   */
  requestBinary: function(url, on_complete, on_error )
	{
		return this.request({ url: url, dataType:"binary", success: on_complete, error: on_error });
  },
  
  requireScript: function (url, on_complete, on_error, on_progress, version)
  {
    if (!url)
    {
      throw ("invalid URL");
    }

    if (url.constructor === String)
    {
      url = [url];
    }

    var total = url.length;
    var size = total;
    var loaded_scripts = [];

    for (var i in url)
    {
      var script = document.createElement('script');
      script.num = i;
      script.type = 'text/javascript';
			script.src = url[i] + ( version ? "?version=" + version : "" );
			script.original_src = url[i];
      script.async = false;
      script.onload = function (e)
      { 
        total--;
        loaded_scripts.push(this);
        if (total)
        {
          if (on_progress)
          {
            on_progress(this.original_src, this.num);
          }
        }
        else if (on_complete)
        {
          on_complete(loaded_scripts);
        }
      };

      if (on_error)
      {
        script.onerror = function (error)
        {
          on_error(error, this.original_src, this.num);
        }
      }

      document.getElementsByTagName('head')[0].appendChild(script);
    }
  },

  newDiv: function (id, code)
  {
    return this.createElement("div", id, code);
  },

  createElement: function (tag, id_class, content, style, events)
  {
    var element = document.createElement(tag);
    if (id_class)
    {
      var seperateStr = id_class.split(" ");
      for (var i = 0; i < seperateStr.length; i++)
      {
        if (seperateStr[i][0] == ".")
        {
          element.classList.add(seperateStr[i].substr(1));
        }
        else if (seperateStr[i][0] == "#")
        {
          element.id = seperateStr[i].substr(1);
        }
        else
        {
          element.id = seperateStr[i];
        }
      }
    }

    element.root = element;
    if (content)
    {
      element.innerHTML = content;
    }

    element.add = function (v)
    {
      this.appendChild(v.root || v);
    };

    if (style)
    {
      if (style.constructor === String)
      {
        element.setAttribute("style", style);
      }
      else
      {
        for (var i in style)
        {
          element.style[i] = style[i];
        }
      }
    }

    if (events)
    {
      for (var i in events)
      {
        element.addEventListener(i, events[i]);
      }
    }

    return element;
  },

  createListItem: function (code, values, style)
  {
    var element = document.createElement("span");
    element.innerHTML = code;
    element = element.childNodes[0];
    if (values)
    {
      for (var i in values)
      {
        var subelement = element.querySelector(i);
        if (subelement)
        {
          subelement.innerText = values[i];
        }
      }

      if (style)
      {
        for (var i in style)
        {
          element.style[i] = style[i];
        }
      }

      return element;
    }
  },

  createButton: function (id_class, content, callback, style)
  {
    var element = document.createElement("button");
    element.className = "litegui litebutton button";
    if (id_class)
    {
      var seperateStr = id_class.split(" ");
      for (var i = 0; i < seperateStr.length; i++)
      {
        if (seperateStr[i][0] == ".")
        {
          element.classList.add(seperateStr[i].substr(1));
        }
        else if (seperateStr[i][0] == "#")
        {
          element.id = seperateStr[i].substr(1);
        }
        else
        {
          element.id = seperateStr[i];
        }
      }
    }

    element.root = element;
    if (content !== undefined)
    {
      element.innerHTML = content;
    }
    if (callback)
    {
      element.addEventListener("click", callback);
    }
    if (style)
    {
      if (style.constructor === String)
      {
        element.setAttribute("style", style);
      }
      else
      {
        for (var i in style)
        {
          element.style[i] = style[i];
        }
      }
    }
    return element;
  },

  getParents: function (element)
  {
    var elements = [];
    while ((element = element.parentElement) !== null)
    {
      if (element.nodeType !== Node.ELEMENT_NODE)
      {
        continue;
      }
      elements.push(element);
    }
    return elements;
  },

  newWindow: function (title, width, height, options)
  {
    options = options || {}
    var new_window = window.open("", "", "width=" + width + ", height=" + height + ", location=no, status=no, menubar=no, titlebar=no, fullscreen=yes");
    

  },

  //* DIALOGS *******************
	showModalBackground: function(v)
	{
		if(LiteGUI.modalbg_div)
			LiteGUI.modalbg_div.style.display = v ? "block" : "none";
  },
  
  downloadURL: function (url, filename)
  {
    var link = document.createElement('a');
    link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
  },

  downloadFile: function (filename, data, dataType)
  {
    if(!data)
		{
			console.warn("No file provided to download");
			return;
		}

		if(!dataType)
		{
			if(data.constructor === String )
				dataType = 'text/plain';
			else
				dataType = 'application/octet-stream';
		}

		var file = null;
		if(data.constructor !== File && data.constructor !== Blob)
			file = new Blob( [ data ], {type : dataType});
		else
			file = data;

		var url = URL.createObjectURL( file );
		var element = document.createElement("a");
		element.setAttribute('href', url);
		element.setAttribute('download', filename );
		element.style.display = 'none';
		document.body.appendChild(element);
		element.click();
		document.body.removeChild(element);
		setTimeout( function(){ URL.revokeObjectURL( url ); }, 1000*60 );
  },

  getUrlVars: function(){
		var vars = [], hash;
		var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
		for(var i = 0; i < hashes.length; i++)
		{
		  hash = hashes[i].split('=');
		  vars.push(hash[0]);
		  vars[hash[0]] = hash[1];
		}
		return vars;
	},

	getUrlVar: function(name) {
		return LiteGUI.getUrlVars()[name];
	},

	focus: function( element )
	{
		element.focus();
	},

	blur: function( element )
	{
		element.blur();
  },
  
  draggable: function (container, dragger, on_start, on_finish, on_is_draggable)
  {
    dragger = dragger || container;
    dragger.addEventListener("mousedown", inner_mouse);
    dragger.style.cursor = "move";
    var prev_x = 0;
    var prev_y = 0;

    var rect = container.getClientRects()[0];
		var x = rect ? rect.left : 0;
		var y = rect ? rect.top : 0;

		container.style.position = "absolute";
		container.style.left = x + "px";
    container.style.top = y + "px";
    
    function inner_mouse(e)
    {
      if(e.type == "mousedown")
			{
				if(!rect)
				{
					rect = container.getClientRects()[0];
					x = rect ? rect.left : 0;
					y = rect ? rect.top : 0;
				}

				if(on_is_draggable && on_is_draggable(container,e) == false )
				{
					e.stopPropagation();
					e.preventDefault();
					return false;
				}

				prev_x = e.clientX;
				prev_y = e.clientY;
				document.addEventListener("mousemove",inner_mouse);
				document.addEventListener("mouseup",inner_mouse);
				if(on_start)
					on_start( container, e );
				e.stopPropagation();
				e.preventDefault();
				return false;
			}

			if(e.type == "mouseup")
			{
				document.removeEventListener("mousemove",inner_mouse);
				document.removeEventListener("mouseup",inner_mouse);

				if( on_finish )
					on_finish( container, e );
				return;
			}

			if(e.type == "mousemove")
			{
				var deltax = e.clientX - prev_x;
				var deltay = e.clientY - prev_y;
				prev_x = e.clientX;
				prev_y = e.clientY;
				x += deltax;
				y += deltay;
				container.style.left = x + "px";
				container.style.top = y + "px";
			}
    }
  },

  cloneObject: function(object, target)
	{
		var o = target || {};
		for(var i in object)
		{
			if(i[0] == "_" || i.substr(0,6) == "jQuery") //skip vars with _ (they are private)
				continue;

			var v = object[i];
			if(v == null)
				o[i] = null;			
			else if ( isFunction(v) )
				continue;
			else if (typeof(v) == "number" || typeof(v) == "string")
				o[i] = v;
			else if( v.constructor == Float32Array ) //typed arrays are ugly when serialized
				o[i] = Array.apply( [], v ); //clone
			else if ( isArray(v) )
			{
				if( o[i] && o[i].constructor == Float32Array ) //reuse old container
					o[i].set(v);
				else
					o[i] = JSON.parse( JSON.stringify(v) ); //v.slice(0); //not safe using slice because it doesnt clone content, only container
			}
			else //slow but safe
			{
				try
				{
					//prevent circular recursions
					o[i] = JSON.parse( JSON.stringify(v) );
				}
				catch (err)
				{
					console.error(err);
				}
			}
		}
		return o;
  },
  
  
	safeName: function( str )
	{
		return String(str).replace(/[\s\.]/g, '');
	},

	//those useful HTML unicode codes that I never remeber but I always need
  special_codes:
  {
		close: "&#10005;",
		navicon: "&#9776;",
		refresh: "&#8634;",
		gear: "&#9881;",
		open_folder: "&#128194;",
		download: "&#11123;",
		tick: "&#10003;",
		trash: "&#128465;"
	},
	
	//given a html entity string it returns the equivalent unicode character
	htmlEncode: function( html_code )
	{
		var e = document.createElement("div");
		e.innerHTML = html_code;
		return e.innerText;
	},

	//given a unicode character it returns the equivalent html encoded string
	htmlDecode: function( unicode_character )
	{
		var e = document.createElement("div");
		e.innerText = unicode_character;
		return e.innerHTML;
	},

	/**
	* Convert sizes in any format to a valid CSS format (number to string, negative number to calc( 100% - number px )
	* @method sizeToCSS
	* @param {String||Number} size
	* @return {String} valid css size string
	**/
	sizeToCSS: function( v )
	{
		if( v ===  undefined || v === null )
			return null;
		if(v.constructor === String )
			return v;
		if(v >= 0 )
			return (v|0) + "px";
		return "calc( 100% - " + Math.abs(v|0) + "px )";
	},

	/**
	* Returns the window where this element is attached (used in multi window applications)
	* @method getElementWindow
	* @param {HTMLElement} v
	* @return {Window} the window element
	**/
	getElementWindow: function(v)
	{
        var doc = v.ownerDocument;
        return doc.defaultView || doc.parentWindow;
	},

	/**
	* Helper, makes drag and drop easier by enabling drag and drop in a given element
	* @method createDropArea
	* @param {HTMLElement} element the element where users could drop items
	* @param {Function} callback_drop function to call when the user drops the item
	* @param {Function} callback_enter [optional] function to call when the user drags something inside
	**/
	createDropArea: function( element, callback_drop, callback_enter, callback_exit )
	{
		element.addEventListener("dragenter", onDragEvent);

		function onDragEvent(evt)
		{
			element.addEventListener("dragexit", onDragEvent);
			element.addEventListener("dragover", onDragEvent);
			element.addEventListener("drop", onDrop);
			evt.stopPropagation();
			evt.preventDefault();
			if(evt.type == "dragenter" && callback_enter)
				callback_enter(evt, this);
			if(evt.type == "dragexit" && callback_exit)
				callback_exit(evt, this);
		}

		function onDrop(evt)
		{
			evt.stopPropagation();
			evt.preventDefault();

			element.removeEventListener("dragexit", onDragEvent);
			element.removeEventListener("dragover", onDragEvent);
			element.removeEventListener("drop", onDrop);

			var r = undefined;
			if(callback_drop)
				r = callback_drop(evt);
			if(r)
			{
				evt.stopPropagation();
				evt.stopImmediatePropagation();
				return true;
			}
		}
	}
};

//low quality templating system
Object.defineProperty( String.prototype, "template", {
	value: function( data, eval_code )
	{
		var tpl = this;
		var re = /{{([^}}]+)?}}/g, match;
	    while(match = re.exec(tpl)) {
			var str = eval_code ? (new Function("with(this) { try { return " + match[1] +"} catch(e) { return 'error';} }")).call(data) : data[match[1]];
		    tpl = tpl.replace(match[0], str);
	    }
	    return tpl;		
	},
	enumerable: false
});


function purgeElement(d, skip) {
    var a = d.attributes, i, l, n;

    if (a) {
        for (i = a.length - 1; i >= 0; i -= 1) {
            n = a[i].name;
            if (typeof d[n] === 'function') {
                d[n] = null;
            }
        }
    }

    a = d.childNodes;
    if (a) {
        l = a.length;
        for (i = 0; i < l; i += 1) {
            purgeElement(d.childNodes[i]);
        }
    }
}

//useful functions

//from stackoverflow http://stackoverflow.com/questions/1354064/how-to-convert-characters-to-html-entities-using-plain-javascript

if (typeof escapeHtmlEntities == 'undefined')
{
  escapeHtmlEntities = function (text)
  {
    return text.replace(/[\u00A0-\u2666<>\&]/g, function (c)
    {
      return '&' + (escapeHtmlEntities.entityTable[c.charCodeAt(0)] || '#'+c.charCodeAt(0)) + ';';});
  };

        // all HTML4 entities as defined here: http://www.w3.org/TR/html4/sgml/entities.html
        // added: amp, lt, gt, quot and apos
  escapeHtmlEntities.entityTable =
  {
            34 : 'quot', 
            38 : 'amp', 
            39 : 'apos', 
            60 : 'lt', 
            62 : 'gt', 
            160 : 'nbsp', 
            161 : 'iexcl', 
            162 : 'cent', 
            163 : 'pound', 
            164 : 'curren', 
            165 : 'yen', 
            166 : 'brvbar', 
            167 : 'sect', 
            168 : 'uml', 
            169 : 'copy', 
            170 : 'ordf', 
            171 : 'laquo', 
            172 : 'not', 
            173 : 'shy', 
            174 : 'reg', 
            175 : 'macr', 
            176 : 'deg', 
            177 : 'plusmn', 
            178 : 'sup2', 
            179 : 'sup3', 
            180 : 'acute', 
            181 : 'micro', 
            182 : 'para', 
            183 : 'middot', 
            184 : 'cedil', 
            185 : 'sup1', 
            186 : 'ordm', 
            187 : 'raquo', 
            188 : 'frac14', 
            189 : 'frac12', 
            190 : 'frac34', 
            191 : 'iquest', 
            192 : 'Agrave', 
            193 : 'Aacute', 
            194 : 'Acirc', 
            195 : 'Atilde', 
            196 : 'Auml', 
            197 : 'Aring', 
            198 : 'AElig', 
            199 : 'Ccedil', 
            200 : 'Egrave', 
            201 : 'Eacute', 
            202 : 'Ecirc', 
            203 : 'Euml', 
            204 : 'Igrave', 
            205 : 'Iacute', 
            206 : 'Icirc', 
            207 : 'Iuml', 
            208 : 'ETH', 
            209 : 'Ntilde', 
            210 : 'Ograve', 
            211 : 'Oacute', 
            212 : 'Ocirc', 
            213 : 'Otilde', 
            214 : 'Ouml', 
            215 : 'times', 
            216 : 'Oslash', 
            217 : 'Ugrave', 
            218 : 'Uacute', 
            219 : 'Ucirc', 
            220 : 'Uuml', 
            221 : 'Yacute', 
            222 : 'THORN', 
            223 : 'szlig', 
            224 : 'agrave', 
            225 : 'aacute', 
            226 : 'acirc', 
            227 : 'atilde', 
            228 : 'auml', 
            229 : 'aring', 
            230 : 'aelig', 
            231 : 'ccedil', 
            232 : 'egrave', 
            233 : 'eacute', 
            234 : 'ecirc', 
            235 : 'euml', 
            236 : 'igrave', 
            237 : 'iacute', 
            238 : 'icirc', 
            239 : 'iuml', 
            240 : 'eth', 
            241 : 'ntilde', 
            242 : 'ograve', 
            243 : 'oacute', 
            244 : 'ocirc', 
            245 : 'otilde', 
            246 : 'ouml', 
            247 : 'divide', 
            248 : 'oslash', 
            249 : 'ugrave', 
            250 : 'uacute', 
            251 : 'ucirc', 
            252 : 'uuml', 
            253 : 'yacute', 
            254 : 'thorn', 
            255 : 'yuml', 
            402 : 'fnof', 
            913 : 'Alpha', 
            914 : 'Beta', 
            915 : 'Gamma', 
            916 : 'Delta', 
            917 : 'Epsilon', 
            918 : 'Zeta', 
            919 : 'Eta', 
            920 : 'Theta', 
            921 : 'Iota', 
            922 : 'Kappa', 
            923 : 'Lambda', 
            924 : 'Mu', 
            925 : 'Nu', 
            926 : 'Xi', 
            927 : 'Omicron', 
            928 : 'Pi', 
            929 : 'Rho', 
            931 : 'Sigma', 
            932 : 'Tau', 
            933 : 'Upsilon', 
            934 : 'Phi', 
            935 : 'Chi', 
            936 : 'Psi', 
            937 : 'Omega', 
            945 : 'alpha', 
            946 : 'beta', 
            947 : 'gamma', 
            948 : 'delta', 
            949 : 'epsilon', 
            950 : 'zeta', 
            951 : 'eta', 
            952 : 'theta', 
            953 : 'iota', 
            954 : 'kappa', 
            955 : 'lambda', 
            956 : 'mu', 
            957 : 'nu', 
            958 : 'xi', 
            959 : 'omicron', 
            960 : 'pi', 
            961 : 'rho', 
            962 : 'sigmaf', 
            963 : 'sigma', 
            964 : 'tau', 
            965 : 'upsilon', 
            966 : 'phi', 
            967 : 'chi', 
            968 : 'psi', 
            969 : 'omega', 
            977 : 'thetasym', 
            978 : 'upsih', 
            982 : 'piv', 
            8226 : 'bull', 
            8230 : 'hellip', 
            8242 : 'prime', 
            8243 : 'Prime', 
            8254 : 'oline', 
            8260 : 'frasl', 
            8472 : 'weierp', 
            8465 : 'image', 
            8476 : 'real', 
            8482 : 'trade', 
            8501 : 'alefsym', 
            8592 : 'larr', 
            8593 : 'uarr', 
            8594 : 'rarr', 
            8595 : 'darr', 
            8596 : 'harr', 
            8629 : 'crarr', 
            8656 : 'lArr', 
            8657 : 'uArr', 
            8658 : 'rArr', 
            8659 : 'dArr', 
            8660 : 'hArr', 
            8704 : 'forall', 
            8706 : 'part', 
            8707 : 'exist', 
            8709 : 'empty', 
            8711 : 'nabla', 
            8712 : 'isin', 
            8713 : 'notin', 
            8715 : 'ni', 
            8719 : 'prod', 
            8721 : 'sum', 
            8722 : 'minus', 
            8727 : 'lowast', 
            8730 : 'radic', 
            8733 : 'prop', 
            8734 : 'infin', 
            8736 : 'ang', 
            8743 : 'and', 
            8744 : 'or', 
            8745 : 'cap', 
            8746 : 'cup', 
            8747 : 'int', 
            8756 : 'there4', 
            8764 : 'sim', 
            8773 : 'cong', 
            8776 : 'asymp', 
            8800 : 'ne', 
            8801 : 'equiv', 
            8804 : 'le', 
            8805 : 'ge', 
            8834 : 'sub', 
            8835 : 'sup', 
            8836 : 'nsub', 
            8838 : 'sube', 
            8839 : 'supe', 
            8853 : 'oplus', 
            8855 : 'otimes', 
            8869 : 'perp', 
            8901 : 'sdot', 
            8968 : 'lceil', 
            8969 : 'rceil', 
            8970 : 'lfloor', 
            8971 : 'rfloor', 
            9001 : 'lang', 
            9002 : 'rang', 
            9674 : 'loz', 
            9824 : 'spades', 
            9827 : 'clubs', 
            9829 : 'hearts', 
            9830 : 'diams', 
            338 : 'OElig', 
            339 : 'oelig', 
            352 : 'Scaron', 
            353 : 'scaron', 
            376 : 'Yuml', 
            710 : 'circ', 
            732 : 'tilde', 
            8194 : 'ensp', 
            8195 : 'emsp', 
            8201 : 'thinsp', 
            8204 : 'zwnj', 
            8205 : 'zwj', 
            8206 : 'lrm', 
            8207 : 'rlm', 
            8211 : 'ndash', 
            8212 : 'mdash', 
            8216 : 'lsquo', 
            8217 : 'rsquo', 
            8218 : 'sbquo', 
            8220 : 'ldquo', 
            8221 : 'rdquo', 
            8222 : 'bdquo', 
            8224 : 'dagger', 
            8225 : 'Dagger', 
            8240 : 'permil', 
            8249 : 'lsaquo', 
            8250 : 'rsaquo', 
            8364 : 'euro'
  };
}

function beautifyCode( code, reserved, skip_css )
{
	reserved = reserved || ["abstract", "else", "instanceof", "super", "boolean", "enum", "int", "switch", "break", "export", "interface", "synchronized", "byte", "extends", "let", "this", "case", "false", "long", "throw", "catch", "final", "native", "throws", "char", "finally", "new", "transient", "class", "float", "null", "true", "const", "for", "package", "try", "continue", "function", "private", "typeof", "debugger", "goto", "protected", "var", "default", "if", "public", "void", "delete", "implements", "return", "volatile", "do", "import", "short", "while", "double", "in", "static", "with"];

	//reserved words
	code = code.replace(/\b(\w+)\b/g, function(v) {
		if(reserved.indexOf(v) != -1)
			return "<span class='rsv'>" + v + "</span>";
		return v;
	});

	//numbers
	code = code.replace(/\b([0-9]+)\b/g, function(v) {
		return "<span class='num'>" + v + "</span>";
	});

	//obj.method
	code = code.replace(/(\w+\.\w+)/g, function(v) {
		var t = v.split(".");
		return "<span class='obj'>" + t[0] + "</span>.<span class='prop'>" + t[1] + "</span>";
	});

	//function
	code = code.replace(/(\w+)\(/g, function(v) {
		return "<span class='prop'>" + v.substr(0, v.length - 1) + "</span>(";
	});

	//strings
	code = code.replace(/(\"(\\.|[^\"])*\")/g, function(v) {
		return "<span class='str'>" + v + "</span>";
	});

	//comments 
	code = code.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, function(v) { ///(\/\/[a-zA-Z0-9\?\!\(\)_ ]*)/g
		return "<span class='cmnt'>" + v.replace(/<[^>]*>/g, "") + "</span>";
	});


	if(!skip_css)
		code = "<style>.obj { color: #79B; } .prop { color: #B97; }	.str,.num { color: #A79; } .cmnt { color: #798; } .rsv { color: #9AB; } </style>" + code;

	return code;
}

function beautifyJSON( code, skip_css )
{
	if(typeof(code) == "object")
		code = JSON.stringify(code);

	var reserved = ["false", "true", "null"];

	//reserved words
	code = code.replace(/(\w+)/g, function(v) {
		if(reserved.indexOf(v) != -1)
			return "<span class='rsv'>" + v + "</span>";
		return v;
	});


	//numbers
	code = code.replace(/([0-9]+)/g, function(v) {
		return "<span class='num'>" + v + "</span>";
	});

	//obj.method
	code = code.replace(/(\w+\.\w+)/g, function(v) {
		var t = v.split(".");
		return "<span class='obj'>" + t[0] + "</span>.<span class='prop'>" + t[1] + "</span>";
	});

	//strings
	code = code.replace(/(\"(\\.|[^\"])*\")/g, function(v) {
		return "<span class='str'>" + v + "</span>";
	});

	//comments
	code = code.replace(/(\/\/[a-zA-Z0-9\?\!\(\)_ ]*)/g, function(v) {
		return "<span class='cmnt'>" + v + "</span>";
	});

	if(!skip_css)
		code = "<style>.obj { color: #79B; } .prop { color: #B97; }	.str { color: #A79; } .num { color: #B97; } .cmnt { color: #798; } .rsv { color: #9AB; } </style>" + code;

	return code;
}

function dataURItoBlob( dataURI ) {
	var pos = dataURI.indexOf(",");
	//convert to binary
    var byteString = atob( dataURI.substr(pos+1) ); 
	//copy from string to array
    var ab = new ArrayBuffer( byteString.length ); 
    var ia = new Uint8Array(ab);
	var l = byteString.length;
    for (var i = 0; i < l; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

	var mime = dataURI.substr(5,pos-5);
	mime = mime.substr(0, mime.length - 7); //strip ";base64"
    return new Blob([ab], { type: mime });
}
