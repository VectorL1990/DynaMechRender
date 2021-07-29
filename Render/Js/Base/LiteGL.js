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

    /**
     * Buffer means data will be transfered and stored in GPU
     * Normal procedures include glGenBuffers, glBindBuffers, glBufferData, which represents for
     * generate buffer, binding buffer and transfer data to buffer respectively
     * @param {*} target 
     * GL_ARRAY_BUFFER: This binding point can be used to store vertex array data created by
     *  glVertexAttribPointer which tells OpenGl how to interpret vertex data like stride of data
     * 
     * GL_ELEMENT_ARRAY_BUFFER: This binding point can store index data, which is useful for glDrawElements()
     * 
     * GL_PIXEL_PACK_BUFFER: 
     * @param {*} data 
     * @param {*} spacing 
     * @param {*} streamType 
     * There are 9 kinds of streamtype, including GL_STATIC_DRAW, GL_STATIC_READ, GL_STATIC_COPY,
     * GL_DYNAMIC_DRAW, GL_DYNAMIC_READ, GL_DYNAMIC_COPY, GL_STREAM_DRAW, GL_STREAM_READ, GL_STREAM_COPY
     * 
     * "Static" means that data in VBO will not change, "Dynamic" means data can be changed, "stream" means
     * data is different every frame
     * 
     * "Draw" means data will be transfer to GPU to draw, "read" means data will be read by applications,
     * "copy" means data will be used for drawing and reading
     * @param {*} gl 
     */
    GL.Buffer = function Buffer(target, data, spacing, streamType, gl){
        if (GL.debug)
        {
            console.log("GL.Buffer created");
        }
        if (gl !== null)
        {
            gl = gl || global.gl;
        }
        this.gl = gl;

        this.buffer = null;
        // There are different kinds of buffer that we can bind to, like GL.ARRAY_BUFFER, GL.ELEMENT_ARRAY_BUFFER
        this.target = target;
        this.attribute = null;

        this.data = data;
        this.spacing = spacing || 3;

        if (this.data && this.gl)
        {
            this.upload(streamType);
        }
    }

    /**
     * Bind buffer to a attrib location
     * After bindBuffer, we usually tell opengl how to interpret this buffer by vertexAttribPointer
     * @param {*} location 
     * @param {*} gl 
     */
    GL.Buffer.prototype.bind = function(location, gl){
        gl = gl || this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, this.spacing, this.buffer.glType, false, 0, 0);
    }

    GL.Buffer.prototype.unbind = function(location, gl){
        gl = gl || this.gl;
        gl.disableVertexAttribArray(location);
    }

    /**
    * Applies an action to every vertex in this buffer
    * @method forEach
    * @param {function} callback to be called for every vertex (or whatever is contained in the buffer)
    */
    GL.Buffer.prototype.forEach = function(callback){
        var d = this.data;
        for (var i=0, s = this.spacing; i<d.length; i+=s)
        {
            callback(d.subarray(i, i+s), i);
        }
        return this;
    }

    GL.Buffer.prototype.applyTransform = function(mat){
        var d = this.data;
        for (var i=0, s = this.spacing; i<d.length; i += s)
        {
            var v = d.subarray(i, i+s);
            vec3.transformMat4(v, v, mat);
        }
        return this;
    }

    /**
    * Uploads the buffer data (stored in this.data) to the GPU
    * @method upload
    * @param {number} stream_type default gl.STATIC_DRAW (other: gl.DYNAMIC_DRAW, gl.STREAM_DRAW 
    */
    GL.Buffer.prototype.upload = function(streamType){
        var spacing = this.spacing || 3;
        var gl = this.gl;
        if (!gl)
        {
            return;
        }

        if (!this.data)
        {
            throw("no data supplied");
        }

        var data = this.data;
        if (!data.buffer)
        {
            throw("Buffers must be typed arrays");
        }

        this.buffer = this.buffer || gl.createBuffer();
        if (!this.buffer)
        {
            return;
        }

        this.buffer.length = data.length;
        this.buffer.spacing = spacing;

        switch (data.constructor)
        {
            case Int8Array: this.buffer.gl_type = gl.BYTE; break;
            case Uint8ClampedArray: 
            case Uint8Array: this.buffer.gl_type = gl.UNSIGNED_BYTE; break;
            case Int16Array: this.buffer.gl_type = gl.SHORT; break;
            case Uint16Array: this.buffer.gl_type = gl.UNSIGNED_SHORT; break;
            case Int32Array: this.buffer.gl_type = gl.INT; break;
            case Uint32Array: this.buffer.gl_type = gl.UNSIGNED_INT; break;
            case Float32Array: this.buffer.gl_type = gl.FLOAT; break;
            default: throw("unsupported buffer type");
        }

        if(this.target == gl.ARRAY_BUFFER && ( this.buffer.gl_type == gl.INT || this.buffer.gl_type == gl.UNSIGNED_INT ))
        {
            console.warn("WebGL does not support UINT32 or INT32 as vertex buffer types, converting to FLOAT");
            this.buffer.gl_type = gl.FLOAT;
            data = new Float32Array(data);
        }

        gl.bindBuffer(this.target, this.buffer);
        gl.bufferData(this.target, data, streamType || this.streamType || gl.STATIC_DRAW);
    };

    GL.Buffer.prototype.compile = GL.Buffer.prototype.upload;


})();

