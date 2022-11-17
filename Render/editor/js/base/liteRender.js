///@INFO: UNCOMMON
//WIP: this is the lowest GPU rendering object, which encapsulates all about a render call
//by encapsulating every render action into an object we can have materials that produce several render passes in different moments
//of the rendering process
//the only problem is that uniform containrs could change between render calls which will lead to errors 

function RenderCall()
{
	this.shader = null;
	this.uniforms_containers = [];
	this.vertex_buffers = null;
	this.index_buffer = null;
	this.offset_start = -1;
	this.offset_range = -1;
	this.primitive = -1;

	this.renderState = null;
}

RenderCall.prototype.draw = function()
{
	this.renderState.enable();

	this.shader.uniforms( this.uniforms ).drawBuffers( this.vertex_buffers,
	  this.index_buffer,
	  this.primitive, this.offset_start, this.offset_range );
}

//Pool
RenderCall.pool = [];

RenderCall.get = function()
{
	if( RenderCall.pool.length > 0 )
		return RenderCall.pool.pop();
	return new RenderCall();
}

RenderCall.prototype.release = function()
{
	RenderCall.pool.push(this);
}

///@FILE:../src/render/renderInstance.js
///@INFO: BASE
/**
* RenderInstance contains info of one object to be rendered on the scene.
* It shouldnt contain ids to resources (strings), instead if must contain the direct reference (to mesh, material)
*
* @class RenderInstance
* @namespace LS
* @constructor
*/

function RenderInstance( node, component )
{
	this.uid = LS.generateUId("RINS"); //unique identifier for this RI
	this.layers = 3; //in layer 1 and 2 by default
	this.index = -1; //used to know the rendering order
	this.version = -1; //not used yet

	//info about the mesh
	this.vertex_buffers = {};
	this.index_buffer = null;
	this.wireframe_index_buffer = null;
	this.range = new Int32Array([0,-1]); //start, offset
	this.primitive = GL.TRIANGLES;

	this.transform = null; //parented transform: not finished

	this.mesh = null; //shouldnt be used (buffers are added manually), but just in case
	this.collision_mesh = null; //in case of raycast

	//where does it come from
	this.node = node;
	this.component = component;
	this.priority = 10; //only used if the RenderQueue is in PRIORITY MODE, instances are rendered from higher to lower priority
	this.sort_mode = RenderInstance.NO_SORT;

	//transformation
	this.matrix = mat4.create();
	this.normal_matrix = mat4.create();
	this.position = vec3.create(); //the origin of the node

	//for visibility computation
	this.oobb = BBox.create(); //object space bounding box
	this.aabb = BBox.create(); //axis aligned bounding box
	this.center = BBox.getCenter( this.aabb ); //the center of the AABB

	//info about the material
	this.material = null; //the material, cannot be a string
	this.use_bounding = true; //in case it has vertex shader deformers the bounding box is not usable

	//for extra data for the shader
	this.uniforms = {};
	this.samplers = [];

	//array of all the model matrix for all the instanced
	this.instanced_models = null;

	this.shader_block_flags = 0;
	this.shader_blocks = [];

	this.picking_node = null; //in case of picking, which node to reference

	//this.deformers = []; //TODO

	//TO DO: instancing
	//this.uniforms_instancing = {};

	//for internal use
	this._camera_visibility = 0; //tells in which camera was visible this instance during the last rendering (using bit operations)
	this._is_visible = false; //used during the rendering to mark if it was seen
	this._dist = 0; //computed during rendering, tells the distance to the current camera
	this._nearest_reflection_probe = null;
}

RenderInstance.NO_SORT = 0;
RenderInstance.SORT_NEAR_FIRST = 1;
RenderInstance.SORT_FAR_FIRST = 2;

RenderInstance.fast_normalmatrix = false; //avoid doint the inverse transpose for normal matrix, and just copies the model

RenderInstance.prototype.fromNode = function(node, skip_matrices)
{
	if(!node)
		throw("no node");
	this.node = node;
	this.layers = node.layers;

	if(!skip_matrices)
	{
		if(node.transform)
			this.setMatrix( node.transform._global_matrix );
		else
			this.setMatrix( LS.IDENTITY );
		mat4.multiplyVec3( this.position, this.matrix, LS.ZEROS );
	}
}

//set the matrix 
RenderInstance.prototype.setMatrix = function(matrix, normal_matrix)
{
	this.matrix.set( matrix );

	if( normal_matrix )
		this.normal_matrix.set( normal_matrix )
	else
		this.computeNormalMatrix();
}

/**
* Updates the normal matrix using the matrix
*
* @method computeNormalMatrix
*/
RenderInstance.prototype.computeNormalMatrix = function()
{
	if(RenderInstance.fast_normalmatrix)
	{
		this.normal_matrix.set( this.matrix );
		mat4.setTranslation( this.normal_matrix, LS.ZEROS );
		return;
	}

	var m = mat4.invert(this.normal_matrix, this.matrix);
	if(m)
		mat4.transpose(this.normal_matrix, m);
}

/**
* applies a transformation to the current matrix
*
* @method applyTransform
* @param {mat4} matrix
* @param {mat4} normal_matrix [optional]
*/
RenderInstance.prototype.applyTransform = function( matrix, normal_matrix )
{
	mat4.mul( this.matrix, matrix, this.matrix );
	if( normal_matrix )
		mat4.mul( this.normal_matrix, normal_matrix, this.normal_matrix );
	else
		this.computeNormalMatrix();
}

//set the material and apply material flags to render instance
RenderInstance.prototype.setMaterial = function(material)
{
	if(material && !material.constructor.is_material)
	{
		//console.error("Material in RenderInstance is not a material class:",material);
		return;
	}
	this.material = material;
	if(material && material.applyToRenderInstance)
		material.applyToRenderInstance(this);
}

//sets the buffers to render, the primitive, and the bounding
RenderInstance.prototype.setMesh = function( mesh, primitive )
{
	if( primitive == -1 || primitive === undefined )
		primitive = gl.TRIANGLES;
	this.primitive = primitive;

	if(mesh != this.mesh)
	{
		this.mesh = mesh;
		this.vertex_buffers = {};
	}

	if(!this.mesh)
		return;

	//this.vertex_buffers = mesh.vertexBuffers;
	for(var i in mesh.vertexBuffers)
		this.vertex_buffers[i] = mesh.vertexBuffers[i];

	switch(primitive)
	{
		case gl.TRIANGLES: 
			this.index_buffer = mesh.indexBuffers["triangles"]; //works for indexed and non-indexed
			break;
		case gl.LINES: 
			/*
			if(!mesh.indexBuffers["lines"])
				mesh.computeWireframe();
			*/
			this.index_buffer = mesh.indexBuffers["lines"];
			break;
		case 10:  //wireframe
			this.primitive = gl.LINES;
			if(!mesh.indexBuffers["wireframe"])
				mesh.computeWireframe();
			this.index_buffer = mesh.indexBuffers["wireframe"];
			break;

		case gl.POINTS: 
		default:
			this.index_buffer = null;
			break;
	}

	if(mesh.bounding)
	{
		this.oobb.set( mesh.bounding ); //copy
		this.use_bounding = true;
	}
	else
		this.use_bounding = false;
}

/**
* Sets the object oriented bounding box using the BBox format (usually is the mesh bounding but in some cases could be different like with skinning or submeshes)
*
* @method setBoundinbBox
* @param {BBox} bbox bounding in bbox format
*/
RenderInstance.prototype.setBoundingBox = function(bbox)
{
	this.oobb.set( bbox );
}

/**
* specifies the rendering range for the mesh (from where and how many primitives), if -1 then ignored
*
* @method setRange
* @param {Number} start
* @param {Number} length
*/
RenderInstance.prototype.setRange = function( start, length )
{
	this.range[0] = start;
	this.range[1] = length;
}

/**
* Enable flag in the flag bit field
*
* @method enableFlag
* @param {number} flag id
*/
RenderInstance.prototype.enableFlag = function(flag)
{
	this.flags |= flag;
}

/**
* Disable flag in the flag bit field
*
* @method enableFlag
* @param {number} flag id
*/
RenderInstance.prototype.disableFlag = function(flag)
{
	this.flags &= ~flag;
}

/**
* Tells if a flag is enabled
*
* @method enableFlag
* @param {number} flag id
* @return {boolean} flag value
*/
RenderInstance.prototype.isFlag = function(flag)
{
	return (this.flags & flag);
}

/**
* Computes the instance bounding box in world space from the one in local space
*
* @method updateAABB
*/
RenderInstance.prototype.updateAABB = function()
{
	BBox.transformMat4( this.aabb, this.oobb, this.matrix );
}

/**
* Used to update the RI info without having to go through the collectData process, it is faster but some changes may take a while
*
* @method update
*/
RenderInstance.prototype.update = function()
{
	if(!this.node || !this.node.transform)
		return;
	this.setMatrix( this.node.transform._global_matrix );
}

/**
* Calls render taking into account primitive and range
*
* @method render
* @param {Shader} shader
*/
RenderInstance.prototype.render = function(shader, primitive)
{
	//in case no normals found but they are required
	if(shader.attributes["a_normal"] && !this.vertex_buffers["normals"])
	{
		this.mesh.computeNormals();		
		this.vertex_buffers["normals"] = this.mesh.vertexBuffers["normals"];
	}

	//in case no coords found but they are required
	/*
	if(shader.attributes["a_coord"] && !this.vertex_buffers["coords"])
	{
		//this.mesh.computeTextureCoordinates();		
		//this.vertex_buffers["coords"] = this.mesh.vertexBuffers["coords"];
	}
	*/

	//in case no tangents found but they are required
	if(shader.attributes["a_tangent"] && !this.vertex_buffers["tangents"])
	{
		this.mesh.computeTangents();		
		this.vertex_buffers["tangents"] = this.mesh.vertexBuffers["tangents"];
	}

	//in case no secondary coords found but they are required
	if(shader.attributes["a_coord1"] && !this.vertex_buffers["coords1"])
	{
		this.mesh.createVertexBuffer("coords1",2, vertex_buffers["coords"].data );
		this.vertex_buffers["coords1"] = this.mesh.vertexBuffers["coords1"];
	}

	if(shader.attributes["a_normal"] && !this.vertex_buffers["normals"])
	{
		this.mesh.computeNormals();		
		this.vertex_buffers["normals"] = this.mesh.vertexBuffers["normals"];
	}

	//in case no secondary coords found but they are required
	if(shader.attributes["a_extra"] && !this.vertex_buffers["extra"])
	{
		this.mesh.createVertexBuffer("extra", "a_extra", 1 );
		this.vertex_buffers["extra"] = this.mesh.vertexBuffers["extra"];
	}

	if(shader.attributes["a_extra2"] && !this.vertex_buffers["extra2"])
	{
		this.mesh.createVertexBuffer("extra2","a_extra2", 2 );
		this.vertex_buffers["extra2"] = this.mesh.vertexBuffers["extra2"];
	}

	if(shader.attributes["a_extra3"] && !this.vertex_buffers["extra3"])
	{
		this.mesh.createVertexBuffer("extra3","a_extra3", 3 );
		this.vertex_buffers["extra3"] = this.mesh.vertexBuffers["extra3"];
	}

	//in case no secondary coords found but they are required
	if(shader.attributes["a_color"] && !this.vertex_buffers["colors"])
	{
		this.mesh.createVertexBuffer( "colors", "a_color", 4 );
		this.vertex_buffers["colors"] = this.mesh.vertexBuffers["colors"];
	}


	if(primitive === undefined)
		primitive = this.primitive;

	var changed_draw_buffers = false;
	if(!shader.supports_drawbuffers && GL.FBO.current && GL.FBO.current.color_textures.length > 1)
	{
		changed_draw_buffers = true;
		GL.FBO.current.toSingle();
	}

	//instancing
	if(this.instanced_models && this.instanced_models.length)
	{
		if( shader.attributes["u_model"] ) //if extension enabled
		{
			if(!this._instanced_uniforms)
				this._instanced_uniforms = {};
			this._instanced_uniforms.u_model = this.instanced_models;
			shader.drawInstanced( this.mesh, primitive,
			  this.index_buffer, this._instanced_uniforms,
			  this.range[0], this.range[1], this.instanced_models.length );
		}
		else //not supported the extension
		{
			for(var i = 0; i < this.instanced_models.length; ++i)
			{
				shader.setUniform("u_model", this.instanced_models[i] );
				shader.drawBuffers( this.vertex_buffers, this.index_buffer, primitive, this.range[0], this.range[1] );
			}
		}
	}
	else //no instancing
	{
		shader.drawBuffers( this.vertex_buffers, this.index_buffer, primitive, this.range[0], this.range[1] );
	}

	if(changed_draw_buffers)
		GL.FBO.current.toMulti();
}

RenderInstance.prototype.addShaderBlock = function( block, uniforms )
{
	if( block.flag_mask & this.shader_block_flags && uniforms === undefined )
		return;

	for(var i = 0; i < this.shader_blocks.length; ++i)
	{
		if(!this.shader_blocks[i])
			continue;
		if( this.shader_blocks[i].block == block )
		{
			if(uniforms !== undefined)
				this.shader_blocks[i].uniforms = uniforms;
			return i;
		}
	}
	this.shader_blocks.push( { block: block, uniforms: uniforms } );
	this.shader_block_flags |= block.flag_mask;
	return this.shader_blocks.length - 1;
}

RenderInstance.prototype.disableShaderBlock = function( block )
{
	if( ! (block.flag_mask & this.shader_block_flags) )
		return;

	for(var i = 0; i < this.shader_blocks.length; ++i)
	{
		if(!this.shader_blocks[i])
			continue;
		if( this.shader_blocks[i].block !== block )
			continue;
		this.shader_block_flags &= ~block.flag_mask;
		break;
	}
}


RenderInstance.prototype.removeShaderBlock = function( block )
{
	if( ! (block.flag_mask & this.shader_block_flags) )
		return;

	for(var i = 0; i < this.shader_blocks.length; ++i)
	{
		if(!this.shader_blocks[i])
			continue;
		if( this.shader_blocks[i].block !== block )
			continue;

		this.shader_blocks.splice(i,1);
		this.shader_block_flags &= ~block.flag_mask;
		break;
	}
}

//checks the ShaderBlocks attached to this instance and resolves the flags
RenderInstance.prototype.computeShaderBlockFlags = function()
{
	return this.shader_block_flags;

	/*
	var r = 0;
	for(var i = 0; i < this.shader_blocks.length; ++i)
	{
		var shader_block = this.shader_blocks[i];
		if(!shader_block)
			continue;
		var block = this.shader_blocks[i].block;
		r |= block.flag_mask;
	}
	return r;
	*/
}

/*
RenderInstance.prototype.renderInstancing = function( shader )
{
	var instances_info = this.instances_info;

	var matrices = new Float32Array( instances_info.length * 16 );
	for(var j = 0; j < instances_info.length; ++j)
	{
		var matrix = instances_info[j].matrix;
		matrices.set( matrix, j*16 );
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, matricesBuffer );
	gl.bufferData(gl.ARRAY_BUFFER, matrices, gl.STREAM_DRAW);

	// Bind the instance matrices data (mat4 behaves as 4 attributes)
	for(var k = 0; k < 4; ++k)
	{
		gl.enableVertexAttribArray( location+k );
		gl.vertexAttribPointer( location+k, 4, gl.FLOAT , false, 16*4, k*4*4 );
		ext.vertexAttribDivisorANGLE( location+k, 1 ); // This makes it instanced!
	}

	//gl.drawElements( gl.TRIANGLES, length, indexBuffer.buffer.gl_type, 0 ); //gl.UNSIGNED_SHORT
	ext.drawElementsInstancedANGLE( gl.TRIANGLES, length, indexBuffer.buffer.gl_type, 0, batch.length );
	GFX.stats.calls += 1;
	for(var k = 0; k < 4; ++k)
	{
		ext.vertexAttribDivisorANGLE( location+k, 0 );
		gl.disableVertexAttribArray( location+k );
	}
}
*/

RenderInstance.prototype.overlapsSphere = function( center, radius )
{
	//we dont know if the bbox of the instance is valid
	if( !this.use_bounding )
		return true;
	return geo.testSphereBBox( center, radius, this.aabb );
}

/**
* Checks if this object was visible by a camera during the last frame
*
* @method wasVisibleByCamera
* @param {LS.Camera} camera [optional] if a camera is supplied it checks if it was visible by that camera, otherwise tells you if it was visible by any camera
* @return {Boolean} true if it was visible by the camera (or any camera if no camera supplied), false otherwise
*/
RenderInstance.prototype.wasVisibleByCamera = function( camera )
{
	if(!camera)
		return this._camera_visibility != 0;
	return (this._camera_visibility | (1<<(camera._rendering_index))) ? true : false;
}

LS.RenderInstance = RenderInstance;
///@FILE:../src/render/renderFrameContext.js
///@INFO: BASE
/**	RenderFrameContext
*	This class is used when you want to render the scene not to the screen but to some texture for postprocessing
*	It helps to create the textures and bind them easily, add extra buffers or show it on the screen.
*	Check the FrameFX and CameraFX components to see it in action.
*   Dependencies: LS.Renderer (writes there only)
*
* @class RenderFrameContext
* @namespace LS
* @constructor
*/
function RenderFrameContext( o )
{
	this.width = 0; //0 means the same size as the viewport, negative numbers mean reducing the texture in half N times
	this.height = 0; //0 means the same size as the viewport
	this.precision = RenderFrameContext.DEFAULT_PRECISION; //LOW_PRECISION uses a byte, MEDIUM uses a half_float, HIGH uses a float, or directly the texture type (p.e gl.UNSIGNED_SHORT_4_4_4_4 )
	this.filter_texture = true; //magFilter: in case the texture is shown, do you want to see it pixelated?
	this.format = GL.RGB; //how many color channels, or directly the texture internalformat 
	this.use_depth_texture = true; //store the depth in a texture
	this.use_stencil_buffer = false; //add an stencil buffer (cannot be read as a texture in webgl)
	this.num_extra_textures = 0; //number of extra textures in case we want to render to several buffers
	this.name = null; //if a name is provided all the textures will be stored in the LS.ResourcesManager

	this.generate_mipmaps = false; //try to generate mipmaps if possible (only when the texture is power of two)
	this.adjust_aspect = false; //when the size doesnt match the canvas size it could look distorted, settings this to true will fix the problem
	this.clone_after_unbind = false; //clones the textures after unbinding it. Used when the texture will be in the 3D scene

	this._fbo = null;
	this._color_texture = null;
	this._depth_texture = null;
	this._textures = []; //all color textures (the first will be _color_texture)
	this._cloned_textures = null; //in case we set the clone_after_unbind to true
	this._cloned_depth_texture = null;

	this._version = 1; //to detect changes
	this._minFilter = gl.NEAREST;

	if(o)
		this.configure(o);
}


RenderFrameContext.current = null;
RenderFrameContext.stack = [];

RenderFrameContext.DEFAULT_PRECISION = 0; //selected by the renderer
RenderFrameContext.LOW_PRECISION = 1; //byte
RenderFrameContext.MEDIUM_PRECISION = 2; //half_float or float
RenderFrameContext.HIGH_PRECISION = 3; //float

RenderFrameContext.DEFAULT_PRECISION_WEBGL_TYPE = GL.UNSIGNED_BYTE;

RenderFrameContext["@width"] = { type: "number", step: 1, precision: 0 };
RenderFrameContext["@height"] = { type: "number", step: 1, precision: 0 };

//definitions for the GUI
RenderFrameContext["@precision"] = { widget: "combo", values: { 
	"default": RenderFrameContext.DEFAULT_PRECISION, 
	"low": RenderFrameContext.LOW_PRECISION,
	"medium": RenderFrameContext.MEDIUM_PRECISION,
	"high": RenderFrameContext.HIGH_PRECISION
	}
};

RenderFrameContext["@format"] = { widget: "combo", values: { 
		"RGB": GL.RGB,
		"RGBA": GL.RGBA
//		"R8": GL.LUMINANCE,
//		"LUMINANCE_ALPHA": GL.LUMINANCE_ALPHA,
//		"ALPHA": GL.ALPHA
	}
};

RenderFrameContext["@num_extra_textures"] = { type: "number", step: 1, min: 0, max: 4, precision: 0 };
RenderFrameContext["@name"] = { type: "string" };

RenderFrameContext.prototype.clear = function()
{
	if(this.name)
	{
		for(var i = 0; i < this._textures.length; ++i)
			delete LS.ResourcesManager.textures[ this.name + (i > 1 ? i : "") ];
		if(this._depth_texture)
			delete LS.ResourcesManager.textures[ this.name + "_depth"];
	}

	this._fbo = null;
	this._textures = [];
	this._color_texture = null;
	this._depth_textures = null;
}

RenderFrameContext.prototype.configure = function(o)
{
	this.width = o.width || 0;
	this.height = o.height || 0;
	this.format = o.format || GL.RGBA;
	this.precision = o.precision || 0;
	this.filter_texture = !!o.filter_texture;
	this.adjust_aspect = !!o.adjust_aspect;
	this.use_depth_texture = !!o.use_depth_texture;
	this.use_stencil_buffer = !!o.use_stencil_buffer;
	this.num_extra_textures = o.num_extra_textures || 0;
	this.name = o.name;
	this.clone_after_unbind = !!o.clone_after_unbind;
}

RenderFrameContext.prototype.serialize = function()
{
	return {
		width: this.width,
		height:  this.height,
		filter_texture: this.filter_texture,
		precision:  this.precision,
		format: this.format,
		adjust_aspect: this.adjust_aspect,
		use_depth_texture:  this.use_depth_texture,
		use_stencil_buffer: this.use_stencil_buffer,
		num_extra_textures:  this.num_extra_textures,
		clone_after_unbind: this.clone_after_unbind,
		name: this.name
	};
}

RenderFrameContext.prototype.prepare = function( viewport_width, viewport_height )
{
	//compute the right size for the textures
	var final_width = this.width;
	var final_height = this.height;
	if(final_width == 0)
		final_width = viewport_width;
	else if(final_width < 0)
		final_width = viewport_width >> Math.abs( this.width ); //subsampling
	if(final_height == 0)
		final_height = viewport_height;
	else if(final_height < 0)
		final_height = viewport_height >> Math.abs( this.height ); //subsampling

	var format = this.format;
	var magFilter = this.filter_texture ? gl.LINEAR : gl.NEAREST ;
	var type = 0;

	var minFilter = gl.LINEAR;
	if(this.generate_mipmaps && GL.isPowerOfTwo(final_width) && GL.isPowerOfTwo(final_height) )
		minFilter = gl.LINEAR_MIPMAP_LINEAR;
	this._minFilter = minFilter;

	switch( this.precision )
	{
		case RenderFrameContext.LOW_PRECISION:
			type = gl.UNSIGNED_BYTE; break;
		case RenderFrameContext.MEDIUM_PRECISION:
			type = gl.HIGH_PRECISION_FORMAT; break; //gl.HIGH_PRECISION_FORMAT is HALF_FLOAT_OES, if not supported then is FLOAT, otherwise is UNSIGNED_BYTE
		case RenderFrameContext.HIGH_PRECISION:
			type = gl.FLOAT; break;
		case RenderFrameContext.DEFAULT_PRECISION:
			type = RenderFrameContext.DEFAULT_PRECISION_WEBGL_TYPE; break;
		default:
			type = this.precision; break; //used for custom formats
	}

	//check support due to weirdeness of webgl 1.0
	if( type == GL.HALF_FLOAT_OES && !GL.FBO.testSupport( type, format ) )
		format = gl.RGBA;
	if( type == GL.HALF_FLOAT_OES && !GL.FBO.testSupport( type, format ) )
		type = gl.FLOAT;

	var textures = this._textures;

	//for the color: check that the texture size matches
	if( !this._color_texture || 
		this._color_texture.width != final_width || this._color_texture.height != final_height || 
		this._color_texture.type != type || this._color_texture.format != format || this._color_texture.minFilter != minFilter )
		this._color_texture = new GL.Texture( final_width, final_height, { minFilter: minFilter, magFilter: magFilter, format: format, type: type });
	else
		this._color_texture.setParameter( gl.TEXTURE_MAG_FILTER, magFilter );
	textures[0] = this._color_texture;

	//extra color texture (multibuffer rendering)
	var total_extra = Math.min( this.num_extra_textures, 4 );
	
	//extra buffers not supported in this webgl context
	if(gl.webgl_version == 1 && !gl.extensions["WEBGL_draw_buffers"])
		total_extra = 0;

	for(var i = 0; i < total_extra; ++i) //MAX is 4
	{
		var extra_texture = textures[1 + i];
		if( (!extra_texture || extra_texture.width != final_width || extra_texture.height != final_height || extra_texture.type != type || extra_texture.format != format || extra_texture.minFilter != minFilter) )
			extra_texture = new GL.Texture( final_width, final_height, { minFilter: minFilter, magFilter: magFilter, format: format, type: type });
		else
			extra_texture.setParameter( gl.TEXTURE_MAG_FILTER, magFilter );
		textures[1 + i] = extra_texture;
	}

	//for the depth
	var depth_format = gl.DEPTH_COMPONENT;
	var depth_type = gl.UNSIGNED_INT;

	if(this.use_stencil_buffer && gl.extensions.WEBGL_depth_texture)
	{
		depth_format = gl.DEPTH_STENCIL;
		depth_type = gl.extensions.WEBGL_depth_texture.UNSIGNED_INT_24_8_WEBGL;
	}

	if( this.use_depth_texture && 
		(!this._depth_texture || this._depth_texture.width != final_width || this._depth_texture.height != final_height || this._depth_texture.format != depth_format || this._depth_texture.type != depth_type ) && 
		gl.extensions["WEBGL_depth_texture"] )
		this._depth_texture = new GL.Texture( final_width, final_height, { filter: gl.NEAREST, format: depth_format, type: depth_type });
	else if( !this.use_depth_texture )
		this._depth_texture = null;

	//we will store some extra info in the depth texture for the near and far plane distances
	if(this._depth_texture)
	{
		if(!this._depth_texture.near_far_planes)
			this._depth_texture.near_far_planes = vec2.create();
	}

	//create FBO
	if( !this._fbo )
		this._fbo = new GL.FBO();

	//cut extra
	textures.length = 1 + total_extra;

	//assign textures (this will enable the FBO but it will restore the old one after finishing)
	this._fbo.stencil = this.use_stencil_buffer;
	this._fbo.setTextures( textures, this._depth_texture );
	this._version += 1;
}

/**
* Called to bind the rendering to this context, from now on all the render will be stored in the textures inside
*
* @method enable
*/
RenderFrameContext.prototype.enable = function( render_settings, viewport, camera )
{
	viewport = viewport || gl.viewport_data;

	//create FBO and textures (pass width and height of current viewport)
	this.prepare( viewport[2], viewport[3] );

	if(!this._fbo)
		throw("No FBO created in RenderFrameContext");

	//enable FBO
	RenderFrameContext.enableFBO( this._fbo, this.adjust_aspect );

	if(LS.RenderFrameContext.current)
		RenderFrameContext.stack.push( LS.RenderFrameContext.current );
	LS.RenderFrameContext.current = this;

	//set depth info inside the texture
	camera = camera || LS.Renderer._current_camera;
	if(this._depth_texture && camera)
	{
		this._depth_texture.near_far_planes[0] = camera.near;
		this._depth_texture.near_far_planes[1] = camera.far;
	}
}

//we cannot read and write in the same buffer, so we need to clone the textures
//done from... ?
RenderFrameContext.prototype.cloneBuffers = function()
{
	//we do not call this._fbo.unbind because it will set the previous FBO
	gl.bindFramebuffer( gl.FRAMEBUFFER, null );

	///for every color texture
	if( this._textures.length )
	{
		if(!this._cloned_textures)
			this._cloned_textures = [];
		var textures = this._textures;
		this._cloned_textures.length = textures.length;
		for(var i = 0; i < textures.length; ++i)
		{
			var texture = textures[i];
			var cloned_texture = this._cloned_textures[i];
			if( !cloned_texture || !cloned_texture.hasSameSize( texture ) || !cloned_texture.hasSameProperties( texture ) )
				cloned_texture = this._cloned_textures[i] = new GL.Texture( texture.width, texture.height, texture.getProperties() );
			texture.copyTo( cloned_texture );
			if(i == 0)
				LS.ResourcesManager.textures[":color_buffer" ] = cloned_texture;
		}
	}

	//for depth
	if( this._depth_texture )
	{
		var depth = this._depth_texture;
		if(!this._cloned_depth_texture || this._cloned_depth_texture.width != depth.width || this._cloned_depth_texture.height != depth.height || !this._cloned_depth_texture.hasSameProperties( depth ) )
			this._cloned_depth_texture = new GL.Texture( depth.width, depth.height, depth.getProperties() );

		depth.copyTo( this._cloned_depth_texture );
		if(!this._cloned_depth_texture.near_far_planes)
			this._cloned_depth_texture.near_far_planes = vec2.create();
		this._cloned_depth_texture.near_far_planes.set( depth.near_far_planes );

		LS.ResourcesManager.textures[":depth_buffer" ] = this._cloned_depth_texture;
	}

	//rebind FBO
	gl.bindFramebuffer( gl.FRAMEBUFFER, this._fbo.handler );
}

