var CORE = {
  Modules: [],

  init: function ()
  {
    this.root = document.body;
  },

  requireScript: function (urls, on_complete, version)
  {
    for (var i in urls)
    {
      var script = document.createElement('script');
      script.num = i;
      script.type = 'text/javascript';
      script.src = urls[i] + (version ? "?version=" + version : "");
      script.original_src = urls[i];
      script.async = false;
      script.onload = function (e) {
        on_complete();
      };
      document.getElementsByTagName('head')[0].appendChild(script);
    }
  },

  loadImports: function (import_list)
  {
    this.requireScript(import_list, on_complete, 0.6);

    on_complete()
    {
      setTimeout(function () {CORE.launch();}, 500);
    }
  },

  launch: function ()
  {
    this.initModules();
  },

  initModules: function ()
  {
    for (var i in this.Modules)
    {
      this.Modules[i].init();
    }
  },

  registerModule: function (module)
  {
    this.Modules.push(module);
    module.init();
  },
  
}