var InterfaceModule = {
  _liteGUI: null,

  testinit: function (options) {
    options = options || {};

    var side_panel_width = 360;

    var mainarea = new LiteGUI.Area({
      id: "mainarea",
      content_id: "workarea",
      height: "calc(100% - 30px)",
      autoresize: true,
      inmediateResize: true,
      minSplitSize: 200
    });

    this.mainarea = mainarea;
    mainarea.split("horizontal", [null, side_panel_width], true);
    console.log("liteGUI is: ");
    console.log(LiteGUI);
    if (options.liteGUI) {
      _liteGUI = options.liteGUI;
      _liteGUI.add(mainarea);
    }
    LiteGUI.add(mainarea);

    this.createTabs();
  },

  init: function (options) {
    options = options || {};

    var root = document.createElement("div");
		root.className = "drawareaclass";
		if (options.id) {
			root.id = options.id;
    } else {
      root.id = "drawarea";
    }
		if (options.className)
		{
			root.className += " " + options.className;
		}

		var width = options.width || "100%";
		var height = options.height || "100%";

		root.style.width = width;
		root.style.height = height;
    this.options = options;
    
    LiteGUI.add(root);
  },

  createTabs: function () {
    var main_tabs = new LiteGUI.Tabs({
      id: "worktabs",
      width: "full",
      mode: "vertical",
      autoswitch: true
    });
    this.mainarea.getSection(0).add(main_tabs);
    LiteGUI.main_tabs = main_tabs;
  },

  setVisorArea: function (area) {
    this.visorarea = area;
  },
};

CORE.registerModule(InterfaceModule);