/**
* Called to stop rendering to this context
*
* @method disable
*/
RenderFrameContext.prototype.disable = function()
{
	//sets some global parameters for aspect and current RFC
	RenderFrameContext.disableFBO( this._fbo );

	//if we need to store the textures in the ResourcesManager
	if(this.name)
	{
		var textures = this._textures;
		for(var i = 0; i < textures.length; ++i)
		{
			var name = this.name + (i > 0 ? i : "");
			textures[i].filename = name;
			var final_texture = textures[i];

			//only clone main color if requested
			if( this.clone_after_unbind && i === 0 )
			{
				if( !this._cloned_texture || 
					this._cloned_texture.width !== final_texture.width || 
					this._cloned_texture.height !== final_texture.height ||
					this._cloned_texture.type !== final_texture.type )
					this._cloned_texture = final_texture.clone();
				else
					final_texture.copyTo( this._cloned_texture );
				final_texture = this._cloned_texture;
			}

			if( this._minFilter == gl.LINEAR_MIPMAP_LINEAR )
			{
				final_texture.bind(0);
				gl.generateMipmap(gl.TEXTURE_2D);
				final_texture.has_mipmaps = true;
			}

			LS.ResourcesManager.textures[ name ] = final_texture;
		}

		if(this._depth_texture)
		{
			var name = this.name + "_depth";
			var depth_texture = this._depth_texture;
			if( this.clone_after_unbind )
			{
				if( !this._cloned_depth_texture || 
					this._cloned_depth_texture.width !== depth_texture.width || 
					this._cloned_depth_texture.height !== depth_texture.height ||
					this._cloned_depth_texture.type !== depth_texture.type )
					this._cloned_depth_texture = depth_texture.clone();
				else
					depth_texture.copyTo( this._cloned_depth_texture );
				if(!this._cloned_depth_texture.near_far_planes)
					this._cloned_depth_texture.near_far_planes = vec2.create();
				this._cloned_depth_texture.near_far_planes.set( depth_texture.near_far_planes );
				depth_texture = this._cloned_depth_texture;
			}

			depth_texture.filename = name;
			LS.ResourcesManager.textures[ name ] = depth_texture;
		}
	}

	if( RenderFrameContext.stack.length )
		LS.RenderFrameContext.current = RenderFrameContext.stack.pop();
	else
		LS.RenderFrameContext.current = null;
}

/**
* returns the texture containing the data rendered in this context
*
* @method getColorTexture
* @param {number} index the number of the texture (in case there is more than one)
* @return {GL.Texture} the texture
*/
RenderFrameContext.prototype.getColorTexture = function(num)
{
	return this._textures[ num || 0 ] || null;
}

/**
* returns the depth texture containing the depth data rendered in this context (in case the use_depth_texture is set to true)
*
* @method getDepthTexture
* @return {GL.Texture} the depth texture
*/
RenderFrameContext.prototype.getDepthTexture = function()
{
	return this._depth_texture || null;
}

/**
* Fills the textures with a flat color
* @method clearTextures
*/
RenderFrameContext.prototype.clearTextures = function()
{
	for(var i = 0; i < this._textures.length; ++i)
	{
		var texture = this._textures[i];
		if(!texture)
			continue;
		texture.fill([0,0,0,0]);
	}
}

//enables the FBO and sets every texture with a flag so it cannot be used during the rendering process
RenderFrameContext.enableFBO = function( fbo, adjust_aspect )
{
	fbo.bind( true ); //changes viewport to full FBO size (saves old)

	LS.Renderer._full_viewport.set( gl.viewport_data );
	if( adjust_aspect )
	{
		fbo._old_aspect = LS.Renderer.global_aspect;
		LS.Renderer.global_aspect = (gl.canvas.width / gl.canvas.height) / (fbo.color_textures[0].width / fbo.color_textures[0].height);
	}
	else
		delete fbo._old_aspect;
}

RenderFrameContext.disableFBO = function( fbo )
{
	fbo.unbind(); //restores viewport to old saved one
	LS.Renderer._full_viewport.set( fbo._old_viewport );
	if( fbo._old_aspect )
		LS.Renderer.global_aspect = fbo._old_aspect;
}


/**
* Render the context of the context to the viewport (allows to apply FXAA)
*
* @method show
* @param {boolean} use_antialiasing in case you want to render with FXAA antialiasing
*/
RenderFrameContext.prototype.show = function( use_antialiasing )
{
	var texture = this._color_texture;
	if(!use_antialiasing)
	{
		texture.toViewport();
		return;
	}

	var viewport = gl.getViewport();
	var shader = GL.Shader.getFXAAShader();
	var mesh = GL.Mesh.getScreenQuad();
	texture.bind(0);
	shader.uniforms( { u_texture:0, uViewportSize: viewport.subarray(2,4), u_iViewportSize: [1 / texture.width, 1 / texture.height]} ).draw( mesh );
}

//Resets the current WebGL fbo so it renders to the screen
RenderFrameContext.reset = function()
{
	gl.bindFramebuffer( gl.FRAMEBUFFER, null );
	LS.RenderFrameContext.current = null;
	LS.RenderFrameContext.stack.length = 0;
}


LS.RenderFrameContext = RenderFrameContext;

///@FILE:../src/render/renderQueue.js
///@INFO: BASE
//RenderQueue is in charge of storing the RenderInstances that must be rendered
//There could be several RenderQueue (for opaque, transparent, overlays, etc)
//It works similar to the one in Unity
function RenderQueue( value, sort_mode, options )
{
	this.enabled = true; //if disabled it will be skipped

	//container for all instances that belong to this render queue
	this.instances = [];

	this.value = value || 0;
	this.sort_mode = sort_mode || LS.RenderQueue.NO_SORT;
	this.must_clone_buffers = false; //used for readback rendering like refracion
	//this.visible_in_pass = null;

	//callbacks
	this.onStart = null;
	this.onFinish = null;

	//configure
	if(options)
		for(var i in options)
			this[i] = options[i];
}

RenderQueue.readback_allowed = true;

RenderQueue.prototype.sort = function()
{
	if(!this.instances.length)
		return;

	var func = null;
	switch(this.sort_mode)
	{
		case 1: func = LS.RenderQueue.sort_near_to_far_func; break;
		case 2: func = LS.RenderQueue.sort_far_to_near_func; break;
		case 3: func = LS.RenderQueue.sort_by_priority_func; break;
	}

	if(func)
		this.instances.sort( func );
}

RenderQueue.prototype.add = function( ri )
{
	this.instances.push( ri );
}

RenderQueue.prototype.clear = function()
{
	this.instances.length = 0;
}

RenderQueue.prototype.start = function( pass, render_settings )
{
	if(this.onStart)
	{
		var r = this.onStart( pass, render_settings); //cancels rendering
		if (r === false)
			return false;
	}

	if(this.instances.length && this.must_clone_buffers && RenderQueue.readback_allowed && pass === LS.COLOR_PASS )
	{
		if( LS.RenderFrameContext.current )
			LS.RenderFrameContext.current.cloneBuffers();
		//cubemaps are not cloned... too much work
	}
}

//not used...
RenderQueue.prototype.finish = function( pass )
{
	if(this.onFinish)
		this.onFinish( pass, render_settings );
}

//we use 5 so from 0 to 9 is one queue, from 10 to 19 another one, etc
RenderQueue.AUTO =			-1;
RenderQueue.BACKGROUND =	5; //0..9
RenderQueue.GEOMETRY =		35; //30..39
RenderQueue.TRANSPARENT =	75; //70..79
RenderQueue.READBACK_COLOR = 95;//90..99
RenderQueue.OVERLAY =		115; //100..119

RenderQueue.NO_SORT = 0;
RenderQueue.SORT_NEAR_TO_FAR = 1;
RenderQueue.SORT_FAR_TO_NEAR = 2;
RenderQueue.SORT_BY_PRIORITY = 3;

RenderQueue.sort_far_to_near_func = function(a,b) { return b._dist - a._dist; },
RenderQueue.sort_near_to_far_func = function(a,b) { return a._dist - b._dist; },
RenderQueue.sort_by_priority_func = function(a,b) { return b.priority - a.priority; },
RenderQueue.sort_by_priority_and_near_to_far_func = function(a,b) { var r = b.priority - a.priority; return r ? r : (a._dist - b._dist) },
RenderQueue.sort_by_priority_and_far_to_near_func = function(a,b) { var r = b.priority - a.priority; return r ? r : (b._dist - a._dist) },

LS.RenderQueue = RenderQueue;
///@FILE:../src/render/renderer.js
///@INFO: BASE

//************************************
/**
* The Renderer is in charge of generating one frame of the scene. Contains all the passes and intermediate functions to create the frame.
*
* @class Renderer
* @namespace LS
* @constructor
*/

//passes
var COLOR_PASS = LS.COLOR_PASS = { name: "color", id: 1 };
var SHADOW_PASS = LS.SHADOW_PASS = { name: "shadow", id: 2 };
var PICKING_PASS = LS.PICKING_PASS = { name: "picking", id: 3 };

//render events
EVENT.BEFORE_RENDER = "beforeRender";
EVENT.READY_TO_RENDER = "readyToRender";
EVENT.RENDER_SHADOWS = "renderShadows";
EVENT.AFTER_VISIBILITY = "afterVisibility";
EVENT.RENDER_REFLECTIONS = "renderReflections";
EVENT.BEFORE_RENDER_MAIN_PASS = "beforeRenderMainPass";
EVENT.ENABLE_FRAME_CONTEXT = "enableFrameContext";
EVENT.SHOW_FRAME_CONTEXT = "showFrameContext";
EVENT.AFTER_RENDER = "afterRender";
EVENT.BEFORE_RENDER_FRAME = "beforeRenderFrame";
EVENT.BEFORE_RENDER_SCENE = "beforeRenderScene";
EVENT.COMPUTE_VISIBILITY = "computeVisibility";
EVENT.AFTER_RENDER_FRAME = "afterRenderFrame";
EVENT.AFTER_RENDER_SCENE = "afterRenderScene";
EVENT.RENDER_HELPERS = "renderHelpers";
EVENT.RENDER_PICKING = "renderPicking";
EVENT.BEFORE_SHOW_FRAME_CONTEXT = "beforeShowFrameContext";
EVENT.BEFORE_CAMERA_ENABLED = "beforeCameraEnabled";
EVENT.AFTER_CAMERA_ENABLED = "afterCameraEnabled";
EVENT.BEFORE_RENDER_INSTANCES = "beforeRenderInstances";
EVENT.RENDER_INSTANCES = "renderInstances";
EVENT.RENDER_SCREEN_SPACE = "renderScreenSpace";
EVENT.AFTER_RENDER_INSTANCES = "afterRenderInstances";
EVENT.RENDER_GUI = "renderGUI";
EVENT.FILL_SCENE_UNIFORMS = "fillSceneUniforms";
EVENT.AFTER_COLLECT_DATA = "afterCollectData";
EVENT.PREPARE_MATERIALS = "prepareMaterials";

