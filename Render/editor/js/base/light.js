//***** LIGHT ***************************

/**
* Light contains all the info about the light (type: SPOT, OMNI, DIRECTIONAL, attenuations, shadows, etc)
* @class Light
* @namespace LS.Components
* @constructor
* @param {Object} object to configure from
*/
function Light(o)
{
	/**
	* Position of the light in world space
	* @property position
	* @type {[[x,y,z]]}
	* @default [0,0,0]
	*/
	this._position = vec3.create();
	/**
	* Position where the light is pointing at (in world space)
	* @property target
	* @type {[[x,y,z]]}
	* @default [0,0,1]
	*/
	this._target = vec3.fromValues(0,0,1);
	/**
	* Up vector (in world coordinates)
	* @property up
	* @type {[[x,y,z]]}
	* @default [0,1,0]
	*/
	this._up = vec3.fromValues(0,1,0);

	/**
	* Enabled
	* @property enabled
	* @type {Boolean}
	* @default true
	*/
	this.enabled = true;

	/**
	* Layers mask, this layers define which objects are iluminated by this light
	* @property illuminated_layers
	* @type {Number}
	* @default true
	*/
	this.illuminated_layers = 0xFF;


	/**
	* Near distance
	* @property near
	* @type {Number}
	* @default 1
	*/
	this.near = 1;
	/**
	* Far distance
	* @property far
	* @type {Number}
	* @default 1000
	*/

	this.far = 500;
	/**
	* Angle for the spot light inner apperture
	* @property angle
	* @type {Number}
	* @default 45
	*/
	this.angle = 45; //spot cone
	/**
	* Angle for the spot light outer apperture
	* @property angle_end
	* @type {Number}
	* @default 60
	*/
	this.angle_end = 60; //spot cone end

	this.constant_diffuse = false;
	this.use_specular = true;
	this.att_start = 0;
	this.att_end = 1000;

	/**
	* type of attenuation: Light.NO_ATTENUATION, Light.LINEAR_ATTENUATION, Light.RANGE_ATTENUATION
	* @property attenuation_type
	* @type {Number}
	* @default [1,1,1]
	*/
	this.attenuation_type = Light.RANGE_ATTENUATION; //0: none, 1:linear, 2:range, ...
	this.offset = 0;
	this._spot_cone = true;

	this.projective_texture = null;

	this._attenuation_info = new Float32Array([ this.att_start, this.att_end, this.attenuation_type, 0 ]); //start,end,type,extra

	//use target (when attached to node)
	this.use_target = false;

	/**
	* The color of the light
	* @property color
	* @type {vec3}
	* @default [1,1,1]
	*/
	this._color = vec3.fromValues(1,1,1);
	/**
	* The intensity of the light
	* @property intensity
	* @type {Number}
	* @default 1
	*/
	this.intensity = 1;

	this._type = Light.OMNI;
	this.frustum_size = 50; //ortho

	/**
	* If the light cast shadows
	* @property cast_shadows
	* @type {Boolean}
	* @default false
	*/
	this._cast_shadows = false;

	//shadowmap class
	this._shadowmap = null; //Shadow class
	this._precompute_shadowmaps_on_startup = false;
	this._update_shadowmap_render_settings = null;

	//used to force the computation of the light matrix for the shader (otherwise only if projective texture or shadows are enabled)
	this._light_matrix = mat4.create();

	this.extra_texture = null;

	//vectors in world space
	this._front = vec3.clone( LS.FRONT );
	this._right = vec3.clone( LS.RIGHT );
	this._top = vec3.clone( LS.TOP );

	//for StandardMaterial
	this._samplers = [];

	//light uniforms
	this._uniforms = {
		u_light_info: vec4.fromValues( this._type, this._spot_cone ? 1 : 0, 0, 0 ), //light type, spot cone, index of pass, num passes
		u_light_front: this._front,
		u_light_angle: vec4.fromValues( this.angle * DEG2RAD, this.angle_end * DEG2RAD, Math.cos( this.angle * DEG2RAD * 0.5 ), Math.cos( this.angle_end * DEG2RAD * 0.5 ) ),
		u_light_position: this._position,
		u_light_color: vec3.create(),
		u_light_att: this._attenuation_info,
		u_light_offset: this.offset,
		u_light_extra: vec4.create(),
		u_light_matrix: this._light_matrix
	};

	//configure
	if(o) 
		this.configure(o);
}

Light.NO_ATTENUATION = 0;
Light.LINEAR_ATTENUATION = 1;
Light.RANGE_ATTENUATION = 2;

Light.AttenuationTypes = {
	"none": Light.NO_ATTENUATION,
	"linear": Light.LINEAR_ATTENUATION,
	"range": Light.RANGE_ATTENUATION
};

Light["@projective_texture"] = { type: LS.TYPES.TEXTURE };
Light["@extra_texture"] = { type: LS.TYPES.TEXTURE };
Light["@color"] = { type: LS.TYPES.COLOR };
Light["@attenuation_type"] = { type: "enum", values: Light.AttenuationTypes };

Object.defineProperty( Light.prototype, 'type', {
	get: function() { return this._type; },
	set: function(v) { 
		this._uniforms.u_light_info[0] = v;
		this._type = v;
	},
	enumerable: true
});

Object.defineProperty( Light.prototype, 'position', {
	get: function() { return this._position; },
	set: function(v) { this._position.set(v); },
	enumerable: true
});

Object.defineProperty( Light.prototype, 'target', {
	get: function() { return this._target; },
	set: function(v) { this._target.set(v);  },
	enumerable: true
});

Object.defineProperty( Light.prototype, 'extra', {
	get: function() { return this._uniforms.u_light_extra; },
	set: function(v) { 
		if(v)
			this._uniforms.u_light_extra.set(v);  },
	enumerable: true
});

Object.defineProperty( Light.prototype, 'up', {
	get: function() { return this._up; },
	set: function(v) { this._up.set(v);  },
	enumerable: true
});

Object.defineProperty( Light.prototype, 'color', {
	get: function() { return this._color; },
	set: function(v) { this._color.set(v); },
	enumerable: true
});

Object.defineProperty( Light.prototype, 'spot_cone', {
	get: function() { return this._spot_cone; },
	set: function(v) { 
		this._spot_cone = v;
		this._uniforms.u_light_info[1] = v ? 1 : 0;
	},
	enumerable: true
});

