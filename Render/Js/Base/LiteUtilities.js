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

}
)