var Renderer = {

	default_render_settings: new LS.RenderSettings(), //overwritten by the global info or the editor one
	default_material: new LS.StandardMaterial(), //used for objects without material

	global_aspect: 1, //used when rendering to a texture that doesnt have the same aspect as the screen
	default_point_size: 1, //point size in pixels (could be overwritte by render instances)

	render_profiler: false,

	_global_viewport: vec4.create(), //the viewport we have available to render the full frame (including subviewports), usually is the 0,0,gl.canvas.width,gl.canvas.height
	_full_viewport: vec4.create(), //contains info about the full viewport available to render (current texture size or canvas size)

	//temporal info during rendering
	_current_scene: null,
	_current_render_settings: null,
	_current_camera: null,
	_current_target: null, //texture where the image is being rendered
	_current_pass: COLOR_PASS, //object containing info about the pass
	_current_layers_filter: 0xFFFF,// do a & with this to know if it must be rendered
	_global_textures: {}, //used to speed up fetching global textures
	_global_shader_blocks: [], //used to add extra shaderblocks to all objects in the scene (it gets reseted every frame)
	_global_shader_blocks_flags: 0, 
	_reverse_faces: false,
	_in_player: true, //true if rendering in the player

	_queues: [], //render queues in order

	_main_camera: null,

	_visible_cameras: null,
	_active_lights: null, //array of lights that are active in the scene
	_visible_instances: null,
	_visible_materials: [],
	_near_lights: [],
	_active_samples: [],

	//stats
	_frame_time: 0,
	_frame_cpu_time: 0,
	_rendercalls: 0, //calls to instance.render
	_rendered_instances: 0, //instances processed
	_rendered_passes: 0,
	_frame: 0,
	_last_time: 0,

	//using timer queries
	gpu_times: {
		total: 0,
		shadows: 0,
		reflections: 0,
		main: 0,
		postpo: 0,
		gui: 0
	},

	//to measure performance
	timer_queries_enabled: true,
	_timer_queries: {},
	_waiting_queries: false,

	//settings
	_collect_frequency: 1, //used to reuse info (WIP)

	//reusable locals
	_view_matrix: mat4.create(),
	_projection_matrix: mat4.create(),
	_viewprojection_matrix: mat4.create(),
	_2Dviewprojection_matrix: mat4.create(),

	_temp_matrix: mat4.create(),
	_temp_cameye: vec3.create(),
	_identity_matrix: mat4.create(),
	_uniforms: {},
	_samplers: [],
	_instancing_data: [],

	//safety
	_is_rendering_frame: false,
	_ignore_reflection_probes: false,

	//debug
	allow_textures: true,
	_sphere_mesh: null,
	_debug_instance: null,

	//fixed texture slots for global textures
	SHADOWMAP_TEXTURE_SLOT: 7,
	ENVIRONMENT_TEXTURE_SLOT: 6,
	IRRADIANCE_TEXTURE_SLOT: 5,
	LIGHTPROJECTOR_TEXTURE_SLOT: 4,
	LIGHTEXTRA_TEXTURE_SLOT: 3,

	//used in special cases
	BONES_TEXTURE_SLOT: 3,
	MORPHS_TEXTURE_SLOT: 2,
	MORPHS_TEXTURE2_SLOT: 1,

	//called from...
	init: function()
	{
		//create some useful textures: this is used in case a texture is missing
		this._black_texture = new GL.Texture(1,1, { pixel_data: [0,0,0,255] });
		this._gray_texture = new GL.Texture(1,1, { pixel_data: [128,128,128,255] });
		this._white_texture = new GL.Texture(1,1, { pixel_data: [255,255,255,255] });
		this._normal_texture = new GL.Texture(1,1, { pixel_data: [128,128,255,255] });
		this._white_cubemap_texture = new GL.Texture(1,1, { texture_type: gl.TEXTURE_CUBE_MAP, pixel_data: (new Uint8Array(6*4)).fill(255) });
		this._missing_texture = this._gray_texture;
		var internal_textures = [ this._black_texture, this._gray_texture, this._white_texture, this._normal_texture, this._missing_texture ];
		internal_textures.forEach(function(t){ t._is_internal = true; });
		LS.ResourcesManager.textures[":black"] = this._black_texture;
		LS.ResourcesManager.textures[":gray"] = this._gray_texture;
		LS.ResourcesManager.textures[":white"] = this._white_texture;
		LS.ResourcesManager.textures[":flatnormal"] = this._normal_texture;

		//some global meshes could be helpful: used for irradiance probes
		this._sphere_mesh = GL.Mesh.sphere({ size:1, detail:32 });

		//draw helps rendering debug stuff
		if(LS.Draw)
		{
			LS.Draw.init();
			LS.Draw.onRequestFrame = function() { LS.GlobalScene.requestFrame(); }
		}

		//enable webglCanvas lib so it is easy to render in 2D
		if(global.enableWebGLCanvas && !gl.canvas.canvas2DtoWebGL_enabled)
			global.enableWebGLCanvas( gl.canvas );

		// we use fixed slots to avoid changing texture slots all the time
		// from more common to less (to avoid overlappings with material textures)
		// the last slot is reserved for litegl binding stuff
		var max_texture_units = this._max_texture_units = gl.getParameter( gl.MAX_TEXTURE_IMAGE_UNITS );
		this.SHADOWMAP_TEXTURE_SLOT = max_texture_units - 2;
		this.ENVIRONMENT_TEXTURE_SLOT = max_texture_units - 3;
		this.IRRADIANCE_TEXTURE_SLOT = max_texture_units - 4;

		this.BONES_TEXTURE_SLOT = max_texture_units - 5;
		this.MORPHS_TEXTURE_SLOT = max_texture_units - 6;
		this.MORPHS_TEXTURE2_SLOT = max_texture_units - 7;

		this.LIGHTPROJECTOR_TEXTURE_SLOT = max_texture_units - 8;
		this.LIGHTEXTRA_TEXTURE_SLOT = max_texture_units - 9;

		this._active_samples.length = max_texture_units;

		this.createRenderQueues();

		this._full_viewport.set([0,0,gl.drawingBufferWidth,gl.drawingBufferHeight]);

		this._uniforms.u_viewport = gl.viewport_data;
		this._uniforms.environment_texture = this.ENVIRONMENT_TEXTURE_SLOT;
		this._uniforms.u_clipping_plane = vec4.create();
	},

	reset: function()
	{
	},

	//used to clear the state
	resetState: function()
	{
		this._is_rendering_frame = false;
		this._reverse_faces = false;
	},

	//used to store which is the current full viewport available (could be different from the canvas in case is a FBO or the camera has a partial viewport)
	setFullViewport: function(x,y,w,h)
	{
		if(arguments.length == 0) //restore
		{
			this._full_viewport[0] = this._full_viewport[1] = 0;
			this._full_viewport[2] = gl.drawingBufferWidth;
			this._full_viewport[3] = gl.drawingBufferHeight;
		}
		else if(x.constructor === Number)
		{
			this._full_viewport[0] = x; this._full_viewport[1] = y; this._full_viewport[2] = w; this._full_viewport[3] = h;
		}
		else if(x.length)
			this._full_viewport.set(x);
	},

	/**
	* Renders the current scene to the screen
	* Many steps are involved, from gathering info from the scene tree, generating shadowmaps, setup FBOs, render every camera
	* If you want to change the rendering pipeline, do not overwrite this function, try to understand it first, otherwise you will miss lots of features
	*
	* @method render
	* @param {Scene} scene
	* @param {RenderSettings} render_settings
	* @param {Array} [cameras=null] if no cameras are specified the cameras are taken from the scene
	*/
	render: function( scene, render_settings, cameras )
	{
		scene = scene || LS.GlobalScene;

		if( this._is_rendering_frame )
		{
			console.error("Last frame didn't finish and a new one was issued. Remember that you cannot call LS.Renderer.render from an event dispatched during the render, this would cause a recursive loop. Call LS.Renderer.reset() to clear from an error.");
			//this._is_rendering_frame = false; //for safety, we setting to false 
			return;
		}

		//init frame
		this._is_rendering_frame = true;
		render_settings = render_settings || this.default_render_settings;
		this._current_render_settings = render_settings;
		this._current_scene = scene;
		this._main_camera = cameras ? cameras[0] : null;
		scene._frame += 1; //done at the beginning just in case it crashes
		this._frame += 1;
		scene._must_redraw = false;

		var start_time = getTime();
		this._frame_time = start_time - this._last_time;
		this._last_time = start_time;
		this._rendercalls = 0;
		this._rendered_instances = 0;
		this._rendered_passes = 0;
		this._global_shader_blocks.length = 0;
		this._global_shader_blocks_flags = 0;
		for(var i in this._global_textures)
			this._global_textures[i] = null;
		if(!this._current_pass)
			this._current_pass = COLOR_PASS;
		this._reverse_faces = false;

		//extract info about previous frame
		this.resolveQueries();

		//to restore from a possible exception (not fully tested, remove if problem)
		if(!render_settings.ignore_reset)
			LS.RenderFrameContext.reset();

		if(gl.canvas.canvas2DtoWebGL_enabled)
			gl.resetTransform(); //reset 

		LS.GUI.ResetImmediateGUI(true);//just to let the GUI ready

		//force fullscreen viewport
		if( !render_settings.keep_viewport )
		{
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight );
			this.setFullViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); //assign this as the full available viewport
		}
		else
			this.setFullViewport( gl.viewport_data );
		this._global_viewport.set( gl.viewport_data );

		//Event: beforeRender used in actions that could affect which info is collected for the rendering
		this.startGPUQuery( "beforeRender" );
		LEvent.trigger( scene, EVENT.BEFORE_RENDER, render_settings );
		this.endGPUQuery();

		//get render instances, cameras, lights, materials and all rendering info ready (computeVisibility)
		this.processVisibleData( scene, render_settings, cameras );

		//Define the main camera, the camera that should be the most important (used for LOD info, or shadowmaps)
		cameras = cameras && cameras.length ? cameras : scene._cameras;//this._visible_cameras;
		if(cameras.length == 0)
			throw("no cameras");
		this._visible_cameras = cameras; //the cameras being rendered
		this._main_camera = cameras[0];

		//Event: readyToRender when we have all the info to render
		LEvent.trigger( scene, EVENT.READY_TO_RENDER, render_settings );

		//remove the lights that do not lay in front of any camera (this way we avoid creating shadowmaps)
		//TODO

		//Event: renderShadowmaps helps to generate shadowMaps that need some camera info (which could be not accessible during processVisibleData)
		this.startGPUQuery("shadows");
		LEvent.trigger(scene, EVENT.RENDER_SHADOWS, render_settings );
		this.endGPUQuery();

		//Event: afterVisibility allows to cull objects according to the main camera
		LEvent.trigger(scene, EVENT.AFTER_VISIBILITY, render_settings );

		//Event: renderReflections in case some realtime reflections are needed, this is the moment to render them inside textures
		this.startGPUQuery("reflections");
		LEvent.trigger(scene, EVENT.RENDER_REFLECTIONS, render_settings );
		this.endGPUQuery();

		//Event: beforeRenderMainPass in case a last step is missing
		LEvent.trigger(scene, EVENT.BEFORE_RENDER_MAIN_PASS, render_settings );

		//enable global FX context
		if(render_settings.render_fx)
			LEvent.trigger( scene, EVENT.ENABLE_FRAME_CONTEXT, render_settings );

		//render what every camera can see
		if(this.onCustomRenderFrameCameras)
			this.onCustomRenderFrameCameras( cameras, render_settings );
		else
			this.renderFrameCameras( cameras, render_settings );

		//keep original viewport
		if( render_settings.keep_viewport )
			gl.setViewport( this._global_viewport );

		//disable and show final FX context
		if(render_settings.render_fx)
		{
			this.startGPUQuery("postpo");
			LEvent.trigger( scene, EVENT.SHOW_FRAME_CONTEXT, render_settings );
			this.endGPUQuery();
		}

		//renderGUI
		this.startGPUQuery("gui");
		this.renderGUI( render_settings );
		this.endGPUQuery();

		//profiling must go here
		this._frame_cpu_time = getTime() - start_time;
		if( LS.Draw ) //developers may decide not to include LS.Draw
			this._rendercalls += LS.Draw._rendercalls; LS.Draw._rendercalls = 0; //stats are not centralized

		//Event: afterRender to give closure to some actions
		LEvent.trigger( scene, EVENT.AFTER_RENDER, render_settings ); 
		this._is_rendering_frame = false;

		//coroutines
		LS.triggerCoroutines("render");

		if(this.render_profiler)
			this.renderProfiler();
	},

	/**
	* Calls renderFrame of every camera in the cameras list (triggering the appropiate events)
	*
	* @method renderFrameCameras
	* @param {Array} cameras
	* @param {RenderSettings} render_settings
	*/
	renderFrameCameras: function( cameras, render_settings )
	{
		var scene = this._current_scene;

		//for each camera
		for(var i = 0; i < cameras.length; ++i)
		{
			var current_camera = cameras[i];

			LEvent.trigger(scene, EVENT.BEFORE_RENDER_FRAME, render_settings );
			LEvent.trigger(current_camera, EVENT.BEFORE_RENDER_FRAME, render_settings );
			LEvent.trigger(current_camera, EVENT.ENABLE_FRAME_CONTEXT, render_settings );

			//main render
			this.startGPUQuery("main");
			if(this.onCustomRenderFrame)
				this.onCustomRenderFrame( current_camera, render_settings ); 
			else
				this.renderFrame( current_camera, render_settings ); 
			this.endGPUQuery();

			//show buffer on the screen
			this.startGPUQuery("postpo");
			LEvent.trigger(current_camera, EVENT.SHOW_FRAME_CONTEXT, render_settings );
			LEvent.trigger(current_camera, EVENT.AFTER_RENDER_FRAME, render_settings );
			LEvent.trigger(scene, EVENT.AFTER_RENDER_FRAME, render_settings );
			this.endGPUQuery();
		}
	},

	/**
	* renders the view from one camera to the current viewport (could be the screen or a texture)
	*
	* @method renderFrame
	* @param {Camera} camera 
	* @param {Object} render_settings [optional]
	* @param {Scene} scene [optional] this can be passed when we are rendering a different scene from LS.GlobalScene (used in renderMaterialPreview)
	*/
	renderFrame: function ( camera, render_settings, scene )
	{
		render_settings = render_settings || this.default_render_settings;

		//get all the data
		if(scene) //in case we use another scene than the default one
		{
			scene._frame++;
			this.processVisibleData( scene, render_settings );
		}
		this._current_scene = scene = scene || this._current_scene; //ugly, I know

		//set as active camera and set viewport
		this.enableCamera( camera, render_settings, render_settings.skip_viewport, scene ); 

		//clear buffer
		this.clearBuffer( camera, render_settings );

		//send before events
		LEvent.trigger(scene, EVENT.BEFORE_RENDER_SCENE, camera );
		LEvent.trigger(this, EVENT.BEFORE_RENDER_SCENE, camera );

		//in case the user wants to filter instances
		LEvent.trigger(this, EVENT.COMPUTE_VISIBILITY, this._visible_instances );

		//here we render all the instances
		if(this.onCustomRenderInstances)
			this.onCustomRenderInstances( render_settings, this._visible_instances );
		else
			this.renderInstances( render_settings, this._visible_instances );

		//send after events
		LEvent.trigger( scene, EVENT.AFTER_RENDER_SCENE, camera );
		LEvent.trigger( this, EVENT.AFTER_RENDER_SCENE, camera );
		if(this.onRenderScene)
			this.onRenderScene( camera, render_settings, scene);

		//render helpers (guizmos)
		if(render_settings.render_helpers)
		{
			if(GL.FBO.current) //rendering to multibuffer gives warnings if the shader outputs to a single fragColor
				GL.FBO.current.toSingle(); //so we disable multidraw for debug rendering (which uses a single render shader)
			LEvent.trigger(this, EVENT.RENDER_HELPERS, camera );
			LEvent.trigger(scene, EVENT.RENDER_HELPERS, camera );
			if(GL.FBO.current)
				GL.FBO.current.toMulti();
		}
	},

	//shows a RenderFrameContext to the viewport (warning, some components may do it bypassing this function)
	showRenderFrameContext: function( render_frame_context, camera )
	{
		//if( !this._current_render_settings.onPlayer)
		//	return;
		LEvent.trigger(this, EVENT.BEFORE_SHOW_FRAME_CONTEXT, render_frame_context );
		render_frame_context.show();
	},

	/**
	* Sets camera as the current camera, sets the viewport according to camera info, updates matrices, and prepares LS.Draw
	*
	* @method enableCamera
	* @param {Camera} camera
	* @param {RenderSettings} render_settings
	*/
	enableCamera: function(camera, render_settings, skip_viewport, scene )
	{
		scene = scene || this._current_scene || LS.GlobalScene;

		LEvent.trigger( camera, EVENT.BEFORE_CAMERA_ENABLED, render_settings );
		LEvent.trigger( scene, EVENT.BEFORE_CAMERA_ENABLED, camera );

		//assign viewport manually (shouldnt use camera.getLocalViewport to unify?)
		var startx = this._full_viewport[0];
		var starty = this._full_viewport[1];
		var width = this._full_viewport[2];
		var height = this._full_viewport[3];
		if(width == 0 && height == 0)
		{
			console.warn("enableCamera: full viewport was 0, assigning to full viewport");
			width = gl.viewport_data[2];
			height = gl.viewport_data[3];
		}

		var final_x = Math.floor(width * camera._viewport[0] + startx);
		var final_y = Math.floor(height * camera._viewport[1] + starty);
		var final_width = Math.ceil(width * camera._viewport[2]);
		var final_height = Math.ceil(height * camera._viewport[3]);

		if(!skip_viewport)
		{
			//force fullscreen viewport?
			if(render_settings && render_settings.ignore_viewports )
			{
				camera.final_aspect = this.global_aspect * camera._aspect * (width / height);
				gl.viewport( this._full_viewport[0], this._full_viewport[1], this._full_viewport[2], this._full_viewport[3] );
			}
			else
			{
				camera.final_aspect = this.global_aspect * camera._aspect * (final_width / final_height); //what if we want to change the aspect?
				gl.viewport( final_x, final_y, final_width, final_height );
			}
		}
		camera._last_viewport_in_pixels.set( gl.viewport_data );

		//recompute the matrices (view,proj and viewproj)
		camera.updateMatrices();

		//store matrices locally
		mat4.copy( this._view_matrix, camera._view_matrix );
		mat4.copy( this._projection_matrix, camera._projection_matrix );
		mat4.copy( this._viewprojection_matrix, camera._viewprojection_matrix );

		//safety in case something went wrong in the camera
		for(var i = 0; i < 16; ++i)
			if( isNaN( this._viewprojection_matrix[i] ) )
				console.warn("warning: viewprojection matrix contains NaN when enableCamera is used");

		//2D Camera: TODO: MOVE THIS SOMEWHERE ELSE
		mat4.ortho( this._2Dviewprojection_matrix, -1, 1, -1, 1, 1, -1 );

		//set as the current camera
		this._current_camera = camera;
		LS.Camera.current = camera;
		this._current_layers_filter = render_settings ? camera.layers & render_settings.layers : camera.layers;

		//Draw allows to render debug info easily
		if(LS.Draw)
		{
			LS.Draw.reset(); //clear 
			LS.Draw.setCamera( camera );
		}

		LEvent.trigger( camera, EVENT.AFTER_CAMERA_ENABLED, render_settings );
		LEvent.trigger( scene, EVENT.AFTER_CAMERA_ENABLED, camera ); //used to change stuff according to the current camera (reflection textures)
	},

	/**
	* Returns the camera active
	*
	* @method getCurrentCamera
	* @return {Camera} camera
	*/
	getCurrentCamera: function()
	{
		return this._current_camera;
	},

	/**
	* clear color using camera info ( background color, viewport scissors, clear depth, etc )
	*
	* @method clearBuffer
	* @param {Camera} camera
	* @param {LS.RenderSettings} render_settings
	*/
	clearBuffer: function( camera, render_settings )
	{
		if( render_settings.ignore_clear || (!camera.clear_color && !camera.clear_depth) )
			return;

		//scissors test for the gl.clear, otherwise the clear affects the full viewport
		gl.scissor( gl.viewport_data[0], gl.viewport_data[1], gl.viewport_data[2], gl.viewport_data[3] );
		gl.enable(gl.SCISSOR_TEST);

		//clear color buffer 
		gl.colorMask( true, true, true, true );
		gl.clearColor( camera.background_color[0], camera.background_color[1], camera.background_color[2], camera.background_color[3] );

		//clear depth buffer
		gl.depthMask( true );

		//to clear the stencil
		gl.enable( gl.STENCIL_TEST );
		gl.clearStencil( 0x0 );

		//do the clearing
		if(GL.FBO.current)
			GL.FBO.current.toSingle();
		gl.clear( ( camera.clear_color ? gl.COLOR_BUFFER_BIT : 0) | (camera.clear_depth ? gl.DEPTH_BUFFER_BIT : 0) | gl.STENCIL_BUFFER_BIT );
		if(GL.FBO.current)
			GL.FBO.current.toMulti();

		//in case of multibuffer we want to clear with black the secondary buffers with black
		if( GL.FBO.current )
			GL.FBO.current.clearSecondary( LS.ZEROS4 );
		/*
		if( fbo && fbo.color_textures.length > 1 && gl.extensions.WEBGL_draw_buffers )
		{
			var ext = gl.extensions.WEBGL_draw_buffers;
			var new_order = [gl.NONE];
			for(var i = 1; i < fbo.order.length; ++i)
				new_order.push(fbo.order[i]);
			ext.drawBuffersWEBGL( new_order );
			gl.clearColor( 0,0,0,0 );
			gl.clear( gl.COLOR_BUFFER_BIT );
			GL.FBO.current.toMulti();
		}
		*/

		gl.disable( gl.SCISSOR_TEST );
		gl.disable( gl.STENCIL_TEST );
	},

	//creates the separate render queues for every block of instances
	createRenderQueues: function()
	{
		this._queues.length = 0;

		this._renderqueue_background = this.addRenderQueue( new LS.RenderQueue( LS.RenderQueue.BACKGROUND, LS.RenderQueue.NO_SORT, { name: "BACKGROUND" } ));
		this._renderqueue_geometry = this.addRenderQueue( new LS.RenderQueue( LS.RenderQueue.GEOMETRY, LS.RenderQueue.SORT_NEAR_TO_FAR, { name: "GEOMETRY" } ));
		this._renderqueue_transparent = this.addRenderQueue( new LS.RenderQueue( LS.RenderQueue.TRANSPARENT, LS.RenderQueue.SORT_FAR_TO_NEAR, { name: "TRANSPARENT" } ));
		this._renderqueue_readback = this.addRenderQueue( new LS.RenderQueue( LS.RenderQueue.READBACK_COLOR, LS.RenderQueue.SORT_FAR_TO_NEAR , { must_clone_buffers: true, name: "READBACK" }));
		this._renderqueue_overlay = this.addRenderQueue( new LS.RenderQueue( LS.RenderQueue.OVERLAY, LS.RenderQueue.SORT_BY_PRIORITY, { name: "OVERLAY" }));
	},

	addRenderQueue: function( queue )
	{
		var index = Math.floor(queue.value * 0.1);
		if( this._queues[ index ] )
			console.warn("Overwritting render queue:", queue.name );
		this._queues[ index ] = queue;
		return queue;
	},

	//clears render queues and inserts objects according to their settings
	updateRenderQueues: function( camera, instances )
	{
		//compute distance to camera
		var camera_eye = camera.getEye( this._temp_cameye );
		for(var i = 0, l = instances.length; i < l; ++i)
		{
			var instance = instances[i];
			if(instance)
				instance._dist = vec3.dist( instance.center, camera_eye );
		}

		var queues = this._queues;

		//clear render queues
		for(var i = 0; i < queues.length; ++i)
			if(queues[i])
				queues[i].clear();

		//add to their queues
		for(var i = 0, l = instances.length; i < l; ++i)
		{
			var instance = instances[i];
			if( !instance || !instance.material || !instance._is_visible )
				continue;
			this.addInstanceToQueue( instance );
		}

		//sort queues
		for(var i = 0, l = queues.length; i < l; ++i)
		{
			var queue = queues[i];
			if(!queue || !queue.sort_mode || !queue.instances.length)
				continue;
			queue.sort();
		}
	},

	addInstanceToQueue: function(instance)
	{
		var queues = this._queues;
		var queue = null;
		var queue_index = -1;

		if( instance.material.queue == RenderQueue.AUTO || instance.material.queue == null ) 
		{
			if( instance.material._render_state.blend )
				queue = this._renderqueue_transparent;
			else
				queue = this._renderqueue_geometry;
		}
		else
		{
			//queue index use the tens digit
			queue_index = Math.floor( instance.material.queue * 0.1 );
			queue = queues[ queue_index ];
		}

		if( !queue ) //create new queue
		{
			queue = new LS.RenderQueue( queue_index * 10 + 5, LS.RenderQueue.NO_SORT );
			queues[ queue_index ] = queue;
		}

		if(queue)
			queue.add( instance );
		return queue;
	},

	/**
	* To set gl state to a known and constant state in every render pass
	*
	* @method resetGLState
	* @param {RenderSettings} render_settings
	*/
	resetGLState: function( render_settings )
	{
		render_settings = render_settings || this._current_render_settings;

		//maybe we should use this function instead
		//LS.RenderState.reset(); 

		gl.enable( gl.CULL_FACE );
		gl.frontFace(gl.CCW);

		gl.colorMask(true,true,true,true);

		gl.enable( gl.DEPTH_TEST );
		gl.depthFunc( gl.LESS );
		gl.depthMask(true);

		gl.disable( gl.BLEND );
		gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

		gl.disable( gl.STENCIL_TEST );
		gl.stencilMask( 0xFF );
		gl.stencilOp( gl.KEEP, gl.KEEP, gl.KEEP );
		gl.stencilFunc( gl.ALWAYS, 1, 0xFF );
	},

	/**
	* Calls the render method for every RenderInstance (it also takes into account events and frustrum culling)
	*
	* @method renderInstances
	* @param {RenderSettings} render_settings
	* @param {Array} instances array of RIs, if not specified the last visible_instances are rendered
	*/
	renderInstances: function( render_settings, instances, scene )
	{
		scene = scene || this._current_scene;
		if(!scene)
		{
			console.warn("LS.Renderer.renderInstances: no scene found in LS.Renderer._current_scene");
			return 0;
		}

		this._rendered_passes += 1;

		var pass = this._current_pass;
		var camera = this._current_camera;
		var camera_index_flag = camera._rendering_index != -1 ? (1<<(camera._rendering_index)) : 0;
		var apply_frustum_culling = render_settings.frustum_culling;
		var frustum_planes = camera.updateFrustumPlanes();
		var layers_filter = this._current_layers_filter = camera.layers & render_settings.layers;

		LEvent.trigger( scene, EVENT.BEFORE_RENDER_INSTANCES, render_settings );
		//scene.triggerInNodes( EVENT.BEFORE_RENDER_INSTANCES, render_settings );

		//reset state of everything!
		this.resetGLState( render_settings );

		LEvent.trigger( scene, EVENT.RENDER_INSTANCES, render_settings );
		LEvent.trigger( this, EVENT.RENDER_INSTANCES, render_settings );

		//reset again!
		this.resetGLState( render_settings );

		/*
		var render_instance_func = pass.render_instance;
		if(!render_instance_func)
			return 0;
		*/

		var render_instances = instances || this._visible_instances;

		//global samplers
		this.bindSamplers( this._samplers );

		var instancing_data = this._instancing_data;

		//compute visibility pass: checks which RIs are visible from this camera according to its flags, layers and AABB
		for(var i = 0, l = render_instances.length; i < l; ++i)
		{
			//render instance
			var instance = render_instances[i];
			var node_flags = instance.node.flags;
			instance._is_visible = false;

			//hidden nodes
			if( pass == SHADOW_PASS && !(instance.material.flags.cast_shadows) )
				continue;
			if( pass == PICKING_PASS && node_flags.selectable === false )
				continue;
			if( (layers_filter & instance.layers) === 0 )
				continue;

			//done here because sometimes some nodes are moved in this action
			if(instance.onPreRender)
				if( instance.onPreRender( render_settings ) === false)
					continue;

			if(!instance.material) //in case something went wrong...
				continue;

			var material = camera._overwrite_material || instance.material;

			if(material.opacity <= 0) //TODO: remove this, do it somewhere else
				continue;

			//test visibility against camera frustum
			if( apply_frustum_culling && instance.use_bounding && !material.flags.ignore_frustum )
			{
				if(geo.frustumTestBox( frustum_planes, instance.aabb ) == CLIP_OUTSIDE )
					continue;
			}

			//save visibility info
			instance._is_visible = true;
			if(camera_index_flag) //shadowmap cameras dont have an index
				instance._camera_visibility |= camera_index_flag;
		}

		//separate in render queues, and sort them according to distance or priority
		this.updateRenderQueues( camera, render_instances, render_settings );

		var start = this._rendered_instances;
		var debug_instance = this._debug_instance;

		//process render queues
		for(var j = 0; j < this._queues.length; ++j)
		{
			var queue = this._queues[j];
			if(!queue || !queue.instances.length || !queue.enabled) //empty
				continue;

			//used to change RenderFrameContext stuff (cloning textures for refraction, etc)
			if(queue.start( pass, render_settings ) == false)
				continue;

			var render_instances = queue.instances;

			//for each render instance
			for(var i = 0, l = render_instances.length; i < l; ++i)
			{
				//render instance
				var instance = render_instances[i];

				//used to debug
				if(instance == debug_instance)
				{
					console.log(debug_instance);
					debugger; 
				}

				if( !instance._is_visible || !instance.mesh )
					continue;

				this._rendered_instances += 1;

				var material = camera._overwrite_material || instance.material;

				if( pass == PICKING_PASS && material.renderPickingInstance )
					material.renderPickingInstance( instance, render_settings, pass );
				else if( material.renderInstance )
					material.renderInstance( instance, render_settings, pass );
				else
					continue;

				//some instances do a post render action (DEPRECATED)
				if(instance.onPostRender)
					instance.onPostRender( render_settings );
			}

			queue.finish( pass, render_settings );
		}

		this.resetGLState( render_settings );

		LEvent.trigger( scene, EVENT.RENDER_SCREEN_SPACE, render_settings);

		//restore state
		this.resetGLState( render_settings );

		LEvent.trigger( scene, EVENT.AFTER_RENDER_INSTANCES, render_settings );
		LEvent.trigger( this, EVENT.AFTER_RENDER_INSTANCES, render_settings );

		//and finally again
		this.resetGLState( render_settings );

		return this._rendered_instances - start;
	},

	/*
	groupingInstances: function(instances)
	{
		//TODO: if material supports instancing WIP
		var instancing_supported = gl.webgl_version > 1 || gl.extensions["ANGLE_instanced_arrays"];
		if( instancing_supported && material._allows_instancing && !instance._shader_blocks.length )
		{
			var instancing_ri_info = null;
			if(!instancing_data[ material._index ] )
				instancing_data[ material._index ] = instancing_ri_info = [];
			instancing_ri_info.push( instance );
		}
	},
	*/

	renderGUI: function( render_settings )
	{
		//renders GUI items using mostly the Canvas2DtoWebGL library
		gl.viewport( this._full_viewport[0], this._full_viewport[1], this._full_viewport[2], this._full_viewport[3] ); //assign full viewport always?
		if(gl.start2D) //in case we have Canvas2DtoWebGL installed (it is optional)
			gl.start2D();
		if( render_settings.render_gui )
		{
			if( LEvent.hasBind( this._current_scene, EVENT.RENDER_GUI ) ) //to avoid forcing a redraw if no gui is set
			{
				if(LS.GUI)
					LS.GUI.ResetImmediateGUI(); //mostly to change the cursor (warning, true to avoid forcing redraw)
				LEvent.trigger( this._current_scene, EVENT.RENDER_GUI, gl );
			}
		}
		if( this.on_render_gui ) //used by the editor (here to ignore render_gui flag)
			this.on_render_gui( render_settings );
		if( gl.finish2D )
			gl.finish2D();
	},

	/**
	* returns a list of all the lights overlapping this instance (it uses sperical bounding so it could returns lights that are not really overlapping)
	* It is used by the multipass lighting to iterate 
	*
	* @method getNearLights
	* @param {RenderInstance} instance the render instance
	* @param {Array} result [optional] the output array
	* @return {Array} array containing a list of LS.Light affecting this RenderInstance
	*/
	getNearLights: function( instance, result )
	{
		result = result || [];

		result.length = 0; //clear old lights

		//it uses the lights gathered by prepareVisibleData
		var lights = this._active_lights;
		if(!lights || !lights.length)
			return result;

		//Compute lights affecting this RI (by proximity, only takes into account spherical bounding)
		result.length = 0;
		var numLights = lights.length;
		for(var j = 0; j < numLights; j++)
		{
			var light = lights[j];
			//same layer?
			if( (light.illuminated_layers & instance.layers) == 0 || (light.illuminated_layers & this._current_camera.layers) == 0)
				continue;
			var light_intensity = light.computeLightIntensity();
			//light intensity too low?
			if(light_intensity < 0.0001)
				continue;
			var light_radius = light.computeLightRadius();
			var light_pos = light.position;
			//overlapping?
			if( light_radius == -1 || instance.overlapsSphere( light_pos, light_radius ) )
				result.push( light );
		}

		return result;
	},

	regenerateShadowmaps: function( scene, render_settings )
	{
		scene = scene || this._current_scene;
		render_settings = render_settings || this.default_render_settings;
		LEvent.trigger( scene, EVENT.RENDER_SHADOWS, render_settings );
		for(var i = 0; i < this._active_lights.length; ++i)
		{
			var light = this._active_lights[i];
			light.prepare( render_settings );
			light.onGenerateShadowmap();
		}
	},

	mergeSamplers: function( samplers, result )
	{
		result = result || [];
		result.length = this._max_texture_units;

		for(var i = 0; i < result.length; ++i)
		{
			for(var j = samplers.length - 1; j >= 0; --j)
			{
				if(	samplers[j][i] )
				{
					result[i] = samplers[j][i];
					break;
				}
			}
		}

		return result;
	},

	//to be sure we dont have anything binded
	clearSamplers: function()
	{
		for(var i = 0; i < this._max_texture_units; ++i)
		{
			gl.activeTexture(gl.TEXTURE0 + i);
			gl.bindTexture( gl.TEXTURE_2D, null );
			gl.bindTexture( gl.TEXTURE_CUBE_MAP, null );
			this._active_samples[i] = null;
		}
	},

	bindSamplers: function( samplers )
	{
		if(!samplers)
			return;

		var allow_textures = this.allow_textures; //used for debug

		for(var slot = 0; slot < samplers.length; ++slot)
		{
			var sampler = samplers[slot];
			if(!sampler) 
				continue;

			//REFACTOR THIS
			var tex = null;
			if(sampler.constructor === String || sampler.constructor === GL.Texture) //old way
			{
				tex = sampler;
				sampler = null;
			}
			else if(sampler.texture)
				tex = sampler.texture;
			else //dont know what this var type is?
			{
				//continue; //if we continue the sampler slot will remain empty which could lead to problems
			}

			if( tex && tex.constructor === String)
				tex = LS.ResourcesManager.textures[ tex ];
			if(!allow_textures)
				tex = null;

			if(!tex)
			{
				if(sampler)
				{
					switch( sampler.missing )
					{
						case "black": tex = this._black_texture; break;
						case "white": tex = this._white_texture; break;
						case "gray": tex = this._gray_texture; break;
						case "normal": tex = this._normal_texture; break;
						case "cubemap": tex = this._white_cubemap_texture; break;
						default: 
							if(sampler.is_cubemap) //must be manually specified
								tex = this._white_cubemap_texture;
							else
								tex = this._missing_texture;
					}
				}
				else
					tex = this._missing_texture;
			}

			//avoid to read from the same texture we are rendering to (generates warnings)
			if(tex._in_current_fbo) 
				tex = this._missing_texture;

			tex.bind( slot );
			this._active_samples[slot] = tex;

			//texture properties
			if(sampler)// && sampler._must_update ) //disabled because samplers ALWAYS must set to the value, in case the same texture is used in several places in the scene
			{
				if(sampler.minFilter)
				{
					if( sampler.minFilter !== gl.LINEAR_MIPMAP_LINEAR || (GL.isPowerOfTwo( tex.width ) && GL.isPowerOfTwo( tex.height )) )
						gl.texParameteri(tex.texture_type, gl.TEXTURE_MIN_FILTER, sampler.minFilter);
				}
				if(sampler.magFilter)
					gl.texParameteri(tex.texture_type, gl.TEXTURE_MAG_FILTER, sampler.magFilter);
				if(sampler.wrap)
				{
					gl.texParameteri(tex.texture_type, gl.TEXTURE_WRAP_S, sampler.wrap);
					gl.texParameteri(tex.texture_type, gl.TEXTURE_WRAP_T, sampler.wrap);
				}
				if(sampler.anisotropic != null && gl.extensions.EXT_texture_filter_anisotropic )
					gl.texParameteri(tex.texture_type, gl.extensions.EXT_texture_filter_anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, sampler.anisotropic );

				//sRGB textures must specified ON CREATION, so no
				//if(sampler.anisotropic != null && gl.extensions.EXT_sRGB )
				//sampler._must_update = false;
			}
		}
	},

	//Called at the beginning of processVisibleData 
	fillSceneUniforms: function( scene, render_settings )
	{
		//global uniforms
		var uniforms = scene._uniforms;
		uniforms.u_time = scene._time || getTime() * 0.001;
		uniforms.u_ambient_light = scene.info ? scene.info.ambient_color : vec3.create();

		this._samplers.length = 0;

		//clear globals
		this._global_textures.environment = null;

		//fetch global textures
		if(scene.info)
		for(var i in scene.info.textures)
		{
			var texture = LS.getTexture( scene.info.textures[i] );
			if(!texture)
				continue;

			var slot = 0;
			if( i == "environment" )
				slot = LS.Renderer.ENVIRONMENT_TEXTURE_SLOT;
			else
				continue; 

			var type = (texture.texture_type == gl.TEXTURE_2D ? "_texture" : "_cubemap");
			if(texture.texture_type == gl.TEXTURE_2D)
			{
				texture.bind(0);
				texture.setParameter( gl.TEXTURE_MIN_FILTER, gl.LINEAR ); //avoid artifact
			}
			this._samplers[ slot ] = texture;
			scene._uniforms[ i + "_texture" ] = slot; 
			scene._uniforms[ i + type ] = slot; //LEGACY

			if( i == "environment" )
				this._global_textures.environment = texture;
		}

		LEvent.trigger( scene, EVENT.FILL_SCENE_UNIFORMS, scene._uniforms );
	},	

	/**
	* Collects and process the rendering instances, cameras and lights that are visible
	* Its a prepass shared among all rendering passes
	* Called ONCE per frame from LS.Renderer.render before iterating cameras
	* Warning: rendering order is computed here, so it is shared among all the cameras (TO DO, move somewhere else)
	*
	* @method processVisibleData
	* @param {Scene} scene
	* @param {RenderSettings} render_settings
	* @param {Array} cameras in case you dont want to use the scene cameras
	*/
	processVisibleData: function( scene, render_settings, cameras, instances, skip_collect_data )
	{
		//options = options || {};
		//options.scene = scene;
		var frame = scene._frame;
		instances = instances || scene._instances;

		this._current_scene = scene;
		//compute global scene info
		this.fillSceneUniforms( scene, render_settings );

		//update info about scene (collecting it all or reusing the one collected in the frame before)
		if(!skip_collect_data)
		{
			if( this._frame % this._collect_frequency == 0)
				scene.collectData( cameras );
			LEvent.trigger( scene, EVENT.AFTER_COLLECT_DATA, scene );
		}

		//set cameras: use the parameters ones or the ones found in the scene
		cameras = (cameras && cameras.length) ? cameras : scene._cameras;
		if( cameras.length == 0 )
		{
			console.error("no cameras found");
			return;
		}
				
		//find which materials are going to be seen
		var materials = this._visible_materials; 
		materials.length = 0;

		//prepare cameras: TODO: sort by priority
		for(var i = 0, l = cameras.length; i < l; ++i)
		{
			var camera = cameras[i];
			camera._rendering_index = i;
			camera.prepare();
			if(camera.overwrite_material)
			{
				var material = camera.overwrite_material.constructor === String ? LS.ResourcesManager.resources[ camera.overwrite_material ] : camera.overwrite_material;
				if(material)
				{
					camera._overwrite_material = material;
					materials.push( material );
				}
			}
			else
				camera._overwrite_material = null;
		}

		//define the main camera (the camera used for some algorithms)
		if(!this._main_camera)
		{
			if( cameras.length )
				this._main_camera = cameras[0];
			else
				this._main_camera = new LS.Camera(); // ??
		}

		//nearest reflection probe to camera
		var nearest_reflection_probe = scene.findNearestReflectionProbe( this._main_camera.getEye() );

		//process instances
		this.processRenderInstances( instances, materials, scene, render_settings );

		//store all the info
		this._visible_instances = scene._instances;
		this._active_lights = scene._lights;
		this._visible_cameras = cameras; 
		//this._visible_materials = materials;

		//prepare lights (collect data and generate shadowmaps)
		for(var i = 0, l = this._active_lights.length; i < l; ++i)
			this._active_lights[i].prepare( render_settings );

		LEvent.trigger( scene, EVENT.AFTER_COLLECT_DATA, scene );
	},

	//this processes the instances 
	processRenderInstances: function( instances, materials, scene, render_settings )
	{
		materials = materials || this._visible_materials;
		var frame = scene._frame;
		render_settings = render_settings || this._current_render_settings;

		//process render instances (add stuff if needed, gather materials)
		for(var i = 0, l = instances.length; i < l; ++i)
		{
			var instance = instances[i];
			if(!instance)
				continue;

			var node_flags = instance.node.flags;

			if(!instance.mesh)
			{
				console.warn("RenderInstance must always have mesh");
				continue;
			}

			//materials
			if(!instance.material)
				instance.material = this.default_material;

			if( instance.material._last_frame_update != frame )
			{
				instance.material._last_frame_update = frame;
				materials.push( instance.material );
			}

			//add extra info: distance to main camera (used for sorting)
			instance._dist = 0;

			//find nearest reflection probe
			if( scene._reflection_probes.length && !this._ignore_reflection_probes )
				instance._nearest_reflection_probe = scene.findNearestReflectionProbe( instance.center ); //nearest_reflection_probe;
			else
				instance._nearest_reflection_probe = null;

			//change conditionaly
			if(render_settings.force_wireframe && instance.primitive != gl.LINES ) 
			{
				instance.primitive = gl.LINES;
				if(instance.mesh)
				{
					if(!instance.mesh.indexBuffers["wireframe"])
						instance.mesh.computeWireframe();
					instance.index_buffer = instance.mesh.indexBuffers["wireframe"];
				}
			}

			//clear camera visibility mask (every flag represents a camera index)
			instance._camera_visibility = 0|0;
			instance.index = i;
		}

		//prepare materials 
		for(var i = 0; i < materials.length; ++i)
		{
			var material = materials[i];
			material._index = i;
			if( material.prepare )
				material.prepare( scene );
		}

		LEvent.trigger( scene, EVENT.PREPARE_MATERIALS );
	},

	/**
	* Renders a frame into a texture (could be a cubemap, in which case does the six passes)
	*
	* @method renderInstancesToRT
	* @param {Camera} cam
	* @param {Texture} texture
	* @param {RenderSettings} render_settings
	*/
	renderInstancesToRT: function( cam, texture, render_settings, instances )
	{
		render_settings = render_settings || this.default_render_settings;
		this._current_target = texture;
		var scene = LS.Renderer._current_scene;
		texture._in_current_fbo = true;

		if(texture.texture_type == gl.TEXTURE_2D)
		{
			this.enableCamera(cam, render_settings);
			texture.drawTo( inner_draw_2d );
		}
		else if( texture.texture_type == gl.TEXTURE_CUBE_MAP)
			this.renderToCubemap( cam.getEye(), texture.width, texture, render_settings, cam.near, cam.far );
		this._current_target = null;
		texture._in_current_fbo = false;

		function inner_draw_2d()
		{
			LS.Renderer.clearBuffer( cam, render_settings );
			/*
			gl.clearColor(cam.background_color[0], cam.background_color[1], cam.background_color[2], cam.background_color[3] );
			if(render_settings.ignore_clear != true)
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			*/
			//render scene
			LS.Renderer.renderInstances( render_settings, instances );
		}
	},

	/**
	* Renders the current scene to a cubemap centered in the given position
	*
	* @method renderToCubemap
	* @param {vec3} position center of the camera where to render the cubemap
	* @param {number} size texture size
	* @param {Texture} texture to reuse the same texture
	* @param {RenderSettings} render_settings
	* @param {number} near
	* @param {number} far
	* @return {Texture} the resulting texture
	*/
	renderToCubemap: function( position, size, texture, render_settings, near, far, background_color, instances )
	{
		size = size || 256;
		near = near || 1;
		far = far || 1000;

		if(render_settings && render_settings.constructor !== LS.RenderSettings)
			throw("render_settings parameter must be LS.RenderSettings.");

		var eye = position;
		if( !texture || texture.constructor != GL.Texture)
			texture = null;

		var scene = this._current_scene;
		if(!scene)
			scene = this._current_scene = LS.GlobalScene;

		var camera = this._cubemap_camera;
		if(!camera)
			camera = this._cubemap_camera = new LS.Camera();
		camera.configure({ fov: 90, aspect: 1.0, near: near, far: far });

		texture = texture || new GL.Texture(size,size,{texture_type: gl.TEXTURE_CUBE_MAP, minFilter: gl.NEAREST});
		this._current_target = texture;
		texture._in_current_fbo = true; //block binding this texture during rendering of the reflection

		texture.drawTo( function(texture, side) {

			var info = LS.Camera.cubemap_camera_parameters[side];
			if(texture._is_shadowmap || !background_color )
				gl.clearColor(0,0,0,0);
			else
				gl.clearColor( background_color[0], background_color[1], background_color[2], background_color[3] );
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			camera.configure({ eye: eye, center: [ eye[0] + info.dir[0], eye[1] + info.dir[1], eye[2] + info.dir[2]], up: info.up });

			LS.Renderer.enableCamera( camera, render_settings, true );
			LS.Renderer.renderInstances( render_settings, instances, scene );
		});

		this._current_target = null;
		texture._in_current_fbo = false;
		return texture;
	},

	/**
	* Returns the last camera that falls into a given screen position
	*
	* @method getCameraAtPosition
	* @param {number} x in canvas coordinates (0,0 is bottom-left)
	* @param {number} y in canvas coordinates (0,0 is bottom-left)
	* @param {Scene} scene if not specified last rendered scene will be used
	* @return {Camera} the camera
	*/
	getCameraAtPosition: function(x,y, cameras)
	{
		cameras = cameras || this._visible_cameras;
		if(!cameras || !cameras.length)
			return null;

		for(var i = cameras.length - 1; i >= 0; --i)
		{
			var camera = cameras[i];
			if(!camera.enabled || camera.render_to_texture)
				continue;

			if( camera.isPoint2DInCameraViewport(x,y) )
				return camera;
		}
		return null;
	},

	setRenderPass: function( pass )
	{
		if(!pass)
			pass = COLOR_PASS;
		this._current_pass = pass;
	},

	addImmediateRenderInstance: function( instance )
	{
		if(!instance.material)
			return;

		//this is done in collect so...
		instance.updateAABB(); 

		//add material to the list of visible materials
		if( instance.material._last_frame_update != this._frame )
		{
			instance.material._last_frame_update = this._frame;
			this._visible_materials.push( instance.material );
			if( instance.material.prepare )
				instance.material.prepare( this._current_scene );
		}

		this.addInstanceToQueue( instance );

		this._visible_instances.push( instance );
	},
	
	/**
	* Enables a ShaderBlock ONLY DURING THIS FRAME
	* must be called during frame rendering (event like fillSceneUniforms)
	*
	* @method enableFrameShaderBlock
	* @param {String} shader_block_name
	*/
	enableFrameShaderBlock: function( shader_block_name, uniforms, samplers )
	{
		var shader_block = shader_block_name.constructor === LS.ShaderBlock ? shader_block_name : LS.Shaders.getShaderBlock( shader_block_name );

		if( !shader_block || this._global_shader_blocks_flags & shader_block.flag_mask )
			return; //already added

		this._global_shader_blocks.push( shader_block );
		this._global_shader_blocks_flags |= shader_block.flag_mask;

		//add uniforms to renderer uniforms?
		if(uniforms)
			for(var i in uniforms)
				this._uniforms[i] = uniforms[i];

		if(samplers)
			for(var i = 0; i < samplers.length; ++i)
				if( samplers[i] )
					this._samplers[i] = samplers[i];
	},

	/**
	* Disables a ShaderBlock ONLY DURING THIS FRAME
	* must be called during frame rendering (event like fillSceneUniforms)
	*
	* @method disableFrameShaderBlock
	* @param {String} shader_block_name
	*/
	disableFrameShaderBlock:  function( shader_block_name, uniforms, samplers )
	{
		var shader_block = shader_block_name.constructor === LS.ShaderBlock ? shader_block_name : LS.Shaders.getShaderBlock( shader_block_name );
		if( !shader_block || !(this._global_shader_blocks_flags & shader_block.flag_mask) )
			return; //not active

		var index = this._global_shader_blocks.indexOf( shader_block );
		if(index != -1)
			this._global_shader_blocks.splice( index, 1 );
		this._global_shader_blocks_flags &= ~( shader_block.flag_mask ); //disable bit
	},

	//time queries for profiling
	_current_query: null,

	startGPUQuery: function( name )
	{
		if(!gl.extensions["disjoint_timer_query"] || !this.timer_queries_enabled) //if not supported
			return;
		if(this._waiting_queries)
			return;
		var ext = gl.extensions["disjoint_timer_query"];
		var query = this._timer_queries[ name ];
		if(!query)
			query = this._timer_queries[ name ] = ext.createQueryEXT();
		ext.beginQueryEXT( ext.TIME_ELAPSED_EXT, query );
		this._current_query = query;
	},

	endGPUQuery: function()
	{
		if(!gl.extensions["disjoint_timer_query"] || !this.timer_queries_enabled) //if not supported
			return;
		if(this._waiting_queries)
			return;
		var ext = gl.extensions["disjoint_timer_query"];
		ext.endQueryEXT( ext.TIME_ELAPSED_EXT );
		this._current_query = null;
	},

	resolveQueries: function()
	{
		if(!gl.extensions["disjoint_timer_query"] || !this.timer_queries_enabled) //if not supported
			return;

		//var err = gl.getError();
		//if(err != gl.NO_ERROR)
		//	console.log("GL_ERROR: " + err );

		var ext = gl.extensions["disjoint_timer_query"];

		var last_query = this._timer_queries["gui"];
		if(!last_query)
			return;

		var available = ext.getQueryObjectEXT( last_query, ext.QUERY_RESULT_AVAILABLE_EXT );
		if(!available)
		{
			this._waiting_queries = true;
			return;
		}
	
		var disjoint = gl.getParameter( ext.GPU_DISJOINT_EXT );
		if(!disjoint)
		{
			var total = 0;
			for(var i in this._timer_queries)
			{
				var query = this._timer_queries[i];
				// See how much time the rendering of the object took in nanoseconds.
				var timeElapsed = ext.getQueryObjectEXT( query, ext.QUERY_RESULT_EXT ) * 10e-6; //to milliseconds;
				total += timeElapsed;
				this.gpu_times[ i ] = timeElapsed;
				//ext.deleteQueryEXT(query);
				//this._timer_queries[i] = null;
			}
			this.gpu_times.total = total;
		}

		this._waiting_queries = false;
	},

	profiler_text: [],

	renderProfiler: function()
	{
		if(!gl.canvas.canvas2DtoWebGL_enabled)
			return;

		var text = this.profiler_text;
		var ext = gl.extensions["disjoint_timer_query"];

		if(this._frame % 5 == 0)
		{
			text.length = 0;
			var fps = 1000 / this._frame_time;
			text.push( fps.toFixed(2) + " FPS" );
			text.push( "CPU: " + this._frame_cpu_time.toFixed(2) + " ms" );
			text.push( " - Passes: " + this._rendered_passes );
			text.push( " - RIs: " + this._rendered_instances );
			text.push( " - Draws: " + this._rendercalls );

			if( ext )
			{
				text.push( "GPU: " + this.gpu_times.total.toFixed(2) );
				text.push( " - PreRender: " + this.gpu_times.beforeRender.toFixed(2) );
				text.push( " - Shadows: " + this.gpu_times.shadows.toFixed(2) );
				text.push( " - Reflections: " + this.gpu_times.reflections.toFixed(2) );
				text.push( " - Scene: " + this.gpu_times.main.toFixed(2) );
				text.push( " - Postpo: " + this.gpu_times.postpo.toFixed(2) );
				text.push( " - GUI: " + this.gpu_times.gui.toFixed(2) );
			}
			else
				text.push( "GPU: ???");
		}

		var ctx = gl;
		ctx.save();
		ctx.translate( gl.canvas.width - 200, gl.canvas.height - 280 );
		ctx.globalAlpha = 0.7;
		ctx.font = "14px Tahoma";
		ctx.fillStyle = "black";
		ctx.fillRect(0,0,200,280);
		ctx.fillStyle = "white";
		ctx.fillText( "Profiler", 20, 20 );
		ctx.fillStyle = "#AFA";
		for(var i = 0; i < text.length; ++i)
			ctx.fillText( text[i], 20,50 + 20 * i );
		ctx.restore();
	},

	/**
	* Renders one texture into another texture, it allows to apply a shader
	*
	* @method blit
	* @param {GL.Texture} source
	* @param {GL.Texture} destination
	* @param {GL.Shader} shader [optional] shader to apply, it must use the GL.Shader.QUAD_VERTEX_SHADER as vertex shader
	* @param {Object} uniforms [optional] uniforms for the shader
	*/
	blit: function( source, destination, shader, uniforms )
	{
		if(!source || !destination)
			throw("data missing in blit");

		if(source != destination)
		{
			destination.drawTo( function(){
				source.toViewport( shader, uniforms );
			});
			return;
		}

		if(!shader)
			throw("blitting texture to the same texture doesnt makes sense unless a shader is specified");

		var temp = GL.Texture.getTemporary( source.width, source.height, source );
		source.copyTo( temp );
		temp.copyTo( source, shader, uniforms );
		GL.Texture.releaseTemporary( temp );
	}
};


