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
	 */
	bind: function(instance, event_type, callback, target_instance){
		if (!instance){
			throw("cannot bind event to null");
		}
		if (!callback){
			throw("cannot bind to null callback");
		}
		if (instance.constructor == String){
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

		if (events.hasOwnProperty(event_type)){
			events[event_type].push([callback, target_instance]);
		}
		else{
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

		var events = instance.__levents;
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
}

}
)