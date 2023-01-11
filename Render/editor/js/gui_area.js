(function () { 
	function Area(options) {
		options = options || {};

		var root = document.createElement("div");
		root.className = "litearea";
		if (options.id)
		{
			root.id = options.id;
		}
		if (options.className)
		{
			root.className += " " + options.className;
		}

		this.root = root;
		this.root.litearea = this;

		var width = options.width || "100%";
		var height = options.height || "100%";

		root.style.width = width;
		root.style.height = height;
		this.options = options;

		var content = document.createElement("div");
		if (options.content_id)
		{
			content.id = options.content_id;
		}
		content.className = "liteareacontent";
		content.style.width = "100%";
		content.style.height = "100%";
		this.root.appendChild(content);
		this.content = content;
		
		this.sections = [];
	}

	Area.prototype.getSection = function(num)
	{
		num = num || 0;
		if (this.sections.length > num) {
			return this.sections[num];
		}
		return null;
	}

	Area.prototype.split = function( direction, sizes, editable )
	{
		if (!direction || direction.constructor !== String) {
			throw ("First parameter must be a string: 'vertical' or 'horizontal'");
		}
		if (!sizes) {
			sizes = ["50%", null];
		}

		if (direction != "vertical" && direction != "horizontal") {
			throw ("First parameter must be a string: 'vertical' or 'horizontal'");
		}

		if (this.sections.length) {
			throw "cannot split twice";
		}

		//create areas
		var area1 = new LiteGUI.Area({ content_id: this.content.id });
		area1.root.style.display = "inline-block";
		var area2 = new LiteGUI.Area();
		area2.root.style.display = "inline-block";

		var splitinfo = "";
		var splitbar = null;
		var dynamic_section = null;
		if(editable)
		{
			splitinfo = " - " + (Area.splitbar_size + 2) +"px"; //2 px margin �?
			splitbar = document.createElement("div");
			splitbar.className = "litesplitbar " + direction;
			if (direction == "vertical") {
				splitbar.style.height = Area.splitbar_size + "px";
			}
			else {
				splitbar.style.width = Area.splitbar_size + "px";
			}
			this.splitbar = splitbar;
			splitbar.addEventListener("mousedown", inner_mousedown);
		}

		sizes = sizes || ["50%",null];

		if(direction == "vertical")
		{
			area1.root.style.width = "100%";
			area2.root.style.width = "100%";

			if(sizes[0] == null)
			{
				var h = sizes[1];
				if (typeof (h) == "number") {
					h = sizes[1] + "px";
				}

				area1.root.style.height = "-moz-calc( 100% - " + h + splitinfo + " )";
				area1.root.style.height = "-webkit-calc( 100% - " + h + splitinfo + " )";
				area1.root.style.height = "calc( 100% - " + h + splitinfo + " )";
				area2.root.style.height = h;
				area2.size = h;
				dynamic_section = area1;
			}
			else if(sizes[1] == null)
			{
				var h = sizes[0];
				if(typeof(h) == "number")
					h = sizes[0] + "px";

				area1.root.style.height = h;
				area1.size = h;
				area2.root.style.height = "-moz-calc( 100% - " + h + splitinfo + " )";
				area2.root.style.height = "-webkit-calc( 100% - " + h + splitinfo + " )";
				area2.root.style.height = "calc( 100% - " + h + splitinfo + " )";
				dynamic_section = area2;
			}
			else
			{
				var h1 = sizes[0];
				if (typeof (h1) == "number") {
					h1 = sizes[0] + "px";
				}
				var h2 = sizes[1];
				if (typeof (h2) == "number") {
					h2 = sizes[1] + "px";
				}
				area1.root.style.height = h1;
				area1.size = h1;
				area2.root.style.height = h2;
				area2.size = h2;
			}
		}
		else //horizontal
		{
			area1.root.style.height = "100%";
			area2.root.style.height = "100%";

			if(sizes[0] == null)
			{
				var w = sizes[1];
				if (typeof (w) == "number") {
					w = sizes[1] + "px";
				}
				area1.root.style.width = "-moz-calc( 100% - " + w + splitinfo + " )";
				area1.root.style.width = "-webkit-calc( 100% - " + w + splitinfo + " )";
				area1.root.style.width = "calc( 100% - " + w + splitinfo + " )";
				area2.root.style.width = w;
				area2.size = sizes[1];
				dynamic_section = area1;
			}
			else if(sizes[1] == null)
			{
				var w = sizes[0];
				if (typeof (w) == "number") {
					w = sizes[0] + "px";
				}

				area1.root.style.width = w;
				area1.size = w;
				area2.root.style.width = "-moz-calc( 100% - " + w + splitinfo + " )";
				area2.root.style.width = "-webkit-calc( 100% - " + w + splitinfo + " )";
				area2.root.style.width = "calc( 100% - " + w + splitinfo + " )";
				dynamic_section = area2;
			}
			else
			{
				var w1 = sizes[0];
				if (typeof (w1) == "number") {
					w1 = sizes[0] + "px";
				}
				var w2 = sizes[1];
				if (typeof (w2) == "number") {
					w2 = sizes[1] + "px";
				}

				area1.root.style.width = w1;
				area1.size = w1;
				area2.root.style.width = w2;
				area2.size = w2;
			}
		}

		area1.root.removeChild( area1.content );
		area1.root.appendChild( this.content );
		area1.content = this.content;

		this.root.appendChild( area1.root );
		if (splitbar) {
			this.root.appendChild(splitbar);
		}
		this.root.appendChild( area2.root );

		this.sections = [area1, area2];
		this.dynamic_section = dynamic_section;
		this.direction = direction;

		//SPLITTER DRAGGER INTERACTION
		var that = this;
		var last_pos = [0,0];
		function inner_mousedown(e)
		{
			var doc = that.root.ownerDocument;
			doc.addEventListener("mousemove",inner_mousemove);
			doc.addEventListener("mouseup",inner_mouseup);
			last_pos[0] = e.pageX;
			last_pos[1] = e.pageY;
			e.stopPropagation();
			e.preventDefault();
		}

		function inner_mousemove(e)
		{
			if(direction == "horizontal")
			{
				if (last_pos[0] != e.pageX) {
					that.moveSplit(last_pos[0] - e.pageX);
				}
			}
			else if(direction == "vertical")
			{
				if (last_pos[1] != e.pageY) {
					that.moveSplit(e.pageY - last_pos[1]);
				}
			}

			last_pos[0] = e.pageX;
			last_pos[1] = e.pageY;
			e.stopPropagation();
			e.preventDefault();
			if (that.options.immediateResize || that.options.inmediateResize) //inmediate is for legacy...
			{
				that.onResize();
			}
		}

		function inner_mouseup(e)
		{
			var doc = that.root.ownerDocument;
			doc.removeEventListener("mousemove",inner_mousemove);
			doc.removeEventListener("mouseup",inner_mouseup);
			that.onResize();
		}
	}

	Area.prototype.add = function(v)
	{
		if(typeof(v) == "string")
		{
			var element = document.createElement("div");
			element.innerHTML = v;
			v = element;
		}

		this.content.appendChild( v.root || v );
	}

	LiteGUI.Area = Area;


	/***************** SPLIT ******************/

	/**
	* Split 
	*
	* @class Split
	* @constructor
	*/
	function Split( sections, options, legacy )
	{
		options = options || {};

		if(sections && sections.constructor === String)
		{
			var id = sections;
			sections = options;
			options = legacy || {};
			options.id = id;
			console.warn("LiteGUI.Split legacy parameter, use sections as first parameter instead of id.");
		}

		var root = document.createElement("div");
		this.root = root;
		if(options.id)
			root.id = id;
		root.className = "litesplit " + (options.vertical ? "vsplit" : "hsplit");
		this.sections = [];

		for(var i in sections)
		{
			var section = document.createElement("div");

			section.className = "split-section split" + i;
			if(typeof(sections[i]) == "number")
			{
				if(options.vertical)
					section.style.height = sections[i].toFixed(1) + "%";
				else
					section.style.width = sections[i].toFixed(1) + "%";
			}
			else if(typeof(sections[i]) == "string")
			{
				if(options.vertical)
					section.style.height = sections[i];
				else
					section.style.width = sections[i];
			}
			else
			{
				if(sections[i].id) section.id = sections[i].id;
				if(options.vertical)
					section.style.height = (typeof(sections[i].height) == "Number" ? sections[i].height.toFixed(1) + "%" : sections[i].height);
				else
					section.style.width = (typeof(sections[i].width) == "Number" ? sections[i].width.toFixed(1) + "%" : sections[i].width);
			}

			section.add = function(element) {
				this.appendChild( element.root || element );
			}

			this.sections.push(section);
			root.appendChild(section);
		}

		if(options.parent)
		{
			if(options.parent.root)
				options.parent.root.appendChild(root);
			else
				options.parent.appendChild(root);
		}

		this.getSection = function(n)
		{
			return this.sections[n];
		}
	}

	LiteGUI.Split = Split;
})();