///@FILE:../src/render/debug.js
///@INFO: UNCOMMON
/**	DebugRender
* Used to render debug information like skeletons, a grid, etc
* I moved it from WebGLStudio to LS so it could help when working with scenes coded without the editor
*
* @class DebugRender
* @namespace LS
* @constructor
*/
function DebugRender()
{
	this.debug_points = []; //used for debugging, allows to draw points easily

	//current frame data to render (we store it so we can render with less drawcalls)
	this._points = []; //linear array with x,y,z, x,y,z, ...
	this._points_color = [];
	this._points_nodepth = []; //linear array with x,y,z, x,y,z, ...
	this._points_color_nodepth = [];
	this._lines = []; //vec3,vec3 array
	this._lines_color = []; //
	this._names = []; //array of [vec3, string]

	this.grid_texture_url = "imgs/grid.png";

	//this camera is used to render names
	this.camera2D = new LS.Camera({eye:[0,0,0],center:[0,0,-1]});
	this.createMeshes();

	this.colors = {
		selected: vec4.fromValues(1,1,1,1),
		node: vec4.fromValues(1,0.5,0,1),
		bone: vec4.fromValues(1,0,0.5,1)
	};

	this.settings = {
		render_grid: true,
		grid_scale: 1.0,
		grid_alpha: 0.5,
		grid_plane: "xz",
		render_names: false,
		render_skeletons: true,
		render_tree: false,
		render_components: true,
		render_null_nodes: true,
		render_axis: false,
		render_colliders: true,
		render_paths: true,
		render_origin: true,
		render_colliders_aabb: false
	};

	this._in_scene = false;
}

DebugRender.prototype.enable = function( scene )
{
	if(this._in_scene)
		return;
	scene = scene || LS.GlobalScene;
	LEvent.bind( scene, "afterRenderInstances", this.onRender, this );
	this._in_scene = scene;
}

DebugRender.prototype.disable = function( scene )
{
	if(!this._in_scene)
		return;
	LEvent.unbind( this._in_scene, "afterRenderInstances", this.onRender, this );
	this._in_scene = null;
}

DebugRender.prototype.onRender = function( e, render_settings )
{
	this.render( LS.Renderer._current_camera );
}

//we pass a callback to check if something is selected
DebugRender.prototype.render = function( camera, is_selected_callback, scene )
{
	var settings = this.settings;

	scene = scene || LS.GlobalScene;

	gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
	gl.enable( gl.DEPTH_TEST );
	gl.disable(gl.BLEND);
	gl.disable( gl.CULL_FACE );
	gl.depthFunc( gl.LEQUAL );
	//gl.depthMask( false );
	var selected_node = null;

	if( settings.render_grid && settings.grid_alpha > 0 )
		this.renderGrid();

	if( settings.render_origin )
	{
		LS.Draw.setColor([0.3,0.3,0.3,1.0]);
		LS.Draw.push();
		LS.Draw.scale(0.01,0.01,0.01);
		LS.Draw.rotate(-90,[1,0,0]);
		gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
		LS.Draw.renderText("Origin");
		gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
		LS.Draw.pop();
	}

	if( settings.render_components )
	{
		//Node components
		for(var i = 0, l = scene._nodes.length; i < l; ++i)
		{
			var node = scene._nodes[i];
			var is_node_selected = node._is_selected;
			selected_node = node;
			if(node.renderEditor)
				node.renderEditor( is_node_selected );
			for(var j = 0, l2 = node._components.length; j < l2; ++j)
			{
				var component = node._components[j];
				var is_component_selected = false;
				if(is_selected_callback)
					is_component_selected = is_selected_callback( component );
				if(component.renderEditor)
					component.renderEditor( is_node_selected, is_component_selected );
			}
		}
	}

	//render local things		
	var zero = vec3.create();
	for(var i = 0, l = scene._nodes.length; i < l; ++i)
	{
		var node = scene._nodes[i];
		if(node._is_root || !node.flags.visible ) 
			continue;

		var global = node.transform ? node.transform.getGlobalMatrixRef() : mat4.create();
		var pos = mat4.multiplyVec3( vec3.create(), global, zero ); //create a new one to store them

		if( settings.render_null_nodes)
		{
			if( node._is_selected )
				this.renderPoint( pos, true, this.colors.selected );
			else if( node._is_bone )
				this.renderPoint( pos, true, this.colors.bone );
			else
				this.renderPoint( pos, false, this.colors.node );
		}

		if(settings.render_names)
			this.renderText(pos, node.name, node._is_selected ? [0.94, 0.8, 0.4,1] : [0.8,0.8,0.8,0.9] );

		if (node._parentNode && node._parentNode.transform && (settings.render_tree || (settings.render_skeletons && node._is_bone && node._parentNode._is_bone)) )
		{
			this.renderLine( pos , node._parentNode.transform.getGlobalPosition(), this.colors.bone );
			//this.renderPoint( pos, true, this.colors.bone );
		}

		if( settings.render_axis )
		{
			LS.Draw.push();
			LS.Draw.multMatrix(global);
			LS.Draw.setColor([1,1,1,1]);
			LS.Draw.renderMesh( this.axis_mesh, gl.LINES );
			LS.Draw.pop();
		}
	}

	if( settings.render_colliders )
		this.renderColliders( scene );
	if( settings.render_paths )
		this.renderPaths( scene );

	//Render primitives (points, lines, text) ***********************

	if( this._points.length )
	{
		LS.Draw.setPointSize(4);
		LS.Draw.setColor([1,1,1,1]);
		LS.Draw.renderPoints( this._points, this._points_color );
		this._points.length = 0;
		this._points_color.length = 0;
	}

	if( this._points_nodepth.length )
	{
		LS.Draw.setPointSize(4);
		LS.Draw.setColor([1,1,1,1]);
		gl.disable( gl.DEPTH_TEST );
		LS.Draw.renderPoints( this._points_nodepth, this._points_color_nodepth );
		gl.enable( gl.DEPTH_TEST );
		this._points_nodepth.length = 0;
		this._points_color_nodepth.length = 0;
	}

	if( this._lines.length )
	{
		gl.disable( gl.DEPTH_TEST );
		LS.Draw.setColor([1,1,1,1]);
		LS.Draw.renderLines( this._lines, this._lines_color );
		gl.enable( gl.DEPTH_TEST );
		this._lines.length = 0;
		this._lines_color.length = 0;
	}

	if( this.debug_points.length )
	{
		LS.Draw.setPointSize(5);
		LS.Draw.setColor([1,0,1,1]);
		LS.Draw.renderPoints( this.debug_points );
	}

	//this require Canvas2DtoWebGL library
	if( settings.render_names && gl.start2D )
	{
		gl.disable( gl.DEPTH_TEST );
		var camera2D = this.camera2D;
		var viewport = gl.getViewport();
		camera2D.setOrthographic(0,viewport[2], 0,viewport[3], -1,1);
		camera2D.updateMatrices();
		gl.start2D();
		//gl.disable( gl.BLEND );
		gl.font = "14px Arial";
		var black_color = vec4.fromValues(0,0,0,0.5);

		for(var i = 0; i < this._names.length; ++i)
		{
			var pos2D = camera.project( this._names[i][1] );
			if(pos2D[2] < 0)
				continue;
			pos2D[2] = 0;

			var text_size = gl.measureText( this._names[i][0] );
			gl.fillColor = black_color;
			gl.fillRect( Math.floor(pos2D[0] + 10), viewport[3] - (Math.floor(pos2D[1] + 8)), text_size.width, text_size.height );
			gl.fillColor = this._names[i][2];
			gl.fillText( this._names[i][0], Math.floor(pos2D[0] + 10), viewport[3] - (Math.floor(pos2D[1] - 4) ) );
		}
		gl.finish2D();
		this._names.length = 0;
	}

	//DEBUG
	if(settings.render_axis && selected_node && selected_node.transform ) //render axis for all nodes
	{
		LS.Draw.push();
		var Q = selected_node.transform.getGlobalRotation();
		var R = mat4.fromQuat( mat4.create(), Q );
		LS.Draw.setMatrix( R );
		LS.Draw.setColor([1,1,1,1]);
		LS.Draw.scale(10,10,10);
		LS.Draw.renderMesh( this.axis_mesh, gl.LINES );
		LS.Draw.pop();
	}

	gl.depthFunc( gl.LESS );
}

//this primitives are rendered after all the components editors are rendered
DebugRender.prototype.renderPoint = function( p, ignore_depth, c )
{
	c = c || [1,1,1,1];
	if(ignore_depth)
	{
		this._points_nodepth.push( p[0], p[1], p[2] );
		this._points_color_nodepth.push( c[0], c[1], c[2], c[3] );
	}
	else
	{
		this._points.push( p[0], p[1], p[2] );
		this._points_color.push( c[0], c[1], c[2], c[3] );
	}
}

DebugRender.prototype.renderLine = function( start, end, color )
{
	color = color || [1,1,1,1];
	this._lines.push( start, end );
	this._lines_color.push( color, color );
}

DebugRender.prototype.renderText = function( position, text, color )
{
	color = color || [1,1,1,1];
	this._names.push([text,position, color]);
}

DebugRender.prototype.renderGrid = function()
{
	var settings = this.settings;

	//textured grid
	if(!this.grid_shader)
	{
		//this.grid_shader = LS.Draw.createSurfaceShader("float PI2 = 6.283185307179586; return vec4( vec3( max(0.0, cos(pos.x * PI2 * 0.1) - 0.95) * 10.0 + max(0.0, cos(pos.z * PI2 * 0.1) - 0.95) * 10.0 ),1.0);");
		this.grid_shader = LS.Draw.createSurfaceShader("vec2 f = vec2(1.0/64.0,-1.0/64.0); float brightness = texture2D(u_texture, pos.xz + f).x * 0.6 + texture2D(u_texture, pos.xz * 0.1 + f ).x * 0.3 + texture2D(u_texture, pos.xz * 0.01 + f ).x * 0.2; brightness /= max(1.0,0.001 * length(u_camera_position.xz - pos.xz));vec4 color = u_color * vec4(vec3(1.0),brightness); if( abs(pos.x) < 0.1 ) color = mix(vec4(0.4,0.4,1.0,0.5),color,abs(pos.x/0.1)); if( abs(pos.z) < 0.1 ) color = mix(vec4(1.0,0.4,0.4,0.5),color,abs(pos.z/0.1)); return color;");
		//this.grid_shader = LS.Draw.createSurfaceShader("vec2 f = vec2(1.0/64.0,-1.0/64.0); float brightness = texture2D(u_texture, pos.xz + f).x * 0.6 + texture2D(u_texture, pos.xz * 0.1 + f ).x * 0.3 + texture2D(u_texture, pos.xz * 0.01 + f ).x * 0.2; brightness /= max(1.0,0.001 * length(u_camera_position.xz - pos.xz));vec4 color = u_color * vec4(vec3(1.0),brightness); return color;");
		this.grid_shader_xy = LS.Draw.createSurfaceShader("vec2 f = vec2(1.0/64.0,-1.0/64.0); float brightness = texture2D(u_texture, pos.xy + f).x * 0.6 + texture2D(u_texture, pos.xy * 0.1 + f ).x * 0.3 + texture2D(u_texture, pos.xy * 0.01 + f ).x * 0.2; brightness /= max(1.0,0.001 * length(u_camera_position.xy - pos.xy));vec4 color = u_color * vec4(vec3(1.0),brightness);  if( abs(pos.x) < 0.025 ) color *= vec4(0.4,1.0,0.4,1.0); if( abs(pos.y) < 0.025 ) color *= vec4(1.0,0.4,0.4,1.0); return color;");
		//this.grid_shader_xy = LS.Draw.createSurfaceShader("vec2 f = vec2(1.0/64.0,-1.0/64.0); float brightness = texture2D(u_texture, pos.xy + f).x * 0.6 + texture2D(u_texture, pos.xy * 0.1 + f ).x * 0.3 + texture2D(u_texture, pos.xy * 0.01 + f ).x * 0.2; brightness /= max(1.0,0.001 * length(u_camera_position.xy - pos.xy));return u_color * vec4(vec3(1.0),brightness);");
		this.grid_shader_yz = LS.Draw.createSurfaceShader("vec2 f = vec2(1.0/64.0,-1.0/64.0); float brightness = texture2D(u_texture, pos.yz + f).x * 0.6 + texture2D(u_texture, pos.yz * 0.1 + f ).x * 0.3 + texture2D(u_texture, pos.yz * 0.01 + f ).x * 0.2; brightness /= max(1.0,0.001 * length(u_camera_position.yz - pos.yz)); vec4 color = u_color * vec4(vec3(1.0),brightness);  if( abs(pos.y) < 0.025 ) color *= vec4(0.4, 0.4, 1.0, 1.0); if( abs(pos.z) < 0.025 ) color *= vec4(0.4,1.0,0.4,1.0); return color;");
		//this.grid_shader_yz = LS.Draw.createSurfaceShader("vec2 f = vec2(1.0/64.0,-1.0/64.0); float brightness = texture2D(u_texture, pos.yz + f).x * 0.6 + texture2D(u_texture, pos.yz * 0.1 + f ).x * 0.3 + texture2D(u_texture, pos.yz * 0.01 + f ).x * 0.2; brightness /= max(1.0,0.001 * length(u_camera_position.yz - pos.yz));return u_color * vec4(vec3(1.0),brightness);");
		this.grid_shader.uniforms({u_texture:0});

		if( this.grid_img && this.grid_img.loaded )
			this.grid_texture = GL.Texture.fromImage( this.grid_img, {format: gl.RGB, wrap: gl.REPEAT, anisotropic: 4, minFilter: gl.LINEAR_MIPMAP_LINEAR } );
		else
			this.grid_texture = GL.Texture.fromURL( this.grid_texture_url, {format: gl.RGB, wrap: gl.REPEAT, anisotropic: 4, minFilter: gl.LINEAR_MIPMAP_LINEAR } );
	}

	LS.Draw.push();

	if(settings.grid_plane == "xy")
		LS.Draw.rotate(90,1,0,0);
	else if(settings.grid_plane == "yz")
		LS.Draw.rotate(90,0,0,1);


	if(!this.grid_texture || this.grid_texture.ready === false)
	{
		var grid_scale = 1;			
		var grid_alpha = 1;
		//lines grid
		LS.Draw.setColor([0.2,0.2,0.2, grid_alpha * 0.75]);
		LS.Draw.scale( grid_scale , grid_scale , grid_scale );
		LS.Draw.renderMesh( this.grid_mesh, gl.LINES );
		LS.Draw.scale(10,10,10);
		LS.Draw.renderMesh( this.grid_mesh, gl.LINES );
	}
	else
	{
		//texture grid
		gl.enable( gl.POLYGON_OFFSET_FILL );
		gl.depthFunc( gl.LEQUAL );
		gl.polygonOffset(1,-100.0);
		gl.enable(gl.BLEND);
		this.grid_texture.bind(0);
		gl.depthMask( false );
		LS.Draw.setColor([1,1,1, this.settings.grid_alpha ]);
		LS.Draw.translate( LS.Draw.camera_position[0], 0, LS.Draw.camera_position[2] ); //follow camera
		LS.Draw.scale( 10000, 10000, 10000 );
		LS.Draw.renderMesh( this.plane_mesh, gl.TRIANGLES, settings.grid_plane == "xy" ? this.grid_shader_xy : (settings.grid_plane == "yz" ? this.grid_shader_yz : this.grid_shader) );
		gl.depthMask( true );
		gl.depthFunc( gl.LESS );
		gl.disable( gl.POLYGON_OFFSET_FILL );
		gl.polygonOffset(0,0);
	}

	LS.Draw.pop();
}

DebugRender.prototype.renderColliders = function( scene )
{
	scene = scene || LS.GlobalScene;
	if(!scene._colliders)
		return;

	LS.Draw.setColor([0.33,0.71,0.71,0.5]);

	for(var i = 0; i < scene._colliders.length; ++i)
	{
		var instance = scene._colliders[i];
		var oobb = instance.oobb;

		if(this.settings.render_colliders_aabb) //render AABB
		{
			var aabb = instance.aabb;
			LS.Draw.push();
			var center = BBox.getCenter(aabb);
			var halfsize = BBox.getHalfsize(aabb);
			LS.Draw.translate(center);
			//LS.Draw.setColor([0.33,0.71,0.71,0.5]);
			LS.Draw.renderWireBox(halfsize[0]*2,halfsize[1]*2,halfsize[2]*2);
			LS.Draw.pop();
		}

		LS.Draw.push();
		LS.Draw.multMatrix( instance.matrix );
		var halfsize = BBox.getHalfsize(oobb);

		if(instance.type == LS.PhysicsInstance.BOX)
		{
			LS.Draw.translate( BBox.getCenter(oobb) );
			LS.Draw.renderWireBox( halfsize[0]*2, halfsize[1]*2, halfsize[2]*2 );
		}
		else if(instance.type == LS.PhysicsInstance.PLANE)
		{
			LS.Draw.translate( BBox.getCenter(oobb) );
			LS.Draw.renderWireBox( halfsize[0]*2, 0.0001, halfsize[2]*2 );
		}
		else if(instance.type == LS.PhysicsInstance.SPHERE)
		{
			//Draw.scale(,halfsize[0],halfsize[0]);
			LS.Draw.translate( BBox.getCenter(oobb) );
			LS.Draw.renderWireSphere( halfsize[0], 20 );
		}
		else if(instance.type == LS.PhysicsInstance.MESH)
		{
			var mesh = instance.mesh;
			if(mesh)
			{
				if(!mesh.indexBuffers["wireframe"])
					mesh.computeWireframe();
				LS.Draw.renderMesh(mesh, gl.LINES, null, "wireframe" );
			}
		}

		LS.Draw.pop();
	}
}

DebugRender.prototype.renderPaths = function( scene )
{
	scene = scene || LS.GlobalScene;

	if(!scene._paths)
		return;

	LS.Draw.setColor([0.7,0.6,0.3,0.5]);

	for(var i = 0; i < scene._paths.length; ++i)
	{
		var path = scene._paths[i];
		var points = path.samplePoints(0);
		LS.Draw.renderLines( points, null, true );
	}
}

DebugRender.prototype.createMeshes = function()
{
	//plane
	this.plane_mesh = GL.Mesh.plane({xz:true, detail: 10});

	//grid
	var dist = 10;
	var num = 10;
	var vertices = [];
	for(var i = -num; i <= num; i++)
	{
		vertices.push([i*dist,0,dist*num]);
		vertices.push([i*dist,0,-dist*num]);
		vertices.push([dist*num,0,i*dist]);
		vertices.push([-dist*num,0,i*dist]);
	}
	this.grid_mesh = GL.Mesh.load({vertices:vertices});

	//box
	vertices = new Float32Array([-1,1,1 , -1,1,-1, 1,1,-1, 1,1,1, -1,-1,1, -1,-1,-1, 1,-1,-1, 1,-1,1]);
	var triangles = new Uint16Array([0,1, 0,4, 0,3, 1,2, 1,5, 2,3, 2,6, 3,7, 4,5, 4,7, 6,7, 5,6 ]);
	this.box_mesh = GL.Mesh.load({vertices: vertices, lines:triangles });

	//circle
	this.circle_mesh = GL.Mesh.circle({size:1,slices:50});
	this.circle_empty_mesh = GL.Mesh.circle({size:1,slices:50,empty:1});
	this.sphere_mesh = GL.Mesh.icosahedron({size:1, subdivisions: 3});

	//dummy
	vertices = [];
	vertices.push([-dist*0.5,0,0],[+dist*0.5,0,0]);
	vertices.push([0,-dist*0.5,0],[0,+dist*0.5,0]);
	vertices.push([0,0,-dist*0.5],[0,0,+dist*0.5]);
	this.dummy_mesh = GL.Mesh.load({vertices:vertices});

	//box
	vertices = [];
	vertices.push([-1.0,1.0,1.0],[1.0,1.0,1.0],[-1.0,1.0,-1.0], [1.0,1.0,-1.0],[-1.0,-1.0,1.0], [1.0,-1.0,1.0],[-1.0,-1.0,-1.0], [1.0,-1.0,-1.0]);
	vertices.push([1.0,-1.0,1.0],[1.0,1.0,1.0],[1.0,-1.0,-1.0],[1.0,1.0,-1.0],[-1.0,-1.0,1.0],[-1.0,1.0,1.0],[-1.0,-1.0,-1.0],[-1.0,1.0,-1.0]);
	vertices.push([1.0,1.0,1.0],[1.0,1.0,-1.0],[1.0,-1.0,1.0],[1.0,-1.0,-1.0],[-1.0,1.0,1.0],[-1.0,1.0,-1.0],[-1.0,-1.0,1.0],[-1.0,-1.0,-1.0]);
	this.cube_mesh = GL.Mesh.load({vertices:vertices});

	for(var i = 1; i >= 0.0; i -= 0.02)
	{
		var f = ( 1 - 0.001/(i) )*2-1;
		vertices.push([-1.0,1.0,f],[1.0,1.0,f],[-1.0,-1.0,f], [1.0,-1.0,f]);
		vertices.push([1.0,-1.0,f],[1.0,1.0,f],[-1.0,-1.0,f],[-1.0,1.0,f]);
	}

	this.frustum_mesh = GL.Mesh.load({vertices:vertices});

	//cylinder
	this.cylinder_mesh = GL.Mesh.cylinder({radius:10,height:2});

	//axis
	vertices = [];
	var colors = [];
	dist = 2;
	vertices.push([0,0,0],[+dist*0.5,0,0]);
	colors.push([1,0,0,1],[1,0,0,1]);
	vertices.push([0,0,0],[0,+dist*0.5,0]);
	colors.push([0,1,0,1],[0,1,0,1]);
	vertices.push([0,0,0],[0,0,+dist*0.5]);
	colors.push([0,0,1,1],[0,0,1,1]);
	this.axis_mesh = GL.Mesh.load({vertices:vertices, colors: colors});

	//top
	vertices = [];
	vertices.push([0,0,0],[0,+dist*0.5,0]);
	vertices.push([0,+dist*0.5,0],[0.1*dist,+dist*0.4,0]);
	vertices.push([0,+dist*0.5,0],[-0.1*dist,+dist*0.4,0]);
	this.top_line_mesh = GL.Mesh.load({vertices:vertices});

	//front
	vertices = [];
	vertices.push([0,0,0],[0,0,+dist*0.5]);
	vertices.push([0,0,+dist*0.5],[0,0.1*dist,+dist*0.4]);
	vertices.push([0,0,+dist*0.5],[0,-0.1*dist,+dist*0.4]);
	this.front_line_mesh = GL.Mesh.load({vertices:vertices});
}

//this module is in charge of rendering basic objects like lines, points, and primitives
//it works over litegl (no need of scene)
//carefull, it is very slow

/**
* LS.Draw allows to render basic primitives, similar to the OpenGL Fixed pipeline.
* It reuses local meshes when possible to avoid fragmenting the VRAM.
* @class Draw
* @constructor
*/

