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

global.createCanvas = GL.createCanvas = function createCanvas(width, height){
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

global.cloneCanvas = GL.cloneCanvas = function cloneCanvas(c){
    var canvas = document.createElement("canvas");
    canvas.width = c.width;
    canvas.height = c.height;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(c,0,0);
}

})