Object.defineProperty( Light.prototype, 'cast_shadows', {
	get: function() { return this._cast_shadows; },
	set: function(v) { 
		this._cast_shadows = v;
		if(!this._shadowmap && v)
			this._shadowmap = new LS.Shadowmap(this);
	},
	enumerable: true
});

Object.defineProperty( Light.prototype, 'shadows', {
	get: function() { 
		return this._shadowmap; 
	},
	set: function(v) {
		if(!this._shadowmap)
			this._shadowmap = new LS.Shadowmap(this);
		this._shadowmap.configure(v);
	},
	enumerable: false
});

Light.OMNI = 1;
Light.SPOT = 2;
Light.DIRECTIONAL = 3;

Light.DEFAULT_DIRECTIONAL_FRUSTUM_SIZE = 50;

Light.prototype.onAddedToNode = function(node)
{
	if(!node.light)
		node.light = this;
}

Light.prototype.onRemovedFromNode = function(node)
{
	if(node.light == this)
		delete node.light;
}

Light.prototype.onAddedToScene = function(scene)
{
	LEvent.bind( scene, "collectLights", this.onCollectLights, this ); 
	LEvent.bind( scene, "renderShadows", this.onGenerateShadowmap, this ); 
}

Light.prototype.onRemovedFromScene = function(scene)
{
	LEvent.unbind( scene, "collectLights", this.onCollectLights, this );
	LEvent.unbind( scene, "renderShadows", this.onGenerateShadowmap, this );

	LS.ResourcesManager.unregisterResource( ":shadowmap_" + this.uid );
}

Light.prototype.onSerialize = function(v)
{
	if(this._shadowmap)
		v.shadows = LS.cloneObject(this._shadowmap);
}

Light.prototype.onConfigure = function(v)
{
	if(v.shadows)
	{
		if(!this._shadowmap)
			this._shadowmap = new LS.Shadowmap(this);
		LS.cloneObject(v.shadows, this._shadowmap);
	}
}

Light.prototype.onGenerateShadowmap = function(e)
{
	if( this._update_shadowmap_render_settings )
	{
		this.generateShadowmap( this._update_shadowmap_render_settings, this._precompute_shadowmaps_on_startup );
		this._update_shadowmap_render_settings = null;
	}
}

Light.prototype.onCollectLights = function(e, lights)
{
	if(!this.enabled)
		return;

	//add to lights vector
	lights.push(this);
}

/**
* Returns the camera that will match the light orientation (taking into account fov, etc), useful for shadowmaps
* @method getLightCamera
* @param {number} face_index only used when rendering to a cubemap
* @return {Camera} the camera
*/
Light.prototype.getLightCamera = function( face_index )
{
	this.updateLightCamera( face_index );
	return this._light_camera;
}

Light._temp_matrix = mat4.create();
Light._temp2_matrix = mat4.create();
Light._temp3_matrix = mat4.create();
Light._temp_position = vec3.create();
Light._temp_target = vec3.create();
Light._temp_up = vec3.create();
Light._temp_front = vec3.create();

//Used to create a camera from a light
Light.prototype.updateLightCamera = function( face_index )
{
	if(!this._light_camera)
		this._light_camera = new LS.Components.Camera();

	var camera = this._light_camera;
	camera.type = this.type == Light.DIRECTIONAL ? LS.Components.Camera.ORTHOGRAPHIC : LS.Components.Camera.PERSPECTIVE;
	camera.eye = this.getPosition( Light._temp_position );

	if( this.type == Light.OMNI && face_index != null )
	{
		var info = LS.Camera.cubemap_camera_parameters[ face_index ];
		var target = Light._temp_target;
		vec3.add( target, Light._temp_position, info.dir );
		camera.center = target;
		camera.fov = 90;
		camera.up = info.up;
	}
	else
	{
		camera.center = this.getTarget( Light._temp_target );
		var up = this.getUp( Light._temp_up );
		var front = this.getFront( Light._temp_front );
		if( Math.abs( vec3.dot(front,up) ) > 0.999 ) 
			vec3.set(up,0,0,1);
		camera.up = up;
		camera.fov = (this.angle_end || 45); //fov is in degrees
	}

	var closest_far = this.computeFar();

	camera.frustum_size = this.frustum_size || Light.DEFAULT_DIRECTIONAL_FRUSTUM_SIZE;
	camera.near = this.near;
	camera.far = closest_far;
	camera.layers = this.illuminated_layers;
	camera.updateMatrices();

	this._light_matrix.set( camera._viewprojection_matrix );

	return camera;
}


Light.prototype.computeFar = function()
{
	var closest_far = this.far;

	if( this.type == Light.OMNI )
	{
		//Math.SQRT2 because in a 45� triangle the hypotenuse is sqrt(1+1) * side
		if( this.attenuation_type == this.RANGE_ATTENUATION  && (this.att_end * Math.SQRT2) < closest_far)
			closest_far = this.att_end / Math.SQRT2;
		//TODO, if no range_attenuation but linear_attenuation also check intensity to reduce the far
	}
	else 
	{
		if( this.attenuation_type == this.RANGE_ATTENUATION && this.att_end < closest_far)
			closest_far = this.att_end;
	}

	return closest_far;
}

/**
* updates all the important vectors (target, position, etc) according to the node parent of the light
* @method updateVectors
*/
Light.prototype.updateVectors = (function(){
	var temp_v3 = vec3.create();

	return function()
	{
		//if the light is inside the root node of the scene
		if(!this._root || !this._root.transform) 
		{
			//position, target and up are already valid
			 //front
			 //vec3.subtract(this._front, this.position, this.target ); //positive z front
			 vec3.subtract(this._front, this._target, this._position ); //positive z front
			 vec3.normalize(this._front,this._front);
			 //right
			 vec3.normalize( temp_v3, this._up );
			 vec3.cross( this._right, this._front, temp_v3 );
			 //top
			 vec3.cross( this._top, this._right, this._front );
			 return;
		}

		var mat = this._root.transform.getGlobalMatrixRef();

		//position
		mat4.getTranslation( this._position, mat);
		//target
		if (!this.use_target)
			mat4.multiplyVec3( this._target, mat, LS.FRONT ); //right in front of the object
		//up
		mat4.multiplyVec3( this._up, mat, LS.TOP ); //right in front of the object

		//vectors
		mat4.rotateVec3( this._front, mat, LS.FRONT ); 
		mat4.rotateVec3( this._right, mat, LS.RIGHT ); 
		vec3.copy( this._top, this.up ); 
	}
})();
/**
* returns a copy of the light position (in global coordinates), if you want local you can access the position property
* @method getPosition
* @param {vec3} output optional
* @return {vec3} the position
*/
Light.prototype.getPosition = function( out )
{
	out = out || vec3.create();
	//if(this._root && this._root.transform) return this._root.transform.localToGlobal( this.position, p || vec3.create() );
	if(this._root && this._root.transform) 
		return this._root.transform.getGlobalPosition( out );
	out.set( this._position );
	return out;
}

