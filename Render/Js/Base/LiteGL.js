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

if (typeof(Image) != "undefined")
{
    Image.prototype.getPixels = function(){
        var canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(this, 0, 0);
        return ctx.getImageData(0,0,this.width, this.height).data;
    }
}

(function(){
    var DDS = (function(){

    })();
    
    if (typeof(global) != "undefined")
    {
        global.DDS = DDS;
    }
})();

(function(){
    GL.Indexer = function Indexer(){
        this.unique = [];
        this.indices = [];
        // map's key represents obj's json string, value represents number of indice
        this.map = {};
    }
    GL.Indexer.prototype = {
        add: function(obj){
            var key = JSON.stringify(obj);
            if (!(key in this.map))
            {
                // This means that 
                this.map[key] = this.unique.length;
                this.unique.push(obj);
            }
            return this.map[key];
        }
    };

    GL.Buffer = function Buffer(target, data, spacing, streamType, gl){
        
    }
})();

})