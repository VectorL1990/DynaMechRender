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

}
)