(function(){
    /**
     * BBox is a class to create BoundingBoxes but it works as glMatrix, creating Float32Array with the info inside instead of objects
    * The bounding box is stored as center,halfsize,min,max,radius (total of 13 floats)
    * @class BBox
     */
    global.BBox = GL.BBox = {
        center: 0,
        halfsize: 3,
        min: 6,
        max: 9,
        radius: 12,
        dataLength: 13,
        corners: [vec3.fromValues(1,1,1), vec3.fromValues(1,1,-1), vec3.fromValues(1,-1,1), 
                vec3.fromValues(1,-1,-1), vec3.fromValues(-1,1,1), vec3.fromValues(-1,1,-1), 
                vec3.fromValues(-1,-1,1), vec3.fromValues(-1,-1,-1)],
        
        create: function(){
            return new Float32Array(13);
        },

        clone: function(bb){
            return new Float32Array(bb);
        },

        copy: function(out, bb){
            out.set(bb);
            return out;
        },

        /**
	* create a bbox from one point
	* @method fromPoint
	* @param {vec3} point
	* @return {BBox} returns a float32array with the bbox
	*/
	fromPoint: function(point)
	{
		var bb = this.create();
		bb.set(point, 0); //center
		bb.set(point, 6); //min
		bb.set(point, 9); //max
		return bb;
	},

	/**
	* create a bbox from min and max points
	* @method fromMinMax
	* @param {vec3} min
	* @param {vec3} max
	* @return {BBox} returns a float32array with the bbox
	*/
	fromMinMax: function(min,max)
	{
		var bb = this.create();
		this.setMinMax(bb, min, max);
		return bb;
	},

	/**
	* create a bbox from center and halfsize
	* @method fromCenterHalfsize
	* @param {vec3} center
	* @param {vec3} halfsize
	* @return {BBox} returns a float32array with the bbox
	*/
	fromCenterHalfsize: function(center, halfsize)
	{
		var bb = this.create();
		this.setCenterHalfsize(bb, center, halfsize);
		return bb;
	},

	/**
	* create a bbox from a typed-array containing points
	* @method fromPoints
	* @param {Float32Array} points
	* @return {BBox} returns a float32array with the bbox
	*/
	fromPoints: function(points)
	{
		var bb = this.create();
		this.setFromPoints(bb, points);
		return bb;	
	},

	/**
	* set the values to a BB from a set of points
	* @method setFromPoints
	* @param {BBox} out where to store the result
	* @param {Float32Array} points
	* @return {BBox} returns a float32array with the bbox
	*/
	setFromPoints: function(bb, points)
	{
		var min = bb.subarray(6,9);
		var max = bb.subarray(9,12);

		min[0] = points[0]; //min.set( points.subarray(0,3) );
		min[1] = points[1];
		min[2] = points[2];
		max.set( min );

		var v = 0;
		for(var i = 3, l = points.length; i < l; i+=3)
		{
			var x = points[i];
			var y = points[i+1];
			var z = points[i+2];
			if( x < min[0] ) min[0] = x;
			else if( x > max[0] ) max[0] = x;
			if( y < min[1] ) min[1] = y;
			else if( y > max[1] ) max[1] = y;
			if( z < min[2] ) min[2] = z;
			else if( z > max[2] ) max[2] = z;
			/*
			v = points.subarray(i,i+3);
			vec3.min( min, v, min);
			vec3.max( max, v, max);
			*/
		}

		//center
		bb[0] = (min[0] + max[0]) * 0.5;
		bb[1] = (min[1] + max[1]) * 0.5;
		bb[2] = (min[2] + max[2]) * 0.5;
		//halfsize
		bb[3] = max[0] - bb[0];
		bb[4] = max[1] - bb[1];
		bb[5] = max[2] - bb[2];
		bb[12] = Math.sqrt( bb[3]*bb[3] + bb[4]*bb[4] + bb[5]*bb[5] );

		/*
		var center = vec3.add( bb.subarray(0,3), min, max );
		vec3.scale( center, center, 0.5);
		vec3.subtract( bb.subarray(3,6), max, center );
		bb[12] = vec3.length(bb.subarray(3,6)); //radius		
		*/
		return bb;
	},

	/**
	* set the values to a BB from min and max
	* @method setMinMax
	* @param {BBox} out where to store the result
	* @param {vec3} min
	* @param {vec3} max
	* @return {BBox} returns out
	*/
	setMinMax: function(bb, min, max)
	{
		bb[6] = min[0];
		bb[7] = min[1];
		bb[8] = min[2];
		bb[9] = max[0];
		bb[10] = max[1];
		bb[11] = max[2];

		//halfsize
		var halfsize = bb.subarray(3,6); 
		vec3.sub( halfsize, max, min ); //range
		vec3.scale( halfsize, halfsize, 0.5 );

		//center
		bb[0] = max[0] - halfsize[0];
		bb[1] = max[1] - halfsize[1];
		bb[2] = max[2] - halfsize[2];

		bb[12] = vec3.length(bb.subarray(3,6)); //radius
		return bb;
	},

	/**
	* set the values to a BB from center and halfsize
	* @method setCenterHalfsize
	* @param {BBox} out where to store the result
	* @param {vec3} min
	* @param {vec3} max
	* @param {number} radius [optional] (the minimum distance from the center to the further point)
	* @return {BBox} returns out
	*/
	setCenterHalfsize: function(bb, center, halfsize, radius)
	{
		bb[0] = center[0];
		bb[1] = center[1];
		bb[2] = center[2];
		bb[3] = halfsize[0];
		bb[4] = halfsize[1];
		bb[5] = halfsize[2];
		bb[6] = bb[0] - bb[3];
		bb[7] = bb[1] - bb[4];
		bb[8] = bb[2] - bb[5];
		bb[9] = bb[0] + bb[3];
		bb[10] = bb[1] + bb[4];
		bb[11] = bb[2] + bb[5];
		if(radius)
			bb[12] = radius;
		else
			bb[12] = vec3.length(halfsize);
		return bb;
	},

	/**
	* Apply a matrix transformation to the BBox (applies to every corner and recomputes the BB)
	* @method transformMat4
	* @param {BBox} out where to store the result
	* @param {BBox} bb bbox you want to transform
	* @param {mat4} mat transformation
	* @return {BBox} returns out
	*/
	transformMat4: (function(){
		var hsx = 0;
		var hsy = 0;
		var hsz = 0;
		var points_buffer = new Float32Array(8*3);
		var points = [];
		for(var i = 0; i < 24; i += 3 )
			points.push( points_buffer.subarray( i, i+3 ) );
		
		return function( out, bb, mat )
		{
			var centerx = bb[0];
			var centery = bb[1];
			var centerz = bb[2];
			hsx = bb[3];
			hsy = bb[4];
			hsz = bb[5];

			var corners = this.corners;

			for(var i = 0; i < 8; ++i)		
			{
				var corner = corners[i];
				var result = points[i];
				result[0] = hsx * corner[0] + centerx;
				result[1] = hsy * corner[1] + centery;
				result[2] = hsz * corner[2] + centerz;
				mat4.multiplyVec3( result, mat, result );
			}

			return this.setFromPoints( out, points_buffer );
		}
	})(),


	/**
	* Computes the eight corners of the BBox and returns it
	* @method getCorners
	* @param {BBox} bb the bounding box
	* @param {Float32Array} result optional, should be 8 * 3
	* @return {Float32Array} returns the 8 corners
	*/
	getCorners: function( bb, result )
	{
		var center = bb; //.subarray(0,3); AVOID GC
		var halfsize = bb.subarray(3,6);

		var corners = null;
		if(result)
		{
			result.set(this.corners);
			corners = result;
		}
		else
			corners = new Float32Array( this.corners );

		for(var i = 0; i < 8; ++i)		
		{
			var corner = corners.subarray(i*3, i*3+3);
			vec3.multiply( corner, halfsize, corner );
			vec3.add( corner, corner, center );
		}

		return corners;
	},	

	merge: function( out, a, b )
	{
		var min = out.subarray(6,9);
		var max = out.subarray(9,12);
		vec3.min( min, a.subarray(6,9), b.subarray(6,9) );
		vec3.max( max, a.subarray(9,12), b.subarray(9,12) );
		return BBox.setMinMax( out, min, max );
	},

	extendToPoint: function( out, p )
	{
		if( p[0] < out[6] )	out[6] = p[0];
		else if( p[0] > out[9] ) out[9] = p[0];

		if( p[1] < out[7] )	out[7] = p[1];
		else if( p[1] > out[10] ) out[10] = p[1];


		if( p[2] < out[8] )	out[8] = p[2];
		else if( p[2] > out[11] ) out[11] = p[2];

		//recompute 
		var min = out.subarray(6,9);
		var max = out.subarray(9,12);
		var center = vec3.add( out.subarray(0,3), min, max );
		vec3.scale( center, center, 0.5);
		vec3.subtract( out.subarray(3,6), max, center );
		out[12] = vec3.length( out.subarray(3,6) ); //radius		
		return out;
	},

	clampPoint: function(out, box, point)
	{
		out[0] = Math.clamp( point[0], box[0] - box[3], box[0] + box[3]);
		out[1] = Math.clamp( point[1], box[1] - box[4], box[1] + box[4]);
		out[2] = Math.clamp( point[2], box[2] - box[5], box[2] + box[5]);
	},

	isPointInside: function( bbox, point )
	{
		if( (bbox[0] - bbox[3]) > point[0] ||
			(bbox[1] - bbox[4]) > point[1] ||
			(bbox[2] - bbox[5]) > point[2] ||
			(bbox[0] + bbox[3]) < point[0] ||
			(bbox[1] + bbox[4]) < point[1] ||
			(bbox[2] + bbox[5]) < point[2] )
			return false;
		return true;
	},

	getCenter: function(bb) { return bb.subarray(0,3); },
	getHalfsize: function(bb) { return bb.subarray(3,6); },
	getMin: function(bb) { return bb.subarray(6,9); },
	getMax: function(bb) { return bb.subarray(9,12); },
	getRadius: function(bb) { return bb[12]; }
	//setCenter,setHalfsize not coded, too much work to update all
    }
})();

})