/**
* returns a copy of the light target (in global coordinates), if you want local you can access the target property
* @method getTarget
* @param {vec3} output optional
* @return {vec3} the target
*/
Light.prototype.getTarget = function( out )
{
	out = out || vec3.create();
	if(this._root && this._root.transform && !this.use_target) 
		return this._root.transform.localToGlobal( LS.FRONT , out );
	out.set( this._target );
	return out;
}

/**
* returns a copy of the light up vector (in global coordinates), if you want local you can access the up property
* @method getUp
* @param {vec3} output optional
* @return {vec3} the up vector
*/
Light.prototype.getUp = function( out )
{
	out = out || vec3.create();

	if(this._root && this._root.transform) 
		return this._root.transform.transformVector( LS.TOP , out );
	out.set( this._up );
	return out;
}

/**
* returns a copy of the front vector (in global coordinates)
* @method getFront
* @param {vec3} output optional
* @return {vec3} the front vector
*/
Light.prototype.getFront = function( out ) 
{
	var front = out || vec3.create();
	this.getPosition( front );
	vec3.subtract( front, front, this.getTarget( Light._temp_position ) ); //front is reversed?
	//vec3.subtract(front, this.getTarget(), this.getPosition() ); //front is reversed?
	vec3.normalize(front, front);
	return front;
}

/*
Light.prototype.getLightRotationMatrix = function()
{
	//TODO
}
*/

Light.prototype.getResources = function (res)
{
	if(this.projective_texture)
		res[ this.projective_texture ] = GL.Texture;
	if(this.extra_texture)
		res[ this.extra_texture ] = GL.Texture;
	return res;
}

Light.prototype.onResourceRenamed = function (old_name, new_name, resource)
{
	if(this.projective_texture == old_name)
		this.projective_texture = new_name;
	if(this.extra_texture == old_name)
		this.extra_texture = new_name;
}

//Layer stuff
Light.prototype.checkLayersVisibility = function( layers )
{
	return (this.illuminated_layers & layers) !== 0;
}

Light.prototype.isInLayer = function(num)
{
	return (this.illuminated_layers & (1<<num)) !== 0;
}

/**
* This method is called by the LS.Renderer when the light needs to be prepared to be used during render (compute light camera, create shadowmaps, prepare macros, etc)
* @method prepare
* @param {Object} render_settings info about how the scene will be rendered
*/
Light.prototype.prepare = function( render_settings )
{
	var uniforms = this._uniforms;
	var samplers = this._samplers;
	this._update_shadowmap_render_settings = null;

	//projective texture needs the light matrix to compute projection
	if(this.projective_texture || this._cast_shadows || this.force_light_matrix)
		this.updateLightCamera();

	if( (!render_settings.shadows_enabled || !this._cast_shadows) && this._shadowmap )
	{
		//this._shadowmap = null; 
		this._shadowmap.release();//I keep the shadowmap class but free the memory of the texture
		delete LS.ResourcesManager.textures[":shadowmap_" + this.uid ];
	}

	this.updateVectors();

	//PREPARE UNIFORMS
	//if(this.type == Light.DIRECTIONAL || this.type == Light.SPOT)
	//	uniforms.u_light_front = this._front;
	if(this.type == Light.SPOT)
	{
		uniforms.u_light_angle[0] = this.angle * DEG2RAD;
		uniforms.u_light_angle[1] = this.angle_end * DEG2RAD;
		uniforms.u_light_angle[2] = Math.cos( this.angle * DEG2RAD * 0.5 );
		uniforms.u_light_angle[3] = Math.cos( this.angle_end * DEG2RAD * 0.5 );
	}

	vec3.scale( uniforms.u_light_color, this.color, this.intensity );
	this._attenuation_info[0] = this.att_start;
	this._attenuation_info[1] = this.att_end;
	this._attenuation_info[2] = this.attenuation_type;
	uniforms.u_light_offset = this.offset;

	//prepare samplers
	this._samplers.length = 0;

	//projective texture
	if(this.projective_texture)
	{
		var light_projective_texture = this.projective_texture.constructor === String ? LS.ResourcesManager.textures[ this.projective_texture ] : this.projective_texture;
		if(light_projective_texture)
		{
			if(light_projective_texture.texture_type == gl.TEXTURE_CUBE_MAP)
				uniforms.light_cubemap = LS.Renderer.LIGHTPROJECTOR_TEXTURE_SLOT;
			else
				uniforms.light_texture = LS.Renderer.LIGHTPROJECTOR_TEXTURE_SLOT;
		}
		samplers[ LS.Renderer.LIGHTPROJECTOR_TEXTURE_SLOT ] = light_projective_texture;
	}
	else
	{
		delete uniforms["light_texture"];
		delete uniforms["light_cubemap"];
	}

	if(this.extra_texture)
	{
		var extra_texture = this.extra_texture.constructor === String ? LS.ResourcesManager.textures[this.extra_texture] : this.extra_texture;
		if(extra_texture)
		{
			if(extra_texture.texture_type == gl.TEXTURE_CUBE_MAP)
				uniforms.extra_light_cubemap = LS.Renderer.LIGHTEXTRA_TEXTURE_SLOT;
			else
				uniforms.extra_light_texture = LS.Renderer.LIGHTEXTRA_TEXTURE_SLOT;
		}
		samplers[ LS.Renderer.LIGHTEXTRA_TEXTURE_SLOT ] = extra_texture;
	}
	else
	{
		delete uniforms["extra_light_texture"];
		delete uniforms["extra_light_cubemap"];
	}

	//generate shadowmaps
	var must_update_shadowmap = (render_settings.update_shadowmaps || (!this._shadowmap._texture && !LS.ResourcesManager.isLoading())) && render_settings.shadows_enabled && !render_settings.lights_disabled && !render_settings.low_quality;
	if(must_update_shadowmap)
	{
		var is_inside_one_frustum = false;
		is_inside_one_frustum = this.isInsideVisibleFrustum();
		if( is_inside_one_frustum )
			this._update_shadowmap_render_settings = render_settings; //mark shadowmap to be updated
	}

	if( this._shadowmap && !this.cast_shadows )
		this._shadowmap.release();

	//prepare shadowmap
	if( this.cast_shadows && this._shadowmap && this._light_matrix != null && !render_settings.shadows_disabled ) //render_settings.update_all_shadowmaps
		this._shadowmap.prepare( uniforms, this._samplers );
}