var Draw = {
	ready: false,
	images: {},
	image_last_id: 1,

	onRequestFrame: null,
	reset_stack_on_reset: true,
	_rendercalls: 0,

	/**
	* Sets up everything (prepare meshes, shaders, and so)
	* @method init
	*/
	init: function()
	{
		if(this.ready)
			return;
		if(!gl)
			return;

		this.color = new Float32Array(4);
		this.color[3] = 1;
		this.mvp_matrix = mat4.create();
		this.temp_matrix = mat4.create();
		this.point_size = 2;
		this.line_width = 1;

		this.stack = new Float32Array(16 * 32); //stack max size
		this.model_matrix = new Float32Array(this.stack.buffer,0,16);
		mat4.identity( this.model_matrix );

		//matrices
		this.camera = null;
		this.camera_position = vec3.create();
		this.view_matrix = mat4.create();
		this.projection_matrix = mat4.create();
		this.viewprojection_matrix = mat4.create();

		this.camera_stack = []; //not used yet

		this.uniforms = {
				u_model: this.model_matrix,
				u_viewprojection: this.viewprojection_matrix,
				u_mvp: this.mvp_matrix,
				u_color: this.color,
				u_camera_position: this.camera_position,
				u_point_size: this.point_size,
				u_point_perspective: 0,
				u_perspective: 1, //viewport.w * this._projection_matrix[5]
				u_texture: 0
		};

		//temp containers
		this._temp = vec3.create();

		//Meshes
		var vertices = [[-1,1,0],[1,1,0],[1,-1,0],[-1,-1,0]];
		var coords = [[0,1],[1,1],[1,0],[0,0]];
		this.quad_mesh = GL.Mesh.load({vertices:vertices, coords: coords});

		var vertex_shader = Draw.vertex_shader_code;
		var pixel_shader = Draw.fragment_shader_code;

		//create shaders
		this.shader = new Shader( vertex_shader, pixel_shader );
		this.shader_instancing = new Shader(vertex_shader,pixel_shader,{"USE_INSTANCING":""});
		this.shader_color = new Shader(vertex_shader,pixel_shader,{"USE_COLOR":""});
		this.shader_color_instancing = new Shader(vertex_shader,pixel_shader,{"USE_COLOR":"","USE_INSTANCING":""});
		this.shader_texture = new Shader(vertex_shader,pixel_shader,{"USE_TEXTURE":""});
		this.shader_texture_instancing = new Shader(vertex_shader,pixel_shader,{"USE_TEXTURE":"","USE_INSTANCING":""});
		this.shader_points = new Shader(vertex_shader,pixel_shader,{"USE_POINTS":""});
		this.shader_points_color = new Shader(vertex_shader,pixel_shader,{"USE_COLOR":"","USE_POINTS":""});
		this.shader_points_color_size = new Shader(vertex_shader,pixel_shader,{"USE_COLOR":"","USE_SIZE":"","USE_POINTS":""});


		this.shader_image = new Shader('\
			precision mediump float;\n\
			attribute vec3 a_vertex;\n\
			uniform mat4 u_mvp;\n\
			uniform float u_point_size;\n\
			void main() {\n\
				gl_PointSize = u_point_size;\n\
				gl_Position = u_mvp * vec4(a_vertex,1.0);\n\
			}\
			','\
			precision mediump float;\n\
			uniform vec4 u_color;\n\
			uniform sampler2D u_texture;\n\
			void main() {\n\
			  vec4 tex = texture2D(u_texture, vec2(gl_PointCoord.x,1.0 - gl_PointCoord.y) );\n\
			  if(tex.a < 0.01)\n\
				discard;\n\
			  gl_FragColor = u_color * tex;\n\
			}\
		');

		this.shader_points_color_texture_size = new Shader('\
			precision mediump float;\n\
			attribute vec3 a_vertex;\n\
			attribute vec4 a_color;\n\
			attribute float a_extra;\n\
			uniform mat4 u_mvp;\n\
			uniform float u_point_size;\n\
			varying vec4 v_color;\n\
			void main() {\n\
				v_color = a_color;\n\
				gl_PointSize = u_point_size * a_extra;\n\
				gl_Position = u_mvp * vec4(a_vertex,1.0);\n\
			}\
			','\
			precision mediump float;\n\
			uniform vec4 u_color;\n\
			varying vec4 v_color;\n\
			uniform sampler2D u_texture;\n\
			void main() {\n\
			  vec4 tex = texture2D(u_texture, vec2(gl_PointCoord.x,1.0 - gl_PointCoord.y) );\n\
			  if(tex.a < 0.1)\n\
				discard;\n\
			  vec4 color = u_color * v_color * tex;\n\
			  gl_FragColor = color;\n\
			}\
		');

		this.shader_text2D = new Shader('\
			precision mediump float;\n\
			attribute vec3 a_vertex;\n\
			attribute vec4 a_extra4;\n\
			uniform mat4 u_mvp;\n\
			uniform float u_point_size;\n\
			void main() {\n\
				gl_PointSize = u_point_size;\n\
				gl_Position = u_mvp * vec4(a_vertex,1.0);\n\
			}\
			','\
			precision mediump float;\n\
			uniform vec4 u_color;\n\
			uniform sampler2D u_texture;\n\
			void main() {\n\
			  vec4 tex = texture2D(u_texture, vec2(gl_PointCoord.x,1.0 - gl_PointCoord.y) );\n\
			  if(tex.a < 0.1)\n\
				discard;\n\
			  vec4 color = u_color * tex;\n\
			  gl_FragColor = color;\n\
			}\
		');

		//create shaders
		var phong_vertex_code = "\
			precision mediump float;\n\
			attribute vec3 a_vertex;\n\
			attribute vec3 a_normal;\n\
			varying vec3 v_pos;\n\
			varying vec3 v_normal;\n\
			#ifdef USE_INSTANCING\n\
				attribute mat4 u_model;\n\
			#else\n\
				uniform mat4 u_model;\n\
			#endif\n\
			uniform mat4 u_viewprojection;\n\
			void main() {\n\
				v_pos = ( u_model * vec4( a_vertex, 1.0 )).xyz;\n\
				v_normal = (u_model * vec4(a_normal,0.0)).xyz;\n\
				gl_Position = u_viewprojection * vec4( v_pos, 1.0 );\n\
			}\n";
		
		var phong_pixel_shader = "\n\
			precision mediump float;\n\
			uniform vec3 u_ambient_color;\n\
			uniform vec3 u_light_color;\n\
			uniform vec3 u_light_dir;\n\
			uniform vec4 u_color;\n\
			varying vec3 v_pos;\n\
			varying vec3 v_normal;\n\
			void main() {\n\
				vec3 N = normalize(v_normal);\n\
				float NdotL = max(0.0, dot(N,u_light_dir));\n\
				gl_FragColor = u_color * vec4(u_ambient_color + u_light_color * NdotL, 1.0);\n\
			}\n";

		this.shader_phong = new Shader( phong_vertex_code, phong_pixel_shader);
		this.shader_phong_instanced = new Shader( phong_vertex_code, phong_pixel_shader, { "USE_INSTANCING":"" } );
		var phong_uniforms = {u_ambient_color:[0.1,0.1,0.1], u_light_color:[0.8,0.8,0.8], u_light_dir: [0,1,0] };
		this.shader_phong.uniforms( phong_uniforms );
		this.shader_phong_instanced.uniforms( phong_uniforms );

		//create shaders
		this.shader_depth = new Shader('\
			precision mediump float;\n\
			attribute vec3 a_vertex;\n\
			varying vec4 v_pos;\n\
			uniform mat4 u_model;\n\
			uniform mat4 u_mvp;\n\
			void main() {\n\
				v_pos = u_model * vec4(a_vertex,1.0);\n\
				gl_Position = u_mvp * vec4(a_vertex,1.0);\n\
			}\
			','\
			precision mediump float;\n\
			varying vec4 v_pos;\n\
			\n\
			vec4 PackDepth32(float depth)\n\
			{\n\
				const vec4 bitSh  = vec4(   256*256*256, 256*256,   256,         1);\n\
				const vec4 bitMsk = vec4(   0,      1.0/256.0,    1.0/256.0,    1.0/256.0);\n\
				vec4 comp;\n\
				comp	= depth * bitSh;\n\
				comp	= fract(comp);\n\
				comp	-= comp.xxyz * bitMsk;\n\
				return comp;\n\
			}\n\
			void main() {\n\
				float depth = (v_pos.z / v_pos.w) * 0.5 + 0.5;\n\
				gl_FragColor = PackDepth32(depth);\n\
			}\
		');

		this.ready = true;
	},

	/**
	* A helper to create shaders when you only want to specify some basic shading
	* @method createSurfaceShader
	* @param {string} surface_function GLSL code like: "vec4 surface_function( vec3 pos, vec3 normal, vec2 coord ) { return vec4(1.0); } ";
	* @param {object} macros [optional] object containing the macros and value
	* @param {object} uniforms [optional] object with name and type
	* @return {GL.Shader} the resulting shader
	*/
	createSurfaceShader: function( surface_function, uniforms, macros )
	{
		//"vec4 surface_function( vec3 pos, vec3 normal, vec2 coord ) { return vec4(1.0); } ";

		if( surface_function.indexOf("surface_function") == -1 )
			surface_function = "vec4 surface_function( vec3 pos, vec3 normal, vec2 coord ) { " + surface_function + "\n } ";

		if(uniforms)
		{
			if (uniforms.constructor === String)
				surface_function = uniforms + ";\n" + surface_function;
			else
				for(var i in uniforms)
					surface_function += "uniform " + uniforms[i] + " " + i + ";\n";
		}

		var vertex_shader = "\
			precision mediump float;\n\
			attribute vec3 a_vertex;\n\
			attribute vec3 a_normal;\n\
			attribute vec2 a_coord;\n\
			varying vec2 v_coord;\n\
			varying vec3 v_pos;\n\
			varying vec3 v_normal;\n\
			uniform mat4 u_mvp;\n\
			uniform mat4 u_model;\n\
			void main() {\n\
				v_coord = a_coord;\n\
				v_pos = (u_model * vec4(a_vertex,1.0)).xyz;\n\
				v_normal = (u_model * vec4(a_normal,0.0)).xyz;\n\
				gl_Position = u_mvp * vec4(a_vertex,1.0);\n\
			}\
			";

		var pixel_shader = "\
			precision mediump float;\n\
			varying vec2 v_coord;\n\
			varying vec3 v_pos;\n\
			varying vec3 v_normal;\n\
			uniform vec4 u_color;\n\
			uniform vec3 u_camera_position;\n\
			uniform sampler2D u_texture;\n\
			"+ surface_function +"\n\
			void main() {\n\
				gl_FragColor = surface_function(v_pos,v_normal,v_coord);\n\
			}\
		";	

		return new GL.Shader( vertex_shader, pixel_shader, macros );
	},

	/**
	* clears the stack
	* @method reset
	*/
	reset: function( reset_memory )
	{
		if(!this.ready)
			this.init();
		else
		{
			this.color.set([1,1,1,1]);
			this.point_size = 2;
			this.line_width = 1;
		}

		if( reset_memory )
			this.images = {}; //clear images

		if(this.reset_stack_on_reset)
		{
			this.model_matrix = new Float32Array(this.stack.buffer,0,16);
			this.uniforms.u_model = this.model_matrix;
			mat4.identity( this.model_matrix );
		}
	},

	/**
	* Sets the color used to paint primitives
	* @method setColor
	* @param {vec3|vec4} color
	*/
	setColor: function(color)
	{
		if( arguments.length >= 3 )
		{
			this.color[0] = arguments[0];
			this.color[1] = arguments[1];
			this.color[2] = arguments[2];
			if( arguments.length == 4 )
				this.color[3] = arguments[3];
		}
		else
		for(var i = 0; i < color.length; i++)
			this.color[i] = color[i];
	},

	/**
	* Sets the alpha used to paint primitives
	* @method setAlpha
	* @param {number} alpha
	*/
	setAlpha: function(alpha)
	{
		this.color[3] = alpha;
	},

	/**
	* Sets the point size
	* @method setPointSize
	* @param {number} v size of points
	* @param {number} perspective [optional] if set to true, the points will be affected by perspective
	*/
	setPointSize: function(v, perspective)
	{
		this.point_size = v;
		this.uniforms.u_point_size = v;
		this.uniforms.u_point_perspective = perspective ? 1 : 0;
	},

	/**
	* Sets the line width
	* @method setLineWidth
	* @param {number} v width in pixels
	*/
	setLineWidth: function(v)
	{
		if(gl.setLineWidth)
			gl.setLineWidth(v);
		else
			gl.lineWidth(v);
		this.line_width = v;
	},

	/**
	* Sets the camera to use during the rendering, this is already done by LS.Renderer
	* @method setCamera
	* @param {LS.Camera} camera
	*/
	setCamera: function( camera )
	{
		this.camera = camera;
		camera.updateMatrices();
		vec3.copy( this.camera_position, camera.getEye() );	
		this.view_matrix.set( camera._view_matrix );
		this.projection_matrix.set( camera._projection_matrix );
		this.viewprojection_matrix.set( camera._viewprojection_matrix );
		this.uniforms.u_perspective = gl.viewport_data[3] * this.projection_matrix[5];
	},

	/**
	* Specifies the camera position (used to compute point size)
	* @method setCameraPosition
	* @param {vec3} center
	*/
	setCameraPosition: function(center)
	{
		vec3.copy( this.camera_position, center);
	},

	pushCamera: function()
	{
		this.camera_stack.push( mat4.create( this.viewprojection_matrix ) );
	},

	popCamera: function()
	{
		if(this.camera_stack.length == 0)
			throw("too many pops");
		this.viewprojection_matrix.set( this.camera_stack.pop() );
	},

	/**
	* Specifies the camera view and projection matrices
	* @method setViewProjectionMatrix
	* @param {mat4} view
	* @param {mat4} projection
	* @param {mat4} vp viewprojection matrix [optional]
	*/
	setViewProjectionMatrix: function(view, projection, vp)
	{
		mat4.copy( this.view_matrix, view);
		mat4.copy( this.projection_matrix, projection);
		if(vp)
			mat4.copy( this.viewprojection_matrix, vp);
		else
			mat4.multiply( this.viewprojection_matrix, view, vp);
	},

	/**
	* Specifies the transformation matrix to apply to the mesh
	* @method setMatrix
	* @param {mat4} matrix
	*/
	setMatrix: function(matrix)
	{
		mat4.copy(this.model_matrix, matrix);
	},

	/**
	* Multiplies the current matrix by a given one
	* @method multMatrix
	* @param {mat4} matrix
	*/
	multMatrix: function(matrix)
	{
		mat4.multiply(this.model_matrix, matrix, this.model_matrix);
	},

	/**
	* Render lines given a set of points
	* @method renderLines
	* @param {Float32Array|Array} points
	* @param {Float32Array|Array} colors [optional]
	* @param {bool} strip [optional] if the lines are a line strip (one consecutive line)
	* @param {bool} loop [optional] if strip, close loop
	*/
	renderLines: function(lines, colors, strip, loop)
	{
		if(!lines || !lines.length) return;
		var vertices = null;

		vertices = lines.constructor == Float32Array ? lines : this.linearize(lines);
		if(colors)
			colors = colors.constructor == Float32Array ? colors : this.linearize(colors);
		if(colors && (colors.length/4) != (vertices.length/3))
			colors = null;

		var type = gl.LINES;
		if(loop)
			type = gl.LINE_LOOP;
		else if(strip)
			type = gl.LINE_STRIP;

		var mesh = this.toGlobalMesh({vertices: vertices, colors: colors});
		return this.renderMesh( mesh, type, colors ? this.shader_color : this.shader, undefined, 0, vertices.length / 3 );
	},

	/**
	* Render points given a set of positions (and colors)
	* @method renderPoints
	* @param {Float32Array|Array} points
	* @param {Float32Array|Array} colors [optional]
	* @param {GL.Shader} shader [optional]
	*/
	renderPoints: function(points, colors, shader)
	{
		if(!points || !points.length)
			return;

		var vertices = null;

		if(points.constructor == Float32Array)
			vertices = points;
		else if(points[0].length) //array of arrays
			vertices = this.linearize(points);
		else
			vertices = new Float32Array(points);

		if(colors && colors.constructor != Float32Array)
		{
			if(colors.constructor === Array && colors[0].constructor === Number)
				colors = new Float32Array( colors );
			else
				colors = this.linearize(colors);
		}

		var mesh = this.toGlobalMesh({vertices: vertices, colors: colors});
		if(!shader)
			shader = colors ? this.shader_color : this.shader;

		return this.renderMesh(mesh, gl.POINTS, shader, undefined, 0, vertices.length / 3 );
	},

	/**
	* Render round points given a set of positions (and colors)
	* @method renderRoundPoints
	* @param {Float32Array|Array} points
	* @param {Float32Array|Array} colors [optional]
	* @param {GL.Shader} shader [optional]
	*/
	renderRoundPoints: function(points, colors, shader)
	{
		if(!points || !points.length)
			return;

		var vertices = null;

		if(points.constructor == Float32Array)
			vertices = points;
		else if(points[0].length) //array of arrays
			vertices = this.linearize(points);
		else
			vertices = new Float32Array(points);

		if(colors)
			colors = colors.constructor == Float32Array ? colors : this.linearize(colors);

		var mesh = this.toGlobalMesh({vertices: vertices, colors: colors});
		if(!shader)
			shader = colors ? this.shader_points_color : this.shader_points;
		return this.renderMesh( mesh, gl.POINTS, shader, undefined, 0, vertices.length / 3 );
	},

	/**
	* Render points with color, size, and texture binded in 0
	* @method renderPointsWithSize
	* @param {Float32Array|Array} points
	* @param {Float32Array|Array} colors [optional]
	* @param {Float32Array|Array} sizes [optional]
	* @param {GL.Texture} texture [optional]
	* @param {GL.Shader} shader [optional]
	*/
	renderPointsWithSize: function(points, colors, sizes, texture, shader)
	{
		if(!points || !points.length) return;
		var vertices = null;

		if(points.constructor == Float32Array)
			vertices = points;
		else if(points[0].length) //array of arrays
			vertices = this.linearize(points);
		else
			vertices = new Float32Array(points);

		if(!colors)
			throw("colors required in Draw.renderPointsWithSize");
		colors = colors.constructor == Float32Array ? colors : this.linearize(colors);
		if(!sizes)
			throw("sizes required in Draw.renderPointsWithSize");
		sizes = sizes.constructor == Float32Array ? sizes : this.linearize(sizes);

		var mesh = this.toGlobalMesh({vertices: vertices, colors: colors, extra: sizes});
		shader = shader || (texture ? this.shader_points_color_texture_size : this.shader_points_color_size);
		
		return this.renderMesh(mesh, gl.POINTS, shader, undefined, 0, vertices.length / 3 );
	},

	createRectangleMesh: function( width, height, in_z, use_global )
	{
		var vertices = new Float32Array(4 * 3);
		if(in_z)
			vertices.set([-width*0.5,0,height*0.5, width*0.5,0,height*0.5, width*0.5,0,-height*0.5, -width*0.5,0,-height*0.5]);
		else
			vertices.set([-width*0.5,height*0.5,0, width*0.5,height*0.5,0, width*0.5,-height*0.5,0, -width*0.5,-height*0.5,0]);

		if(use_global)
			return this.toGlobalMesh( {vertices: vertices} );

		return GL.Mesh.load({vertices: vertices});
	},

	/**
	* Render a wireframe rectangle of width x height 
	* @method renderRectangle
	* @param {number} width
	* @param {number} height
	* @param {boolean} in_z [optional] if the plane is aligned with the z plane
	*/
	renderRectangle: function(width, height, in_z, fill)
	{
		var mesh = this.createRectangleMesh( width, height, in_z, true );
		return this.renderMesh( mesh, fill ? gl.TRIANGLE_FAN : gl.LINE_LOOP, undefined, undefined, 0, this._global_mesh_last_size );
	},

	createCircleMesh: function(radius, segments, in_z, use_global)
	{
		segments = segments || 32;
		var axis = [0,1,0];
		var num_segments = segments || 100;
		var R = quat.create();
		var temp = this._temp;
		var vertices = new Float32Array(num_segments * 3);

		var offset =  2 * Math.PI / num_segments;

		for(var i = 0; i < num_segments; i++)
		{
			temp[0] = Math.sin(offset * i) * radius;
			if(in_z)
			{
				temp[1] = 0;
				temp[2] = Math.cos(offset * i) * radius;
			}
			else
			{
				temp[2] = 0;
				temp[1] = Math.cos(offset * i) * radius;
			}

			vertices.set(temp, i*3);
		}

		if(use_global)
			return this.toGlobalMesh({vertices: vertices});

		return GL.Mesh.load({vertices: vertices});
	},

	/**
	* Renders a circle 
	* @method renderCircle
	* @param {number} radius
	* @param {number} segments
	* @param {boolean} in_z [optional] if the circle is aligned with the z plane
	* @param {boolean} filled [optional] renders the interior
	*/
	renderCircle: function(radius, segments, in_z, filled)
	{
		var mesh = this.createCircleMesh(radius, segments, in_z, true);
		return this.renderMesh(mesh, filled ? gl.TRIANGLE_FAN : gl.LINE_LOOP, undefined, undefined, 0, this._global_mesh_last_size );
	},

	/**
	* Render a filled circle
	* @method renderSolidCircle
	* @param {number} radius
	* @param {number} segments
	* @param {boolean} in_z [optional] if the circle is aligned with the z plane
	*/
	renderSolidCircle: function(radius, segments, in_z)
	{
		return this.renderCircle(radius, segments, in_z, true);
	},

	createWireSphereMesh: function(radius, segments, use_global )
	{
		var axis = [0,1,0];
		segments = segments || 100;
		var R = quat.create();
		var temp = this._temp;
		var vertices = new Float32Array( segments * 2 * 3 * 3); 

		var delta = 1.0 / segments * Math.PI * 2;

		for(var i = 0; i < segments; i++)
		{
			temp.set([ Math.sin( i * delta) * radius, Math.cos( i * delta) * radius, 0]);
			vertices.set(temp, i*18);
			temp.set([Math.sin( (i+1) * delta) * radius, Math.cos( (i+1) * delta) * radius, 0]);
			vertices.set(temp, i*18 + 3);

			temp.set([ Math.sin( i * delta) * radius, 0, Math.cos( i * delta) * radius ]);
			vertices.set(temp, i*18 + 6);
			temp.set([Math.sin( (i+1) * delta) * radius, 0, Math.cos( (i+1) * delta) * radius ]);
			vertices.set(temp, i*18 + 9);

			temp.set([ 0, Math.sin( i * delta) * radius, Math.cos( i * delta) * radius ]);
			vertices.set(temp, i*18 + 12);
			temp.set([ 0, Math.sin( (i+1) * delta) * radius, Math.cos( (i+1) * delta) * radius ]);
			vertices.set(temp, i*18 + 15);
		}

		if(use_global)
			return this.toGlobalMesh({vertices: vertices});
		
		return GL.Mesh.load({vertices: vertices});
	},

	/**
	* Renders three circles to form a simple spherical shape
	* @method renderWireSphere
	* @param {number} radius
	* @param {number} segments
	*/
	renderWireSphere: function(radius, segments)
	{
		var mesh = this.createWireSphereMesh( radius, segments, true );
		return this.renderMesh( mesh, gl.LINES, undefined, undefined, 0, this._global_mesh_last_size );
	},

	/**
	* Renders an sphere
	* @method renderSolidSphere
	* @param {number} radius
	*/
	renderSolidSphere: function(radius)
	{
		var mesh = this._sphere_mesh;
		if(!this._sphere_mesh)
			mesh = this._sphere_mesh = GL.Mesh.sphere({ size: 1 });
		this.push();
		this.scale( radius,radius,radius );
		this.renderMesh( mesh, gl.TRIANGLES );
		this.pop();
	},


	createWireBoxMesh: function( sizex, sizey, sizez, use_global )
	{
		sizex = sizex*0.5;
		sizey = sizey*0.5;
		sizez = sizez*0.5;
		var vertices = new Float32Array([-sizex,sizey,sizez , -sizex,sizey,-sizez, sizex,sizey,-sizez, sizex,sizey,sizez,
						-sizex,-sizey,sizez, -sizex,-sizey,-sizez, sizex,-sizey,-sizez, sizex,-sizey,sizez]);
		var triangles = new Uint16Array([0,1, 0,4, 0,3, 1,2, 1,5, 2,3, 2,6, 3,7, 4,5, 4,7, 6,7, 5,6   ]);

		if(use_global)
			return this.toGlobalMesh( {vertices: vertices}, triangles );

		return GL.Mesh.load({vertices: vertices, lines:triangles });
	},

	/**
	* Renders a wire box (box made of lines, not filled)
	* @method renderWireBox
	* @param {number} sizex
	* @param {number} sizey
	* @param {number} sizez
	*/
	renderWireBox: function(sizex,sizey,sizez)
	{
		var mesh = this.createWireBoxMesh(sizex,sizey,sizez, true);
		return this.renderMesh( mesh, gl.LINES, undefined, "indices", 0, this._global_mesh_last_size );
	},

	createSolidBoxMesh: function( sizex,sizey,sizez, use_global)
	{
		sizex = sizex*0.5;
		sizey = sizey*0.5;
		sizez = sizez*0.5;
		//var vertices = [[-sizex,sizey,-sizez],[-sizex,-sizey,+sizez],[-sizex,sizey,sizez],[-sizex,sizey,-sizez],[-sizex,-sizey,-sizez],[-sizex,-sizey,+sizez],[sizex,sizey,-sizez],[sizex,sizey,sizez],[sizex,-sizey,+sizez],[sizex,sizey,-sizez],[sizex,-sizey,+sizez],[sizex,-sizey,-sizez],[-sizex,sizey,sizez],[sizex,-sizey,sizez],[sizex,sizey,sizez],[-sizex,sizey,sizez],[-sizex,-sizey,sizez],[sizex,-sizey,sizez],[-sizex,sizey,-sizez],[sizex,sizey,-sizez],[sizex,-sizey,-sizez],[-sizex,sizey,-sizez],[sizex,-sizey,-sizez],[-sizex,-sizey,-sizez],[-sizex,sizey,-sizez],[sizex,sizey,sizez],[sizex,sizey,-sizez],[-sizex,sizey,-sizez],[-sizex,sizey,sizez],[sizex,sizey,sizez],[-sizex,-sizey,-sizez],[sizex,-sizey,-sizez],[sizex,-sizey,sizez],[-sizex,-sizey,-sizez],[sizex,-sizey,sizez],[-sizex,-sizey,sizez]];
		var vertices = [-sizex,sizey,-sizez,-sizex,-sizey,+sizez,-sizex,sizey,sizez,-sizex,sizey,-sizez,-sizex,-sizey,-sizez,-sizex,-sizey,+sizez,sizex,sizey,-sizez,sizex,sizey,sizez,sizex,-sizey,+sizez,sizex,sizey,-sizez,sizex,-sizey,+sizez,sizex,-sizey,-sizez,-sizex,sizey,sizez,sizex,-sizey,sizez,sizex,sizey,sizez,-sizex,sizey,sizez,-sizex,-sizey,sizez,sizex,-sizey,sizez,-sizex,sizey,-sizez,sizex,sizey,-sizez,sizex,-sizey,-sizez,-sizex,sizey,-sizez,sizex,-sizey,-sizez,-sizex,-sizey,-sizez,-sizex,sizey,-sizez,sizex,sizey,sizez,sizex,sizey,-sizez,-sizex,sizey,-sizez,-sizex,sizey,sizez,sizex,sizey,sizez,-sizex,-sizey,-sizez,sizex,-sizey,-sizez,sizex,-sizey,sizez,-sizex,-sizey,-sizez,sizex,-sizey,sizez,-sizex,-sizey,sizez];
		if(use_global)
			return this.toGlobalMesh( {vertices: vertices} );

		return GL.Mesh.load({vertices: vertices });
	},

	/**
	* Renders a solid box 
	* @method renderSolidBox
	* @param {number} sizex
	* @param {number} sizey
	* @param {number} sizez
	*/
	renderSolidBox: function(sizex,sizey,sizez)
	{
		var mesh = this.createSolidBoxMesh(sizex,sizey,sizez, true);
		return this.renderMesh( mesh, gl.TRIANGLES, undefined, undefined, 0, this._global_mesh_last_size );
	},

	/**
	* Renders a wire cube of size size
	* @method renderWireCube
	* @param {number} size
	*/
	renderWireCube: function(size)
	{
		return this.renderWireBox(size,size,size);
	},

	/**
	* Renders a solid cube of size size
	* @method renderSolidCube
	* @param {number} size
	*/
	renderSolidCube: function(size)
	{
		return this.renderSolidBox(size,size,size);
	},

	/**
	* Renders a solid plane (could be textured or even with an specific shader)
	* @method renderPlane
	* @param {vec3} position
	* @param {vec2} size
	* @param {GL.Texture} texture
	* @param {GL.Shader} shader
	*/
	renderPlane: function( position, size, texture, shader)
	{
		if(!position || !size)
			throw("LS.Draw.renderPlane param missing");

		this.push();
		this.translate(position);
		this.scale( size[0], size[1], 1 );
		if(texture)
			texture.bind(0);

		if(!shader && texture)
			shader = this.shader_texture;

		this.renderMesh(this.quad_mesh, gl.TRIANGLE_FAN, shader );

		if(texture)
			texture.unbind(0);
		
		this.pop();
	},	

	createGridMesh: function(dist,num)
	{
		dist = dist || 20;
		num = num || 10;
		var vertices = new Float32Array( (num*2+1) * 4 * 3);
		var pos = 0;
		for(var i = -num; i <= num; i++)
		{
			vertices.set( [i*dist,0,dist*num], pos);
			vertices.set( [i*dist,0,-dist*num],pos+3);
			vertices.set( [dist*num,0,i*dist], pos+6);
			vertices.set( [-dist*num,0,i*dist],pos+9);
			pos += 3*4;
		}
		return GL.Mesh.load({vertices: vertices});
	},

	/**
	* Renders a grid of lines
	* @method renderGrid
	* @param {number} dist distance between lines
	* @param {number} num number of lines
	*/
	renderGrid: function(dist,num)
	{
		var mesh = this.createGridMesh(dist,num);
		return this.renderMesh(mesh, gl.LINES);
	},

	createConeMesh: function(radius, height, segments, in_z, use_global )
	{
		var axis = [0,1,0];
		segments = segments || 100;
		var R = quat.create();
		var temp = this._temp;
		var vertices = new Float32Array( (segments+2) * 3);
		vertices.set(in_z ? [0,0,height] : [0,height,0], 0);

		for(var i = 0; i <= segments; i++)
		{
			quat.setAxisAngle(R,axis, 2 * Math.PI * (i/segments) );
			vec3.transformQuat(temp, [0,0,radius], R );
			if(in_z)
				vec3.set(temp, temp[0],temp[2],temp[1] );
			vertices.set(temp, i*3+3);
		}

		if(use_global)
			return this.toGlobalMesh( {vertices: vertices} );

		return GL.Mesh.load({vertices: vertices});
	},

	/**
	* Renders a cone 
	* @method renderCone
	* @param {number} radius
	* @param {number} height
	* @param {number} segments
	* @param {boolean} in_z aligned with z axis
	*/
	renderCone: function(radius, height, segments, in_z)
	{
		var mesh = this.createConeMesh(radius, height, segments, in_z, true);
		return this.renderMesh(mesh, gl.TRIANGLE_FAN, undefined, undefined, 0, this._global_mesh_last_size );
	},

	createCylinderMesh: function( radius, height, segments, in_z, use_global )
	{
		var axis = [0,1,0];
		segments = segments || 100;
		var R = quat.create();
		var temp = this._temp;
		var vertices = new Float32Array( (segments+1) * 3 * 2);

		for(var i = 0; i <= segments; i++)
		{
			quat.setAxisAngle(R, axis, 2 * Math.PI * (i/segments) );
			vec3.transformQuat(temp, [0,0,radius], R );
			vertices.set(temp, i*3*2+3);
			temp[1] = height;
			vertices.set(temp, i*3*2);
		}

		if(use_global)
			return this.toGlobalMesh( {vertices: vertices} );

		return GL.Mesh.load({vertices: vertices});
	},

	/**
	* Renders a cylinder
	* @method renderCylinder
	* @param {number} radius
	* @param {number} height
	* @param {number} segments
	* @param {boolean} in_z aligned with z axis
	*/
	renderCylinder: function( radius, height, segments, in_z )
	{
		var mesh = this.createCylinderMesh(radius, height, segments, in_z, true);
		return this.renderMesh( mesh, gl.TRIANGLE_STRIP, undefined, undefined, 0, this._global_mesh_last_size );
	},

	/**
	* Renders an image in 2D (billboarded)
	* @method renderImage
	* @param {vec3} position that will be projected
	* @param {Image|Texture|String} image from an URL, or a texture
	* @param {number} size [optional=10]
	* @param {boolean} fixed_size [optional=false] (camera distance do not affect size)
	*/
	renderImage: function( position, image, size, fixed_size )
	{
		if(!position || !image)
			throw("LS.Draw.renderImage param missing");
		size = size || 10;
		var texture = null;

		if(typeof(image) == "string")
		{
			if(window.LS)
				texture = LS.ResourcesManager.textures[image];
			if(!texture)
				texture = this.images[image];
			if(texture == null)
			{
				Draw.images[image] = 1; //loading
				var img = new Image();
				img.src = image;
				img.onload = function()
				{
					var texture = GL.Texture.fromImage(this);
					Draw.images[image] = texture;
					if(Draw.onRequestFrame)
						Draw.onRequestFrame();
					return;
				}	
				return;
			}
			else if(texture == 1)
				return; //loading
		}
		else if(image.constructor == Image)
		{
			if(!image.texture)
				image.texture = GL.Texture.fromImage( this );
			texture = image.texture;
		}
		else if(image.constructor == Texture)
			texture = image;

		if(!texture)
			return;

		if(fixed_size)
		{
			this.setPointSize( size );
			texture.bind(0);
			this.renderPoints( position, null, this.shader_image );
		}
		else
		{
			this.push();
			//this.lookAt(position, this.camera_position,[0,1,0]);
			this.billboard(position);
			this.scale(size,size,size);
			texture.bind(0);
			this.renderMesh(this.quad_mesh, gl.TRIANGLE_FAN, this.shader_texture );
			this.pop();
		}
	},

	/**
	* Renders a given mesh applyting the stack transformations
	* @method renderMesh
	* @param {GL.Mesh} mesh
	* @param {enum} primitive [optional=gl.TRIANGLES] GL.TRIANGLES, gl.LINES, gl.POINTS, ...
	* @param {string} indices [optional="triangles"] the name of the buffer in the mesh with the indices
	* @param {number} range_start [optional] in case of rendering a range, the start primitive
	* @param {number} range_length [optional] in case of rendering a range, the number of primitives
	*/
	renderMesh: function( mesh, primitive, shader, indices, range_start, range_length )
	{
		if(!this.ready)
			throw ("Draw.js not initialized, call Draw.init()");
		if(!mesh)
			throw ("LS.Draw.renderMesh mesh cannot be null");

		if(!shader)
		{
			if(mesh === this._global_mesh && this._global_mesh_ignore_colors )
				shader = this.shader;
			else
				shader = mesh.vertexBuffers["colors"] ? this.shader_color : this.shader;
		}

		mat4.multiply(this.mvp_matrix, this.viewprojection_matrix, this.model_matrix );

		shader.uniforms( this.uniforms );
				
		if( range_start === undefined )
			shader.draw(mesh, primitive === undefined ? gl.TRIANGLES : primitive, indices );
		else
			shader.drawRange(mesh, primitive === undefined ? gl.TRIANGLES : primitive, range_start, range_length, indices );

		//used for repeating render 
		this._last_mesh = mesh;
		this._last_primitive = primitive;
		this._last_shader = shader;
		this._last_indices = indices;
		this._last_range_start = range_start;
		this._last_range_length = range_length;
		this._rendercalls += 1;

		this.last_mesh = mesh;
		return mesh;
	},

	/**
	* Renders several meshes in one draw call, keep in mind the shader and the browser should support instancing
	* @method renderMeshesInstanced
	* @param {GL.Mesh} mesh
	* @param {Array} matrices an array containing all the matrices
	* @param {enum} primitive [optional=gl.TRIANGLES] GL.TRIANGLES, gl.LINES, gl.POINTS, ...
	* @param {string} indices [optional="triangles"] the name of the buffer in the mesh with the indices
	*/
	renderMeshesInstanced: (function(){ 
		
		var tmp = { u_model: null };
		var tmp_matrix = mat4.create();

		return function( mesh, matrices, primitive, shader, indices )
		{
			if(!this.ready)
				throw ("Draw.js not initialized, call Draw.init()");
			if(!mesh)
				throw ("LS.Draw.renderMeshesInstanced mesh cannot be null");

			if( gl.webgl_version == 1 && !gl.extensions.ANGLE_instanced_arrays )
				return null; //instancing not supported

			if(!shader)
				shader = mesh.vertexBuffers["colors"] ? this.shader_color_instancing : this.shader_instancing;

			if( !shader.attributes.u_model )
				throw("Shader does not support instancing, it must have a attribute u_model");

			tmp.u_model = matrices;
			//this hack is done so we dont have to multiply the global model for every matrix, the VP is in reality a MVP
			tmp_matrix.set( this.viewprojection_matrix );
			mat4.multiply( this.viewprojection_matrix, this.viewprojection_matrix, this.model_matrix );

			shader.uniforms( this.uniforms );
			shader.drawInstanced( mesh, primitive === undefined ? gl.TRIANGLES : primitive, indices, tmp );

			this.viewprojection_matrix.set( tmp_matrix );
			this._rendercalls += 1;
			return mesh;
		};
	})(),

	//used in some special cases
	repeatLastRender: function()
	{
		this.renderMesh( this._last_mesh, this._last_primitive, this._last_shader, this._last_indices, this._last_range_start, this._last_range_length );
	},

	/**
	* Renders a text in 3D, in the XY plane, using the current matrix position
	* @method renderText
	* @param {string} text
	* @param {vec3} position [optional] 3D coordinate in relation to matrix
	* @param {number} scale [optional] scale modifier, default 1
	*/
	renderText: function( text, position, scale )
	{
		position = position || LS.ZEROS;
		scale = scale || 1;
		var l = text.length;
		if(l==0 || scale == 0)
			return;

		if(!Draw.font_atlas)
			this.createFontAtlas();
		var atlas = this.font_atlas;
		var char_size = atlas.atlas.char_size * scale;
		var i_char_size = 1 / atlas.atlas.char_size;
		var spacing = atlas.atlas.spacing * scale;

		var num_valid_chars = 0;
		for(var i = 0; i < l; ++i)
			if(atlas.atlas[ text.charCodeAt(i) ] != null)
				num_valid_chars++;

		var vertices = new Float32Array( num_valid_chars * 6 * 3);
		var coords = new Float32Array( num_valid_chars * 6 * 2);

		var pos = 0;
		var x = 0, y = 0;
		for(var i = 0; i < l; ++i)
		{
			var c = atlas.atlas[ text.charCodeAt(i) ];
			if(!c)
			{
				if(text.charCodeAt(i) == 10)
				{
					x = 0;
					y -= char_size;
				}
				else
					x += char_size;
				continue;
			}

			vertices.set( [x + position[0], y + position[1], position[2]], pos*6*3);
			vertices.set( [x + position[0], y + position[1] + char_size, position[2]], pos*6*3+3);
			vertices.set( [x + position[0] + char_size, y + position[1] + char_size, position[2]], pos*6*3+6);
			vertices.set( [x + position[0] + char_size, y + position[1], position[2]], pos*6*3+9);
			vertices.set( [x + position[0], y + position[1], position[2]], pos*6*3+12);
			vertices.set( [x + position[0] + char_size, y + position[1] + char_size, position[2]], pos*6*3+15);

			coords.set( [c[0], c[1]], pos*6*2);
			coords.set( [c[0], c[3]], pos*6*2+2);
			coords.set( [c[2], c[3]], pos*6*2+4);
			coords.set( [c[2], c[1]], pos*6*2+6);
			coords.set( [c[0], c[1]], pos*6*2+8);
			coords.set( [c[2], c[3]], pos*6*2+10);

			x+= spacing;
			++pos;
		}
		var mesh = this.toGlobalMesh({vertices: vertices, coords: coords});
		atlas.bind(0);
		return this.renderMesh( mesh, gl.TRIANGLES, this.shader_texture, undefined, 0, vertices.length / 3 );
	},

	/*
	renderText2D: function( text, position )
	{
		position = position || LS.ZEROS;
		if(!Draw.font_atlas)
			this.createFontAtlas();
		var atlas = this.font_atlas;
		var l = text.length;
		var char_size = atlas.atlas.char_size;
		var i_char_size = 1 / atlas.atlas.char_size;
		var spacing = atlas.atlas.spacing;

		var num_valid_chars = 0;
		for(var i = 0; i < l; ++i)
			if(atlas.atlas[ text.charCodeAt(i) ] != null)
				num_valid_chars++;

		var vertices = new Float32Array( num_valid_chars * 3 );
		var extra4 = new Float32Array( num_valid_chars * 4 );

		var pos = 0;
		var x = 0, y = 0;
		for(var i = 0; i < l; ++i)
		{
			var c = atlas.atlas[ text.charCodeAt(i) ];
			if(!c)
			{
				if(text.charCodeAt(i) == 10) //breakline
				{
					x = 0;
					y += char_size;
				}
				else
					x += char_size;
				continue;
			}

			vertices.set( position, i*3 );
			extra4.set([ c[0], c[1], x,y );

			x+= spacing;
			++pos;
		}
		var mesh = this.toGlobalMesh({ vertices: vertices, extra4: extra4 });
		this.setPointSize(20);
		atlas.bind(0);
		this.shader_text2D.uniforms({ u_char_offset: atlas.offset });
		return this.renderMesh( mesh, gl.POINTS, this.shader_text2D, undefined, 0, vertices.length / 3 );
	},
	*/

	createFontAtlas: function()
	{
		var canvas = createCanvas(512,512);
		var fontsize = (canvas.width * 0.09)|0;
		var char_size = (canvas.width * 0.1)|0;

		//$("body").append(canvas);
		var ctx = canvas.getContext("2d");
		//ctx.fillRect(0,0,canvas.width,canvas.height);
		ctx.fillStyle = "white";
		ctx.font = fontsize + "px Courier New";
		ctx.textAlign = "center";
		var x = 0;
		var y = 0;
		var xoffset = 0.5, yoffset = fontsize * -0.3;
		var atlas = { char_size: char_size, offset: char_size / canvas.width , spacing: char_size * 0.6 };

		for(var i = 6; i < 100; i++)//valid characters
		{
			var character = String.fromCharCode(i+27);
			atlas[i+27] = [x/canvas.width, 1-(y+char_size)/canvas.height, (x+char_size)/canvas.width, 1-(y)/canvas.height];
			ctx.fillText( character,Math.floor(x+char_size*xoffset),Math.floor(y+char_size+yoffset),char_size);
			x += char_size;
			if((x + char_size) > canvas.width)
			{
				x = 0;
				y += char_size;
			}
		}

		this.font_atlas = GL.Texture.fromImage(canvas, {magFilter: gl.LINEAR, minFilter: gl.LINEAR_MIPMAP_LINEAR} );
		gl.colorMask(true,true,true,false);
		this.font_atlas.fill([1,1,1,0]);
		gl.colorMask(true,true,true,true);
		this.font_atlas.atlas = atlas;
	},

	linearize: function(array) //fairly optimized
	{
		if(!array.length)
			return [];
		if(array[0].constructor === Number) //array of numbers
			return array.constructor === Float32Array ? array : new Float32Array(array);
		//linearize
		var n = array[0].length; //assuming all values have the same size!
		var result = new Float32Array(array.length * n);
		var l = array.length;
		for(var i = 0; i < l; ++i)
			result.set(array[i], i*n);
		return result;
	},

	/**
	* pushes the transform matrix into the stack to save the state
	* @method push
	*/
	push: function()
	{
		if(this.model_matrix.byteOffset >= (this.stack.byteLength - 16*4))
			throw("matrices stack overflow");

		var old = this.model_matrix;
		this.model_matrix = new Float32Array(this.stack.buffer,this.model_matrix.byteOffset + 16*4,16);
		this.uniforms.u_model = this.model_matrix;
		mat4.copy(this.model_matrix, old);
	},

	/**
	* takes the matrix from the top position of the stack to restore the last saved state
	* @method push
	*/
	pop: function()
	{
		if(this.model_matrix.byteOffset == 0)
			throw("too many pops");
		this.model_matrix = new Float32Array(this.stack.buffer,this.model_matrix.byteOffset - 16*4,16);
		this.uniforms.u_model = this.model_matrix;
	},

	/**
	* clears the transform matrix setting it to an identity
	* @method identity
	*/
	identity: function()
	{
		mat4.identity(this.model_matrix);
	},

	/**
	* changes the scale of the transform matrix. The parameters could be a vec3, a single number (then the scale is uniform in all axis) or three numbers
	* @method scale
	* @param {vec3|array|number} x could be an array of 3, one value (if no other values are specified then it is an uniform scaling)
	* @param {number} y
	* @param {number} z
	*/
	scale: function(x,y,z)
	{
		if(arguments.length == 3)
		{
			var temp = this._temp;
			temp[0] = x; temp[1] = y; temp[2] = z;
			mat4.scale(this.model_matrix,this.model_matrix,temp);
		}
		else if(x.length)//one argument: x is vec3
			mat4.scale(this.model_matrix,this.model_matrix,x);
		else //is number
		{
			var temp = this._temp;
			temp[0] = temp[1] = temp[2] = x;
			mat4.scale(this.model_matrix,this.model_matrix,temp);
		}
	},

	/**
	* applies a translation to the transform matrix
	* @method translate
	* @param {vec3|number} x could be an array of 3 or the x transform
	* @param {number} y
	* @param {number} z
	*/
	translate: function(x,y,z)
	{
		if(arguments.length == 3)
		{
			var temp = this._temp;
			temp[0] = x; temp[1] = y; temp[2] = z;
			mat4.translate(this.model_matrix,this.model_matrix,temp);
		}
		else  //one argument: x -> vec3
			mat4.translate(this.model_matrix,this.model_matrix,x);
	},

	/**
	* applies a translation to the transform matrix
	* @method rotate
	* @param {number} angle in degrees
	* @param {number|vec3} x could be the x component or the full axis
	* @param {number} y
	* @param {number} z
	*/
	rotate: function(angle, x,y,z)
	{
		if(arguments.length == 4)
		{
			var temp = this._temp;
			temp[0] = x; temp[1] = y; temp[2] = z;
			mat4.rotate(this.model_matrix, this.model_matrix, angle * DEG2RAD, [x,y,z]);
		}
		else //two arguments: x -> vec3
			mat4.rotate(this.model_matrix, this.model_matrix, angle * DEG2RAD, x);
	},

	/**
	* moves an object to a given position and forces it to look to another direction
	* Warning: it doesnt changes the camera in any way, only the transform matrix
	* @method lookAt
	* @param {vec3} position
	* @param {vec3} target
	* @param {vec3} up
	*/
	lookAt: function(position, target, up)
	{
		mat4.lookAt( this.model_matrix, position, target, up );
		mat4.invert( this.model_matrix, this.model_matrix );
	},

	billboard: function(position)
	{
		mat4.invert(this.model_matrix, this.view_matrix);
		mat4.setTranslation(this.model_matrix, position);
	},

	fromTranslationFrontTop: function(position, front, top)
	{
		mat4.fromTranslationFrontTop(this.model_matrix, position, front, top);
	},

	/**
	* projects a point from 3D space to 2D space (multiply by MVP)
	* @method project
	* @param {vec3} position
	* @param {vec3} dest [optional]
	* @return {vec3} the point in screen space (in normalized coordinates)
	*/
	project: function( position, dest )
	{
		dest = dest || vec3.create();
		return mat4.multiplyVec3(dest, this.mvp_matrix, position);
	},

	getPhongShader: function( ambient_color, light_color, light_dir, instanced )
	{
		var shader = instanced ? this.shader_phong_instanced : this.shader_phong;
		vec3.normalize( light_dir, light_dir );
		shader.uniforms({ u_ambient_color: ambient_color, u_light_color: light_color, u_light_dir: light_dir });
		return shader;
	},

	getDepthShader: function()
	{
		return this.shader_depth;
	},

	//reuses a global mesh to avoid fragmenting the VRAM 
	toGlobalMesh: function( buffers, indices )
	{
		if(!this._global_mesh)
		{
			//global mesh: to reuse memory and save fragmentation
			this._global_mesh_max_vertices = 1024;
			this._global_mesh = new GL.Mesh({
				vertices: new Float32Array(this._global_mesh_max_vertices * 3),
				normals: new Float32Array(this._global_mesh_max_vertices * 3),
				coords: new Float32Array(this._global_mesh_max_vertices * 2),
				colors: new Float32Array(this._global_mesh_max_vertices * 4),
				extra: new Float32Array(this._global_mesh_max_vertices * 1)
			},{
				indices: new Uint16Array(this._global_mesh_max_vertices * 3)
			}, { stream_type: gl.DYNAMIC_STREAM });
		}

		//take every stream and store it inside the mesh buffers
		for(var i in buffers)
		{
			var mesh_buffer = this._global_mesh.getBuffer( i );
			if(!mesh_buffer)
			{
				console.warn("Draw: global mesh lacks one buffer: " + i );
				continue;
			}

			var buffer_data = buffers[i];
			if(!buffer_data)
				continue;
			if(!buffer_data.buffer)
				buffer_data = new Float32Array( buffer_data ); //force typed arrays

			//some data would be lost here
			if(buffer_data.length > mesh_buffer.data.length)
			{
				console.warn("Draw: data is too big, resizing" );
				this.resizeGlobalMesh();
				mesh_buffer = this._global_mesh.getBuffer( i );
				buffer_data = buffer_data.subarray(0,mesh_buffer.data.length);
			}

			mesh_buffer.setData( buffer_data ); //set and upload
		}

		this._global_mesh_ignore_colors = !(buffers.colors);

		if(indices)
		{
			var mesh_buffer = this._global_mesh.getIndexBuffer("indices");			
			mesh_buffer.setData( indices );
			this._global_mesh_last_size = indices.length;
		}
		else
			this._global_mesh_last_size = buffers["vertices"].length / 3;
		return this._global_mesh;
	},

	resizeGlobalMesh: function()
	{
		if(!this._global_mesh)
			throw("No global mesh to resize");

		//global mesh: to reuse memory and save fragmentation
		this._global_mesh_max_vertices = this._global_mesh_max_vertices * 2;
		this._global_mesh.deleteBuffers();

		this._global_mesh = new GL.Mesh({
			vertices: new Float32Array(this._global_mesh_max_vertices * 3),
			normals: new Float32Array(this._global_mesh_max_vertices * 3),
			coords: new Float32Array(this._global_mesh_max_vertices * 2),
			colors: new Float32Array(this._global_mesh_max_vertices * 4),
			extra: new Float32Array(this._global_mesh_max_vertices * 1)
		},{
			indices: new Uint16Array(this._global_mesh_max_vertices * 3)
		}, { stream_type: gl.DYNAMIC_STREAM });
	}
};


