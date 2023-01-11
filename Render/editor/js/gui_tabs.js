(function () {

  Tabs.tabs_width = 64;
  Tabs.tabs_height = 26;

  function Tabs(options) {
    options = options || {};

    var mode = this.mode = options.mode || "horizontal";

    var root = document.createElement("DIV");
    if (options.id) {
      root.id = options.id;
    }
    root.data = this;
    root.className = "litetabs" + mode;
    this.root = root;
    this.root.tabs = this;

    if (mode == "horizontal") {
      if (options.size) {
        if (options.size == "full") {
          this.root.style.height = "100%";
        } else {
          this.root.style.height = options.size;
        }
      }
    } else if (mode == "vertical") {
      if (options.size) {
        if (options.size == "full") {
          this.root.style.width = "100%";
        } else {
          this.root.style.width = options.size;
        }
      }
    }

    if (options.width) {
      this.root.style.width = options.width.constructor === Number ? options.width.toFixed(0) + "px" : options.width;
    }
    if (options.height) {
      this.root.style.height = options.height.constructor === Number ? options.height.toFixed(0) + "px" : options.height;
    }

    // list contains all tabs on left part of screen
    // actually this part is not necessary
    var list = document.createElement("UL");
    list.className = "wtabcontainer";
    if (mode == "vertical") {
      list.style.width = LiteGUI.Tabs.tabs_width + "px";
    } else {
      list.style.height = LiteGUI.Tabs.tabs_height + "px";
    }

    // TODO: we should add mouse wheel control here

    this.list = list;
    //this.root.appendChild(list);

    if (options.parent) {
      this.appendTo(options.parent);
    }
  }


  Tabs.prototype.addTabContent = function (id, options) {
    options = options || {};
    var safe_id = id.replace(/ /gi, "_");

    var content = document.createElement("div");
    if (options.id) {
      content.id = options.id;
    }

    content.className = "wtabcontent " + "wtabcontent-" + safe_id + " " + (options.className || "");
    content.dataset["id"] = id;
    content.style.display = "none";

    if(this.mode == "horizontal")
		{
			if(options.size)
			{
				content.style.overflow = "auto";
				if(options.size == "full")
				{
					content.style.width = "100%";
					content.style.height = "calc( 100% - "+LiteGUI.Tabs.tabs_height+"px )"; //minus title
					content.style.height = "-moz-calc( 100% - "+LiteGUI.Tabs.tabs_height+"px )"; //minus title
					content.style.height = "-webkit-calc( 100% - "+LiteGUI.Tabs.tabs_height+"px )"; //minus title
					//content.style.height = "-webkit-calc( 90% )"; //minus title
				}
				else
					content.style.height = options.size;
			}
		}
		else if(this.mode == "vertical")
		{
			if(options.size)
			{
				content.style.overflow = "auto";
				if(options.size == "full")
				{
					content.style.height = "100%";
					content.style.width = "calc( 100% - "+LiteGUI.Tabs.tabs_width+"px )"; //minus title
					content.style.width = "-moz-calc( 100% - "+LiteGUI.Tabs.tabs_width+"px )"; //minus title
					content.style.width = "-webkit-calc( 100% - "+LiteGUI.Tabs.tabs_width+"px )"; //minus title
					//content.style.height = "-webkit-calc( 90% )"; //minus title
				}
				else
					content.style.width = options.size;
			}
    }
    
    if (options.width !== undefined) {
      content.style.width = typeof(options.width) === "string" ? options.width : options.width + "px";
    }
    if (options.height !== undefined) {
      content.style.height = typeof(options.height) === "string" ? options.height : options.height + "px";
    }

		//add content
		if(options.content)
		{
			if (typeof(options.content) == "string")
				content.innerHTML = options.content;
			else
				content.appendChild(options.content);
		}

		this.root.appendChild(content);

		//tab object
		var tab_info = {
			id: id,
			//tab: element,
			content: content,
			//title: title,
			add: function(v) { this.content.appendChild(v.root || v); },
			//setTitle: function( title )	{ this.title.innerHTML = title; },
			//click: function(){ LiteGUI.trigger( this.tab, "click" ); },
			destroy: function(){ that.removeTab(this.id) }
		};

		//if(options.onclose)
		//	tab_info.onclose = options.onclose;
		//this.tabs[ id ] = tab_info;

		//this.recomputeTabsByIndex();

		//if ( options.selected == true || this.selected == null )
		//	this.selectTab( id, options.skip_callbacks );

		return tab_info;
  }

  LiteGUI.Tabs = Tabs;
})();