/**
* Computes the max amount of light this object can produce (taking into account every color channel)
* @method computeLightIntensity
* @return {number} intensity
*/
Light.prototype.computeLightIntensity = function()
{
	var max = Math.max( this.color[0], this.color[1], this.color[2] );
	return Math.max(0,max * this.intensity);
}

/**
* Computes the light radius according to the attenuation
* @method computeLightRadius
* @return {number} radius
*/
Light.prototype.computeLightRadius = function()
{
	//linear attenuation has no ending so infinite
	if(this.attenuation_type == Light.NO_ATTENUATION || this.attenuation_type == Light.LINEAR_ATTENUATION )
		return -1;

	if( this.type == Light.OMNI )
		return this.att_end * Math.SQRT2;

	return this.att_end;
}

/**
* Generates the shadowmap for this light
* @method generateShadowmap
* @return {Object} render_settings
*/
Light.prototype.generateShadowmap = function ( render_settings, precompute_static )
{
	if(!this.cast_shadows)
		return;

	if(!this._shadowmap)
		this._shadowmap = new Shadowmap( this ); //this should never happend (it is created in cast_shadows = true, by just in case
	this._shadowmap.generate( null, render_settings, precompute_static );
}

/**
* It returns the global matrix 
* @method getGlobalMatrix
* @param {mat4} output [optional]
* @return {mat4} mat4
*/
Light.prototype.getGlobalMatrix = function( mat )
{
	if( this._root && this._root.transform )
		return this._root.transform.getGlobalMatrix( mat ); //use the node transform

	mat = mat || mat4.create();
	mat4.lookAt( mat, this._position, this._target, LS.TOP );
	return mat;
}


/**
* It returns a matrix in the position of the given light property (target, position), mostly used for gizmos
* @method getTransformMatrix
* @param {String} element "target" or "position"
* @param {mat4} output [optional]
* @return {mat4} mat4
*/
Light.prototype.getTransformMatrix = function( element, mat )
{
	if( this._root && this._root.transform )
		return this._root.transform.getGlobalMatrix( mat ); //use the node transform

	var p = null;
	if( element == "matrix" )
		return this.getGlobalMatrix(mat);
	if (element == "target")
		p = this.target;
	else //if (element == "position")
		p = this.position;

	var T = mat || mat4.create();
	mat4.setTranslation( T, p );
	return T;
}

/**
* apply a transformation to a given light property, this is done in a function to allow more complex gizmos
* @method applyTransformMatrix
* @param {mat4} matrix transformation in matrix form
* @param {vec3} center �?
* @param {string} property_name "target" or "position"
* @return {mat4} mat4
*/
Light.prototype.applyTransformMatrix = function( matrix, center, property_name )
{
	if( this._root && this._root.transform )
		return false; //ignore transform

	var p = null;
	if (property_name == "target")
		p = this.target;
	else
		p = this.position;

	mat4.multiplyVec3( p, matrix, p );
	return true;
}

//for when rendering to color
Light.prototype.applyShaderBlockFlags = function( flags, pass, render_settings )
{
	if(!this.enabled)
		return flags;

	//get the default light shader block
	flags |= Light.shader_block.flag_mask;

	//attenuation
	if(this.attenuation_type)
		flags |= Light.attenuation_block.flag_mask;

	//projective texture
	if(this.projective_texture)
		flags |= Light.light_texture_block.flag_mask;

	if( this.cast_shadows && render_settings.shadows_enabled && this._shadowmap )
		flags |= this._shadowmap.getReadShaderBlock();

	return flags;
}

//tells you if this light is inside any active camera
Light.prototype.isInsideVisibleFrustum = function()
{
	if( this.type != Light.OMNI ) //TODO: detect cone inside frustum
		return true;

	var cameras = LS.Renderer._visible_cameras;
	if(!cameras)
		return true;

	//test sphere inside frustum
	var closest_far = this.computeFar();
	var pos = this.position;
	for(var i = 0; i < cameras.length; i++)
	{
		if( geo.frustumTestSphere( cameras[i]._frustum_planes, pos, closest_far ) != CLIP_OUTSIDE )
			return true;
	}
	return false;
}



//define surface structures
LS.Shaders.registerSnippet("surface","\n\
	//used to store surface shading properties\n\
	struct SurfaceOutput {\n\
		vec3 Albedo;\n\
		vec3 Normal; //separated in case there is a normal map\n\
		vec3 Emission;\n\
		vec3 Ambient;\n\
		float Specular;\n\
		float Gloss;\n\
		float Alpha;\n\
		float Reflectivity;\n\
		vec4 Extra; //for special purposes\n\
	};\n\
	\n\
	SurfaceOutput getSurfaceOutput()\n\
	{\n\
		SurfaceOutput o;\n\
		o.Albedo = u_material_color.xyz;\n\
		o.Alpha = u_material_color.a;\n\
		o.Normal = normalize( v_normal );\n\
		o.Specular = 0.5;\n\
		o.Gloss = 10.0;\n\
		o.Ambient = vec3(1.0);\n\
		o.Emission = vec3(0.0);\n\
		o.Reflectivity = 0.0;\n\
		o.Extra = vec4(0.0);\n\
		return o;\n\
	}\n\
");