Draw.vertex_shader_code = '\
	precision mediump float;\n\
	attribute vec3 a_vertex;\n\
	varying vec3 v_vertex;\n\
	attribute vec3 a_normal;\n\
	varying vec3 v_normal;\n\
	#ifdef USE_COLOR\n\
		attribute vec4 a_color;\n\
		varying vec4 v_color;\n\
	#endif\n\
	#ifdef USE_TEXTURE\n\
		attribute vec2 a_coord;\n\
		varying vec2 v_coord;\n\
	#endif\n\
	#ifdef USE_SIZE\n\
		attribute float a_extra;\n\
	#endif\n\
	#ifdef USE_INSTANCING\n\
		attribute mat4 u_model;\n\
	#else\n\
		uniform mat4 u_model;\n\
	#endif\n\
	uniform mat4 u_viewprojection;\n\
	uniform float u_point_size;\n\
	uniform float u_perspective;\n\
	uniform float u_point_perspective;\n\
	float computePointSize(float radius, float w)\n\
	{\n\
		if(radius < 0.0)\n\
			return -radius;\n\
		return u_perspective * radius / w;\n\
	}\n\
	void main() {\n\
		#ifdef USE_TEXTURE\n\
			v_coord = a_coord;\n\
		#endif\n\
		#ifdef USE_COLOR\n\
			v_color = a_color;\n\
		#endif\n\
		v_vertex = ( u_model * vec4( a_vertex, 1.0 )).xyz;\n\
		v_normal = ( u_model * vec4( a_normal, 0.0 )).xyz;\n\
		gl_Position = u_viewprojection * vec4(v_vertex,1.0);\n\
		gl_PointSize = u_point_size;\n\
		#ifdef USE_SIZE\n\
			gl_PointSize = a_extra;\n\
		#endif\n\
		if(u_point_perspective != 0.0)\n\
			gl_PointSize = computePointSize( gl_PointSize, gl_Position.w );\n\
	}\
';

Draw.fragment_shader_code = '\
	precision mediump float;\n\
	uniform vec4 u_color;\n\
	#ifdef USE_COLOR\n\
		varying vec4 v_color;\n\
	#endif\n\
	#ifdef USE_TEXTURE\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
	#endif\n\
	void main() {\n\
		vec4 color = u_color;\n\
		#ifdef USE_TEXTURE\n\
		  color *= texture2D(u_texture, v_coord);\n\
		  if(color.a < 0.1)\n\
			discard;\n\
		#endif\n\
		#ifdef USE_POINTS\n\
			float dist = length( gl_PointCoord.xy - vec2(0.5) );\n\
			if( dist > 0.45 )\n\
				discard;\n\
		#endif\n\
		#ifdef USE_COLOR\n\
			color *= v_color;\n\
		#endif\n\
		gl_FragColor = color;\n\
	}\
';

/**
* Renders one mesh, it allows to configure the rendering primitive, the submesh (range of mesh) and a level of detail mesh
* @class MeshRenderer
* @namespace LS.Components
* @constructor
* @param {Object} object to configure from
*/
function MeshRenderer(o)
{
	this._enabled = true;

	this._mesh = null;

	this._lod_mesh = null;

	this._submesh_id = -1;

	this._material = null;

	this._primitive = -1;

	this._must_update_static = true; //used in static meshes
	this._transform_version = -1;

	//used to render with several materials (WIP, not finished yet)
	this.use_submaterials = false;
	this.submaterials = [];

	if(o)
		this.configure(o);

	this._RI = new LS.RenderInstance( null, this );
	//this._RIs = [];
	this._is_attached = false;
}

Object.defineProperty( MeshRenderer.prototype, 'enabled', {
	get: function() { return this._enabled; },
	set: function(v) { 
		v = !!v;
		this._enabled = v;
		this.checkRenderInstances();
	},
	enumerable: true
});

/**
* The GL primitive to use when rendering this mesh (gl.POINTS, gl.TRIANGLES, etc), -1 is default, it also supports the option 10 which means Wireframe
* @property primitive {number}
* @default -1;
*/
Object.defineProperty( MeshRenderer.prototype, 'primitive', {
	get: function() { return this._primitive; },
	set: function(v) { 
		v = (v === undefined || v === null ? -1 : v|0);
		if( v < -1 || v > 10 )
			return;
		this._primitive = v;
		//this.updateRIs();
	},
	enumerable: true
});

/**
* The material to apply to this render, if not provided the one in the node will be used
* @property material {string}
* @default -1;
*/
Object.defineProperty( MeshRenderer.prototype, 'material', {
	get: function() { return this._material; },
	set: function(v) { 
		this._material = v;
		//this.updateRIs();
	},
	enumerable: true
});

/**
* The name of the mesh to render
* @property mesh {string}
* @default null;
*/
Object.defineProperty( MeshRenderer.prototype, 'mesh', {
	get: function() { return this._mesh; },
	set: function(v) { 
		this._mesh = v;
		//this.updateRIs();
	},
	enumerable: true
});

/**
* The name of the mesh to render in case the mesh is far away, this mesh is also used for collision testing if using raycast to RenderInstances
* @property lod_mesh {string}
* @default null;
*/
Object.defineProperty( MeshRenderer.prototype, 'lod_mesh', {
	get: function() { return this._lod_mesh; },
	set: function(v) { 
		this._lod_mesh = v;
		//this.updateRIs();
	},
	enumerable: true
});

/**
* The id of the submesh group to render, if the id is -1 then all the mesh is rendered.
* @property submesh_id {number}
* @default -1;
*/
Object.defineProperty( MeshRenderer.prototype, 'submesh_id', {
	get: function() { return this._submesh_id; },
	set: function(v) { 
		//what about if v is a string, search for the index?
		this._submesh_id = v;
	},
	enumerable: true
});

Object.defineProperty( MeshRenderer.prototype, 'render_instance', {
	get: function() { return this._RI; },
	set: function(v) { throw("cannot set a render_instance, must use the collectRenderInstances process."); },
	enumerable: false
});

MeshRenderer.icon = "mini-icon-teapot.png";

//vars
MeshRenderer["@mesh"] = { type: "mesh" };
MeshRenderer["@lod_mesh"] = { type: "mesh" };
MeshRenderer["@material"] = { type: "material" };
MeshRenderer["@primitive"] = { type:"enum", values: {"Default":-1, "Points": 0, "Lines":1, "LineLoop":2, "LineStrip":3, "Triangles":4, "TriangleStrip":5, "TriangleFan":6, "Wireframe":10 }};
MeshRenderer["@submesh_id"] = { type:"enum", values: function() {
	var component = this.instance;
	var mesh = component.getMesh();
	if(!mesh)
		return null;

	if(!mesh || !mesh.info || !mesh.info.groups)
		return null;

	var t = {"all":null};
	for(var i = 0; i < mesh.info.groups.length; ++i)
		t[mesh.info.groups[i].name] = i;
	return t;
}};

MeshRenderer["@use_submaterials"] = { type: LS.TYPES.BOOLEAN, widget: null }; //avoid widget
MeshRenderer["@submaterials"] = { widget: null }; //avoid 

//we bind to onAddedToNode because the event is triggered per node so we know which RIs belong to which node
MeshRenderer.prototype.onAddedToScene = function( scene )
{
	this.checkRenderInstances();
}

MeshRenderer.prototype.onRemovedFromScene = function( scene )
{
	this.checkRenderInstances();
}

MeshRenderer.prototype.onAddedToNode = function( node )
{
	//LEvent.bind( node, "materialChanged", this.updateRIs, this );
	LEvent.bind( node, "collectRenderInstances", this.onCollectInstances, this );
	this._RI.node = node;
}

MeshRenderer.prototype.onRemovedFromNode = function( node )
{
	//LEvent.unbind( node, "materialChanged", this.updateRIs, this );
	LEvent.unbind( node, "collectRenderInstances", this.onCollectInstances, this );
}


/**
* Configure from a serialized object
* @method configure
* @param {Object} object with the serialized info
*/
MeshRenderer.prototype.configure = function(o)
{
	if(o.uid)
		this.uid = o.uid;
	if(o.enabled !== undefined)
		this.enabled = o.enabled;
	this.mesh = o.mesh;
	this.lod_mesh = o.lod_mesh;
	if(o.submesh_id !== undefined)
		this.submesh_id = o.submesh_id;
	this.primitive = o.primitive; //gl.TRIANGLES
	this.material = o.material;
	this.use_submaterials = !!o.use_submaterials;
	if(o.submaterials)
		this.submaterials = o.submaterials;
	if(o.material && o.material.constructor === String)
		this.material = o.material;
}

/**
* Serialize the object 
* @method serialize
* @return {Object} object with the serialized info
*/
MeshRenderer.prototype.serialize = function()
{
	var o = { 
		object_class: "MeshRenderer",
		enabled: this.enabled,
		uid: this.uid,
		mesh: this.mesh,
		lod_mesh: this.lod_mesh
	};

	if(this.material && this.material.constructor === String )
		o.material = this.material;

	if(this.primitive != -1)
		o.primitive = this.primitive;
	if(this.submesh_id != -1)
		o.submesh_id = this.submesh_id;
	o.material = this.material;

	if(this.use_submaterials)
		o.use_submaterials = this.use_submaterials;
	o.submaterials = this.submaterials;

	return o;
}

MeshRenderer.prototype.getMesh = function() {
	if(!this.mesh)
		return null;

	if( this.mesh.constructor === String )
		return LS.ResourcesManager.meshes[ this.mesh ];
	return this.mesh;
}

MeshRenderer.prototype.getLODMesh = function() {
	if(!this.lod_mesh)
		return null;

	if( this.lod_mesh.constructor === String )
		return LS.ResourcesManager.meshes[ this.lod_mesh ];

	return null;
}

MeshRenderer.prototype.getAnyMesh = function() {
	return (this.getMesh() || this.getLODMesh());
}

MeshRenderer.prototype.getResources = function(res)
{
	if( this.mesh && this.mesh.constructor === String )
		res[ this.mesh ] = GL.Mesh;
	if( this.lod_mesh && this.lod_mesh.constructor === String )
		res[this.lod_mesh] = GL.Mesh;
	if( this.material && this.material.constructor === String )
		res[this.material] = LS.Material;

	if(this.use_submaterials)
	{
		for(var i  = 0; i < this.submaterials.length; ++i)
			if(this.submaterials[i])
				res[this.submaterials[i]] = LS.Material;
	}
	return res;
}

MeshRenderer.prototype.onResourceRenamed = function (old_name, new_name, resource)
{
	if(this.mesh == old_name)
		this.mesh = new_name;
	if(this.lod_mesh == old_name)
		this.lod_mesh = new_name;
	if(this.material == old_name)
		this.material = new_name;
	if(this.morph_targets)
		for(var i in this.morph_targets)
			if( this.morph_targets[i].mesh == old_name )
				this.morph_targets[i].mesh = new_name;
}

