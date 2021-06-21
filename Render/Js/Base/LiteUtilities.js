"use strict";

(function(global){
var GL = global.GL = {};

if (typeof(glMatrix) == "undefined")
{
    throw("glMatrix must be included before litegl");
}
else
{
    if (!global.vec2)
    {
        throw("Litegl does not support gl-matrix3.0, download 2.8");
    }
}

if (typeof(performance) != "undefined"){
    global.getTime = performance.now.bind(performance);
}
else{
    global.getTime = Date.now.bind(Date);
}
GL.getTime = global.getTime;

global.isFunction = function isFunction(obj){
    return !!(obj && obj.constructor && obj.call && obj.apply);
}

global.isArray = function isArray(obj){
    return (obj && obj.constructor == Array);
}

global.isNumber = function isNumber(obj){
    return (obj != null && obj.constructor == Number);
}

global.getClassName = function getClassName(obj){
    if (!obj)
		return;

	//from function info, but not standard
	if(obj.name)
		return obj.name;

	//from sourcecode
	if(obj.toString) {
		var arr = obj.toString().match(
			/function\s*(\w+)/);
		if (arr && arr.length == 2) {
			return arr[1];
		}
	}
}

global.cloneObject = GL.cloneObject = function(o, t)
{
	if(o.constructor !== Object)
		throw("cloneObject only can clone pure javascript objects, not classes");

	t = t || {};

	for(var i in o)
	{
		var v = o[i];
		if(v === null)
		{
			t[i] = null;
			continue;
		}

		switch(v.constructor)
		{
			case Int8Array:
			case Uint8Array:
			case Int16Array:
			case Uint16Array:
			case Int32Array:
			case Uint32Array:
			case Float32Array:
			case Float64Array:
				t[i] = new v.constructor(v);
				break;
			case Boolean:
			case Number:
			case String:
				t[i] = v;
				break;
			case Array:
				t[i] = v.concat(); //content is not cloned
				break;
			case Object:
				t[i] = GL.cloneObject(v);
				break;
		}
	}

	return t;
}


/* SLOW because accepts booleans
function isNumber(obj) {
  var str = Object.prototype.toString.call(obj);
  return str == '[object Number]' || str == '[object Boolean]';
}
*/

//given a regular expression, a text and a callback, it calls the function every time it finds it
global.regexMap = function regexMap(regex, text, callback) {
  var result;
  while ((result = regex.exec(text)) != null) {
    callback(result);
  }
}



var LEvent = global.LEvent = GL.LEvent = {

	/**
	 * Binds event to instance
	 * instance is the object which includes the bindings, it's not the object which really calls that function
	 * callback is the function being called
	 * target_instance is the very object which really calls function
	 */
	bind: function(instance, event_type, callback, target_instance){
		if (!instance)
		{
			throw("cannot bind event to null");
		}
		if (!callback)
		{
			throw("cannot bind to null callback");
		}
		if (instance.constructor == String)
		{
			throw("cannot bind event to a string");
		}

		var events = instance.levents;
		if (!events)
		{
			Object.defineProperty(instance, "levents", {
				value: {}, 
				enumerable: false});
			events = instance.levents;
		}

		if (events.hasOwnProperty(event_type))
		{
			// callback and target_instance are arranged as list to be pushed
			events[event_type].push([callback, target_instance]);
		}
		else
		{
			events[event_type] = [[callback, target_instance]];
		}

		if (instance.onLEventBinded){
			instance.onLEventBinded(event_type, callback, target_instance);
		}
	},

	unbind: function( instance, event_type, callback, target_instance )
	{
		if(!instance) 
			throw("cannot unbind event to null");
		if(!callback) 
			throw("cannot unbind from null callback");
		if(instance.constructor === String ) 
			throw("cannot bind event to a string");

		var events = instance.levents;
		if(!events)
			return;

		if(!events.hasOwnProperty( event_type ))
			return;

		for(var i = 0, l = events[event_type].length; i < l; ++i)
		{
			var v = events[event_type][i];
			if(v[0] === callback && v[1] === target_instance)
			{
				events[event_type].splice( i, 1 );
				break;
			}
		}

		if (events[event_type].length == 0)
			delete events[event_type];

		if( instance.onLEventUnbinded )
			instance.onLEventUnbinded( event_type, callback, target_instance );
	},

	unbindAll: function(instance, targetInstance, callback){
		if (!instance)
		{
			throw("LiteUtilities::unbindAll instance is null");
		}

		var events = instance.levents;
		if (!events)
		{
			return;
		}

		if (targetInstance.onLEventUnbindAll)
		{
			instance.onLEventUnbindAll(targetInstance, callback);
		}

		if (!targetInstance)
		{
			delete instance.levents;
			return;
		}

		for (var i in events)
		{
			var event = events[i];
			for (var j = event.length - 1; j>= 0; --j)
			{
				if (event[j][1] != targetInstance || (callback && callback !== event[j][0]))
				{
					continue;
				}
				event.splice(j,1);
			}
		}
	},

	unbindAllEvent: function( instance, event_type )
	{
		if(!instance) 
			throw("cannot unbind events in null");

		var events = instance.levents;
		if(!events)
			return;
		delete events[ event_type ];
		if( instance.onLEventUnbindAll )
			instance.onLEventUnbindAll( event_type, target_instance, callback );
		return;
	},

	/**
	* Tells if there is a binded callback that matches the criteria
	* @method LEvent.isBind
	* @param {Object} instance where the are the events binded
	* @param {String} event_name string defining the event name
	* @param {function} callback the callback
	* @param {Object} target_instance [Optional] instance binded to callback
	**/
	isBind: function( instance, event_type, callback, target_instance )
	{
		if(!instance)
			throw("LEvent cannot have null as instance");

		var events = instance.levents;
		if( !events )
			return;

		if( !events.hasOwnProperty(event_type) ) 
			return false;

		for(var i = 0, l = events[event_type].length; i < l; ++i)
		{
			var v = events[event_type][i];
			if(v[0] === callback && v[1] === target_instance)
				return true;
		}
		return false;
	},

	/**
	* Tells if there is any callback binded to this event
	* @method LEvent.hasBind
	* @param {Object} instance where the are the events binded
	* @param {String} event_name string defining the event name
	* @return {boolean} true is there is at least one
	**/
	hasBind: function( instance, event_type )
	{
		if(!instance)
			throw("LEvent cannot have null as instance");
		var events = instance.levents;
		if(!events || !events.hasOwnProperty( event_type ) || !events[event_type].length) 
			return false;
		return true;
	},

	/**
	* Tells if there is any callback binded to this object pointing to a method in the target object
	* @method LEvent.hasBindTo
	* @param {Object} instance where there are the events binded
	* @param {Object} target instance to check to
	* @return {boolean} true is there is at least one
	**/
	hasBindTo: function( instance, target )
	{
		if(!instance)
			throw("LEvent cannot have null as instance");
		var events = instance.levents;

		//no events binded
		if(!events) 
			return false;

		for(var j in events)
		{
			var binds = events[j];
			for(var i = 0; i < binds.length; ++i)
			{
				if(binds[i][1] === target) //one found
					return true;
			}
		}

		return false;
	},

	trigger: function(instance, event_type, params, reverse_order, expand_parameters)
	{
		if (!instance){
			throw("trigger:function instance is null");
		}
		if (instance.constructor === String){
			throw("cannot bind an event to string");
		}

		var events = instance.levents;
		if (!events || !events.hasOwnProperty(event_type)){
			return false;
		}

		var eventInst = events[event_type];
		if (reverse_order)
		{
			for (var i = eventInst.length - 1; i >= 0; --i)
			{
				var event = eventInst[i];
				if (expand_parameters)
				{
					if (event && event[0].apply(event[1], params) === true)
					{
						return true;
					}
					else
					{
						if (event && event[0].call(event[1], event_type, params) === true)
						{
							return true;
						}
					}
				}
			}
		}
		else
		{
			for (var i=0; i<eventInst.length; ++i)
			{
				var event = eventInst[i];
				if (expand_parameters)
				{
					if (event && event[0].apply(event[1], params) === true)
					{
						return true;
					}
					else
					{
						if (event && event[0].call(event[1], event_type, params) === true)
						{
							return true;
						}
					}
				}
			}
		}
		return false;
	},

	triggerArray: function(instances, eventType, params, reverseOrder, expandParameters){
		var blocked = false;
		for (var i=0; i<instances.length; ++i)
		{
			var instance = instances[i];
			if (!instance)
			{
				throw("LiteUtilities::triggerArray instance is null");
			}
			if (instance.constructor === String)
			{
				throw("LiteUtilities::triggerArray String cannot bind an event");
			}

			var events = instance.levents;
			if (!events || !events.hasOwnProperty(eventType))
			{
				continue;
			}

			if (reverseOrder)
			{
				for (var j = events[eventType].length - 1; j >= 0; --j)
				{
					var event = events[eventType][j];
					if (expandParameters)
					{
						if (event[0].apply(event[1], params) === true)
						{
							blocked = true;
							break;
						}
					}
					else
					{
						if (event[0].call(event[1], eventType, params) === true)
						{
							blocked = true;
							break;
						}
					}
				}
			}
			else
			{
				for (var j = 0; j < events.length; ++j)
				{
					var event = events[eventType][j];
					if (expandParameters)
					{
						if (event[0].apply(event[1], params) === true)
						{
							blocked = true;
							break;
						}
					}
					else
					{
						if (event[0].call(event[1], eventType, params) === true)
						{
							blocked = true;
							break;
						}
					}
				}
			}
		}
		return blocked;
	},

	extendObject: function(object){
		object.bind = function(eventType, callback, instance)
		{
			return LEvent.bind(this, eventType, callback, instance);
		};
	},
};

if (!String.prototype.hasOwnProperty("replaceAll"))
{
    Object.defineProperty(String.prototype, "replaceAll", {
        value: function(words){
            var str = this;
            for (var i in words)
            {
                str = str.split(i).join(words[i]);
            }
            return str;
        },
        enumerable: false
    });
}

if (!String.prototype.hasOwnProperty("hashCode"))
{
	Object.defineProperty(String.prototype, "hashCode", {
		value: function(){
			var hash = 0, i, c, l;
			if (this.length == 0)
			{
				return hash;
			}
			for (i = 0, l = this.length; i < l; ++i)
			{
				c = this.charCodeAt(i);
				hash = ((hash<<5) - hash) + c;
				hash |= 0;
			}
			return hash;
		},
		enumerable: false
	});
}

if (!Array.prototype.hasOwnProperty("clone"))
{
	Object.defineProperty(Array.prototype, "clone", {
		value: Array.prototype.concat,
		enumerable: false
	});
}

if (!Float32Array.prototype.hasOwnProperty("clone"))
{
	Object.defineProperty(Float32Array.prototype, "clone", {
		value: function(){
			return new Float32Array(this);
		},
		enumerable: false
	});
}

global.wipeObject = function wipeObject(object)
{
	for (var property in object)
	{
		if (object.hasOwnProperty(property))
		{
			delete object[property];
		}
	}
};

global.extendClass = GL.extendClass = function extendClass(target, origin){
	for (var property in origin)
	{
		if (target.hasOwnProperty(property))
		{
			continue;
		}
		target[i] = origin[i];
	}

	if (origin.prototype)
	{
		var propNames = Object.getOwnPropertyNames(origin.prototype);
		for (var i=0; i<propNames.length; ++i)
		{
			var name = propNames[i];
			if (target.prototype.hasOwnProperty(name))
			{
				continue;
			}

			if (origin.prototype.__lookupGetter__(name))
			{
				target.prototype.__defineGetter__(name, origin.prototype.__lookupGetter__(name));
			}
			else
			{
				target.prototype[name] = origin.prototype[name];
			}

			if (origin.prototype.__lookupGetter__(name))
			{
				target.prototype.__defineGetter__(name, origin.prototype.__lookupGetter__(name));
			}
		}
	}

	if (!target.hasOwnProperty("superclass"))
	{
		Object.defineProperty(target, "superclass", {
			get: function(){
				return origin;
			},
			enumerable: false
		});
	}
}

// Temp not finished
global.HttpRequest = GL.request = function HttpRequest(url, params, callBack, error, options){

}

global.getFileExtension = function getFileExtension(url){
	var quesion = url.indexOf("?");
	if (quesion != -1)
	{
		url = url.substr(0, quesion);
	}
	var point = url.lastIndexOf(".");
	if (point == -1)
	{
		return "";
	}
	return url.substr(point + 1).toLowerCase();
}

// Temp not finished
global.loadFileAtlas = GL.loadFileAtlas = function loadFileAtlas(url, callBack, sync){
	var deferredCallback = null;

}

global.processFileAtlas = GL.processFileAtlas = function(data, skipTrim){
	var lines = data.split("\n");
	var files = {};

	var currentFileLine = [];
	var currentFileName = "";
	for (var i=0; i<lines.length; i++)
	{
		var line = skipTrim ? lines[i] : lines[i].trim();
		if (!line.length)
		{
			continue;
		}
		if (line[0] != "\\")
		{
			currentFileLine.push(line);
			continue;
		}
		if (currentFileLine.length)
		{
			files[currentFileName] = currentFileLine.join("\n");
		}
		currentFileLine.length = 0;
		currentFileName = line.substr(1);
	}

	if( currentFileLine.length )
	{
		files[ currentFileName ] = currentFileLine.join("\n");
	}

	return files;
}

global.typedArrayToArray = function(array){
	var r = [];
	r.length = array.length;
	for (var i=0; i<array.length; i++)
	{
		r[i] = array[i];
	}
	return r;
}

// Convert rgb color to hexadecimal
global.RGBToHex = function(r, g, b){
	r = Math.min(255, r*255)|0;
	g = Math.min(255, g*255)|0;
	b = Math.min(255, b*255)|0;
	return "#" + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
}

global.HUEToRGB = function(p, q, t){
	if(t < 0) t += 1;
	if(t > 1) t -= 1;
	if(t < 1/6) return p + (q - p) * 6 * t;
	if(t < 1/2) return q;
	if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
	return p;
}

global.HSLToRGB = function( h, s, l, out ){
	var r, g, b;
	out = out || vec3.create();
	if(s == 0){
		r = g = b = l; // achromatic
	}else{
		var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		var p = 2 * l - q;
		r = HUEToRGB(p, q, h + 1/3);
		g = HUEToRGB(p, q, h);
		b = HUEToRGB(p, q, h - 1/3);
	}
	out[0] = r;
	out[1] = g;
	out[2] = b;
	return out;
}

global.hexColorToRGBA = (function(){
	var stringColors = {
		white: [1,1,1],
		black: [0,0,0],
		gray: [0.501960813999176, 0.501960813999176, 0.501960813999176],
		red: [1,0,0],
		orange: [1, 0.6470588445663452, 0],
		pink: [1, 0.7529411911964417, 0.7960784435272217],
		green: [0, 0.501960813999176, 0],
		lime: [0,1,0],
		blue: [0,0,1],
		violet: [0.9333333373069763, 0.5098039507865906, 0.9333333373069763],
		magenta: [1,0,1],
		cyan: [0,1,1],
		yellow: [1,1,0],
		brown: [0.6470588445663452, 0.16470588743686676, 0.16470588743686676],
		silver: [0.7529411911964417, 0.7529411911964417, 0.7529411911964417],
		gold: [1, 0.843137264251709, 0],
		transparent: [0,0,0,0]
	};

	return function(hex, color, alpha){
		alpha = (alpha === undefined ? 1:alpha);
		color = color || new Float32Array(4);
		color[3] = alpha;

		if (typeof(hex) != "string")
		{
			return color;
		}

		var codeColor = stringColors[hex];
		if (codeColor !== undefined)
		{
			color.set(codeColor);
			if (color.length == 3)
			{
				color[3] = alpha;
			}
			else
			{
				color[3] *= alpha;
			}
			return color;
		}

		var pos = hex.indexOf("rgba(");
		if (pos != -1)
		{
			var str = hex.substr(5, hex.length - 2);
			str = str.split(",");
			color[0] = parseInt(str[0])/255;
			color[1] = parseInt(str[1])/255;
			color[2] = parseInt(str[2])/255;
			color[3] = parseFloat(str[3])*alpha;
			return color;
		}

		var pos = hex.indexOf("hsla(");
	if(pos != -1)
	{
		var str = hex.substr(5,hex.length-2);
		str = str.split(",");
		HSLToRGB( parseInt( str[0] ) / 360, parseInt( str[1] ) / 100, parseInt( str[2] ) / 100, color );
		color[3] = parseFloat( str[3] ) * alpha;
		return color;
	}

	color[3] = alpha;

	//rgb colors
	var pos = hex.indexOf("rgb(");
	if(pos != -1)
	{
		var str = hex.substr(4,hex.length-2);
		str = str.split(",");
		color[0] = parseInt( str[0] ) / 255;
		color[1] = parseInt( str[1] ) / 255;
		color[2] = parseInt( str[2] ) / 255;
		return color;
	}

	var pos = hex.indexOf("hsl(");
	if(pos != -1)
	{
		var str = hex.substr(4,hex.length-2);
		str = str.split(",");
		HSLToRGB( parseInt( str[0] ) / 360, parseInt( str[1] ) / 100, parseInt( str[2] ) / 100, color );
		return color;
	}


	//the rest
	// Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
	var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
	hex = hex.replace( shorthandRegex, function(m, r, g, b) {
		return r + r + g + g + b + b;
	});

	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if(!result)
		return color;

	color[0] = parseInt(result[1], 16) / 255;
	color[1] = parseInt(result[2], 16) / 255;
	color[2] = parseInt(result[3], 16) / 255;
	return color;
	}
})();

}
)