// LIGHT STRUCTS AND FUNCTIONS *****************************************
LS.Shaders.registerSnippet("light_structs","\n\
	#ifndef SB_LIGHT_STRUCTS\n\
	#define SB_LIGHT_STRUCTS\n\
	uniform lowp vec4 u_light_info;\n\
	uniform vec3 u_light_position;\n\
	uniform vec3 u_light_front;\n\
	uniform vec3 u_light_color;\n\
	uniform vec4 u_light_angle; //cone start,end,phi,theta \n\
	uniform vec4 u_light_att; //start,end \n\
	uniform float u_light_offset; //ndotl offset\n\
	uniform vec4 u_light_extra; //user data\n\
	uniform mat4 u_light_matrix; //projection to light screen space\n\
	uniform vec3 u_ambient_light;\n\
	struct Light {\n\
		lowp vec4 Info; //type of light (1:OMNI, 2: SPOT, 3: DIRECTIONAL), falloff type, pass index, num passes \n\
		vec3 Color;\n\
		vec3 Ambient;\n\
		vec3 Position;\n\
		vec3 Front;\n\
		vec4 ConeInfo; //for spotlights\n\
		vec4 Attenuation; //start,end,type,extra\n\
		float Offset; //phong_offset\n\
		vec4 Extra; //users can use this\n\
		mat4 Matrix; //converts to light space\n\
		float Distance;\n\
	};\n\
	//Returns the info about the light\n\
	Light getLight()\n\
	{\n\
		Light LIGHT;\n\
		LIGHT.Info = u_light_info;\n\
		LIGHT.Color = u_light_color;\n\
		if(u_light_info.z == 0.0)\n\
			LIGHT.Ambient = u_ambient_light;\n\
		else\n\
			LIGHT.Ambient = vec3(0.0);\n\
		LIGHT.Position = u_light_position;\n\
		LIGHT.Front = u_light_front;\n\
		LIGHT.ConeInfo = u_light_angle; //for spotlights\n\
		LIGHT.Attenuation = u_light_att; //start and end\n\
		LIGHT.Offset = u_light_offset;\n\
		LIGHT.Distance = length( u_light_position - v_pos );\n\
		LIGHT.Extra = u_light_extra;\n\
		LIGHT.Matrix = u_light_matrix; //converts to light space\n\
		return LIGHT;\n\
	}\n\
	//used to store light contribution\n\
	struct FinalLight {\n\
		vec3 Color;\n\
		vec3 Ambient;\n\
		float Diffuse; //NdotL\n\
		float Specular; //RdotL\n\
		vec3 Emission;\n\
		vec3 Reflection;\n\
		float Attenuation;\n\
		vec3 Vector; //light vector\n\
		float Shadow; //1.0 means fully lit\n\
	};\n\
	#endif\n\
");

// LIGHT ************************************************





Light._vs_shaderblock_code = "\n\
	#pragma shaderblock \"testShadow\"\n\
";

Light._enabled_fs_shaderblock_code = "\n\
	#pragma snippet \"surface\"\n\
	#pragma snippet \"light_structs\"\n\
	#pragma snippet \"spotFalloff\"\n\
	#pragma shaderblock \"firstPass\"\n\
	#pragma shaderblock \"lastPass\"\n\
	#pragma shaderblock \"applyIrradiance\"\n\
	#pragma shaderblock \"attenuation\"\n\
	#pragma shaderblock \"testShadow\"\n\
	\n\
	//Light is separated in two functions, computeLight (how much light receives the object) and applyLight (compute resulting final color)\n\
	// FINAL LIGHT EQUATION, takes all the info from FinalLight and computes the final color \n\
	\n\
	// HERE we fill FinalLight structure with all the info (colors,NdotL,diffuse,specular,etc) \n\
	FinalLight computeLight(in SurfaceOutput o, in Input IN, in Light LIGHT )\n\
	{\n\
		FinalLight FINALLIGHT;\n\
		// INIT\n\
		FINALLIGHT.Color = LIGHT.Color;\n\
		\n\
		// COMPUTE VECTORS\n\
		vec3 N = o.Normal; //use the final normal (should be the same as IN.worldNormal)\n\
		vec3 E = (u_camera_eye - v_pos);\n\
		float cam_dist = length(E);\n\
		E /= cam_dist;\n\
		\n\
		vec3 L = (LIGHT.Position - v_pos) / LIGHT.Distance;\n\
		\n\
		if( LIGHT.Info.x == 3.0 )\n\
			L = -LIGHT.Front;\n\
		\n\
		FINALLIGHT.Vector = L;\n\
		vec3 R = reflect(E,N);\n\
		\n\
		// IRRADIANCE\n\
		#ifdef BLOCK_FIRSTPASS\n\
			FINALLIGHT.Ambient = LIGHT.Ambient;\n\
			applyIrradiance( IN, o, FINALLIGHT );\n\
		#endif\n\
		// PHONG FORMULA\n\
		float NdotL = 1.0;\n\
		NdotL = dot(N,L);\n\
		float EdotN = dot(E,N); //clamp(dot(E,N),0.0,1.0);\n\
		NdotL = NdotL + LIGHT.Offset;\n\
		NdotL = max( 0.0, NdotL );\n\
		FINALLIGHT.Diffuse = abs(NdotL);\n\
		FINALLIGHT.Specular = o.Specular * pow( clamp(dot(R,-L),0.001,1.0), o.Gloss );\n\
		\n\
		// ATTENUATION\n\
		FINALLIGHT.Attenuation = 1.0;\n\
		\n\
		#ifdef BLOCK_ATTENUATION\n\
			FINALLIGHT.Attenuation = computeAttenuation( LIGHT );\n\
		#endif\n\
		if( LIGHT.Info.x == 2.0 && LIGHT.Info.y == 1.0 )\n\
			FINALLIGHT.Attenuation *= spotFalloff( LIGHT.Front, normalize( LIGHT.Position - v_pos ), LIGHT.ConeInfo.z, LIGHT.ConeInfo.w );\n\
		\n\
		// SHADOWS\n\
		FINALLIGHT.Shadow = 1.0;\n\
		#ifdef BLOCK_TESTSHADOW\n\
			FINALLIGHT.Shadow = testShadow( LIGHT );\n\
		#endif\n\
		\n\
		// LIGHT MODIFIERS\n\
		#ifdef LIGHT_MODIFIER\n\
		#endif\n\
		// FINAL LIGHT FORMULA ************************* \n\
		return FINALLIGHT;\n\
	}\n\
	//here we apply the FINALLIGHT to the SurfaceOutput\n\
	vec3 applyLight( in SurfaceOutput o, in FinalLight FINALLIGHT )\n\
	{\n\
		vec3 total_light = FINALLIGHT.Ambient * o.Ambient + FINALLIGHT.Color * FINALLIGHT.Diffuse * FINALLIGHT.Attenuation * FINALLIGHT.Shadow;\n\
		vec3 final_color = o.Albedo * total_light;\n\
		#ifdef BLOCK_FIRSTPASS\n\
		final_color += o.Emission;\n\
		#endif\n\
		final_color	+= o.Albedo * (FINALLIGHT.Color * FINALLIGHT.Specular * FINALLIGHT.Attenuation * FINALLIGHT.Shadow);\n\
		return max( final_color, vec3(0.0) );\n\
	}\n\
	\n\
	//all done in one single step\n\
	vec3 processLight(in SurfaceOutput o, in Input IN, in Light LIGHT)\n\
	{\n\
		FinalLight FINALLIGHT = computeLight( o, IN,LIGHT );\n\
		return applyLight(o,FINALLIGHT);\n\
	}\n\
	\n\
";