MeshRenderer.prototype.checkRenderInstances = function()
{
	return;
	/*
	var should_be_attached = this._enabled && this._root.scene;

	if( should_be_attached && !this._is_attached )
	{
		this._root.scene.attachSceneElement( this._RI );
		this._is_attached = true;
	}
	else if( !should_be_attached && this._is_attached )
	{
		this._root.scene.detachSceneElement( this._RI );
		this._is_attached = false;
	}
	*/
}

//*
//MeshRenderer.prototype.getRenderInstance = function(options)
MeshRenderer.prototype.onCollectInstances = function(e, instances)
{
	if(!this._enabled)
		return;

	if(this.use_submaterials)
	{
		this.onCollectInstancesSubmaterials( instances );
		return;
	}

	var mesh = this.getAnyMesh();
	if(!mesh)
		return null;

	var node = this._root;
	if(!this._root)
		return;

	var RI = this._RI;
	var is_static = this._root.flags && this._root.flags.is_static;
	var transform = this._root.transform;
	RI.layers = this._root.layers;

	//optimize
	//if( is_static && LS.allow_static && !this._must_update_static && (!transform || (transform && this._transform_version == transform._version)) )
	//	return instances.push( RI );

	//assigns matrix, layers
	RI.fromNode( this._root );

	//material (after flags because it modifies the flags)
	var material = null;
	if(this.material)
		material = LS.ResourcesManager.getResource( this.material );
	else
		material = this._root.getMaterial();
	RI.setMaterial( material );

	//buffers from mesh and bounding
	RI.setMesh( mesh, this.primitive );

	if(this.submesh_id != -1 && this.submesh_id != null && mesh.info && mesh.info.groups)
	{
		var group = mesh.info.groups[this.submesh_id];
		if(group)
		{
			RI.setRange( group.start, group.length );
			if( group.bounding )
				RI.setBoundingBox( group.bounding );
		}
	}
	else
		RI.setRange(0,-1);

	//used for raycasting
	/*
	if(this.lod_mesh)
	{
		if( this.lod_mesh.constructor === String )
			RI.collision_mesh = LS.ResourcesManager.resources[ this.lod_mesh ];
		else
			RI.collision_mesh = this.lod_mesh;
		//RI.setLODMesh( RI.collision_mesh );
	}
	else
	*/
		RI.collision_mesh = mesh;

	//mark it as ready once no more changes should be applied
	if( is_static && LS.allow_static && !this.isLoading() )
	{
		this._must_update_static = false;
		this._transform_version = transform ? transform._version : 0;
	}

	instances.push( RI );
}

/*
//called everytime something affecting this RIs configuration changes
MeshRenderer.prototype.updateRIs = function()
{
	return;

	var node = this._root;
	if(!node)
		return;

	var RI = this._RI;
	var is_static = this._root.flags && this._root.flags.is_static;
	var transform = this._root.transform;

	//optimize: TODO
	//if( is_static && LS.allow_static && !this._must_update_static && (!transform || (transform && this._transform_version == transform._version)) )
	//	return instances.push( RI );

	//assigns matrix, layers
	RI.fromNode( this._root );

	//material (after flags because it modifies the flags)
	var material = null;
	if(this.material)
		material = LS.ResourcesManager.getResource( this.material );
	else
		material = this._root.getMaterial();
	RI.setMaterial( material );

	//buffers from mesh and bounding
	var mesh = LS.ResourcesManager.getMesh( this._mesh );
	if( mesh )
	{
		RI.setMesh( mesh, this.primitive );
		if(this._submesh_id != -1 && this._submesh_id != null && mesh.info && mesh.info.groups)
		{
			var group = mesh.info.groups[this._submesh_id];
			if(group)
				RI.setRange( group.start, group.length );
		}
		else
			RI.setRange(0,-1);
	}
	else
	{
		RI.setMesh( null );
		RI.setRange(0,-1);
		if(this._once_binding_index != null)
			this._once_binding_index = LS.ResourcesManager.onceLoaded( this._mesh, this.updateRIs.bind(this ) );
	}

	//used for raycasting
	if(this.lod_mesh)
	{
		if( this.lod_mesh.constructor === String )
			RI.collision_mesh = LS.ResourcesManager.resources[ this.lod_mesh ];
		else
			RI.collision_mesh = this.lod_mesh;
		//RI.setLODMesh( RI.collision_mesh );
	}
	else
		RI.collision_mesh = mesh;

	//mark it as ready once no more changes should be applied
	if( is_static && LS.allow_static && !this.isLoading() )
	{
		this._must_update_static = false;
		this._transform_version = transform ? transform._version : 0;
	}
}
*/


//not fully tested
MeshRenderer.prototype.onCollectInstancesSubmaterials = function(instances)
{
	if(!this._RIs)
		this._RIs = [];

	var mesh = this.getMesh();
	if(!mesh)
		return;

	var groups = mesh.info.groups;
	if(!groups)
		return;

	var global = this._root.transform._global_matrix;
	var center = vec3.create();
	mat4.multiplyVec3( center, global, LS.ZEROS );
	var first_RI = null;

	for(var i = 0; i < this.submaterials.length; ++i)
	{
		var submaterial_name = this.submaterials[i];
		if(!submaterial_name)
			continue;
		var group = groups[i];
		if(!group)
			continue;
		var material = LS.ResourcesManager.getResource( submaterial_name );
		if(!material)
			continue;

		var RI = this._RIs[i];
		if(!RI)
			RI = this._RIs[i] = new LS.RenderInstance(this._root,this);

		if(!first_RI)
			RI.setMatrix( this._root.transform._global_matrix );
		else
			RI.setMatrix( first_RI.matrix, first_RI.normal_matrix );
		RI.center.set(center);

		//flags
		RI.setMaterial( material );
		RI.setMesh( mesh, this.primitive );
		RI.setRange( group.start, group.length );
		instances.push(RI);

		if(!first_RI)
			first_RI = RI;
	}
}
//*/

//test if any of the assets is being loaded
MeshRenderer.prototype.isLoading = function()
{
	if( this.mesh && LS.ResourcesManager.isLoading( this.mesh ))
		return true;
	if( this.lod_mesh && LS.ResourcesManager.isLoading( this.lod_mesh ))
		return true;
	if( this.material && LS.ResourcesManager.isLoading( this.material ))
		return true;
	if(this._root && this._root.material && this._root.material.constructor === String && LS.ResourcesManager.isLoading( this._root.material ))
		return true;
	return false;
}

//used when a node has too many submeshes with materials
MeshRenderer.prototype.explodeSubmeshesToChildNodes = function() { 
	var node = this._root;
	if(!node)
		return;

	var mesh = this.getMesh();
	if(!mesh || !mesh.info || !mesh.info.groups )
		return;

	node.removeComponent( this );

	for(var i = 0; i < mesh.info.groups.length; ++i)
	{
		var group = mesh.info.groups[i];
		var child_node = new LS.SceneNode();
		node.addChild( child_node );
		var comp = new LS.Components.MeshRenderer({ mesh: this.mesh, submesh_id: i, material: group.material });
		child_node.addComponent( comp );	
	}

	LS.GlobalScene.refresh();
}

LS.registerComponent( MeshRenderer );
LS.MeshRenderer = MeshRenderer;
///@FILE:../src/components/morphDeformer.js
///@INFO: UNCOMMON

/**
* It complements a MeshRenderer to add Morph Targets (Blend Shapes) to deform meshes.
* Morph Targets of a mesh must have the same topology and number of vertex, otherwise it won't work.
* @class MorphDeformer
* @namespace LS.Components
* @constructor
* @param {Object} object to configure from
*/
function MorphDeformer(o)
{
	this.enabled = true;

	/**
	* The mode used to apply the morph targets, could be using the CPU, the GPU using uniforms( limited by the browser/driver) or using Textures (more expensive). Leave it as automatic so the system knows the best case.
	* @property mode {Number} MorphDeformer.AUTOMATIC, MorphDeformer.CPU, MorphDeformer.STREAMS, MorphDeformer.TEXTURES
	* @default MorphDeformer.AUTOMATIC;
	*/
	this.mode = MorphDeformer.AUTOMATIC;

	/**
	* if true the meshes will be treated as a increment over the base mesh, not as an absolute mesh
	* @property delta_meshes {Boolean} 
	* @default MorphDeformer.AUTOMATIC;
	*/
	this.delta_meshes = false;

	/**
	* An array with every morph targets info in the form of { mesh: mesh_name, weight: number }
	* @property morph_targets {Array}
	* @default [];
	*/
	this.morph_targets = [];

	//used to speed up search of morphs by its name instead of index
	this._morph_targets_by_name = {};

	if(global.gl)
	{
		if(MorphDeformer.max_supported_vertex_attribs === undefined)
			MorphDeformer.max_supported_vertex_attribs = gl.getParameter( gl.MAX_VERTEX_ATTRIBS );
		if(MorphDeformer.max_supported_morph_targets_using_streams === undefined)
			MorphDeformer.max_supported_morph_targets_using_streams = (gl.getParameter( gl.MAX_VERTEX_ATTRIBS ) - 6) / 2; //6 reserved for vertex, normal, uvs, uvs2, weights, bones. 
	}
	
	this._stream_weights = new Float32Array( 4 );
	this._uniforms = { u_morph_weights: this._stream_weights, u_morph_info: 0 };

	if(o)
		this.configure(o);
}

MorphDeformer.AUTOMATIC = 0;
MorphDeformer.CPU = 1;
MorphDeformer.STREAMS = 2;
MorphDeformer.TEXTURES = 3;

MorphDeformer.icon = "mini-icon-teapot.png";
MorphDeformer.force_GPU  = true; //used to avoid to recompile the shader when all morphs are 0
MorphDeformer["@mode"] = { type:"enum", values: {"automatic": MorphDeformer.AUTOMATIC, "CPU": MorphDeformer.CPU, "streams": MorphDeformer.STREAMS, "textures": MorphDeformer.TEXTURES }};

MorphDeformer.prototype.onAddedToNode = function(node)
{
	LEvent.bind( node, "collectRenderInstances", this.onCollectInstances, this );
}

MorphDeformer.prototype.onConfigure = function(o)
{
	this.updateNamesIndex();
}

MorphDeformer.prototype.updateNamesIndex = function()
{
	for(var i = 0; i < this.morph_targets.length; ++i)
	{
		var morph = this.morph_targets[i];
		if(morph.name)
			this._morph_targets_by_name[ morph.name ] = morph;
	}
}

//object with name:weight
Object.defineProperty( MorphDeformer.prototype, "name_weights", {
	set: function(v) {
		if(!v)
			return;
		for(var i = 0; i < this.morph_targets.length; ++i)
		{
			var m = this.morph_targets[i];
			if(v[m.name] !== undefined)
			{
				var weight = Number(v[m.name]);
				if(!isNaN(weight))	
					m.weight = weight;
			}
		}
	},
	get: function()
	{
		var result = {};
		for(var i = 0; i < this.morph_targets.length; ++i)
		{
			var m = this.morph_targets[i];
			if(m.name)
				result[ m.name ] = m.weight;
		}
		return result;
	},
	enumeration: false
});

//object with mesh:weight
Object.defineProperty( MorphDeformer.prototype, "mesh_weights", {
	set: function(v) {
		if(!v)
			return;
		for(var i = 0; i < this.morph_targets.length; ++i)
		{
			var m = this.morph_targets[i];
			if(v[m.mesh] !== undefined)
			{
				var weight = Number(v[m.mesh]);
				if(!isNaN(weight))	
					m.weight = weight;
			}
		}
	},
	get: function()
	{
		var result = {};
		for(var i = 0; i < this.morph_targets.length; ++i)
		{
			var m = this.morph_targets[i];
			result[ m.mesh ] = m.weight;
		}
		return result;
	},
	enumeration: false
});


Object.defineProperty( MorphDeformer.prototype, "weights", {
	set: function(v) {
		if(!v || !v.length)
			return;
		for(var i = 0; i < v.length; ++i)
			if( this.morph_targets[i] )
				this.morph_targets[i].weight = v[i] || 0;
	},
	get: function()
	{
		var result = new Array( this.morph_targets.length );
		for(var i = 0; i < this.morph_targets.length; ++i)
			result[i] = this.morph_targets[i].weight;
		return result;
	},
	enumeration: false
});

MorphDeformer.prototype.onRemovedFromNode = function(node)
{
	LEvent.unbind( node, "collectRenderInstances", this.onCollectInstances, this );

	//disable
	if( this._last_RI )
		this.disableMorphingGPU( this._last_RI );
	this._last_RI = null;
}

MorphDeformer.prototype.getResources = function(res)
{
	for(var i = 0; i < this.morph_targets.length; ++i)
		if( this.morph_targets[i].mesh )
			res[ this.morph_targets[i].mesh ] = GL.Mesh;
}

MorphDeformer.prototype.onResourceRenamed = function (old_name, new_name, resource)
{
	for(var i = 0; i < this.morph_targets.length; ++i)
		if( this.morph_targets[i].mesh == old_name )
			this.morph_targets[i].mesh = new_name;
}


/**
* Sets the weight for all the 
* @method clearWeights
* @param {Object} object with the serialized info
*/
MorphDeformer.prototype.clearWeights = function()
{
	for(var i = 0; i < this.morph_targets.length; ++i)
		this.morph_targets[i].weight = 0;
}

/**
* Adds a new morph target
* @method addMorph
* @param {String} mesh_name
* @param {Number} weight
*/
MorphDeformer.prototype.addMorph = function( mesh_name, weight)
{
	weight = weight || 0;
	var index = this.getMorphIndex( mesh_name );
	if(index == -1)
		this.morph_targets.push({mesh: mesh_name, weight: weight});
	else
		this.morph_targets[index] = {mesh: mesh_name, weight: weight};
}

MorphDeformer.prototype.onCollectInstances = function( e, render_instances )
{
	if(!render_instances.length || MorphDeformer.max_supported_vertex_attribs < 16)
		return;

	var morph_RI = this.enabled ? render_instances[ render_instances.length - 1] : null;
	
	if( morph_RI != this._last_RI && this._last_RI )
		this.disableMorphingGPU( this._last_RI );
	this._last_RI = morph_RI;

	if( !morph_RI || !morph_RI.mesh)
		return;

	this._last_base_mesh = morph_RI.mesh;
	this._valid_morphs = this.computeValidMorphs( this._valid_morphs, morph_RI.mesh );

	//grab the RI created previously and modified
	//this.applyMorphTargets( last_RI );

	if(this.mode === MorphDeformer.AUTOMATIC )
	{
		if( this._morph_texture_supported === undefined )
			this._morph_texture_supported = (gl.extensions["OES_texture_float"] !== undefined && gl.getParameter( gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS ) > 1);

		if( this._valid_morphs.length == 0 && !MorphDeformer.force_GPU )
			return;

		if( this._valid_morphs.length <= MorphDeformer.max_supported_morph_targets_using_streams ) //use GPU
			this.applyMorphTargetsByGPU( morph_RI, this._valid_morphs );
		else if( this._morph_texture_supported ) //use GPU with textures
			this.applyMorphUsingTextures( morph_RI, this._valid_morphs );
		else
			this.applyMorphBySoftware( morph_RI, this._valid_morphs );
	}
	else
	{
		switch( this.mode )
		{
			case MorphDeformer.STREAMS: this.applyMorphTargetsByGPU( morph_RI, this._valid_morphs ); break;
			case MorphDeformer.TEXTURES: this.applyMorphUsingTextures( morph_RI, this._valid_morphs ); break;
			default: this.applyMorphBySoftware( morph_RI, this._valid_morphs ); break;
		}
	}
}

//returns a list of the morph targets that have some weight and with a mesh that is loaded
MorphDeformer.prototype.computeValidMorphs = function( valid_morphs, base_mesh )
{
	valid_morphs = valid_morphs || [];
	valid_morphs.length = 0;

	if(!base_mesh)
		return valid_morphs;

	//sort by weight
	var morph_targets = this.morph_targets.concat();
	morph_targets.sort( function(a,b) { return Math.abs(b.weight) - Math.abs(a.weight);  } );

	//collect
	for(var i = 0; i < morph_targets.length; ++i)
	{
		var morph = morph_targets[i];
		if(!morph.mesh || Math.abs(morph.weight) < 0.001)
			continue;
		var morph_mesh = LS.ResourcesManager.resources[ morph.mesh ];
		if(!morph_mesh || morph_mesh.constructor !== GL.Mesh)
			continue;
		if(!morph_mesh.info)
			morph_mesh.info = {};
		morph_mesh.info.morph_target_from = base_mesh.filename;
		valid_morphs.push( { name: morph.mesh, weight: morph.weight, mesh: morph_mesh } );
	}

	return valid_morphs;
}

//add to the RI the info to apply the morphs using streams in the GPU
MorphDeformer.prototype.applyMorphTargetsByGPU = function( RI, valid_morphs )
{
	var base_mesh = RI.mesh;

	var base_vertices_buffer = base_mesh.vertexBuffers["vertices"];
	var streams_code = "";
	var morphs_buffers = {};
	var morphs_weights = [];

	//collect (max 4 if using streams)
	for(var i = 0; i < valid_morphs.length && i < 4; ++i)
	{
		var morph = valid_morphs[i];
		var morph_mesh = morph.mesh;

		var vertices_buffer = morph_mesh.vertexBuffers["vertices"];
		if(!vertices_buffer || vertices_buffer.data.length != base_vertices_buffer.data.length)
			continue;

		var normals_buffer = morph_mesh.vertexBuffers["normals"];
		if(!normals_buffer)
			continue;

		var vertices_cloned = vertices_buffer.clone(true);
		var normals_cloned = normals_buffer.clone(true);
		vertices_cloned.attribute = null;
		normals_cloned.attribute = null;

		morphs_buffers["a_vertex_morph" + i ] = vertices_cloned;
		morphs_buffers["a_normal_morph" + i ] = normals_cloned;

		morphs_weights.push( morph.weight );
	}

	//add buffers
	RI.vertex_buffers = {};
	for(var i in base_mesh.vertexBuffers)
		RI.vertex_buffers[i] = base_mesh.vertexBuffers[i];
	for(var i in morphs_buffers)
		RI.vertex_buffers[i] = morphs_buffers[i];

	if(RI.samplers[ LS.Renderer.MORPHS_TEXTURE_SLOT ])
	{
		delete RI.uniforms["u_morph_vertices_texture"];
		delete RI.uniforms["u_morph_normals_texture"];
		RI.samplers[ LS.Renderer.MORPHS_TEXTURE_SLOT ] = null;
		RI.samplers[ LS.Renderer.MORPHS_TEXTURE2_SLOT ] = null;
	}

	var weights = this._stream_weights;
	if( !weights.fill ) //is an Array?
	{
		for(var i = 0; i < weights.length; ++i)
			weights[i] = 0;
	}
	else
		weights.fill(0); //fill first because morphs_weights could have zero length
	weights.set( morphs_weights );
	RI.uniforms["u_morph_weights"] = weights;
	RI.uniforms["u_morph_info"] = this.delta_meshes ? 1 : 0;

	//SHADER BLOCK
	RI.addShaderBlock( MorphDeformer.shader_block ); //global
	RI.addShaderBlock( LS.MorphDeformer.morphing_streams_block, this._uniforms );
	RI.removeShaderBlock( LS.MorphDeformer.morphing_texture_block );
}

MorphDeformer.prototype.applyMorphUsingTextures = function( RI, valid_morphs )
{
	var base_mesh = RI.mesh;
	var base_vertices_buffer = base_mesh.vertexBuffers["vertices"];
	var base_normals_buffer = base_mesh.vertexBuffers["normals"];

	//create textures for the base mesh
	if(!base_vertices_buffer._texture)
		base_vertices_buffer._texture = this.createGeometryTexture( base_vertices_buffer );
	if(!base_normals_buffer._texture)
		base_normals_buffer._texture = this.createGeometryTexture( base_normals_buffer );

	//LS.RM.textures[":debug_base_vertex"] = base_vertices_buffer._texture;
	//LS.RM.textures[":debug_base_normal"] = base_normals_buffer._texture;


	var morphs_textures = [];

	//create the texture container where all will be merged
	if(!this._morphtarget_vertices_texture || this._morphtarget_vertices_texture.height != base_vertices_buffer._texture.height )
	{
		this._morphtarget_vertices_texture = new GL.Texture( base_vertices_buffer._texture.width, base_vertices_buffer._texture.height, { format: gl.RGB, type: gl.FLOAT, filter: gl.NEAREST, wrap: gl.CLAMP_TO_EDGE, no_flip: false });
		this._morphtarget_normals_texture = new GL.Texture( base_normals_buffer._texture.width, base_normals_buffer._texture.height, { format: gl.RGB, type: gl.FLOAT, filter: gl.NEAREST, wrap: gl.CLAMP_TO_EDGE, no_flip: false });

		//used in the shader
		this._texture_size = vec4.fromValues( this._morphtarget_vertices_texture.width, this._morphtarget_vertices_texture.height, 
			1 / this._morphtarget_vertices_texture.width, 1 / this._morphtarget_vertices_texture.height );

		//LS.RM.textures[":debug_morph_vertex"] = this._morphtarget_vertices_texture;
		//LS.RM.textures[":debug_morph_normal"] = this._morphtarget_normals_texture;
	}

	//prepare morph targets
	for(var i = 0; i < valid_morphs.length; ++i)
	{
		var morph = valid_morphs[i];
		var morph_mesh = morph.mesh;

		var vertices_buffer = morph_mesh.vertexBuffers["vertices"];
		if(!vertices_buffer || vertices_buffer.data.length != base_vertices_buffer.data.length)
			continue;

		var normals_buffer = morph_mesh.vertexBuffers["normals"];
		if(!normals_buffer)
			continue;

		if(!vertices_buffer._texture)
			vertices_buffer._texture = this.createGeometryTexture( vertices_buffer );
		if(!normals_buffer._texture)
			normals_buffer._texture = this.createGeometryTexture( normals_buffer );

		//LS.RM.textures[":debug_morph_vertex_" + i] = vertices_buffer._texture;
		//LS.RM.textures[":debug_morph_normal_" + i] = normals_buffer._texture;
		morphs_textures.push( { weight: morph.weight, vertices: vertices_buffer._texture, normals: normals_buffer._texture } );
	}

	//accumulate all morphs targets in two textures that contains the final vertex and final normal

	var shader = this.getMorphTextureShader();
	shader.uniforms({ u_base_texture: 0, u_morph_texture: 1 });

	gl.disable( gl.DEPTH_TEST );
	gl.enable( gl.BLEND );
	gl.blendFunc( gl.ONE, gl.ONE );

	base_vertices_buffer._texture.bind(0);
	var quad_mesh = GL.Mesh.getScreenQuad();

	this._morphtarget_vertices_texture.drawTo( function(){
		gl.clearColor( 0,0,0,0 );
		gl.clear( gl.COLOR_BUFFER_BIT );
		for(var i = 0; i < morphs_textures.length; ++i )
		{
			var stream_texture = morphs_textures[i].vertices;
			stream_texture.bind(1);
			shader.uniforms({ u_weight: morphs_textures[i].weight });
			shader.draw( quad_mesh, gl.TRIANGLES );
		}
	});

	base_normals_buffer._texture.bind(0);

	this._morphtarget_normals_texture.drawTo( function(){
		gl.clearColor( 0,0,0,0 );
		gl.clear( gl.COLOR_BUFFER_BIT );
		for(var i = 0; i < morphs_textures.length; ++i )
		{
			var stream_texture = morphs_textures[i].normals;
			stream_texture.bind(1);
			shader.uniforms({ u_weight: morphs_textures[i].weight });
			shader.draw( quad_mesh, gl.TRIANGLES );
		}
	});

	gl.disable( gl.BLEND );

	//create sequence numbers buffer of the same size
	var num_verts = base_vertices_buffer.data.length / 3;
	if(!this._ids_buffer || this._ids_buffer.data.length != num_verts )
	{
		var ids_data = new Float32Array( num_verts );
		for(var i = 0; i < num_verts; ++i)
			ids_data[i] = i;
		this._ids_buffer = new GL.Buffer( gl.ARRAY_BUFFER, ids_data, 1, gl.STATIC_DRAW );
		this._ids_buffer.attribute = "a_morphing_ids";
	}

	//modify the RI to have the displacement texture
	RI.uniforms["u_morph_vertices_texture"] = LS.Renderer.MORPHS_TEXTURE_SLOT;
	RI.samplers[ LS.Renderer.MORPHS_TEXTURE_SLOT ] = this._morphtarget_vertices_texture;

	RI.uniforms["u_morph_normals_texture"] = LS.Renderer.MORPHS_TEXTURE2_SLOT;
	RI.samplers[ LS.Renderer.MORPHS_TEXTURE2_SLOT ] = this._morphtarget_normals_texture;

	RI.uniforms["u_morph_texture_size"] = this._texture_size;

	//add the ids (the texture with 0,1,2, 3,4,5, ...)
	RI.vertex_buffers["a_morphing_ids"] = this._ids_buffer;

	//SHADER BLOCK
	RI.addShaderBlock( MorphDeformer.shader_block );
	RI.addShaderBlock( LS.MorphDeformer.morphing_texture_block, { 
				u_morph_vertices_texture: LS.Renderer.MORPHS_TEXTURE_SLOT, 
				u_morph_normals_texture: LS.Renderer.MORPHS_TEXTURE2_SLOT, 
				u_morph_texture_size: this._texture_size 
			});
	RI.removeShaderBlock( LS.MorphDeformer.morphing_streams_block );
}


MorphDeformer.prototype.disableMorphingGPU = function( RI )
{
	if( !RI )
		return;
	
	if( RI.samplers[ LS.Renderer.MORPHS_TEXTURE_SLOT ] )
	{
		RI.samplers[ LS.Renderer.MORPHS_TEXTURE_SLOT ] = null;
		RI.samplers[ LS.Renderer.MORPHS_TEXTURE2_SLOT ] = null;
		delete RI.uniforms["u_morph_vertices_texture"];
		delete RI.uniforms["u_morph_normals_texture"];
	}

	RI.removeShaderBlock( LS.MorphDeformer.shader_block );
	RI.removeShaderBlock( LS.MorphDeformer.morphing_streams_block );
	RI.removeShaderBlock( LS.MorphDeformer.morphing_texture_block );
}

MorphDeformer.prototype.applyMorphBySoftware = function( RI, valid_morphs )
{
	var base_mesh = RI.mesh;
	var base_vertices_buffer = base_mesh.vertexBuffers["vertices"];

	this.disableMorphingGPU( RI ); //disable GPU version

	var key = ""; //used to avoid computing the mesh every frame

	//collect
	for(var i = 0; i < valid_morphs.length; ++i)
	{
		var morph = valid_morphs[i];
		key += morph.name + "|" + morph.weight.toFixed(2) + "|";
	}

	//to avoid recomputing if nothing has changed
	if(key == this._last_key)
	{
		//change the RI
		if(this._final_vertices_buffer)
			RI.vertex_buffers["vertices"] = this._final_vertices_buffer;
		if(this._final_normals_buffer)
			RI.vertex_buffers["normals"] = this._final_normals_buffer;
		return; 
	}
	this._last_key = key;

	var base_vertices_buffer = base_mesh.vertexBuffers["vertices"];
	var base_vertices = base_vertices_buffer.data;
	var base_normals_buffer = base_mesh.vertexBuffers["normals"];
	var base_normals = base_normals_buffer.data;

	//create final buffers
	if(!this._final_vertices || this._final_vertices.length != base_vertices.length )
	{
		this._final_vertices = new Float32Array( base_vertices.length );
		this._final_vertices_buffer = new GL.Buffer( gl.ARRAY_BUFFER, this._final_vertices, 3, gl.STREAM_DRAW );
		this._final_vertices_buffer.attribute = "a_vertex";
	}

	if(!this._final_normals || this._final_normals.length != base_normals.length )
	{
		this._final_normals = new Float32Array( base_normals.length );
		this._final_normals_buffer = new GL.Buffer( gl.ARRAY_BUFFER, this._final_normals, 3, gl.STREAM_DRAW );
		this._final_normals_buffer.attribute = "a_normal";
	}

	var vertices = this._final_vertices;
	var normals = this._final_normals;

	vertices.set( base_vertices );
	normals.set( base_normals );

	var morphs_vertices = [];
	var morphs_normals = [];
	var morphs_weights = [];
	var num_morphs = valid_morphs.length;

	for(var i = 0; i < valid_morphs.length; ++i)
	{
		var morph = valid_morphs[i];
		morphs_vertices.push( morph.mesh.vertexBuffers["vertices"].data );
		morphs_normals.push( morph.mesh.vertexBuffers["normals"].data );
		morphs_weights.push( morph.weight );
	}

	//fill them 
	if(this.delta_meshes)
	{
		for(var i = 0, l = vertices.length; i < l; i += 3)
		{
			var v = vertices.subarray(i,i+3);
			var n = normals.subarray(i,i+3);

			for(var j = 0; j < num_morphs; ++j)
			{
				var m_v = morphs_vertices[j];
				var m_n = morphs_normals[j];
				var w = morphs_weights[j];
				v[0] += m_v[i]* w;
				v[1] += m_v[i+1] * w;
				v[2] += m_v[i+2] * w;
				n[0] += m_n[i] * w;
				n[1] += m_n[i+1] * w;
				n[2] += m_n[i+2] * w;
			}
		}
	}
	else
	{
		for(var i = 0, l = vertices.length; i < l; i += 3)
		{
			var v = vertices.subarray(i,i+3);
			var n = normals.subarray(i,i+3);

			for(var j = 0; j < num_morphs; ++j)
			{
				var m_v = morphs_vertices[j];
				var m_n = morphs_normals[j];
				var w = morphs_weights[j];
				v[0] += (m_v[i] - base_vertices[i]) * w;
				v[1] += (m_v[i+1] - base_vertices[i+1]) * w;
				v[2] += (m_v[i+2] - base_vertices[i+2]) * w;
				n[0] += (m_n[i] - base_normals[i]) * w;
				n[1] += (m_n[i+1] - base_normals[i+1]) * w;
				n[2] += (m_n[i+2] - base_normals[i+2]) * w;
			}
		}
	}

	this._final_vertices_buffer.upload(  gl.STREAM_DRAW );
	this._final_normals_buffer.upload(  gl.STREAM_DRAW );

	//change the RI
	RI.vertex_buffers["vertices"] = this._final_vertices_buffer;
	RI.vertex_buffers["normals"] = this._final_normals_buffer;

}




