var CORE = {
  _config: null,
  _modules: [],

  init: function()
  {
    this.root = document.body;

    LiteGUI.init();
    this.request({
      url: "config.json?nocache=" + performance.now(),
      dataType: "json",
      success: this.configLoaded.bind(this)
    });
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

  requireScript: function(url, on_complete, on_error, on_progress, version )
	{
		if(!url)
			throw("invalid URL");

		if( url.constructor === String )
			url = [url];

		var total = url.length;
		var size = total;
		var loaded_scripts = [];

		for(var i in url)
		{
			var script = document.createElement('script');
			script.num = i;
			script.type = 'text/javascript';
			script.src = url[i] + ( version ? "?version=" + version : "" );
			script.original_src = url[i];
			script.async = false;
			script.onload = function(e) { 
				total--;
				loaded_scripts.push(this);
				if(total)
				{
					if(on_progress)
						on_progress(this.original_src, this.num);
				}
				else if(on_complete)
					on_complete( loaded_scripts );
			};
			if(on_error)
				script.onerror = function(err) { 
					on_error(err, this.original_src, this.num );
				}
			document.getElementsByTagName('head')[0].appendChild(script);
		}
	},

  configLoaded: function (config) {
    
    console.log("enter configLoaded!");
    this.request({
      url: "imports.json",
      dataType: "json",
      nocache: true,
      success: this.loadImports.bind(this)
    });
  },

  loadImports: function (imports_info) {
    console.log("enter loadImports!");
    var imports_list = imports_info.imports;
    var async_imports_list = imports_info.async;

    this.requireScript(
      imports_list,
      onReady,
      onError,
      onProgress,
      imports_info.version);

    //one module loaded
		function onProgress( name, num )
		{
			//that.onImportLoaded( name, num );
		}

		//one module loaded
		function onError(err, name, num)
		{
			console.error("Error loading import: " + line.querySelector(".name").textContent );
		}

		function onReady()
		{
			console.log("Loading done");
			setTimeout(function(){ CORE.launch(); },500 );

			//load async scripts (things that are not so relevant)
			//this.requireScript( async_imports_list, null,null,null, CORE.config.imports.version );
		}
  },

  registerModule: function (module) {
    console.log("trigger core registerModule");
    if (this._modules.indexOf(module) != -1) {
      return;
    }

    if (module.init) {
      module.init();
    }
  },

  launch: function () {
    console.log("run core launch");
    
    this.initModules();
  },

  initModules: function ()
  {
    console.log("modules number is: %i", this._modules.length);
    var options = {
      liteGUI: LiteGUI
    };
    for (var i in this._modules)
    {
      if (this._modules[i].init)
      {
        this._modules[i].init(options);
      }
    }
  }
  
}