//the disabled block is included when no light should be present in the scene, but we do not want to break the shaders that rely on them
Light._disabled_shaderblock_code = "\n\
	#pragma shaderblock \"firstPass\"\n\
	#pragma shaderblock \"lastPass\"\n\
	#pragma snippet \"input\"\n\
	#pragma snippet \"surface\"\n\
	#pragma snippet \"light_structs\"\n\
	#pragma shaderblock \"applyIrradiance\"\n\
	FinalLight computeLight( in SurfaceOutput o, in Input IN, in Light LIGHT )\n\
	{\n\
		FinalLight FINALLIGHT;\n\
		FINALLIGHT.Ambient = LIGHT.Ambient;\n\
		FINALLIGHT.Diffuse = 0.0;\n\
		FINALLIGHT.Specular = 0.0;\n\
		FINALLIGHT.Attenuation = 0.0;\n\
		FINALLIGHT.Shadow = 0.0;\n\
		applyIrradiance( IN, o, FINALLIGHT );\n\
		return FINALLIGHT;\n\
	}\n\
	vec3 applyLight( in SurfaceOutput o, in FinalLight FINALLIGHT )\n\
	{\n\
		vec3 final_color = o.Albedo * o.Ambient * FINALLIGHT.Ambient;\n\
		#ifdef BLOCK_FIRSTPASS\n\
		final_color += o.Emission;\n\
		#endif\n\
		return final_color;\n\
	}\n\
	\n\
	//all done in one single step\n\
	vec3 processLight(in SurfaceOutput o, in Input IN, in Light LIGHT)\n\
	{\n\
		FinalLight FINALLIGHT = computeLight( o, IN,LIGHT );\n\
		return applyLight(o,FINALLIGHT);\n\
	}\n\
	\n\
";

//this is the main light block
var light_block = new LS.ShaderBlock("light");
light_block.addCode( GL.VERTEX_SHADER, Light._vs_shaderblock_code, Light._vs_shaderblock_code );
light_block.addCode( GL.FRAGMENT_SHADER, Light._enabled_fs_shaderblock_code, Light._disabled_shaderblock_code );
light_block.register();
Light.shader_block = light_block;

// ATTENUATION ************************************************
//this block handles different types ot attenuation
Light._attenuation_enabled_fragment_code = "\n\
	const float LINEAR_ATTENUATION = 1.0;\n\
	const float RANGE_ATTENUATION = 2.0;\n\
	float computeAttenuation( in Light LIGHT )\n\
	{\n\
		//no attenuation\n\
		if(LIGHT.Attenuation.z == 0.0)\n\
			return 1.0;\n\
		//directional light\n\
		if( LIGHT.Info.x == 3.0 )\n\
			return 1.0;\n\
		if( LIGHT.Attenuation.z == LINEAR_ATTENUATION )\n\
			return 10.0 / LIGHT.Distance;\n\
		if( LIGHT.Attenuation.z == RANGE_ATTENUATION )\n\
		{\n\
			if(LIGHT.Distance >= LIGHT.Attenuation.y)\n\
				return 0.0;\n\
			if(LIGHT.Distance >= LIGHT.Attenuation.x)\n\
				return 1.0 - (LIGHT.Distance - LIGHT.Attenuation.x) / (LIGHT.Attenuation.y - LIGHT.Attenuation.x);\n\
		}\n\
		return 1.0;\n\
	}\n\
";
Light._attenuation_disabled_fragment_code = "";

var attenuation_block = Light.attenuation_block = new LS.ShaderBlock("attenuation");
attenuation_block.addCode( GL.FRAGMENT_SHADER, Light._attenuation_enabled_fragment_code, Light._attenuation_disabled_fragment_code );
attenuation_block.register();

// LIGHT TEXTURE **********************************************
//this block handles light cookies (textures modulating light)
Light._light_texture_fragment_enabled_code ="\n\
uniform sampler2D light_texture;\n\
void applyLightTexture( in Input IN, inout Light LIGHT )\n\
{\n\
	vec2 uv;\n\
	if(LIGHT.Info.x == 1.0) //omni\n\
	{\n\
		vec3 V = normalize(IN.worldPos - LIGHT.Position);\n\
		uv = vec2( 0.5 - (atan(V.z, V.x) / -6.28318531), asin(V.y) / 1.57079633 * 0.5 + 0.5);\n\
	}\n\
	else\n\
	{\n\
		vec4 v = LIGHT.Matrix * vec4( IN.worldPos,1.0 );\n\
		uv = v.xy / v.w * 0.5 + vec2(0.5);\n\
	}\n\
	LIGHT.Color *= texture2D( light_texture, uv ).xyz;\n\
}\n\
";

Light._light_texture_fragment_disabled_code ="\n\
void applyLightTexture( in Input IN, inout Light LIGHT )\n\
{\n\
}\n\
";

var light_texture_block = Light.light_texture_block = new LS.ShaderBlock("light_texture");
light_texture_block.addCode( GL.FRAGMENT_SHADER, Light._light_texture_fragment_enabled_code, Light._light_texture_fragment_disabled_code );
light_texture_block.register();