MorphDeformer._blend_shader_fragment_code = "\n\
	precision highp float;\n\
	uniform sampler2D u_base_texture;\n\
	uniform sampler2D u_morph_texture;\n\
	uniform float u_weight;\n\
	varying vec2 v_coord;\n\
	void main() {\n\
		gl_FragColor = u_weight * ( texture2D(u_morph_texture, v_coord) - texture2D(u_base_texture, v_coord) );\n\
		gl_FragColor.w = 1.0;\n\
	}\n\
";

MorphDeformer._delta_blend_shader_fragment_code = "\n\
	precision highp float;\n\
	uniform sampler2D u_morph_texture;\n\
	uniform float u_weight;\n\
	varying vec2 v_coord;\n\
	void main() {\n\
		gl_FragColor = u_weight * texture2D(u_morph_texture, v_coord);\n\
		gl_FragColor.w = 1.0;\n\
	}\n\
";

MorphDeformer.prototype.getMorphTextureShader = function()
{
	if(this.delta_meshes)
	{
		if(!this._delta_blend_shader)
			this._delta_blend_shader = new GL.Shader( Shader.SCREEN_VERTEX_SHADER, MorphDeformer._delta_blend_shader_fragment_code );
		return this._delta_blend_shader;
	}

	if(!this._blend_shader)
		this._blend_shader = new GL.Shader( Shader.SCREEN_VERTEX_SHADER, MorphDeformer._blend_shader_fragment_code );
	return this._blend_shader;
}

//transfers the geometry to a texture
MorphDeformer.prototype.createGeometryTexture = function( data_buffer, texture )
{
	var stream_data = data_buffer.data;
	var buffer = stream_data.buffer;

	var max_texture_size = gl.getParameter( gl.MAX_TEXTURE_SIZE );

	var num_floats = stream_data.length; 
	var num_vertex = num_floats / 3;
	var width = Math.min( max_texture_size, num_vertex );
	var height = Math.ceil( num_vertex / width );

	var buffer_padded = new Float32Array( width * height * 3 );
	buffer_padded.set( stream_data );
	if(!texture || texture.width != width || texture.height != height )
		texture = new GL.Texture( width, height, { format: gl.RGB, type: gl.FLOAT, filter: gl.NEAREST, wrap: gl.CLAMP_TO_EDGE, pixel_data: buffer_padded, no_flip: false });
	else
		texture.uploadData( buffer_padded );
	return texture;
}

//in case the textures has been modyfied
MorphDeformer.prototype.recomputeGeometryTextures = function()
{
	var RI = this._last_RI;
	if(!RI)
		return;

	var base_mesh = RI.mesh;
	var base_vertices_buffer = base_mesh.vertexBuffers["vertices"];
	var base_normals_buffer = base_mesh.vertexBuffers["normals"];

	//create textures for the base mesh
	base_vertices_buffer._texture = this.createGeometryTexture( base_vertices_buffer, base_vertices_buffer._texture );
	base_normals_buffer._texture = this.createGeometryTexture( base_normals_buffer, base_normals_buffer._texture );

	var valid_morphs = this._valid_morphs;
	if(!valid_morphs)
		return;

	for(var i = 0; i < valid_morphs.length; ++i)
	{
		var morph = valid_morphs[i];
		var morph_mesh = morph.mesh;

		var vertices_buffer = morph_mesh.vertexBuffers["vertices"];
		if( vertices_buffer && vertices_buffer._texture )
			this.createGeometryTexture( vertices_buffer, vertices_buffer._texture );

		var normals_buffer = morph_mesh.vertexBuffers["normals"];
		if( normals_buffer && normals_buffer._texture )
			this.createGeometryTexture( normals_buffer, normals_buffer._texture );
	}
}

/**
* returns the index of the morph target that uses this mesh
* @method getMorphIndex
* @param {String} name the name or the mesh url (filename) 
* @return {number} the index
*/
MorphDeformer.prototype.getMorphIndex = function( name )
{
	//check precomputed index
	var morph = this._morph_targets_by_name[ name ];
	if( morph )
	{
		var index = this.morph_targets.indexOf( morph );
		if(index != -1)
			return index;
	}

	//search manually
	for(var i = 0; i < this.morph_targets.length; ++i)
	{
		if (this.morph_targets[i].mesh == mesh_name )
			return i;
	}
	return -1;
}

/**
* returns the index of the morph target that uses this mesh
* @method getMorphIndex
* @param {String} mesh_name the name (filename) of the mesh in the morph target
* @return {number} the index
*/
MorphDeformer.prototype.removeMorph = function( index )
{
	if(index >= this.morph_targets.length)
		return;
	var morph = this.morph_targets[index];
	if(morph)
	{
		this.morph_targets.splice( index, 1 );
		if(morph.name)
			delete this._morph_targets_by_name[ morph.name];
	}
}


/**
* sets the mesh for a morph target
* @method setMorphMesh
* @param {number} index the index of the morph target
* @param {String} mesh the mesh resource
*/
MorphDeformer.prototype.setMorphMesh = function(index, value)
{
	if(index >= this.morph_targets.length)
		return;
	this.morph_targets[ index ].mesh = value;
}

/**
* sets the weight for a morph target
* @method setMorphWeight
* @param {number} index the index of the morph target
* @param {number} weight the weight
*/
MorphDeformer.prototype.setMorphWeight = function(index, value)
{
	if( index >= this.morph_targets.length || isNaN(value) )
		return;
	this.morph_targets[ index ].weight = value;
}

/**
* sets a special name for the morph target, used when matching morph targets between nodes
* @method setMorphName
* @param {number} index the index of the morph target
* @param {String} name
*/
MorphDeformer.prototype.setMorphName = function(index, value)
{
	if( index >= this.morph_targets.length )
		return;
	var morph = this.morph_targets[ index ];
	if(!morph || morph.name == value)
		return;

	if( this._morph_targets_by_name[ value ] && this._morph_targets_by_name[ value ] != morph )
		console.warn("There is already a morph target with that name: ", value );
	morph.name = value;
	this._morph_targets_by_name[ value ] = morph;
}

//computes a name shorter than the mesh url based on the common info
MorphDeformer.prototype.getPrettyName = function( info, locator, locator_path )
{
	//console.log(locator_path);
	if(locator_path[ locator_path.length - 1 ] == "weight")
	{
		var names = this.morph_targets.map(function(a){return a.mesh;});
		names = MorphDeformer.removeSharedString(names); //remove part
		var index = this.morph_targets.indexOf( info.target );
		if(index != -1)
		{
			var name = names[index].replace(/_/g," ");
			return info.node.name + "::" + name;
		}
	}
}

MorphDeformer.removeSharedString = function(array)
{
	var n = computeSharedInitialString(array);
	array = array.map(function(a){ 
		a = a.substr(n);
		var last = a.lastIndexOf(".");
		if(last != -1)
			return a.substr(0,last);
		return a;
	});
	return array;
}

MorphDeformer.prototype.getPropertyInfoFromPath = function( path )
{
	if(path[0] != "morphs")
		return;

	if(path.length == 1)
		return {
			node: this._root,
			target: this.morph_targets,
			type: "object"
		};

	var num = parseInt( path[1] );
	if(num >= this.morph_targets.length)
		return;

	var varname = path[2];
	if(varname != "mesh" && varname != "weight")
		return;

	return {
		node: this._root,
		component: this,
		target: this.morph_targets[num],
		name: varname,
		value: this.morph_targets[num][ varname ] !== undefined ? this.morph_targets[num][ varname ] : null,
		type: varname == "mesh" ? "mesh" : "number"
	};
}

MorphDeformer.prototype.setPropertyValueFromPath = function( path, value, offset )
{
	offset = offset || 0;

	if( path.length < (offset+1) )
		return;

	if(isNaN(value))
		return;

	if( path[offset] != "morphs" )
		return;

	var num = parseInt( path[offset+1] );
	if(num >= this.morph_targets.length)
		return;

	var varname = path[offset+2];
	this.morph_targets[num][ varname ] = value;
}

//used for graphs
MorphDeformer.prototype.setProperty = function(name, value)
{
	if( name == "enabled" )
		this.enabled = value;
	else if( name.substr(0,5) == "morph" )
	{
		name = name.substr(5);
		var t = name.split("_");
		var num = parseInt( t[0] );
		if( num >= 0 && num < this.morph_targets.length )
		{
			if( t[1] == "weight" )
			{
				if(!isNaN(value)) //this happened some times...
					this.morph_targets[ num ].weight = value;
			}
			else if( t[1] == "mesh" )
				this.morph_targets[ num ].mesh = value;
		}
	}
	else if( name == "weights" )
		this.weights = value;
	else if( name == "name_weights" )
		this.name_weights = value;
	else if( name == "mesh_weights" )
		this.mesh_weights = value;
}

MorphDeformer.prototype.getProperty = function(name)
{
	if(name.substr(0,5) == "morph" && name.length > 5)
	{
		var t = name.substr(5).split("_");
		var index = Number(t[0]);
		var morph = this.morph_targets[ index ];
		if(morph)
		{
			if(t[1] == "mesh")
				return morph.mesh;
			else if(t[1] == "weight")
				return morph.weight;
			else
				return morph;
		}
	}
}

MorphDeformer.prototype.getPropertiesInfo = function()
{
	var properties = {
		enabled: "boolean",
		weights: "array",
		name_weights: "object",
		mesh_weights: "object"
	};

	for(var i = 0; i < this.morph_targets.length; i++)
	{
		properties[ "morph" + i + "_weight" ] = "number";
		//properties[ "morph" + i + "_mesh" ] = "Mesh";
	}

	return properties;
}

/**
* Returns the base mesh on which the morph targets will be applied
* @method getBaseMesh
*/
MorphDeformer.prototype.getBaseMesh = function()
{
	if(!this._root)
		return null;
	if( this._last_base_mesh )
		return this._last_base_mesh;
	var mesh_renderer = this._root.getComponent( LS.Components.MeshRenderer );
	if( mesh_renderer )
		return LS.ResourcesManager.resources[ mesh_renderer.mesh ];
	return null;
}

/**
* Removes innecesary morph targets and removes data from mesh that is already in the base mesh (uvs and indices)
* @method optimizeMorphTargets
*/
MorphDeformer.prototype.optimizeMorphTargets = function()
{
	//base mesh
	var base_mesh = this.getBaseMesh();

	var morph_targets = this.morph_targets.concat();

	for(var i = 0; i < morph_targets.length; ++i)
	{
		var morph = morph_targets[i];
		var mesh = LS.ResourcesManager.meshes[ morph.mesh ];
		if(!mesh)
			continue;
		
		//remove data not used 
		mesh.removeVertexBuffer("coords", true);
		mesh.removeIndexBuffer("triangles", true);
		mesh.removeIndexBuffer("wireframe", true);

		//compute difference
		if( base_mesh )
		{
			var diff = MorphDeformer.computeMeshDifference( base_mesh, mesh );
			if( diff < 0.1 ) //too similar
			{
				var mesh_fullpath = mesh.fullpath || mesh.filename;
				console.log("morph target is too similar to base mesh, removing it: " + mesh_fullpath );
				var index = this.morph_targets.indexOf( morph );
				this.morph_targets.splice( index,1 );
				LS.ResourcesManager.unregisterResource( mesh_fullpath );
				var container_fullpath = mesh.from_pack || mesh.from_prefab;
				if( container_fullpath )
				{
					var container = LS.ResourcesManager.resources[ container_fullpath ];
					if(container)
						container.removeResource( mesh_fullpath );
				}
				continue;
			}
		}

		LS.ResourcesManager.resourceModified( mesh );
	}

	console.log("Morph targets optimized");
}

//computes the difference between to meshes, used to detect useless morph targets
MorphDeformer.computeMeshDifference = function( mesh_a, mesh_b )
{
	if(!mesh_a || !mesh_b || !mesh_a.vertexBuffers["vertices"] || !mesh_b.vertexBuffers["vertices"])
		return 0;

	var vertices_a = mesh_a.vertexBuffers["vertices"].data;
	var vertices_b = mesh_b.vertexBuffers["vertices"].data;

	if( !vertices_a || !vertices_b || vertices_a.length != vertices_b.length )
		return 0;

	var diff = 0;
	for( var i = 0; i < vertices_a.length; i+=3 )
		diff += vec3.distance( vertices_a.subarray(i,i+3), vertices_b.subarray(i,i+3) );
	return diff;
}

//show in the graphcanvas
MorphDeformer.prototype.onInspectNode = function( inspector, graphnode )
{
	var that = this;
	inspector.addButton(null,"Add weights' inputs",{ callback: function(){
		for(var i = 0; i < that.morph_targets.length; ++i)
		{
			var morph = that.morph_targets[i];
			if(graphnode.findInputSlot("morph_" + i + "_weight") == -1)
				graphnode.addInput("morph_" + i + "_weight","number");
		}
		graphnode.setDirtyCanvas(true);
	}});
}

LS.registerComponent( MorphDeformer );
LS.MorphDeformer = MorphDeformer;

//SHADER BLOCKS ******************************************

MorphDeformer.morph_streams_enabled_shader_code = "\n\
	\n\
	//max vertex attribs are 16 usually, so 10 are available after using 6 for V,N,UV,UV2,BW,BI\n\
	attribute vec3 a_vertex_morph0;\n\
	attribute vec3 a_normal_morph0;\n\
	attribute vec3 a_vertex_morph1;\n\
	attribute vec3 a_normal_morph1;\n\
	attribute vec3 a_vertex_morph2;\n\
	attribute vec3 a_normal_morph2;\n\
	attribute vec3 a_vertex_morph3;\n\
	attribute vec3 a_normal_morph3;\n\
	\n\
	uniform vec4 u_morph_weights;\n\
	uniform float u_morph_info;\n\
	\n\
	void applyMorphing( inout vec4 position, inout vec3 normal )\n\
	{\n\
		vec3 original_vertex = vec3(0.0);\n\
		vec3 original_normal = vec3(0.0);\n\
		if( u_morph_info == 0.0 )\n\
		{\n\
			original_vertex = position.xyz;\n\
			original_normal = normal.xyz;\n\
		}\n\
		\n\
		if(u_morph_weights[0] != 0.0)\n\
		{\n\
			position.xyz += (a_vertex_morph0 - original_vertex) * u_morph_weights[0]; normal.xyz += (a_normal_morph0 - original_normal) * u_morph_weights[0];\n\
		}\n\
		if(u_morph_weights[1] != 0.0)\n\
		{\n\
			position.xyz += (a_vertex_morph1 - original_vertex) * u_morph_weights[1]; normal.xyz += (a_normal_morph1 - original_normal) * u_morph_weights[1];\n\
		}\n\
		if(u_morph_weights[2] != 0.0)\n\
		{\n\
			position.xyz += (a_vertex_morph2 - original_vertex) * u_morph_weights[2]; normal.xyz += (a_normal_morph2 - original_normal) * u_morph_weights[2];\n\
		}\n\
		if(u_morph_weights[3] != 0.0)\n\
		{\n\
			position.xyz += (a_vertex_morph3 - original_vertex) * u_morph_weights[3]; normal.xyz += (a_normal_morph3 - original_normal) * u_morph_weights[3];\n\
		}\n\
	}\n\
";

MorphDeformer.morph_texture_enabled_shader_code = "\n\
	\n\
	attribute float a_morphing_ids;\n\
	\n\
	uniform sampler2D u_morph_vertices_texture;\n\
	uniform sampler2D u_morph_normals_texture;\n\
	uniform vec4 u_morph_texture_size;\n\
	\n\
	uniform vec4 u_morph_weights;\n\
	\n\
	void applyMorphing( inout vec4 position, inout vec3 normal )\n\
	{\n\
		vec2 coord;\n\
		coord.x = ( mod( a_morphing_ids, u_morph_texture_size.x ) + 0.5 ) / u_morph_texture_size.x;\n\
		coord.y = 1.0 - ( floor( a_morphing_ids / u_morph_texture_size.x ) + 0.5 ) / u_morph_texture_size.y;\n\
		position.xyz += texture2D( u_morph_vertices_texture, coord ).xyz;\n\
		normal.xyz += texture2D( u_morph_normals_texture, coord ).xyz;\n\
	}\n\
";

MorphDeformer.morph_enabled_shader_code = "\n\
	\n\
	#pragma shaderblock morphing_mode\n\
";


MorphDeformer.morph_disabled_shader_code = "\nvoid applyMorphing( inout vec4 position, inout vec3 normal ) {}\n";

// ShaderBlocks used to inject to shader in runtime
var morphing_block = new LS.ShaderBlock("morphing");
morphing_block.addCode( GL.VERTEX_SHADER, MorphDeformer.morph_enabled_shader_code, MorphDeformer.morph_disabled_shader_code );
morphing_block.register();
MorphDeformer.shader_block = morphing_block;

var morphing_streams_block = new LS.ShaderBlock("morphing_streams");
morphing_streams_block.defineContextMacros( { "morphing_mode": "morphing_streams"} );
morphing_streams_block.addCode( GL.VERTEX_SHADER, MorphDeformer.morph_streams_enabled_shader_code, MorphDeformer.morph_disabled_shader_code );
morphing_streams_block.register();
MorphDeformer.morphing_streams_block = morphing_streams_block;

var morphing_texture_block = new LS.ShaderBlock("morphing_texture");
morphing_texture_block.defineContextMacros( { "morphing_mode": "morphing_texture"} );
morphing_texture_block.addCode( GL.VERTEX_SHADER, MorphDeformer.morph_texture_enabled_shader_code, MorphDeformer.morph_disabled_shader_code );
morphing_texture_block.register();
MorphDeformer.morphing_texture_block = morphing_texture_block;



///@INFO: UNCOMMON
function BackgroundRenderer(o)
{
	this.enabled = true;
	this.texture = null;

	this.createProperty( "color", vec3.fromValues(1,1,1), "color" );
	this.opacity = 1.0;
	this.blend_mode = Blend.NORMAL;

	//this._color = vec3.fromValues(1,1,1);
	this.material_name = null;

	if(o)
		this.configure(o);
}

BackgroundRenderer.icon = "mini-icon-bg.png";
BackgroundRenderer["@texture"] = { type: "texture" };
BackgroundRenderer["@material_name"] = { type: "material" };
BackgroundRenderer["@blend_mode"] = { type: "enum", values: LS.Blend };
BackgroundRenderer["@opacity"] = { type: "number", step: 0.01 };

/*
Object.defineProperty( BackgroundRenderer.prototype, 'color', {
	get: function() { return this._color; },
	set: function(v) { this._color.set(v);},
	enumerable: true
});
*/

BackgroundRenderer.prototype.onAddedToNode = function(node)
{
	LEvent.bind(node, "collectRenderInstances", this.onCollectInstances, this);
}

BackgroundRenderer.prototype.onRemovedFromNode = function(node)
{
	LEvent.unbind(node, "collectRenderInstances", this.onCollectInstances, this);
}

BackgroundRenderer.prototype.getResources = function(res)
{
	if(typeof(this.texture) == "string")
		res[this.texture] = GL.Texture;
	return res;
}

BackgroundRenderer.prototype.onResourceRenamed = function (old_name, new_name, resource)
{
	if(this.texture == old_name)
		this.texture = new_name;
}

BackgroundRenderer.prototype.onCollectInstances = function(e, instances)
{
	if(!this.enabled)
		return;

	var mat = null;

	if( this.material_name )
		mat = LS.ResourcesManager.materials[ this.material_name ];

	if(!mat)
	{
		var texture = this.texture;
		if(!texture) 
			return;
		if(texture.constructor === String)
			texture = LS.ResourcesManager.textures[ texture ];

		if(!this._material)
			mat = this._material = new LS.StandardMaterial({shader: "lowglobal", 
				queue: LS.RenderQueue.BACKGROUND, 
				flags: {
					cast_shadows: false,
					ignore_lights: true,
					two_sided: true,
					depth_test: false,
					ignore_frustum: true
				},
				use_scene_ambient:false
			});
		else
			mat = this._material;

		mat.setTexture("color", texture);
		mat.color.set( this.color );
		mat.opacity = this.opacity;
		mat.blend_mode = this.blend_mode;
	}

	var mesh = this._mesh;
	if(!mesh)
		mesh = this._mesh = GL.Mesh.plane({size:2});

	var RI = this._render_instance;
	if(!RI)
		this._render_instance = RI = new LS.RenderInstance( this._root, this );

	RI.setMesh( mesh );
	RI.setMaterial( mat );

	instances.push(RI);
}

/**
* GeometricPrimitive renders a primitive like a Cube, Sphere, Plane, etc
* @class GeometricPrimitive
* @namespace LS.Components
* @constructor
* @param {String} object to configure from
*/

function GeometricPrimitive( o )
{
	this.enabled = true;
	this._size = 10;
	this._subdivisions = 10;
	this._geometry = GeometricPrimitive.CUBE;
	this._custom_mesh = null; //used for meshes that must be stored with the JSON
	this._primitive = -1; //GL.POINTS, GL.LINES, GL.TRIANGLES, etc...
	this._point_size = 0.1;

	this._version = 1;
	this._mesh = null;
	this._mesh_version = 0;

	if(o)
		this.configure(o);
}


/**
* The shape to render, valid values are: LS.Components.GeometricPrimitive.CUBE,PLANE,CYLINDER,SPHERE,CIRCLE,HEMISPHERE,ICOSAHEDRON,CONE,QUAD
* @property geometry {enum}
* @default LS.Components.GeometricPrimitive.CUBE
*/
Object.defineProperty( GeometricPrimitive.prototype, 'geometry', {
	get: function() { return this._geometry; },
	set: function(v) { 
		if( this._geometry == v )
			return;
		v = (v === undefined || v === null ? -1 : v|0);
		if( !GeometricPrimitive.VALID[v] )
			return;
		this._geometry = v;
		this._version++;
	},
	enumerable: true
});

/**
* The size of the primitive (the global scale)
* @property size {Number}
* @default 10
*/
Object.defineProperty( GeometricPrimitive.prototype, 'size', {
	get: function() { return this._size; },
	set: function(v) { 
		if( this._size == v )
			return;
		this._size = v;
		this._version++;
	},
	enumerable: true
});

Object.defineProperty( GeometricPrimitive.prototype, 'subdivisions', {
	get: function() { return this._subdivisions; },
	set: function(v) { 
		if( this._subdivisions == v )
			return;
		this._subdivisions = v;
		this._version++;
	},
	enumerable: true
});

/**
* The GL primitive to use (LINES,LINE_STRIP,TRIANGLES,TRIANGLE_FAN
* @property primitive {enum}
* @default 10
*/
Object.defineProperty( GeometricPrimitive.prototype, 'primitive', {
	get: function() { return this._primitive; },
	set: function(v) { 
		v = (v === undefined || v === null ? -1 : v|0);
		if(v != -1 && v != 0 && v!= 1 && v!= 4 && v!= 10)
			return;
		this._primitive = v;
	},
	enumerable: true
});

Object.defineProperty( GeometricPrimitive.prototype, 'point_size', {
	get: function() { return this._point_size; },
	set: function(v) { 
		if( this._point_size == v )
			return;
		this._point_size = v;
	},
	enumerable: true
});

//assign a custom mesh
Object.defineProperty( GeometricPrimitive.prototype, 'mesh', {
	get: function() { return this._custom_mesh || this._mesh; },
	set: function(v) { 
		if(v && v.constructor !== GL.Mesh)
			throw("mesh must be a GL.Mesh");
		this._custom_mesh = v;
		if(v)
			this._geometry = GeometricPrimitive.CUSTOM;
	},
	enumerable: false
});


GeometricPrimitive.CUBE = 1;
GeometricPrimitive.PLANE = 2;
GeometricPrimitive.CYLINDER = 3;
GeometricPrimitive.SPHERE = 4;
GeometricPrimitive.CIRCLE = 5;
GeometricPrimitive.HEMISPHERE = 6;
GeometricPrimitive.ICOSAHEDRON = 7;
GeometricPrimitive.CONE = 8;
GeometricPrimitive.QUAD = 9;
GeometricPrimitive.CUSTOM = 100;

GeometricPrimitive.VALID = { 1:"CUBE", 2:"PLANE", 3:"CYLINDER", 4:"SPHERE", 5:"CIRCLE", 6:"HEMISPHERE", 7:"ICOSAHEDRON", 8: "CONE", 9:"QUAD", 100:"CUSTOM" };

//Warning : if you add more primitives, be careful with the setter, it doesnt allow values bigger than 7

GeometricPrimitive.icon = "mini-icon-cube.png";
GeometricPrimitive["@geometry"] = { type:"enum", values: {"Cube":GeometricPrimitive.CUBE, "Plane": GeometricPrimitive.PLANE, "Cylinder":GeometricPrimitive.CYLINDER, "Sphere":GeometricPrimitive.SPHERE, "Cone":GeometricPrimitive.CONE, "Icosahedron":GeometricPrimitive.ICOSAHEDRON, "Circle":GeometricPrimitive.CIRCLE, "Hemisphere":GeometricPrimitive.HEMISPHERE, "Quad": GeometricPrimitive.QUAD, "Custom": GeometricPrimitive.CUSTOM }};
GeometricPrimitive["@primitive"] = {widget:"enum", values: {"Default":-1, "Points": 0, "Lines":1, "Triangles":4, "Wireframe":10 }};
GeometricPrimitive["@subdivisions"] = { type:"number", step:1, min:1, precision: 0 };
GeometricPrimitive["@point_size"] = { type:"number", step:0.001 };

//we bind to onAddedToNode because the event is triggered per node so we know which RIs belong to which node
GeometricPrimitive.prototype.onAddedToNode = function( node )
{
	LEvent.bind( node, "collectRenderInstances", this.onCollectInstances, this);
}

GeometricPrimitive.prototype.onRemovedFromNode = function( node )
{
	LEvent.unbind( node, "collectRenderInstances", this.onCollectInstances, this);
}

GeometricPrimitive.prototype.serialize = function()
{
	var r = LS.BaseComponent.prototype.serialize.call(this);
	if(this._geometry == GeometricPrimitive.CUSTOM && this._custom_mesh)
		r.custom_mesh = this._custom_mesh.toJSON();

	return r;
}

GeometricPrimitive.prototype.configure = function(o)
{
	LS.BaseComponent.prototype.configure.call(this,o);

	//legacy
	if(this._geometry == GeometricPrimitive.PLANE && o.align_z === false )
		this._geometry = GeometricPrimitive.QUAD;

	if(o.geometry == GeometricPrimitive.CUSTOM && o.custom_mesh)
	{
		if(!this._custom_mesh)
			this._custom_mesh = new GL.Mesh();
		this._custom_mesh.fromJSON( o.custom_mesh );
	}

	this._version++;
}

GeometricPrimitive.prototype.updateMesh = function()
{
	var subdivisions = Math.max(0,this.subdivisions|0);

	switch (this._geometry)
	{
		case GeometricPrimitive.CUBE: 
			this._mesh = GL.Mesh.cube({size: this.size, normals:true,coords:true, wireframe: true});
			break;
		case GeometricPrimitive.PLANE:
			this._mesh = GL.Mesh.plane({size: this.size, xz: true, detail: subdivisions, normals:true,coords:true});
			break;
		case GeometricPrimitive.CYLINDER:
			this._mesh = GL.Mesh.cylinder({size: this.size, subdivisions: subdivisions, normals:true,coords:true});
			break;
		case GeometricPrimitive.SPHERE:
			this._mesh = GL.Mesh.sphere({size: this.size, "long": subdivisions, lat: subdivisions, normals:true,coords:true});
			break;
		case GeometricPrimitive.CIRCLE:
			this._mesh = GL.Mesh.circle({size: this.size, slices: subdivisions, normals:true, coords:true});
			break;
		case GeometricPrimitive.HEMISPHERE:
			this._mesh = GL.Mesh.sphere({size: this.size, "long": subdivisions, lat: subdivisions, normals:true, coords:true, hemi: true});
			break;
		case GeometricPrimitive.ICOSAHEDRON:
			this._mesh = GL.Mesh.icosahedron({size: this.size, subdivisions:subdivisions });
			break;
		case GeometricPrimitive.CONE:
			this._mesh = GL.Mesh.cone({radius: this.size, height: this.size, subdivisions:subdivisions });
			break;
		case GeometricPrimitive.QUAD:
			this._mesh = GL.Mesh.plane({size: this.size, xz: false, detail: subdivisions, normals:true, coords:true });
			break;
		case GeometricPrimitive.CUSTOM:
			this._mesh = this._custom_mesh;
			break;
	}

	this._mesh_version = this._version;
}

/**
* Assigns a mesh as custom mesh and sets the geometry to CUSTOM
* @method setCustomMesh
* @param {GL.Mesh} mesh the mesh to use as custom mesh
*/
GeometricPrimitive.prototype.setCustomMesh = function( mesh )
{
	this._geometry = GeometricPrimitive.CUSTOM;
	this._custom_mesh = mesh;
	this._mesh = this._custom_mesh;
}

//GeometricPrimitive.prototype.getRenderInstance = function()
GeometricPrimitive.prototype.onCollectInstances = function(e, instances)
{
	if(!this.enabled)
		return;

	var mesh = null;
	if(!this._root)
		return;

	var RI = this._render_instance;
	if(!RI)
		this._render_instance = RI = new LS.RenderInstance(this._root, this);

	if(!this._mesh || this._version != this._mesh_version )
		this.updateMesh();

	if(!this._mesh) //could happend if custom mesh is null
		return;

	//assigns matrix, layers
	RI.fromNode( this._root );
	RI.setMesh( this._mesh, this._primitive );
	this._root.mesh = this._mesh;
	
	RI.setMaterial( this.material || this._root.getMaterial() );

	//remove one day...
	if(this.primitive == gl.POINTS)
	{
		RI.uniforms.u_point_size = this.point_size;
		//RI.query.macros["USE_POINTS"] = "";
	}

	instances.push(RI);
}