/*
// OMNI LIGHT SHADOWMAP *****************************************
Light._shadowmap_cubemap_code = "\n\
	#define SHADOWMAP_ACTIVE\n\
	uniform samplerCube shadowmap;\n\
	uniform vec4 u_shadow_params; // (1.0/(texture_size), bias, near, far)\n\
	\n\
	float VectorToDepthValue(vec3 Vec)\n\
	{\n\
		vec3 AbsVec = abs(Vec);\n\
		float LocalZcomp = max(AbsVec.x, max(AbsVec.y, AbsVec.z));\n\
		float n = u_shadow_params.z;\n\
		float f = u_shadow_params.w;\n\
		float NormZComp = (f+n) / (f-n) - (2.0*f*n)/(f-n)/LocalZcomp;\n\
		return (NormZComp + 1.0) * 0.5;\n\
	}\n\
	\n\
	float UnpackDepth32(vec4 depth)\n\
	{\n\
		const vec4 bitShifts = vec4( 1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1);\n\
		return dot(depth.xyzw , bitShifts);\n\
	}\n\
	\n\
	float testShadow( Light LIGHT, vec3 offset )\n\
	{\n\
		float shadow = 0.0;\n\
		float depth = 0.0;\n\
		float bias = u_shadow_params.y;\n\
		\n\
		vec3 l_vector = (v_pos - u_light_position);\n\
		float dist = length(l_vector);\n\
		float pixel_z = VectorToDepthValue( l_vector );\n\
		if(pixel_z >= 0.998)\n\
			return 0.0; //fixes a little bit the far edge bug\n\
		vec4 depth_color = textureCube( shadowmap, l_vector + offset * dist );\n\
		float ShadowVec = UnpackDepth32( depth_color );\n\
		if ( ShadowVec > pixel_z - bias )\n\
			return 0.0; //no shadow\n\
		return 1.0; //full shadow\n\
	}\n\
";

Light._shadowmap_vertex_enabled_code ="\n\
	#pragma snippet \"light_structs\"\n\
	varying vec4 v_light_coord;\n\
	void applyLight( vec3 pos ) { v_light_coord = u_light_matrix * vec4(pos,1.0); }\n\
";

Light._shadowmap_vertex_disabled_code ="\n\
	void applyLight(vec3 pos) {}\n\
";


// DIRECTIONAL AND SPOTLIGHT SHADOWMAP *****************************************
Light._shadowmap_2d_enabled_fragment_code = "\n\
	#ifndef TESTSHADOW\n\
		#define TESTSHADOW\n\
	#endif\n\
	uniform sampler2D shadowmap;\n\
	varying vec4 v_light_coord;\n\
	uniform vec4 u_shadow_params; // (1.0/(texture_size), bias, near, far)\n\
	\n\
	float UnpackDepth(vec4 depth)\n\
	{\n\
		#ifdef BLOCK_DEPTH_IN_COLOR\n\
			const vec4 bitShifts = vec4( 1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1);\n\
			return dot(depth.xyzw , bitShifts);\n\
		#else\n\
			return depth.x;\n\
		#endif\n\
	}\n\
	float texsize = 1.0 / u_shadow_params.x;\n\
	float real_depth = 0.0;\n\
	\n\
	float pixelShadow( vec2 uv )\n\
	{\n\
		float sampleDepth = UnpackDepth( texture2D(shadowmap, uv) );\n\
		float depth = (sampleDepth == 1.0) ? 1.0e9 : sampleDepth; //on empty data send it to far away\n\
		if (depth > 0.0) \n\
			return real_depth > depth ? 0.0 : 1.0;\n\
		return 0.0;\n\
	}\n\
	float expFunc(float f)\n\
	{\n\
		return f*f*f*(f*(f*6.0-15.0)+10.0);\n\
	}\n\
	\n\
	float testShadow( Light LIGHT )\n\
	{\n\
		vec3 offset = vec3(0.0);\n\
		float depth = 0.0;\n\
		float bias = u_shadow_params.y;\n\
		\n\
		vec2 sample = (v_light_coord.xy / v_light_coord.w) * vec2(0.5) + vec2(0.5) + offset.xy;\n\
		//is inside light frustum\n\
		if (clamp(sample, 0.0, 1.0) != sample) \n\
			return LIGHT.Info.x == 3.0 ? 1.0 : 0.0; //outside of shadowmap, no shadow\n\
		\n\
		real_depth = (v_light_coord.z - bias) / v_light_coord.w * 0.5 + 0.5;\n\
		vec2 topleft_uv = sample * texsize;\n\
		vec2 offset_uv = fract( topleft_uv );\n\
		offset_uv.x = expFunc(offset_uv.x);\n\
		offset_uv.y = expFunc(offset_uv.y);\n\
		topleft_uv = floor(topleft_uv) * u_shadow_params.x;\n\
		float topleft = pixelShadow( topleft_uv );\n\
		float topright = pixelShadow( topleft_uv + vec2(u_shadow_params.x,0.0) );\n\
		float bottomleft = pixelShadow( topleft_uv + vec2(0.0, u_shadow_params.x) );\n\
		float bottomright = pixelShadow( topleft_uv + vec2(u_shadow_params.x, u_shadow_params.x) );\n\
		float top = mix( topleft, topright, offset_uv.x );\n\
		float bottom = mix( bottomleft, bottomright, offset_uv.x );\n\
		return mix( top, bottom, offset_uv.y );\n\
	}\n\
";

Light._shadowmap_2d_disabled_code = "\nfloat testShadow( Light LIGHT ) { return 1.0; }\n";

var shadowmapping_depth_in_color_block = new LS.ShaderBlock("depth_in_color");
shadowmapping_depth_in_color_block.register();
Light.shadowmapping_depth_in_color_block = shadowmapping_depth_in_color_block;

var shadowmapping_block = new LS.ShaderBlock("testShadow");
shadowmapping_block.addCode( GL.VERTEX_SHADER, Light._shadowmap_vertex_enabled_code, Light._shadowmap_vertex_disabled_code);
shadowmapping_block.addCode( GL.FRAGMENT_SHADER, Light._shadowmap_2d_enabled_fragment_code, Light._shadowmap_2d_disabled_code );
//shadowmapping_block.defineContextMacros({"SHADOWBLOCK":"testShadow"});
shadowmapping_block.register();
Light.shadowmapping_2d_shader_block = shadowmapping_block;
Light.registerShadowType( "hard", shadowmapping_block );

var shadowmapping_2D_hard_shader_block = new LS.ShaderBlock("testShadow2D_hard");
shadowmapping_2D_hard_shader_block.addCode( GL.VERTEX_SHADER, Light._shadowmap_vertex_enabled_code, Light._shadowmap_vertex_disabled_code );
shadowmapping_2D_hard_shader_block.addCode( GL.FRAGMENT_SHADER, Light._shadowmap_2d_enabled_code, "" );
shadowmapping_2D_hard_shader_block.register();
Light.shadowmapping_2D_hard_shader_block = shadowmapping_2D_hard_shader_block;
//Light.registerShadowType( "hard", shadowmapping_hard_2d_shader_block );

var shadowmapping_2D_soft_block = new LS.ShaderBlock("testShadow2D_soft");
shadowmapping_2D_soft_block.addCode( GL.VERTEX_SHADER, Light._shadowmap_vertex_enabled_code, Light._shadowmap_vertex_disabled_code );
shadowmapping_2D_soft_block.addCode( GL.FRAGMENT_SHADER, Light._shadowmap_2d_enabled_code, "" );
shadowmapping_2D_soft_block.register();
Light.shadowmapping_2D_soft_block = shadowmapping_2D_soft_block;
//Light.registerShadowType( "soft", shadowmappingsoft_block );
*/

// ENVIRONMENT *************************************
//this block handles a reflective texture
//it is not part of the illumination, shadars must include it manually
//most of it is solved inside ShaderMaterial.prototype.renderInstance 

var environment_code = "\n\
	#ifdef ENVIRONMENT_TEXTURE\n\
		uniform sampler2D environment_texture;\n\
	#endif\n\
	#ifdef ENVIRONMENT_PLANAR\n\
		uniform sampler2D environment_texture;\n\
	#endif\n\
	#ifdef ENVIRONMENT_CUBEMAP\n\
		uniform samplerCube environment_texture;\n\
	#endif\n\
	vec2 polarToCartesian(in vec3 V)\n\
	{\n\
		return vec2( 0.5 - (atan(V.z, V.x) / -6.28318531), asin(V.y) / 1.57079633 * 0.5 + 0.5);\n\
	}\n\
	\n\
	vec3 getEnvironmentColor( vec3 V, float area )\n\
	{\n\
		#ifdef ENVIRONMENT_TEXTURE\n\
			vec2 uvs = polarToCartesian(V);\n\
			return texture2D( environment_texture, uvs ).xyz;\n\
		#endif\n\
		#ifdef ENVIRONMENT_CUBEMAP\n\
			return textureCube( environment_texture, -V ).xyz;\n\
		#endif\n\
		return u_background_color.xyz;\n\
	}\n\
";
var environment_disabled_code = "\n\
	vec3 getEnvironmentColor( vec3 V, float area )\n\
	{\n\
		return u_background_color.xyz;\n\
	}\n\
";

var environment_cubemap_block = new LS.ShaderBlock("environment_cubemap");
environment_cubemap_block.addCode( GL.FRAGMENT_SHADER, environment_code, environment_disabled_code, { ENVIRONMENT_CUBEMAP: "" } );
environment_cubemap_block.defineContextMacros({ENVIRONMENTBLOCK:"environment_cubemap"});
environment_cubemap_block.register();

var environment_2d_block = new LS.ShaderBlock("environment_2D");
environment_2d_block.defineContextMacros({ENVIRONMENTBLOCK:"environment_2D"});
environment_2d_block.addCode( GL.FRAGMENT_SHADER, environment_code, environment_disabled_code, { ENVIRONMENT_TEXTURE: "" } );
environment_2d_block.register();

var environment_planar_block = new LS.ShaderBlock("environment_planar");
environment_planar_block.defineContextMacros({ENVIRONMENTBLOCK:"environment_planar"});
environment_planar_block.addCode( GL.FRAGMENT_SHADER, environment_code, environment_disabled_code, { ENVIRONMENT_PLANAR: "" } );
environment_planar_block.register();

var environment_block = new LS.ShaderBlock("environment");
environment_block.addCode( GL.FRAGMENT_SHADER, environment_code, environment_disabled_code );
environment_block.register();


var reflection_code = "\n\
	#pragma shaderblock ENVIRONMENTBLOCK \"environment\"\n\
	\n\
	vec4 applyReflection( Input IN, SurfaceOutput o, vec4 final_color )\n\
	{\n\
		vec3 R = reflect( IN.viewDir, o.Normal );\n\
		vec3 bg = vec3(0.0);\n\
		//is last pass for this object?\n\
		#ifdef BLOCK_LASTPASS\n\
			#ifdef ENVIRONMENT_PLANAR\n\
				vec2 screen_uv = gl_FragCoord.xy / u_viewport.zw;\n\
				screen_uv.x = 1.0 - screen_uv.x;\n\
				screen_uv.xy += (u_view * vec4(o.Normal - IN.worldNormal, 0.0)).xy * 0.1;\n\
				bg = texture2D( environment_texture, screen_uv ).xyz;\n\
			#else\n\
				bg = getEnvironmentColor( R, 0.0 );\n\
			#endif\n\
		#endif\n\
		final_color.xyz = mix( final_color.xyz, bg, clamp( o.Reflectivity, 0.0, 1.0) );\n\
		return final_color;\n\
	}\n\
";

var reflection_disabled_code = "\n\
	vec4 applyReflection( Input IN, SurfaceOutput o, vec4 final_color )\n\
	{\n\
		return final_color;\n\
	}\n\
";

var reflection_block = new LS.ShaderBlock("applyReflection");
ShaderMaterial.reflection_block = reflection_block;
reflection_block.addCode( GL.FRAGMENT_SHADER, reflection_code, reflection_disabled_code );
reflection_block.register();



//dummy irradiance code (it is overwritten later) *****************************
var irradiance_disabled_code = "\n\
	void applyIrradiance( in Input IN, in SurfaceOutput o, inout FinalLight FINALLIGHT )\n\
	{\n\
	}\n\
";

if( !LS.Shaders.getShaderBlock("applyIrradiance") )
{
	var irradiance_block = new LS.ShaderBlock("applyIrradiance");
	ShaderMaterial.irradiance_block = irradiance_block;
	irradiance_block.addCode( GL.FRAGMENT_SHADER, irradiance_disabled_code, irradiance_disabled_code );
	irradiance_block.register();
}
