//Material class **************************
/**
* A Material is a class in charge of defining how to render an object, there are several classes for Materials
* but this class is more like a template for other material classes.
* The rendering of a material is handled by the material itself, if not provided then uses the Renderer default one
* @namespace LS
* @class Material
* @constructor
* @param {String} object to configure from
*/

function Material( o )
{
	this.uid = LS.generateUId("MAT-");
	this._must_update = true;

	//used locally during rendering
	this._index = -1;
	this._local_id = Material.last_index++;
	this._last_frame_update = -1;

	/**
	* materials have at least a basic color property and opacity
	* @property color
	* @type {[[r,g,b]]}
	* @default [1,1,1]
	*/
	this._color = new Float32Array([1.0,1.0,1.0,1.0]);

	/**
	* render queue: which order should this be rendered
	* @property queue
	* @type {Number}
	* @default LS.RenderQueue.AUTO
	*/
	this._queue = LS.RenderQueue.AUTO;

	/**
	* render state: which flags should be used (in StandardMaterial this is overwritten due to the multipass lighting)
	* TODO: render states should be moved to render passes defined by the shadercode in the future to allow multipasses like cellshading outline render
	* @property render_state
	* @type {LS.RenderState}
	*/
	this._render_state = new LS.RenderState();


	this._light_mode = LS.Material.NO_LIGHTS;

	/**
	* matrix used to define texture tiling in the shader (passed as u_texture_matrix)
	* @property uvs_matrix
	* @type {mat3}
	* @default [1,0,0, 0,1,0, 0,0,1]
	*/
	this.uvs_matrix = new Float32Array([1,0,0, 0,1,0, 0,0,1]);

	/**
	* texture channels
	* contains info about the samplers for every texture channel
	* @property textures
	* @type {Object}
	*/
	this.textures = {};

	/**
	* used internally by LS.StandardMaterial
	* This will be gone in the future in order to use the new ShaderMaterial rendering system
	* @property query
	* @type {LS.ShaderQuery}
	*/
	//this._query = new LS.ShaderQuery();

	/**
	* flags to control cast_shadows, receive_shadows or ignore_frustum
	* @property flags
	* @type {Object}
	* @default { cast_shadows: true, receive_shadows: true, ignore_frutum: false }
	*/
	this.flags = {
		cast_shadows: true,
		receive_shadows: true,
		ignore_frustum: false
	};

	//properties with special storage (multiple vars shared among single properties)

	Object.defineProperty( this, 'color', {
		get: function() { return this._color.subarray(0,3); },
		set: function(v) { vec3.copy( this._color, v ); },
		enumerable: true
	});

	/**
	* The alpha component to control opacity
	* @property opacity
	* @default 1
	**/
	Object.defineProperty( this, 'opacity', {
		get: function() { return this._color[3]; },
		set: function(v) { this._color[3] = v; },
		enumerable: true
	});

	/**
	* the render queue id where this instance belongs
	* @property queue
	* @default LS.RenderQueue.DEFAULT;
	**/
	Object.defineProperty( this, 'queue', {
		get: function() { return this._queue; },
		set: function(v) { 
			if( isNaN(v) || !isNumber(v) )
				return;
			this._queue = v;
		},
		enumerable: true
	});

	/**
	* the render state flags to control how the GPU behaves
	* @property render_state
	**/
	Object.defineProperty( this, 'render_state', {
		get: function() { return this._render_state; },
		set: function(v) { 
			if(!v)
				return;
			for(var i in v) //copy from JSON object
				this._render_state[i] = v[i];
		},
		enumerable: true
	});


	if(o) 
		this.configure(o);
}

Material["@color"] = { type:"color" };

Material.icon = "mini-icon-material.png";
Material.last_index = 0;

Material.NO_LIGHTS = 0;
Material.ONE_LIGHT = 1;
Material.SEVERAL_LIGHTS = 2;

Material.EXTENSION = "json";

//material info attributes, use this to avoid errors when settings the attributes of a material

/**
* Surface color
* @property color
* @type {vec3}
* @default [1,1,1]
*/
Material.COLOR = "color";
/**
* Opacity. It must be < 1 to enable alpha sorting. If it is <= 0 wont be visible.
* @property opacity
* @type {number}
* @default 1
*/
Material.OPACITY = "opacity";

Material.SPECULAR_FACTOR = "specular_factor";
/**
* Specular glossiness: the glossines (exponent) of specular light
* @property specular_gloss
* @type {number}
* @default 10
*/
Material.SPECULAR_GLOSS = "specular_gloss";

Material.OPACITY_TEXTURE = "opacity";	//used for baked GI
Material.COLOR_TEXTURE = "color";	//material color
Material.AMBIENT_TEXTURE = "ambient";
Material.SPECULAR_TEXTURE = "specular"; //defines specular factor and glossiness per pixel
Material.EMISSIVE_TEXTURE = "emissive";
Material.ENVIRONMENT_TEXTURE = "environment";
Material.IRRADIANCE_TEXTURE = "irradiance";

Material.COORDS_UV0 = 0;
Material.COORDS_UV1 = 1;
Material.COORDS_UV0_TRANSFORMED = 2;
Material.COORDS_UV1_TRANSFORMED = 3;
Material.COORDS_UV_POINTCOORD = 4;

Material.TEXTURE_COORDINATES = { "uv0":Material.COORDS_UV0, "uv1":Material.COORDS_UV1, "uv0_transformed":Material.COORDS_UV0_TRANSFORMED, "uv1_transformed":Material.COORDS_UV1_TRANSFORMED, "uv_pointcoord": Material.COORDS_UV_POINTCOORD  };

Material.available_shaders = ["default","global","lowglobal","phong_texture","flat","normal","phong","flat_texture","cell_outline"];

Material.prototype.fillUniforms = function( scene, options )
{
	var uniforms = {};
	var samplers = [];

	uniforms.u_material_color = this._color;
	uniforms.u_ambient_color = scene.info ? scene.info.ambient_color : LS.ONES;
	uniforms.u_texture_matrix = this.uvs_matrix;

	uniforms.u_specular = vec2.create([1,50]);
	uniforms.u_reflection = 0.0;

	//iterate through textures in the material
	var last_texture_slot = 0;
	for(var i in this.textures) 
	{
		var sampler = this.getTextureSampler(i);
		if(!sampler)
			continue;

		var texture = Material.getTextureFromSampler( sampler );
		if(!texture) //loading or non-existant
			continue;

		samplers[ last_texture_slot ] = sampler;
		var uniform_name = i + (texture.texture_type == gl.TEXTURE_2D ? "_texture" : "_cubemap");
		uniforms[ uniform_name ] = last_texture_slot;
		last_texture_slot++;
	}

	//add extra uniforms
	for(var i in this.extra_uniforms)
		uniforms[i] = this.extra_uniforms[i];

	this._uniforms = uniforms;
	this._samplers = samplers; //samplers without fixed slot
}

/**
* Configure the material getting the info from the object
* @method configure
* @param {Object} object to configure from
*/
Material.prototype.configure = function(o)
{
	for(var i in o)
	{
		if(typeof (o[i]) === "function")
			continue;
		if(!this.setProperty( i, o[i] ) && LS.debug)
			console.warn("Material property not assigned: " + i );
	}
}

/**
* Serialize this material 
* @method serialize
* @return {Object} object with the serialization info
*/
Material.prototype.serialize = function( simplified )
{
	//remove hardcoded data from containers before serializing
	for(var i in this.textures)
		if (this.textures[i] && this.textures[i].constructor === GL.Texture)
			this.textures[i] = null;

	var o = LS.cloneObject(this);
	delete o.filename;
	delete o.fullpath;
	delete o.remotepath;
	o.material_class = LS.getObjectClassName(this);

	if( simplified )
	{
		delete o.render_state;
		delete o.flags;
		if( o.uvs_matrix && o.uvs_matrix.equal([1,0,0, 0,1,0, 0,0,1]) )
			delete o.uvs_matrix;
	}

	return o;
}


/**
* Clone this material (keeping the class)
* @method clone
* @return {Material} Material instance
*/
Material.prototype.clone = function()
{
	var data = this.serialize();
	if(data.uid)
		delete data.uid;
	return new this.constructor( JSON.parse( JSON.stringify( data )) );
}

/**
* Loads and assigns a texture to a channel
* @method loadAndSetTexture
* @param {Texture || url} texture_or_filename
* @param {String} channel
*/
Material.prototype.loadAndSetTexture = function( channel, texture_or_filename, options )
{
	options = options || {};
	var that = this;

	if( texture_or_filename && texture_or_filename.constructor === String ) //it could be the url or the internal texture name 
	{
		if(texture_or_filename[0] != ":")//load if it is not an internal texture
			LS.ResourcesManager.load(texture_or_filename,options, function(texture) {
				that.setTexture(channel, texture);
				if(options.on_complete)
					options.on_complete();
			});
		else
			this.setTexture(channel, texture_or_filename);
	}
	else //otherwise just assign whatever
	{
		this.setTexture( channel, texture_or_filename );
		if(options.on_complete)
			options.on_complete();
	}
}

/**
* gets all the properties and its types
* @method getPropertiesInfo
* @return {Object} object with name:type
*/
Material.prototype.getPropertiesInfo = function()
{
	var o = {
		color:"vec3",
		opacity:"number",
		uvs_matrix:"mat3"
	};

	var textures = this.getTextureChannels();
	for(var i in textures)
		o["tex_" + textures[i]] = "Texture"; //changed from Sampler
	return o;
}

/**
* gets all the properties and its types
* @method getProperty
* @return {Object} object with name:type
*/
Material.prototype.getProperty = function(name)
{
	if(name.substr(0,4) == "tex_")
		return this.textures[ name.substr(4) ];
	return this[name];
}


/**
* gets all the properties and its types
* @method getProperty
* @return {Object} object with name:type
*/
Material.prototype.setProperty = function( name, value )
{
	if( value === undefined )
		return;

	if( name.substr(0,4) == "tex_" )
	{
		if( (value && (value.constructor === String || value.constructor === GL.Texture)) || !value)
			this.setTexture( name.substr(4), value );
		return true;
	}

	switch( name )
	{
		//numbers
		case "queue": 
			if(value === 0)
				value = RenderQueue.AUTO; //legacy
			//nobreak
		case "opacity": 
			if(value !== null && value.constructor === Number)
				this[name] = value; 
			break;
		//bools
		//strings
		case "uid":
			this[name] = value; 
			break;
		//vectors
		case "uvs_matrix":
		case "color": 
			if(this[name].length == value.length)
				this[name].set( value );
			break;
		case "textures":
			for(var i in value)
			{
				var tex = value[i]; //sampler
				if(tex == null)
				{
					delete this.textures[i];
					continue;
				}
				if( tex.constructor === String )
					tex = { texture: tex, uvs: 0, wrap: 0, minFilter: 0, magFilter: 0 };
				if( tex.constructor !== GL.Texture && tex.constructor != Object )
				{
					console.warn("invalid value for texture:",tex);
					break;
				}
				tex._must_update = true;
				this.textures[i] = tex;
				if( tex.uvs != null && tex.uvs.constructor === String )
					tex.uvs = 0;
				//this is to ensure there are no wrong characters in the texture name
				if( this.textures[i] && this.textures[i].texture )
					this.textures[i].texture = LS.ResourcesManager.cleanFullpath( this.textures[i].texture );
			}
			//this.textures = cloneObject(value);
			break;
		case "flags":
			for(var i in value)
				this.flags[i] = value[i];
			break;
		case "transparency": //special cases
			this.opacity = 1 - value;
			break;
		case "render_state":
			this._render_state.configure( value );
			break;
		//ignore
		case "material_class":
		case "object_type":
			return true;
		default:
			return false;
	}
	return true;
}

Material.prototype.setPropertyValueFromPath = function( path, value, offset )
{
	offset = offset || 0;

	if( path.length < (offset+1) )
		return;

	//maybe check if path is texture?
	//TODO

	//assign
	this.setProperty( path[ offset ], value );
}

Material.prototype.getPropertyInfoFromPath = function( path )
{
	if( path.length < 1)
		return;

	var varname = path[0];
	var type = null;

	switch(varname)
	{
		case "queue": 
		case "opacity": 
		case "transparency":
			type = "number"; break;
		//vectors
		case "uvs_matrix":
			type = "mat3"; break;
		case "color": 
			type = "vec3"; break;
		case "textures":
			if( path.length > 1 )
			{
				return {
					node: this._root,
					target: this.textures,
					name: path[1],
					value: this.textures[path[1]] || null,
					type: "Texture"
				}
			}
			type = "Texture"; 
			break;
		default:
			return null;
	}

	return {
		node: this._root,
		target: this,
		name: varname,
		value: this[varname],
		type: type
	};
}

/**
* gets all the texture channels supported by this material
* @method getTextureChannels
* @return {Array} array with the name of every channel supported by this material
*/
Material.prototype.getTextureChannels = function()
{
	//console.warn("this function should never be called, it should be overwritten");
	return [];
}

/**
* Assigns a texture to a channel and its sampling parameters
* @method setTexture
* @param {String} channel for a list of supported channels by this material call getTextureChannels()
* @param {Texture} texture
* @param {Object} sampler_options
*/
Material.prototype.setTexture = function( channel, texture, sampler_options ) {

	if(!channel)
		throw("Material.prototype.setTexture channel must be specified");

	if(!texture)
	{
		delete this.textures[ channel ];
		return;
	}

	//clean to avoid names with double slashes
	if( texture.constructor === String )
		texture = LS.ResourcesManager.cleanFullpath( texture );

	//get current info
	var sampler = this.textures[ channel ];
	if(!sampler)
		this.textures[channel] = sampler = { 
			texture: texture, 
			uvs: 0, 
			wrap: 0, 
			minFilter: 0, 
			magFilter: 0,
			missing: "white"
		};
	else if(sampler.texture == texture && !sampler_options)
		return sampler;
	else
		sampler.texture = texture;

	if(sampler_options)
		for(var i in sampler_options)
			sampler[i] = sampler_options[i];
	sampler._must_update = true;

	if(texture.constructor === String && texture[0] != ":")
		LS.ResourcesManager.load( texture );

	return sampler;
}

/**
* Set a property of the sampling (wrap, uvs, filter)
* @method setTextureProperty
* @param {String} channel for a list of supported channels by this material call getTextureChannels()
* @param {String} property could be "uvs", "filter", "wrap"
* @param {*} value the value, for uvs check Material.TEXTURE_COORDINATES, filter is gl.NEAREST or gl.LINEAR and wrap gl.CLAMP_TO_EDGE, gl.MIRROR or gl.REPEAT
*/
Material.prototype.setTextureProperty = function( channel, property, value )
{
	var sampler = this.textures[channel];

	if(!sampler)
	{
		if(property == "texture")
			this.textures[channel] = sampler = { texture: value, uvs: 0, wrap: 0, minFilter: 0, magFilter: 0 };
		return;
	}

	sampler[ property ] = value;
}

/**
* Returns the texture in a channel
* @method getTexture
* @param {String} channel default is COLOR
* @return {Texture}
*/
Material.prototype.getTexture = function( channel ) {
	channel = channel || Material.COLOR_TEXTURE;

	var v = this.textures[channel];
	if(!v) 
		return null;

	if(v.constructor === String)
		return LS.ResourcesManager.textures[v];

	var tex = v.texture;
	if(!tex)
		return null;
	if(tex.constructor === String)
		return LS.ResourcesManager.textures[tex];
	else if(tex.constructor == Texture)
		return tex;
	return null;
}

/**
* Returns the texture sampler info of one texture channel (filter, wrap, uvs)
* @method getTextureSampler
* @param {String} channel get available channels using getTextureChannels
* @return {Texture}
*/
Material.prototype.getTextureSampler = function(channel) {
	return this.textures[ channel ];
}

Material.getTextureFromSampler = function(sampler)
{
	var texture = sampler.constructor === String ? sampler : sampler.texture;
	if(!texture) //weird case
		return null;

	//fetch
	if(texture.constructor === String)
		texture = LS.ResourcesManager.textures[ texture ];
	
	if (!texture || texture.constructor != GL.Texture)
		return null;
	return texture;
}

/**
* Assigns a texture sampler to one texture channel (filter, wrap, uvs)
* @method setTextureInfo
* @param {String} channel default is COLOR
* @param {Object} sampler { texture, uvs, wrap, filter }
*/
Material.prototype.setTextureSampler = function(channel, sampler) {
	if(!channel)
		throw("Cannot call Material setTextureSampler without channel");
	if(!sampler)
		delete this.textures[ channel ];
	else
		this.textures[ channel ] = sampler;
}

/**
* Collects all the resources needed by this material (textures)
* @method getResources
* @param {Object} resources object where all the resources are stored
* @return {Texture}
*/
Material.prototype.getResources = function (res)
{
	for(var i in this.textures)
	{
		var sampler = this.textures[i];
		if(!sampler) 
			continue;
		if(typeof(sampler.texture) == "string")
			res[ sampler.texture ] = GL.Texture;
	}
	return res;
}

/**
* Event used to inform if one resource has changed its name
* @method onResourceRenamed
* @param {Object} resources object where all the resources are stored
* @return {Boolean} true if something was modified
*/
Material.prototype.onResourceRenamed = function (old_name, new_name, resource)
{
	var v = false;
	for(var i in this.textures)
	{
		var sampler = this.textures[i];
		if(!sampler)
			continue;
		if(sampler.texture == old_name)
		{
			sampler.texture = new_name;
			v = true;

		}
	}
	return v;
}

/**
* Loads all the textures inside this material, by sending the through the ResourcesManager
* @method loadTextures
*/

Material.prototype.loadTextures = function ()
{
	var res = this.getResources({});
	for(var i in res)
		LS.ResourcesManager.load( i );
}

/**
* Register this material in a materials pool to be shared with other nodes
* @method registerMaterial
* @param {String} name name given to this material, it must be unique
*/
Material.prototype.registerMaterial = function(name)
{
	this.name = name;
	LS.ResourcesManager.registerResource(name, this);
	this.material = name;
}

Material.prototype.getCategory = function()
{
	return this.category || "Material";
}

Material.prototype.getLocator = function()
{
	if(this.filename)
		return LS.ResourcesManager.convertFilenameToLocator(this.fullpath || this.filename);

	if(this._root)
		return this._root.uid + "/material";
	return this.uid;
}

Material.prototype.assignToNode = function(node)
{
	if(!node)
		return false;
	var filename = this.fullpath || this.filename;
	node.material = filename ? filename : this;
	return true;
}

/**
* Creates a new property in this material class. Helps with some special cases
* like when we have a Float32Array property and we dont want it to be replaced by another array, but setted
* @method createProperty
* @param {String} name the property name as it should be accessed ( p.e.  "color" -> material.color )
* @param {*} value
* @param {String} type a valid value type ("Number","Boolean","Texture",...)
*/
Material.prototype.createProperty = function( name, value, type, options )
{
	if(type)
	{
		LS.validatePropertyType(type);
		this.constructor[ "@" + name ] = { type: type };
	}

	if(options)
	{
		if(!this.constructor[ "@" + name ])
			this.constructor[ "@" + name ] = {};
		LS.cloneObject( options, this.constructor[ "@" + name ] );
	}

	if(value == null)
		return;

	//basic type
	if(value.constructor === Number || value.constructor === String || value.constructor === Boolean)
	{
		this[ name ] = value;
		return;
	}

	//for vector type
	if(value.constructor === Float32Array )
	{
		var private_name = "_" + name;
		value = new Float32Array( value ); //clone
		this[ private_name ] = value; //this could be removed...

		Object.defineProperty( this, name, {
			get: function() { return value; },
			set: function(v) { value.set( v ); },
			enumerable: true,
			configurable: true
		});
	}
}

Material.prototype.prepare = function( scene )
{
	if(!this._uniforms)
	{
		this._uniforms = {};
		this._samplers = [];
	}

	if(this.onPrepare)
		this.onPrepare(scene);

	//this.fillShaderQuery( scene ); //update shader macros on this material
	this.fillUniforms( scene ); //update uniforms
}

Material.prototype.getShader = function( pass_name )
{
	var shader = Material._shader_color;
	if(!shader)
		shader = Material._shader_color = new GL.Shader( LS.Shaders.common_vscode + "void main(){ vec4 vertex = u_model * a_vertex;\ngl_Position = u_viewprojection * vertex;\n }", LS.Shaders.common_vscode + "uniform vec4 u_color;\n\void main(){ gl_FragColor = u_color;\n }");
	return shader;
}

//main function called to render an object
Material.prototype.renderInstance = function( instance, render_settings, pass )
{
	//some globals
	var renderer = LS.Renderer;
	var camera = LS.Renderer._current_camera;
	var scene = LS.Renderer._current_scene;
	var model = instance.matrix;

	//node matrix info
	var instance_final_query = instance._final_query;
	var instance_final_samplers = instance._final_samplers;
	var render_uniforms = LS.Renderer._render_uniforms;

	//maybe this two should be somewhere else
	render_uniforms.u_model = model; 
	render_uniforms.u_normal_model = instance.normal_matrix; 

	//global stuff
	this._render_state.enable();
	LS.Renderer.bindSamplers( this._samplers );
	var global_flags = 0;

	if(this.onRenderInstance)
		this.onRenderInstance( instance );

	//extract shader compiled
	var shader = shader_code.getShader( pass.name );
	if(!shader)
		return false;

	//assign
	shader.uniformsArray( [ scene._uniforms, camera._uniforms, render_uniforms, this._uniforms, instance.uniforms ] ); 

	//render
	instance.render( shader, this._primitive != -1 ? this._primitive : undefined );
	renderer._rendercalls += 1;

	return true;
}



/**
* ShaderMaterial allows to use your own shader from scratch
* @namespace LS
* @class ShaderMaterial
* @constructor
* @param {Object} object [optional] to configure from
*/
function ShaderMaterial( o )
{
	Material.call( this, null );

	this._shader = ""; //resource filename to a GL.ShaderCode
	this._shader_version = -1; //if the shader gets modified, the material should be modified too
	this._shader_flags = 0; //not used
	this._shader_code = null; //here the final code is stored (for debug)

	this._uniforms = {};	//uniforms to send to the shader
	this._samplers = [];	//textures to send to the shader
	this._properties = [];	//public properties to manipulate this material 
	this._properties_by_name = {};

	this._passes = {};		//the same ShaderCode is  used for different render passes (like color, shadowmap, picking), so here we cache the final GL.Shader for every type of pass
	this._light_mode = 0;	//info if this material should be rendered using lights: Material.NO_LIGHTS, Material.SEVERAL_LIGHTS 
	this._primitive = -1;	//which primitive to use when rendering this material
	this._allows_instancing = false;	//not supported yet

	this._version = -1;	

	this._last_valid_properties = null; //used to recover from a shader error

	if(o) 
		this.configure(o);
}

ShaderMaterial.description = "This material allows full control of the shader being used to render it.\nIt forces to code not only the surface properties but also the light equation.\nIt may be a little bit complex but it comes with examples.";

//assign a shader from a filename to a shadercode and reprocesses the code
Object.defineProperty( ShaderMaterial.prototype, "shader", {
	enumerable: true,
	get: function() {
		return this._shader;
	},
	set: function(v) {
		if(v)
			v = LS.ResourcesManager.cleanFullpath(v);
		if(this._shader == v)
			return;
		this._shader_code = null;
		this._shader = v;
		this.processShaderCode();
	}
});

//allows to assign a shader code that doesnt come from a resource (used from StandardMaterial)
Object.defineProperty( ShaderMaterial.prototype, "shader_code", {
	enumerable: false,
	get: function() {
		return this._shader_code;
	},
	set: function(v) {
		this._shader = null;
		this._shader_code = v;
		this.processShaderCode();
	}
});

Object.defineProperty( ShaderMaterial.prototype, "properties", {
	enumerable: true,
	get: function() {
		return this._properties;
	},
	set: function(v) {
		if(!v)
			return;
		this._properties = v;
		this._properties_by_name = {};
		for(var i in this._properties)
		{
			var p = this._properties[i];
			this._properties_by_name[ p.name ] = p;
		}
	}
});

Object.defineProperty( ShaderMaterial.prototype, "enableLights", {
	enumerable: true,
	get: function() {
		return this._light_mode != 0;
	},
	set: function(v) {
		this._light_mode = v ? 1 : 0;
	}
});

Object.defineProperty( ShaderMaterial.prototype, "version", {
	enumerable: false,
	get: function() {
		return this._version;
	},
	set: function(v) {
		console.error("version cannot be set manually");
	}
});

ShaderMaterial.prototype.addPass = function( name, vertex_shader, fragment_shader, macros )
{
	this._passes[ name ] = {
		vertex: vertex_shader,
		fragment: fragment_shader,
		macros: macros
	};
}

//called when preparing materials before rendering the scene
ShaderMaterial.prototype.prepare = function( scene )
{
	this.fillUniforms();

	if( this.onPrepare )
		this.onPrepare( scene );
}

//called when filling uniforms from this.prepare
ShaderMaterial.prototype.fillUniforms = function()
{
	//gather uniforms & samplers
	var samplers = this._samplers;
	samplers.length = 0;

	this._uniforms.u_material_color = this._color;

	for(var i = 0; i < this._properties.length; ++i)
	{
		var p = this._properties[i];
		if(p.internal) //internal is a property that is not for the shader (is for internal computations)
			continue;

		if(p.is_texture)
		{
			this._uniforms[ p.uniform ] = samplers.length;
			if(p.value)
				samplers.push( p.value );
			else
				samplers.push( " " ); //force missing texture
		}
		else
			this._uniforms[ p.uniform ] = p.value;
	}
}

//assigns a value to a property
ShaderMaterial.prototype.setProperty = function(name, value)
{
	//redirect to base material
	if( Material.prototype.setProperty.call(this,name,value) )
		return true;

	if(name == "shader")
		this.shader = value;
	else if(name == "properties")
	{
		this.properties.length = 0;
		this._properties_by_name = {};
		for(var i = 0; i < value.length; ++i)
		{
			var prop = value[i];
			if(prop.is_texture && prop.value && prop.value.constructor === String)
				prop.value = { texture: prop.value };
			this.properties[i] = prop;
			this._properties_by_name[ prop.name ] = prop;
			//if(prop.is_texture)
			//	this._samplers.push( prop.value );
		}
	}
	else if( this._properties_by_name[ name ] )
	{
		var prop = this._properties_by_name[ name ];
		if( !prop.value || prop.value.constructor === String || !prop.value.length )
			prop.value = value;
		else
			prop.value.set( value );
	}
	else
		return false;
	return true;
}

//check the ShaderCode associated and applies it to this material (keeping the state of the properties)
ShaderMaterial.prototype.processShaderCode = function()
{
	if(!this._shader_code && !this._shader)
	{
		this._properties.length = 0;
		this._properties_by_name = {};
		this._passes = {};
		this._samplers.length = 0;
		return false;
	}

	//get shader code
	var shader_code = this._shader_code;
	
	if( !shader_code && this._shader )
		shader_code = LS.ResourcesManager.getResource( this.shader );

	if( !shader_code || shader_code.constructor !== LS.ShaderCode )
		return false;

	var old_properties = this._properties_by_name;
	var old_state = this._render_state.serialize();
	if( shader_code._has_error ) //save them
		this._last_valid_properties = old_properties; 
	else if( this._last_valid_properties )
	{
		old_properties = this._last_valid_properties;
		this._last_valid_properties = null;
	}

	this._properties.length = 0;
	this._properties_by_name = {};
	this._passes = {};
	this._samplers.length = 0;
	this._light_mode = 0;
	this._primitive = -1;

	//reset material properties
	this._queue = LS.RenderQueue.GEOMETRY;
	this._render_state.init();

	//clear old functions
	for(var i in this)
	{
		if(!this.hasOwnProperty(i))
			continue;
		if( this[i] && this[i].constructor === Function )
			delete this[i];
	}

	this._render_state.configure(old_state);

	//apply init 
	if( shader_code._functions.init )
	{
		if(!LS.catch_exceptions)
			shader_code._functions.init.call( this );
		else
		{
			try
			{
				shader_code._functions.init.call( this );
			}
			catch (err)
			{
				LS.dispatchCodeError(err);
			}
		}
	}

	for(var i in shader_code._global_uniforms)
	{
		var global = shader_code._global_uniforms[i];
		if( global.disabled ) //in case this var is not found in the shader
			continue;
		this.createUniform( global.name, global.uniform, global.type, global.value, global.options );
	}

	//set version before asssignOldProperties
	this._shader_version = shader_code._version;
	this._version++;

	//restore old values
	this.assignOldProperties( old_properties );
}

//used after changing the code of the ShaderCode and wanting to reload the material keeping the old properties
ShaderMaterial.prototype.assignOldProperties = function( old_properties )
{
	//get shader code
	var shader = null;
	var shader_code = this.getShaderCode(); //no parameters because we just want the render_state and init stuff
	if( shader_code )
		shader = shader_code.getShader();

	for(var i = 0; i < this._properties.length; ++i)
	{
		var new_prop = this._properties[i];

		if(!old_properties[ new_prop.name ])
			continue;
		var old = old_properties[ new_prop.name ];
		if(old.value === undefined)
			continue;

		//validate (avoids error if we change the type of a uniform and try to reassign a value)
		if( !old.internal && shader && !new_prop.is_texture ) //textures are not validated (because they are samplers, not values)
		{
			var uniform_info = shader.uniformInfo[ new_prop.uniform ];
			if(!uniform_info)
				continue;
			if(new_prop.value !== undefined)
			{
				if( !GL.Shader.validateValue( new_prop.value, uniform_info ) )
				{
					new_prop.value = undefined;
					continue;
				}
			}
		}

		//this is to keep current values when coding the shader from the editor
		if( new_prop.value && new_prop.value.set ) //special case for typed arrays avoiding generating GC
		{
			//this is to be careful when an array changes sizes
			if( old.value && old.value.length && new_prop.value.length && old.value.length <= new_prop.value.length)
				new_prop.value.set( old.value );
			else
				new_prop.value = old.value;
		}
		else
			new_prop.value = old.value;
	}
}

ShaderMaterial.nolights_vec4 = new Float32Array([0,0,0,1]);
ShaderMaterial.missing_color = new Float32Array([1,0,1,1]);

//called from LS.Renderer when rendering an instance
ShaderMaterial.prototype.renderInstance = function( instance, render_settings, pass )
{
	//get shader code
	var shader_code = this.getShaderCode( instance, render_settings, pass );
	if(!shader_code || shader_code.constructor !== LS.ShaderCode )
	{
		//return true; //skip rendering
		shader_code = LS.ShaderCode.getDefaultCode( instance, render_settings, pass  ); //use default shader
		if( pass.id == COLOR_PASS.id) //to assign some random color
			this._uniforms.u_material_color = ShaderMaterial.missing_color;
	}

	//this is in case the shader has been modified in the editor (reapplies the shadercode to the material)
	if( shader_code._version !== this._shader_version && this.processShaderCode )
		this.processShaderCode();

	//some globals
	var renderer = LS.Renderer;
	var camera = LS.Renderer._current_camera;
	var scene = LS.Renderer._current_scene;
	var model = instance.matrix;
	var renderer_uniforms = LS.Renderer._uniforms;

	//maybe this two should be somewhere else
	renderer_uniforms.u_model = model; 
	renderer_uniforms.u_normal_model = instance.normal_matrix; 

	//compute flags: checks the ShaderBlocks attached to this instance and resolves the flags
	var block_flags = instance.computeShaderBlockFlags();
	var global_flags = LS.Renderer._global_shader_blocks_flags;

	//find environment texture
	if( pass == COLOR_PASS ) //allow reflections only in color pass
	{
		global_flags |= LS.ShaderMaterial.reflection_block.flag_mask;

		var environment_sampler = this.textures["environment"];
		var environment_texture = environment_sampler && environment_sampler.texture ? environment_sampler.texture : null;

		if( !environment_texture ) //use global
		{
			if( LS.Renderer._global_textures.environment )
				environment_texture = LS.Renderer._global_textures.environment;
			if( instance._nearest_reflection_probe )
			{
				if( instance._nearest_reflection_probe._texture )
					environment_texture = instance._nearest_reflection_probe._tex_id;
			}
		}

		if( environment_texture )
		{
			var tex = environment_texture.constructor === String ? LS.ResourcesManager.textures[ environment_texture ] : environment_texture;
			if( tex && tex.texture_type == GL.TEXTURE_2D )
			{
				if( tex._is_planar )
					global_flags |= environment_planar_block.flag_mask;
				else
					global_flags |= environment_2d_block.flag_mask;
			}
			else
				global_flags |= environment_cubemap_block.flag_mask;
		}

		this._samplers[ LS.Renderer.ENVIRONMENT_TEXTURE_SLOT ] = environment_texture;
	}
	else
	{
		this._samplers[ LS.Renderer.ENVIRONMENT_TEXTURE_SLOT ] = null;
	}

	//global stuff
	this._render_state.enable( render_settings );
	LS.Renderer.bindSamplers( this._samplers ); //material samplers
	LS.Renderer.bindSamplers( instance.samplers ); //RI samplers (like morph targets encoded in textures)

	//blocks for extra streams and instancing
	if( instance.vertex_buffers["colors"] )
		block_flags |= LS.Shaders.vertex_color_block.flag_mask;
	if( instance.vertex_buffers["coords1"] )
		block_flags |= LS.Shaders.coord1_block.flag_mask;
	if( instance.instanced_models && instance.instanced_models.length && gl.extensions.ANGLE_instanced_arrays ) //use instancing if supported
		block_flags |= LS.Shaders.instancing_block.flag_mask;

	//for those cases
	if(this.onRenderInstance)
		this.onRenderInstance( instance, pass );

	if( pass == SHADOW_PASS )
	{
		//global flags (like environment maps, irradiance, etc)
		block_flags |= LS.Shaders.firstpass_block.flag_mask;
		block_flags |= LS.Shaders.lastpass_block.flag_mask;
		//extract shader compiled
		var shader = shader_code.getShader( pass.name, block_flags ); //pass.name
		if(!shader)
			return false;

		//assign
		shader.uniformsArray( [ scene._uniforms, camera._uniforms, renderer_uniforms, this._uniforms, instance.uniforms ] ); //removed, why this was in?? light ? light._uniforms : null, 

		//render
		gl.disable( gl.BLEND );
		instance.render( shader, this._primitive != -1 ? this._primitive : undefined );
		renderer._rendercalls += 1;
	
		return true;
	}

	//add flags related to lights
	var lights = null;

	//ignore lights renders the object with flat illumination
	var ignore_lights = pass != COLOR_PASS || render_settings.lights_disabled || this._light_mode === Material.NO_LIGHTS;

	if( !ignore_lights )
		lights = LS.Renderer.getNearLights( instance );

	if(LS.Renderer._use_normalbuffer)
		block_flags |= LS.Shaders.normalbuffer_block.flag_mask;

	//if no lights are set or the render mode is flat
	if( !lights || lights.length == 0 || ignore_lights )
	{
		//global flags (like environment maps, irradiance, etc)
		if( !ignore_lights )
			block_flags |= global_flags;
		block_flags |= LS.Shaders.firstpass_block.flag_mask;
		block_flags |= LS.Shaders.lastpass_block.flag_mask;

		//extract shader compiled
		var shader = shader_code.getShader( null, block_flags ); //pass.name
		if(!shader)
		{
			//var shader = shader_code.getShader( "surface", block_flags );
			return false;
		}

		//assign
		shader.uniformsArray( [ scene._uniforms, camera._uniforms, renderer_uniforms, this._uniforms, instance.uniforms ] ); //removed, why this was in?? light ? light._uniforms : null, 

		shader.setUniform( "u_light_info", ShaderMaterial.nolights_vec4 );
		if( ignore_lights )
			shader.setUniform( "u_ambient_light", LS.ONES );

		//render
		instance.render( shader, this._primitive != -1 ? this._primitive : undefined );
		renderer._rendercalls += 1;
	
		return true;
	}

	var base_block_flags = block_flags;

	var uniforms_array = [ scene._uniforms, camera._uniforms, renderer_uniforms, null, this._uniforms, instance.uniforms ];

	//render multipass with several lights
	var prev_shader = null;
	for(var i = 0, l = lights.length; i < l; ++i)
	{
		var light = lights[i];
		block_flags = light.applyShaderBlockFlags( base_block_flags, pass, render_settings );

		//global
		block_flags |= global_flags;

		//shaders require to know in which pass they are (ambient is applied in the first, reflections in the last)
		if(i == 0)
			block_flags |= LS.Shaders.firstpass_block.flag_mask;
		if(i == l - 1)
			block_flags |= LS.Shaders.lastpass_block.flag_mask;

		//extract shader compiled
		var shader = shader_code.getShader( null, block_flags );
		if(!shader)
		{
			console.warn("material without pass: " + pass.name );
			continue;
		}

		//light texture like shadowmap and cookie
		LS.Renderer.bindSamplers( light._samplers );

		//light parameters (like index of pass or num passes)
		light._uniforms.u_light_info[2] = i; //num pass
		light._uniforms.u_light_info[3] = lights.length; //total passes
		uniforms_array[3] = light._uniforms;

		//assign
		if(prev_shader != shader)
			shader.uniformsArray( uniforms_array );
		else
			shader.uniforms( light._uniforms );
		prev_shader = shader;

		if(i == 1)
		{
			gl.depthMask( false );
			gl.depthFunc( gl.EQUAL );
			gl.enable( gl.BLEND );
			gl.blendFunc( gl.SRC_ALPHA, gl.ONE );
		}

		//render
		instance.render( shader, this._primitive != -1 ? this._primitive : undefined );
		renderer._rendercalls += 1;
	}

	//optimize this
	gl.disable( gl.BLEND );
	gl.depthMask( true );
	gl.depthFunc( gl.LESS );

	return true;
}

ShaderMaterial.prototype.renderPickingInstance = function( instance, render_settings, pass )
{
	//get shader code
	var shader_code = this.getShaderCode( instance, render_settings, pass );
	if(!shader_code || shader_code.constructor !== LS.ShaderCode )
		shader_code = LS.ShaderCode.getDefaultCode( instance, render_settings, pass  ); //use default shader


	//some globals
	var renderer = LS.Renderer;
	var camera = LS.Renderer._current_camera;
	var scene = LS.Renderer._current_scene;
	var model = instance.matrix;
	var node = instance.node;
	var renderer_uniforms = LS.Renderer._uniforms;

	//maybe this two should be somewhere else
	renderer_uniforms.u_model = model; 
	renderer_uniforms.u_normal_model = instance.normal_matrix; 

	//compute flags
	var block_flags = instance.computeShaderBlockFlags();

	//global stuff
	this._render_state.enable( render_settings );
	gl.disable( gl.BLEND ); //picking shouldnt use blending or colors will be wrong
	LS.Renderer.bindSamplers( this._samplers );
	LS.Renderer.bindSamplers( instance.samplers );

	//extract shader compiled
	var shader = shader_code.getShader( pass.name, block_flags );
	if(!shader)
	{
		shader_code = LS.ShaderMaterial.getDefaultPickingShaderCode();
		shader = shader_code.getShader( pass.name, block_flags );
		if(!shader)
			return false; //??!
	}

	//assign uniforms
	shader.uniformsArray( [ camera._uniforms, renderer_uniforms, this._uniforms, instance.uniforms ] );

	//set color
	var pick_color = LS.Picking.getNextPickingColor( instance.picking_node || node );
	shader.setUniform("u_material_color", pick_color );

	//render
	instance.render( shader, this._primitive != -1 ? this._primitive : undefined );
	renderer._rendercalls += 1;

	//optimize this
	gl.disable( gl.BLEND );
	gl.depthMask( true );
	gl.depthFunc( gl.LESS );

	return true;
}

//used by the editor to know which possible texture channels are available
ShaderMaterial.prototype.getTextureChannels = function()
{
	var channels = [];

	for(var i in this._properties)
	{
		var p = this._properties[i];
		if(p.is_texture)
			channels.push( p.name );
	}

	return channels;
}

/**
* Collects all the resources needed by this material (textures)
* @method getResources
* @param {Object} resources object where all the resources are stored
* @return {Texture}
*/
ShaderMaterial.prototype.getResources = function ( res )
{
	if(this.shader)
		res[ this.shader ] = LS.ShaderCode;

	var shadercode = LS.ResourcesManager.getResource( this._shader );
	if(shadercode)
		shadercode.getResources( res );

	for(var i in this._properties)
	{
		var p = this._properties[i];
		if(p.value && p.is_texture)
		{
			if(!p.value)
				continue;
			var name = null;
			if(p.value.texture)
				name = 	p.value.texture;
			else
				name = res[ p.value ];
			if(name && name.constructor === String)
				res[name] = GL.Texture;
		}
	}
	return res;
}


ShaderMaterial.prototype.getPropertyInfoFromPath = function( path )
{
	if( path.length < 1)
		return;

	var info = Material.prototype.getPropertyInfoFromPath.call(this,path);
	if(info)
		return info;

	var varname = path[0];

	var prop = this._properties_by_name[ varname ];
	if(!prop)
		return null;

	var type = prop.type;
	if(type == "float" || type == "int")
		type = "number";

	return {
		node: this._root,
		target: this,
		name: prop.name,
		value: prop.value,
		type: type
	};

	/*
	for(var i = 0, l = this.properties.length; i < l; ++i )
	{
		var prop = this.properties[i];
		if(prop.name != varname)
			continue;

		var type = prop.type;
		if(type == "float" || type == "int")
			type = "number";

		return {
			node: this._root,
			target: this,
			name: prop.name,
			value: prop.value,
			type: type
		};
	}
	return;
	*/
}

ShaderMaterial.prototype.setPropertyValue = function( name, value )
{
	//redirect to base material
	if( Material.prototype.setProperty.call(this,name,value) )
		return;

	var prop = this._properties_by_name[ name ];
	if(!prop)
		return null;

	if(prop.value && prop.value.set)
		prop.value.set( value );
	else
		prop.value = value;
}

//get shader code
ShaderMaterial.prototype.getShaderCode = function( instance, render_settings, pass )
{
	var shader_code = this._shader_code || LS.ResourcesManager.getResource( this._shader );
	if(!shader_code || shader_code.constructor !== LS.ShaderCode )
		return null;

	//this is in case the shader has been modified in the editor (reapplies the shadercode to the material)
	if( shader_code._version !== this._shader_version && this.processShaderCode )
	{
		shader_code._version = this._shader_version;
		this.processShaderCode();
	}

	return shader_code;
}

/**
* Takes an input texture and applies the ShaderMaterial, the result is shown on the viewport or stored in the output_texture
* The ShaderCode must contain a "fx" method.
* Similar to the method BlitTexture in Unity
* @method applyToTexture
* @param {Texture} input_texture
* @param {Texture} output_texture [optional] where to store the result, if omitted it will be shown in the viewport
*/
ShaderMaterial.prototype.applyToTexture = function( input_texture, output_texture )
{
	if( !this.shader || !input_texture )
		return false;

	//get shader code
	var shader_code = this.getShaderCode(); //special use
	if(!shader_code)
		return false;

	//extract shader compiled
	var shader = shader_code.getShader("fx");
	if(!shader)
		return false;

	//global vars
	this.fillUniforms();
	this._uniforms.u_time = LS.GlobalScene._time;
	this._uniforms.u_viewport = gl.viewport_data;

	//bind samplers
	LS.Renderer.bindSamplers( this._samplers );

	gl.disable( gl.DEPTH_TEST );
	gl.disable( gl.CULL_FACE );

	//render
	if(!output_texture)
		input_texture.toViewport( shader, this._uniforms );
	else
		output_texture.drawTo( function(){
			input_texture.toViewport( shader, this._uniforms );
		});
}

/**
* Makes one shader variable (uniform) public so it can be assigned from the engine (or edited from the editor)
* @method createUniform
* @param {String} name the property name as it should be shown
* @param {String} uniform the uniform name in the shader
* @param {String} type the var type in case we want to edit it (use LS.TYPES)
* @param {*} value
* @param {Object} options an object containing all the possible options (used mostly for widgets)
*/
ShaderMaterial.prototype.createUniform = function( name, uniform, type, value, options )
{
	if(!name || !uniform)
		throw("parameter missing in createUniform");

	//
	type = type || "Number";
	if( type.constructor !== String )
		throw("type must be string");

	//cast to typed-array
	value = value || 0;
	if(value && value.length)
		value = new Float32Array( value );//cast them always
	else
	{
		//create a value, otherwise is null
		switch (type)
		{
			case "vec2": value = vec2.create(); break;
			case "color":
			case "vec3": value = vec3.create(); break;
			case "color4":
			case "vec4": value = vec4.create(); break;
			case "mat3": value = mat3.create(); break;
			case "mat4": value = mat4.create(); break;
			default:
		}
	}

	//define info
	var prop = { name: name, uniform: uniform, value: value, type: type, is_texture: 0 };

	//mark as texture (because this need to go to the textures container so they are binded)
	if(type.toLowerCase() == "texture" || type == "sampler2D" || type == "samplerCube" || type == "sampler")
		prop.is_texture = (type == "samplerCube") ? 2 : 1;

	if(prop.is_texture)
	{
		prop.sampler = {};
		prop.type = "sampler";
		prop.sampler_slot = this._samplers.length;
		this._samplers.push( prop.sampler );
	}

	if(options)
		for(var i in options)
			prop[i] = options[i];

	this._properties.push( prop );
	this._properties_by_name[ name ] = prop;
}

/**
* Similar to createUniform but for textures, it helps specifying sampler options
* @method createSampler
* @param {String} name the property name as it should be shown
* @param {String} uniform the uniform name in the shader
* @param {Object} options an object containing all the possible options (used mostly for widgets)
* @param {String} value default value (texture name)
*/
ShaderMaterial.prototype.createSampler = function( name, uniform, sampler_options, value  )
{
	if(!name || !uniform)
		throw("parameter missing in createSampler");

	var type = "sampler";
	if( sampler_options && sampler_options.type )
		type = sampler_options.type;

	var sampler = null;

	//do not overwrite
	if( this._properties_by_name[ name ] )
	{
		var current_prop = this._properties_by_name[ name ];
		if( current_prop.type == type && current_prop.value )
			sampler = current_prop.value;
	}

	if(!sampler)
		sampler = {
			texture: value
		};

	var prop = { name: name, uniform: uniform, value: sampler, type: type, is_texture: 1, sampler_slot: -1 };

	if(sampler_options)
	{
		if(sampler_options.filter)
		{
			sampler.magFilter = sampler_options.filter;
			sampler.minFilter = sampler_options.filter;
			delete sampler_options.filter;
		}

		if(sampler_options.wrap)
		{
			sampler.wrapS = sampler_options.wrap;
			sampler.wrapT = sampler_options.wrap;
			delete sampler_options.wrap;
		}

		for(var i in sampler_options)
			sampler[i] = sampler_options[i];
	}
	prop.sampler_slot = this._samplers.length;
	this._properties.push( prop );
	this._properties_by_name[ name ] = prop;
	this._samplers.push( prop.value );
}

/**
* Creates a property for this material, this property wont be passed to the shader but can be used from source code.
* You must used this function if you want the data to be stored when serializing or changing the ShaderCode
* @method createProperty
* @param {String} name the property name as it should be shown
* @param {*} value the default value
* @param {String} type the data type (use LS.TYPES)
* @param {Object} options an object containing all the possible options (used mostly for widgets)
*/
ShaderMaterial.prototype.createProperty = function( name, value, type, options )
{
	var prop = this._properties_by_name[ name ];
	if(prop && prop.type == type) //already exist with the same type
		return;

	prop = { name: name, type: type, internal: true, value: value };
	if(options)
		for(var i in options)
			prop[i] = options[i];

	this._properties.push( prop );
	this._properties_by_name[ name ] = prop;

	Object.defineProperty( this, name, {
		get: function() { 
			var prop = this._properties_by_name[ name ]; //fetch it because could have been overwritten
			if(prop)
				return prop.value;
		},
		set: function(v) { 
			var prop = this._properties_by_name[ name ]; //fetch it because could have been overwritten
			if(!prop)
				return;
			if(prop.value && prop.value.set) //for typed arrays
				prop.value.set( v );
			else
				prop.value = v;
		},
		enumerable: false, //must not be serialized
		configurable: true //allows to overwrite this property
	});
}

/**
* returns the value of a property taking into account dynamic properties defined in the material
* @method getProperty
* @param {String} name the property name as it should be shown
* @param {*} value of the property
*/
ShaderMaterial.prototype.getProperty = function(name)
{
	var r = Material.prototype.getProperty.call( this, name );
	if(r != null)
		return;
	var p = this._properties_by_name[ name ];
	if (p)
		return p.value;
	return null;
}

/**
* Event used to inform if one resource has changed its name
* @method onResourceRenamed
* @param {Object} resources object where all the resources are stored
* @return {Boolean} true if something was modified
*/
ShaderMaterial.prototype.onResourceRenamed = function (old_name, new_name, resource)
{
	var v = Material.prototype.onResourceRenamed.call(this, old_name, new_name, resource );
	if( this.shader == old_name)
	{
		this.shader = new_name;
		v = true;
	}

	//change texture also in shader values... (this should be automatic but it is not)
	for(var i = 0; i < this._properties.length; ++i)
	{
		var p = this._properties[i];
		if(p.internal) //internal is a property that is not for the shader (is for internal computations)
			continue;

		if( !p.is_texture || !p.value )
			continue;
		if( p.value.texture != old_name )
			continue;
		p.value.texture = new_name;
		v = true;
	}

	return v;
}


ShaderMaterial.getDefaultPickingShaderCode = function()
{
	if( ShaderMaterial.default_picking_shader_code )
		return ShaderMaterial.default_picking_shader_code;
	var sc = new LS.ShaderCode();
	sc.code = LS.ShaderCode.flat_code;
	ShaderMaterial.default_picking_shader_code = sc;
	return sc;
}

//creates a material with flat color, used for debug stuff, shadowmaps, picking, etc
ShaderMaterial.createFlatMaterial = function()
{
	var material = new LS.ShaderMaterial();
	material.shader_code = LS.ShaderCode.getDefaultCode();
	return material;
}




//StandardMaterial class **************************
/* Warning: a material is not a component, because it can be shared by multiple nodes */

/**
* StandardMaterial class improves the material class
* @namespace LS
* @class StandardMaterial
* @constructor
* @param {Object} object [optional] to configure from
*/

function StandardMaterial(o)
{
	ShaderMaterial.call(this,null); //do not pass the data object, it is called later

	this.blend_mode = LS.Blend.NORMAL;

	this.createProperty( "diffuse", new Float32Array([1.0,1.0,1.0]), "color" );
	this.createProperty( "ambient", new Float32Array([1.0,1.0,1.0]), "color" );
	this.createProperty( "emissive", new Float32Array([0,0,0,0]), "color" ); //fourth component to control if emissive is affected by albedo

	this._specular_data = vec4.fromValues( 0.1, 10.0, 0.0, 0.0 ); //specular factor, glossiness, specular_on_top
	this.specular_on_top = false;
	this.specular_on_alpha = false;

	this.backlight_factor = 0;
	this.translucency = 0;

	this.reflection_factor = 0.0;
	this.reflection_fresnel = 1.0;
	this.reflection_specular = false;

	this.createProperty( "velvet", new Float32Array([0.5,0.5,0.5]), "color" );
	this.velvet_exp = 0.0;
	this.velvet_additive = false;
	this._velvet_info = vec4.create();

	this._detail = new Float32Array([0.0, 10, 10]);

	this.normalmap_factor = 1.0;
	this.normalmap_tangent = true;
	this.bumpmap_factor = 1.0;

	this.displacementmap_factor = 0.1;
	this._texture_settings = new Uint8Array(11);

	this.use_scene_ambient = true;
	this.point_size = 1.0;

	this.createProperty( "extra", new Float32Array([0,0,0,1]), "color" ); //used in special situations

	//used to change the render state
	this.flags = {
		alpha_test: false,
		alpha_test_shadows: false,
		two_sided: false,
		flip_normals: false,
		depth_test: true,
		depth_write: true,
		ignore_lights: false,
		cast_shadows: true,
		receive_shadows: true,
		ignore_frustum: false
	};

	//used for special fx 
	this._uniforms = {
		u_material_color: this._color,
		u_ambient_color: this._ambient,
		u_emissive_color: this._emissive,
		u_specular: this._specular_data,
		u_reflection_info: vec2.create(), //factor and fresnel
		u_velvet_info: vec4.create(),
		u_normal_info: vec2.create(),
		u_detail_info: this._detail,
		u_texture_matrix: this.uvs_matrix,
		u_extra_color: this._extra,
		u_texture_settings: this._texture_settings
	};

	this._samplers = [];

	this._allows_instancing = true;
	this.needsUpdate = true;

	if(o) 
		this.configure(o);
}


Object.defineProperty( StandardMaterial.prototype, 'detail_factor', {
	get: function() { return this._detail[0]; },
	set: function(v) { this._detail[0] = v; },
	enumerable: true
});

Object.defineProperty( StandardMaterial.prototype, 'detail_scale', {
	get: function() { return this._detail.subarray(1,3); },
	set: function(v) { this._detail[1] = v[0]; this._detail[2] = v[1]; },
	enumerable: true
});

Object.defineProperty( StandardMaterial.prototype, 'emissive_extra', {
	get: function() { return this._emissive[3]; },
	set: function(v) { this._emissive[3] = v; },
	enumerable: true
});

Object.defineProperty( StandardMaterial.prototype, 'specular_factor', {
	get: function() { return this._specular_data[0]; },
	set: function(v) { 
		if( v != null && v.constructor === Number)
			this._specular_data[0] = v;
	},
	enumerable: true
});

Object.defineProperty( StandardMaterial.prototype, 'specular_gloss', {
	get: function() { return this._specular_data[1]; },
	set: function(v) { this._specular_data[1] = v; },
	enumerable: true
});

StandardMaterial.description = "This material is a general use material that allows to control the most common properties.";

StandardMaterial["@blend_mode"] = { type: "enum", values: LS.Blend };
StandardMaterial.actions = {};

StandardMaterial.DETAIL_TEXTURE = "detail";
StandardMaterial.NORMAL_TEXTURE = "normal";
StandardMaterial.DISPLACEMENT_TEXTURE = "displacement";
StandardMaterial.BUMP_TEXTURE = "bump";
StandardMaterial.REFLECTIVITY_TEXTURE = "reflectivity";
StandardMaterial.EXTRA_TEXTURE = "extra";
StandardMaterial.IRRADIANCE_TEXTURE = "irradiance";

StandardMaterial.TEXTURES_INDEX = { "color":0, "opacity":1, "ambient":2, "specular":3, "emissive":4, "detail":5, "normal":6, "displacement":7, "bump":8, "reflectivity":9, "extra":10, "environment":11 };

StandardMaterial.prototype.renderInstance = ShaderMaterial.prototype.renderInstance;
StandardMaterial.prototype.renderShadowInstance = ShaderMaterial.prototype.renderShadowInstance;
StandardMaterial.prototype.renderPickingInstance = ShaderMaterial.prototype.renderPickingInstance;

//called from LS.Renderer.processVisibleData
StandardMaterial.prototype.prepare = function( scene )
{
	var flags = this.flags;

	var render_state = this._render_state;

	if(!this._texture_settings) //HACK to fix BUG
		this._texture_settings = this._uniforms.u_texture_settings = new Uint8Array(9);

	//set flags in render state
	render_state.cull_face = !flags.two_sided;
	render_state.front_face = flags.flip_normals ? GL.CW : GL.CCW;
	render_state.depth_test = flags.depth_test;
	render_state.depth_mask = flags.depth_write;

	render_state.blend = this.blend_mode != LS.Blend.NORMAL;
	if( this.blend_mode != LS.Blend.NORMAL )
	{
		var func = LS.BlendFunctions[ this.blend_mode ];
		if(func)
		{
			render_state.blendFunc0 = func[0];
			render_state.blendFunc1 = func[1];
		}
	}

	for(var i in this.textures)
	{
		var tex = this.textures[i];
		if(!tex)
			continue;
		if(tex.index == null)
			tex.index = StandardMaterial.TEXTURES_INDEX[i];
		this._texture_settings[ tex.index ] = tex.uvs;
	}

	this._light_mode = this.flags.ignore_lights ? Material.NO_LIGHTS : 1;

	this.fillUniforms( scene ); //update uniforms
}

//options vec4: channel, degamma, transform, contrast

StandardMaterial.FLAGS = {
	COLOR_TEXTURE: 1<<1,
	OPACITY_TEXTURE: 1<<2,
	SPECULAR_TEXTURE: 1<<3,
	REFLECTIVITY_TEXTURE: 1<<4,
	AMBIENT_TEXTURE: 1<<5,
	EMISSIVE_TEXTURE: 1<<6,
	DETAIL_TEXTURE: 1<<7,
	NORMAL_TEXTURE: 1<<8,
	DISPLACEMENT_TEXTURE: 1<<9,
	EXTRA_TEXTURE: 1<<10,
	ENVIRONMENT_TEXTURE: 1<<11,
	ENVIRONMENT_CUBEMAP: 1<<12,
	IRRADIANCE_CUBEMAP: 1<<13,

	DEGAMMA_COLOR: 1<<26,
	SPEC_ON_ALPHA: 1<<27,
	SPEC_ON_TOP: 1<<28,
	ALPHA_TEST: 1<<29
}; //max is 32	



StandardMaterial.shader_codes = {};

//returns the LS.ShaderCode required to render
//here we cannot filter by light pass because this is done before applying shaderblocks
//in the StandardMaterial we cache versions of the ShaderCode according to the settings
StandardMaterial.prototype.getShaderCode = function( instance, render_settings, pass )
{
	var FLAGS = StandardMaterial.FLAGS;

	//lets check which code flags are active according to the configuration of the shader
	var code_flags = 0;
	var scene = LS.Renderer._current_scene;

	//TEXTURES
	if( this.textures.color )
	{
		code_flags |= FLAGS.COLOR_TEXTURE;
		if( this.textures.color.degamma )
			code_flags |= FLAGS.DEGAMMA_COLOR;
	}
	if( this.textures.opacity )
		code_flags |= FLAGS.OPACITY_TEXTURE;
	if( this.textures.displacement )
		code_flags |= FLAGS.DISPLACEMENT_TEXTURE;
	if( this.textures.normal )
		code_flags |= FLAGS.NORMAL_TEXTURE;
	if( this.textures.specular )
		code_flags |= FLAGS.SPECULAR_TEXTURE;
	if( this.reflection_factor > 0 )
	{
		//code_flags |= FLAGS.REFLECTION;
		if( this.textures.reflectivity )
			code_flags |= FLAGS.REFLECTIVITY_TEXTURE;
	}
	if( this.textures.emissive )
		code_flags |= FLAGS.EMISSIVE_TEXTURE;
	if( this.textures.ambient )
		code_flags |= FLAGS.AMBIENT_TEXTURE;
	if( this.textures.detail )
		code_flags |= FLAGS.DETAIL_TEXTURE;
	if( this.textures.extra )
		code_flags |= FLAGS.EXTRA_TEXTURE;
	if( this.specular_on_alpha )
		code_flags |= FLAGS.SPEC_ON_ALPHA;
	if( this.specular_on_top )
		code_flags |= FLAGS.SPEC_ON_TOP;

	//flags
	if( this.flags.alpha_test )
		code_flags |= FLAGS.ALPHA_TEST;

	//check if we already have this ShaderCode created
	var shader_code = LS.StandardMaterial.shader_codes[ code_flags ];

	//reuse shader codes when possible **************************************
	if(shader_code)
		return shader_code;

	//generate code
	var code = {
		vs_local: "",
		vs_global: "",
		fs: "",
		fs_shadows: ""
	};

	if( code_flags & FLAGS.DISPLACEMENT_TEXTURE )
		code.vs_local += "	vertex4.xyz += v_normal * texture2D( displacement_texture, v_uvs ).x * u_displacementmap_factor;\n";	

	//uvs
	var uvs_common = "\n\
	uvs[0] = IN.uv;\n\
	uvs[1] = IN.uv1;\n\
	uvs[2] = (u_texture_matrix * vec3(uvs[0],1.0)).xy;\n\
	#ifdef COORD1_BLOCK\n\
		uvs[3] = (vec3(uvs[1],1.0) * u_texture_matrix).xy;\n\
	#else\n\
		uvs[3] = uvs[2];\n\
	#endif\n\
	uvs[4] = gl_PointCoord;\n\
	";

	code.fs += uvs_common;
	code.fs_shadows += uvs_common;

	if( code_flags & FLAGS.NORMAL_TEXTURE )
	{
		code.fs += "vec2 normal_uv = getUVs( u_texture_settings["+StandardMaterial.TEXTURES_INDEX["normal"]+"]);\n\
		vec3 normal_pixel = texture2D( normal_texture, normal_uv ).xyz;\n\
		if( u_normal_info.y > 0.0 )\n\
		{\n\
			normal_pixel.xy = vec2(1.0) - normal_pixel.xy;\n\
			normal_pixel = normalize( perturbNormal( IN.worldNormal, IN.viewDir, normal_uv, normal_pixel ));\n\
		}\n\
		else\n\
			normal_pixel = normal_pixel * 2.0 - vec3(1.0);\n\
		o.Normal = normalize( mix( o.Normal, normal_pixel, u_normal_info.x ) );\n";
	}

	if( code_flags & FLAGS.COLOR_TEXTURE )
	{
		var str = "	vec4 tex_color = texture2D( color_texture, getUVs( u_texture_settings["+StandardMaterial.TEXTURES_INDEX["color"]+"] ) );\n";
		code.fs += str;
		code.fs_shadows += str;

		if( code_flags & FLAGS.DEGAMMA_COLOR )
			code.fs += "	tex_color.xyz = pow( tex_color.xyz, vec3(2.0) );\n";
		str = "	o.Albedo *= tex_color.xyz;\n\
	o.Alpha *= tex_color.w;\n";
		code.fs += str;
		code.fs_shadows += str;
	}
	if( code_flags & FLAGS.OPACITY_TEXTURE )
	{
		var str =  "	o.Alpha *= texture2D( opacity_texture, getUVs( u_texture_settings["+StandardMaterial.TEXTURES_INDEX["opacity"]+"]) ).x;\n";
		code.fs += str;
		code.fs_shadows += str;
	}
	if( code_flags & FLAGS.SPECULAR_TEXTURE )
	{
		code.fs += "	vec4 spec_info = texture2D( specular_texture, getUVs( u_texture_settings["+StandardMaterial.TEXTURES_INDEX["specular"]+"]) );\n\
	o.Specular *= spec_info.x;\n\
	o.Gloss *= spec_info.y;\n";
	}
	if( code_flags & FLAGS.REFLECTIVITY_TEXTURE )
		code.fs += "	o.Reflectivity *= texture2D( reflectivity_texture, getUVs( u_texture_settings["+StandardMaterial.TEXTURES_INDEX["reflectivity"]+"]) ).x;\n";
	if( code_flags & FLAGS.EMISSIVE_TEXTURE )
		code.fs += "	o.Emission *= texture2D( emissive_texture, getUVs( u_texture_settings["+StandardMaterial.TEXTURES_INDEX["emissive"]+"]) ).xyz;\n";
	if( code_flags & FLAGS.AMBIENT_TEXTURE )
		code.fs += "	o.Ambient *= texture2D( ambient_texture, getUVs( u_texture_settings["+StandardMaterial.TEXTURES_INDEX["ambient"]+"]) ).xyz;\n";
	if( code_flags & FLAGS.DETAIL_TEXTURE )
		code.fs += "	o.Albedo += (texture2D( detail_texture, getUVs( u_texture_settings["+StandardMaterial.TEXTURES_INDEX["detail"]+"]) * u_detail_info.yz).xyz - vec3(0.5)) * u_detail_info.x;\n";
	if( code_flags & FLAGS.EXTRA_TEXTURE )
		code.fs += "	if(u_light_info.z == 0.0) o.Extra = u_extra_color * texture2D( extra_texture, getUVs( u_texture_settings["+StandardMaterial.TEXTURES_INDEX["extra"]+"] ) );\n";

	//flags
	if( code_flags & FLAGS.ALPHA_TEST )
	{
		var str = "	if(o.Alpha < 0.01) discard;\n";
		code.fs += str;
		code.fs_shadows += str;
	}

	if( code_flags & FLAGS.SPEC_ON_TOP )
		code.fs += "	#define SPEC_ON_TOP\n";

	if( code_flags & FLAGS.SPEC_ON_ALPHA )
		code.fs += "	#define SPEC_ON_ALPHA\n";

	//if( code_flags & FLAGS.FLAT_NORMALS )
	//	flat_normals += "";

	//compile shader and cache
	shader_code = new LS.ShaderCode();
	var final_code = StandardMaterial.code_template;

	if( StandardMaterial.onShaderCode )
		StandardMaterial.onShaderCode( code, this, code_flags );

	shader_code.code = ShaderCode.replaceCode( final_code, code );
	/*
	shader_code.code = final_code.replace(/\{\{[a-zA-Z0-9_]*\}\}/g, function(v){
		v = v.replace( /[\{\}]/g, "" );
		return code[v] || "";
	});
	*/

	LS.StandardMaterial.shader_codes[ code_flags ] = shader_code;
	return shader_code;
}

StandardMaterial.prototype.fillUniforms = function( scene, options )
{
	var uniforms = this._uniforms;

	uniforms.u_reflection_info[0] = this.reflection_factor;
	uniforms.u_reflection_info[1] = this.reflection_fresnel;
	uniforms.u_backlight_factor = this.backlight_factor;
	uniforms.u_translucency = this.translucency;
	uniforms.u_normal_info[0] = this.normalmap_factor;
	uniforms.u_normal_info[1] = this.normalmap_tangent ? 1 : 0;
	uniforms.u_displacementmap_factor = this.displacementmap_factor;
	uniforms.u_velvet_info.set( this._velvet );
	uniforms.u_velvet_info[3] = this.velvet_additive ? this.velvet_exp : -this.velvet_exp;
	uniforms.u_point_size = this.point_size;

	//iterate through textures in the material
	var last_texture_slot = 0;
	var samplers = this._samplers;
	samplers.length = 0; //clear
	for(var i in this.textures) 
	{
		var sampler = this.getTextureSampler(i);
		if(!sampler)
			continue;

		var texture = null;
		
		//hardcoded textures
		if(sampler.constructor === GL.Texture)
			texture = sampler;
		else
			texture = sampler.texture;

		if(!texture)
			continue;

		if(texture.constructor === String) //name of texture
			texture = LS.ResourcesManager.textures[texture];
		else if (texture.constructor != Texture)
			continue;		
		
		if(!texture)  //loading or non-existant
			sampler = { texture: ":missing" };

		var slot = last_texture_slot;
		if( i == "environment" )
			slot = LS.Renderer.ENVIRONMENT_TEXTURE_SLOT;
		else if( i == "irradiance" )
			slot = LS.Renderer.IRRADIANCE_TEXTURE_SLOT;
		else
			last_texture_slot++;

		samplers[ slot ] = sampler;
		//var uniform_name = i + ( (!texture || texture.texture_type == gl.TEXTURE_2D) ? "_texture" : "_cubemap");
		uniforms[ i + "_texture" ] = slot;
	}
}

StandardMaterial.prototype.getTextureChannels = function()
{
	return [ Material.COLOR_TEXTURE, Material.OPACITY_TEXTURE, Material.AMBIENT_TEXTURE, Material.SPECULAR_TEXTURE, Material.EMISSIVE_TEXTURE, StandardMaterial.DETAIL_TEXTURE, StandardMaterial.NORMAL_TEXTURE, StandardMaterial.DISPLACEMENT_TEXTURE, StandardMaterial.BUMP_TEXTURE, StandardMaterial.REFLECTIVITY_TEXTURE, StandardMaterial.EXTRA_TEXTURE, Material.ENVIRONMENT_TEXTURE, StandardMaterial.IRRADIANCE_TEXTURE ];
}

/**
* assign a value to a property in a safe way
* @method setProperty
* @param {Object} object to configure from
*/
StandardMaterial.prototype.setProperty = function(name, value)
{
	//redirect to base material
	if( Material.prototype.setProperty.call(this,name,value) )
		return true;

	//regular
	switch(name)
	{
		//objects
		case "render_state":
		//numbers
		case "specular_factor":
		case "specular_gloss":
		case "backlight_factor":
		case "translucency":
		case "reflection_factor":
		case "reflection_fresnel":
		case "velvet_exp":
		case "velvet_additive":
		case "normalmap_tangent":
		case "normalmap_factor":
		case "bumpmap_factor":
		case "displacementmap_factor":
		case "detail_factor":
		case "emissive_extra":
		case "point_size":
		//strings
		case "shader_name":
		//bools
		case "specular_on_top":
		case "specular_on_alpha":
		case "normalmap_tangent":
		case "reflection_specular":
		case "use_scene_ambient":
		case "blend_mode":
			if(value !== null)
				this[name] = value; 
			break;
		case "flags":
			if(value)
			{
				for(var i in value)
					this.flags[i] = value[i];
			}
			break;
		//vectors
		case "ambient":	
		case "emissive": 
		case "velvet":
		case "extra":
		case "detail_scale":
			if(this[name].length >= value.length)
				this[name].set(value);
			break;
		default:
			return false;
	}
	return true;
}

/**
* gets all the properties and its types
* @method getPropertiesInfo
* @return {Object} object with name:type
*/
StandardMaterial.prototype.getPropertiesInfo = function()
{
	//get from the regular material
	var o = Material.prototype.getPropertiesInfo.call(this);

	//add some more
	o.merge({
		shader_name:  LS.TYPES.STRING,

		blend_mode: LS.TYPES.NUMBER,
		specular_factor: LS.TYPES.NUMBER,
		specular_gloss: LS.TYPES.NUMBER,
		backlight_factor: LS.TYPES.NUMBER,
		translucency: LS.TYPES.NUMBER,
		reflection_factor: LS.TYPES.NUMBER,
		reflection_fresnel: LS.TYPES.NUMBER,
		velvet_exp: LS.TYPES.NUMBER,
		point_size: LS.TYPES.NUMBER,

		normalmap_factor: LS.TYPES.NUMBER,
		bumpmap_factor: LS.TYPES.NUMBER,
		displacementmap_factor: LS.TYPES.NUMBER,
		emissive_extra: LS.TYPES.NUMBER,

		ambient: LS.TYPES.VEC3,
		emissive: LS.TYPES.VEC3,
		velvet: LS.TYPES.VEC3,
		extra: LS.TYPES.VEC4,
		detail_factor: LS.TYPES.NUMBER,
		detail_scale: LS.TYPES.VEC2,

		specular_on_top: LS.TYPES.BOOLEAN,
		normalmap_tangent: LS.TYPES.BOOLEAN,
		reflection_specular: LS.TYPES.BOOLEAN,
		use_scene_ambient: LS.TYPES.BOOLEAN,
		velvet_additive: LS.TYPES.BOOLEAN
	});

	return o;
}

StandardMaterial.prototype.getPropertyInfoFromPath = function( path )
{
	if( path.length < 1)
		return;

	var info = Material.prototype.getPropertyInfoFromPath.call(this,path);
	if(info)
		return info;

	var varname = path[0];
	var type;

	switch(varname)
	{
		case "blend_mode":
		case "backlight_factor":
		case "translucency":
		case "reflection_factor":
		case "reflection_fresnel":
		case "velvet_exp":
		case "normalmap_factor":
		case "bumpmap_factor":
		case "displacementmap_factor":
		case "emissive_extra":
		case "detail_factor":
		case "point_size":
			type = LS.TYPES.NUMBER; break;
		case "extra":
			type = LS.TYPES.VEC4; break;
		case "ambient":
		case "emissive":
		case "velvet":
			type = LS.TYPES.VEC3; break;
		case "detail_scale":
			type = LS.TYPES.VEC2; break;
		case "specular_on_top":
		case "specular_on_alpha":
		case "normalmap_tangent":
		case "reflection_specular":
		case "use_scene_ambient":
		case "velvet_additive":
			type = LS.TYPES.BOOLEAN; break;
		default:
			return null;
	}

	return {
		node: this._root,
		target: this,
		name: varname,
		value: this[varname],
		type: type
	};
}

StandardMaterial.clearShadersCache = function()
{
	LS.log("StandardMaterial ShaderCode cache cleared");
	StandardMaterial.shader_codes = {};
}

LS.registerMaterialClass( StandardMaterial );
LS.StandardMaterial = StandardMaterial;

//legacy
LS.Classes["newStandardMaterial"] = StandardMaterial;
//LS.newStandardMaterial = StandardMaterial;
//LS.MaterialClasses.newStandardMaterial = StandardMaterial;

//**********************************************
var UVS_CODE = "\n\
uniform int u_texture_settings[11];\n\
\n\
vec2 uvs[5];\n\
vec2 getUVs(int index)\n\
{\n\
	if(index == 0)\n\
		return uvs[0];\n\
	if(index == 1)\n\
		return uvs[1];\n\
	if(index == 2)\n\
		return uvs[2];\n\
	if(index == 3)\n\
		return uvs[3];\n\
	if(index == 4)\n\
		return uvs[4];\n\
	return uvs[0];\n\
}\n\
";

StandardMaterial.code_template = "\n\
\n\
\n\
\\default.vs\n\
\n\
precision mediump float;\n\
//global defines from blocks\n\
#pragma shaderblock \"vertex_color\"\n\
#pragma shaderblock \"coord1\"\n\
#pragma shaderblock \"instancing\"\n\
\n\
attribute vec3 a_vertex;\n\
attribute vec3 a_normal;\n\
attribute vec2 a_coord;\n\
#ifdef BLOCK_COORD1\n\
	attribute vec2 a_coord1;\n\
	varying vec2 v_uvs1;\n\
#endif\n\
#ifdef BLOCK_VERTEX_COLOR\n\
	attribute vec4 a_color;\n\
	varying vec4 v_vertex_color;\n\
#endif\n\
#pragma event \"vs_attributes\"\n\
\n\
//varyings\n\
varying vec3 v_pos;\n\
varying vec3 v_normal;\n\
varying vec2 v_uvs;\n\
varying vec3 v_local_pos;\n\
varying vec3 v_local_normal;\n\
varying vec4 v_screenpos;\n\
\n\
//matrices\n\
#ifdef BLOCK_INSTANCING\n\
	attribute mat4 u_model;\n\
#else\n\
	uniform mat4 u_model;\n\
#endif\n\
uniform mat4 u_normal_model;\n\
uniform mat4 u_view;\n\
uniform mat4 u_viewprojection;\n\
//material\n\
uniform float u_displacementmap_factor;\n\
uniform sampler2D displacement_texture;\n\
\n\
//globals\n\
uniform float u_time;\n\
uniform vec4 u_viewport;\n\
uniform float u_point_size;\n\
\n\
#pragma shaderblock \"light\"\n\
#pragma shaderblock \"morphing\"\n\
#pragma shaderblock \"skinning\"\n\
\n\
//camera\n\
uniform vec3 u_camera_eye;\n\
uniform vec2 u_camera_planes;\n\
uniform vec3 u_camera_perspective;\n\
\n\
#pragma event \"vs_functions\"\n\
\n\
//special cases\n\
{{vs_out}}\n\
\n\
void main() {\n\
	\n\
	vec4 vertex4 = vec4(a_vertex,1.0);\n\
	v_local_pos = a_vertex;\n\
	v_local_normal = a_normal;\n\
	v_normal = a_normal;\n\
	v_uvs = a_coord;\n\
	#ifdef BLOCK_COORD1\n\
		v_uvs1 = a_coord1;\n\
	#endif\n\
	#ifdef BLOCK_VERTEX_COLOR\n\
		v_vertex_color = a_color;\n\
	#endif\n\
	\n\
	//local deforms\n\
	{{vs_local}}\n\
	applyMorphing( vertex4, v_normal );\n\
	applySkinning( vertex4, v_normal );\n\
	\n\
	//vertex\n\
	v_pos = (u_model * vertex4).xyz;\n\
	\n\
	applyLight(v_pos);\n\
	\n\
	//normal\n\
	#ifdef BLOCK_INSTANCING\n\
		v_normal = (u_model * vec4(v_normal,0.0)).xyz;\n\
	#else\n\
		v_normal = (u_normal_model * vec4(v_normal,0.0)).xyz;\n\
	#endif\n\
	//world deform\n\
	{{vs_global}}\n\
	\n\
	#pragma event \"vs_final_pass\"\n\
	\n\
	gl_Position = u_viewprojection * vec4(v_pos,1.0);\n\
	gl_PointSize = u_point_size;\n\
	v_screenpos = gl_Position;\n\
	#pragma event \"vs_final\"\n\
}\n\
\n\
\\color.fs\n\
\n\
#ifdef DRAW_BUFFERS\n\
	#extension GL_EXT_draw_buffers : require \n\
#endif\n\
\n\
precision mediump float;\n\
\n\
//global defines from blocks\n\
#pragma shaderblock \"vertex_color\"\n\
#pragma shaderblock \"coord1\"\n\
//#pragma shaderblock \"firstPass\"\n\
//#pragma shaderblock \"lastPass\"\n\
\n\
//varyings\n\
varying vec3 v_pos;\n\
varying vec3 v_normal;\n\
varying vec2 v_uvs;\n\
varying vec3 v_local_pos;\n\
varying vec3 v_local_normal;\n\
#ifdef BLOCK_COORD1\n\
	varying vec2 v_uvs1;\n\
#endif\n\
#ifdef BLOCK_VERTEX_COLOR\n\
	varying vec4 v_vertex_color;\n\
#endif\n\
varying vec4 v_screenpos;\n\
\n\
//globals\n\
uniform vec4 u_viewport;\n\
uniform mat4 u_view;\n\
uniform vec3 u_camera_eye;\n\
uniform vec4 u_clipping_plane;\n\
uniform vec4 u_background_color;\n\
uniform vec4 u_material_color;\n\
\n\
uniform vec3 u_ambient_color;\n\
uniform vec4 u_emissive_color;\n\
uniform vec4 u_specular;\n\
uniform vec2 u_reflection_info;\n\
uniform vec4 u_velvet_info;\n\
uniform vec2 u_normal_info;\n\
uniform vec3 u_detail_info;\n\
uniform mat3 u_texture_matrix;\n\
uniform vec4 u_extra_color;\n\
uniform float u_backlight_factor;\n\
uniform float u_translucency;\n\
\n\
uniform sampler2D color_texture;\n\
uniform sampler2D opacity_texture;\n\
uniform sampler2D specular_texture;\n\
uniform sampler2D ambient_texture;\n\
uniform sampler2D emissive_texture;\n\
uniform sampler2D reflectivity_texture;\n\
uniform sampler2D detail_texture;\n\
uniform sampler2D normal_texture;\n\
uniform sampler2D extra_texture;\n\
\n\
\n\
#pragma snippet \"input\"\n\
#pragma shaderblock \"light\"\n\
#pragma shaderblock \"light_texture\"\n\
#pragma shaderblock \"applyReflection\"\n\
#pragma shaderblock \"normalBuffer\"\n\
\n\
#pragma snippet \"perturbNormal\"\n\
\n\
#pragma shaderblock \"extraBuffers\"\n\
\n\
"+ UVS_CODE +"\n\
\n\
void surf(in Input IN, out SurfaceOutput o)\n\
{\n\
	o.Albedo = u_material_color.xyz;\n\
	o.Alpha = u_material_color.a;\n\
	#ifdef BLOCK_VERTEX_COLOR\n\
	o.Albedo *= IN.color.xyz;\n\
	o.Alpha *= IN.color.a;\n\
	#endif\n\
	o.Normal = normalize( v_normal );\n\
	o.Specular = u_specular.x;\n\
	o.Gloss = u_specular.y;\n\
	o.Ambient = u_ambient_color;\n\
	o.Emission = u_emissive_color.xyz;\n\
	o.Reflectivity = u_reflection_info.x;\n\
	o.Extra = u_extra_color;\n\
	\n\
	{{fs}}\n\
	\n\
	if(u_velvet_info.w > 0.0)\n\
		o.Albedo += u_velvet_info.xyz * ( 1.0 - pow( max(0.0, dot( IN.viewDir, o.Normal )), u_velvet_info.w ));\n\
	else if(u_velvet_info.w < 0.0)\n\
		o.Albedo = mix( o.Albedo, u_velvet_info.xyz, 1.0 - pow( max(0.0, dot( IN.viewDir, o.Normal )), abs(u_velvet_info.w) ) );\n\
	if(u_emissive_color.w > 0.0)\n\
		o.Emission *= o.Albedo;\n\
	o.Reflectivity *= max(0.0, pow( 1.0 - clamp(0.0, dot(IN.viewDir,o.Normal),1.0), u_reflection_info.y ));\n\
}\n\
\n\
#pragma event \"fs_functions\"\n\
#pragma snippet \"testClippingPlane\"\n\
\n\
{{fs_out}}\n\
\n\
void main() {\n\
	Input IN = getInput();\n\
	if(testClippingPlane(u_clipping_plane,IN.worldPos) < 0.0)\n\
		discard;\n\
	\n\
	IN.vertex = v_local_pos;\n\
	IN.normal = v_local_normal;\n\
	SurfaceOutput o = getSurfaceOutput();\n\
	#ifdef BLOCK_VERTEX_COLOR\n\
		IN.color = v_vertex_color;\n\
	#endif\n\
	#ifdef BLOCK_COORD1\n\
		IN.uv1 = v_uvs1;\n\
	#endif\n\
	surf(IN,o);\n\
	Light LIGHT = getLight();\n\
	applyLightTexture( IN, LIGHT );\n\
	if( !gl_FrontFacing )\n\
		o.Normal *= -1.0;\n\
	FinalLight FINALLIGHT = computeLight( o, IN, LIGHT );\n\
	FINALLIGHT.Diffuse += u_backlight_factor * max(0.0, dot(FINALLIGHT.Vector, -o.Normal));\n\
	FINALLIGHT.Diffuse = mix(FINALLIGHT.Diffuse,1.0, u_translucency);\n\
	vec4 final_color = vec4( 0.0,0.0,0.0, o.Alpha );\n\
	#ifdef SPEC_ON_ALPHA\n\
		final_color.a += FINALLIGHT.Specular;\n\
	#endif\n\
	#ifdef SPEC_ON_TOP\n\
		float specular = FINALLIGHT.Specular;\n\
		FINALLIGHT.Specular = 0.0;\n\
	#endif\n\
	final_color.xyz = applyLight( o, FINALLIGHT );\n\
	#ifdef SPEC_ON_TOP\n\
		final_color.xyz += specular * LIGHT.Color * FINALLIGHT.Shadow;\n\
	#endif\n\
	final_color = applyReflection( IN, o, final_color );\n\
	#pragma event \"fs_final_pass\"\n\
	{{fs_encode}}\n\
	#ifdef DRAW_BUFFERS\n\
	  gl_FragData[0] = final_color;\n\
	  #ifdef BLOCK_FIRSTPASS\n\
		  #ifdef BLOCK_NORMALBUFFER\n\
			  gl_FragData[1] = vec4( o.Normal * 0.5 + vec3(0.5), 1.0 );\n\
		  #else\n\
			  gl_FragData[1] = o.Extra;\n\
		  #endif\n\
	  #else\n\
		  gl_FragData[1] = vec4(0.0);\n\
	 #endif\n\
	#else\n\
	  gl_FragColor = final_color;\n\
	#endif\n\
	#pragma event \"fs_final\"\n\
}\n\
\n\
\\shadow.fs\n\
\n\
precision mediump float;\n\
\n\
//varyings\n\
varying vec3 v_pos;\n\
varying vec3 v_normal;\n\
varying vec2 v_uvs;\n\
varying vec4 v_screenpos;\n\
varying vec3 v_local_pos;\n\
varying vec3 v_local_normal;\n\
\n\
//globals\n\
uniform vec3 u_camera_eye;\n\
uniform vec2 u_camera_planes;\n\
uniform vec4 u_clipping_plane;\n\
uniform vec4 u_material_color;\n\
\n\
uniform mat3 u_texture_matrix;\n\
\n\
"+ UVS_CODE +"\n\
\n\
\n\
uniform sampler2D color_texture;\n\
uniform sampler2D opacity_texture;\n\
\n\
#pragma snippet \"input\"\n\
#pragma snippet \"surface\"\n\
#pragma snippet \"PackDepth32\"\n\
\n\
void surf(in Input IN, out SurfaceOutput o)\n\
{\n\
	o.Albedo = u_material_color.xyz;\n\
	o.Alpha = u_material_color.a;\n\
	\n\
	{{fs_shadows}}\n\
}\n\
\n\
{{fs_shadow_out}}\n\
\n\
void main() {\n\
	Input IN = getInput();\n\
	IN.vertex = v_local_pos;\n\
	IN.normal = v_local_normal;\n\
	SurfaceOutput o = getSurfaceOutput();\n\
	surf(IN,o);\n\
	//float depth = length( IN.worldPos - u_camera_eye );\n\
	//depth = linearDepth( depth, u_camera_planes.x, u_camera_planes.y );\n\
	float depth = (v_screenpos.z / v_screenpos.w) * 0.5 + 0.5;\n\
	//depth = linearDepthNormalized( depth, u_camera_planes.x, u_camera_planes.y );\n\
	vec4 final_color;\n\
	final_color = PackDepth32(depth);\n\
	{{fs_shadow_encode}}\n\
	gl_FragColor = final_color;\n\
}\n\
\\picking.fs\n\
	precision mediump float;\n\
	varying vec4 v_screenpos;\n\
	uniform vec2 u_camera_planes;\n\
	uniform vec4 u_material_color;\n\
	void main() {\n\
		float n = u_camera_planes.x;\n\
		float f = u_camera_planes.y;\n\
		float z = v_screenpos.z / v_screenpos.w * 0.5 + 0.5;\n\
		//float linear = n * (z + 1.0) / (f + n - z * (f - n));\n\
		gl_FragColor = vec4( u_material_color.xyz, gl_FragCoord.z );\n\
	}\n\
";


/* example to inject code in the standardMaterial without having to edit it
//hooks are vs_out (out of main), vs_local (vertex4 to deform vertices localy), vs_global (v_pos to deform final position), fs_out (out of main), fs_encode (final_color before being written)
this.onStart = function()
{
  LS.StandardMaterial.onShaderCode = function(code,mat)
  {
  	code.fs_encode = "final_color.x = final_color.y;";
  }
	LS.StandardMaterial.clearShadersCache();
}
*/
///@FILE:../src/materials/surfaceMaterial.js
function SurfaceMaterial( o )
{
	Material.call( this, null );

	this.shader_name = "surface";

	this.blend_mode = LS.Blend.NORMAL;
	this._light_mode = 1;

	this.flags = {
		alpha_test: false,
		alpha_test_shadows: false,
		two_sided: false,
		flip_normals: false,
		depth_test: true,
		depth_write: true,
		ignore_lights: false,
		cast_shadows: true,
		receive_shadows: true,
		ignore_frustum: false
	};

	this._code = "void surf(in Input IN, inout SurfaceOutput o) {\n\
	o.Albedo = vec3(1.0) * IN.color.xyz;\n\
	o.Normal = IN.worldNormal;\n\
	o.Emission = vec3(0.0);\n\
	o.Specular = 1.0;\n\
	o.Gloss = 40.0;\n\
	o.Reflectivity = max(0.0, 0.5 - dot(IN.viewDir,o.Normal));\n\
	o.Alpha = IN.color.a;\n}\n";

	this._uniforms = {};
	this._samplers = [];

	this._mustUpdate = false;

	this.properties = []; //array of configurable properties
	if(o) 
		this.configure(o);

	this.computeCode();
}

SurfaceMaterial.description = "This material allows to control the surface properties by coding your own shader in GLSL.\nYou dont have to worry about the complexities of the render engine and light equation, just the surface properties for every pixel.";
SurfaceMaterial.prototype.prepare = StandardMaterial.prototype.prepare;

SurfaceMaterial.icon = "mini-icon-material.png";

SurfaceMaterial.prototype.onCodeChange = function()
{
	this._mustUpdate = true;
	//this.computeCode();
}

Object.defineProperty( SurfaceMaterial.prototype, "code", {
	enumerable: true,
	get: function() {
		return this._code;
	},
	set: function(v) {
		this._code = String(v);
		this._mustUpdate = true;
	}
});

SurfaceMaterial.prototype.getCode = function()
{
	return this._code;
}

SurfaceMaterial.prototype.computeCode = function()
{
	var uniforms_code = "";
	for(var i = 0, l = this.properties.length; i < l; ++i )
	{
		var code = "uniform ";
		var prop = this.properties[i];
		switch(prop.type)
		{
			case 'number': code += "float "; break;
			case 'vec2': code += "vec2 "; break;
			case 'color':
			case 'vec3': code += "vec3 "; break;
			case 'color4':
			case 'vec4': code += "vec4 "; break;
			case 'sampler':
			case 'texture': code += "sampler2D "; break;
			case 'cubemap': code += "samplerCube "; break;
			default: 
				continue;
		}
		code += prop.name + ";\n";
		uniforms_code += code;
	}

	/*
	var lines = this._code.split("\n");
	for(var i = 0, l = lines.length; i < l; ++i )
		lines[i] = lines[i].split("//")[0]; //remove comments
	*/

	this.surf_code = uniforms_code + "\n" + this._code;

	var context = {
		fs_out: this.surf_code
	};

	var final_code = LS.ShaderCode.replaceCode( LS.SurfaceMaterial.code_template, context );
	//var final_code = LS.SurfaceMaterial.code_template.replace( /{{}}/gi, this.surf_code );

	if(!this._shadercode)
		this._shadercode = new LS.ShaderCode();
	this._shadercode.code = final_code;
	this._mustUpdate = false;
}

SurfaceMaterial.prototype.renderInstance = ShaderMaterial.prototype.renderInstance;

SurfaceMaterial.prototype.getShaderCode = function( instance, render_settings, pass )
{
	if(!this._shadercode || this._mustUpdate )
		this.computeCode();
	return this._shadercode;
}

SurfaceMaterial.prototype.fillUniforms = function( scene, options )
{
	var samplers = this._samplers;
	samplers.length = 0;

	var last_texture_slot = 0;
	for(var i = 0, l = this.properties.length; i < l; ++i )
	{
		var prop = this.properties[i];
		if(prop.type == "texture" || prop.type == "cubemap" || prop.type == "sampler")
		{
			var texture = prop.value;
			samplers[ last_texture_slot ] = texture;
			this._uniforms[ prop.name ] = last_texture_slot;
			last_texture_slot++;
		}
		else
			this._uniforms[ prop.name ] = prop.value;
	}

	this._uniforms.u_material_color = this._color;
}

SurfaceMaterial.prototype.configure = function(o) { 
	if(o.flags !== undefined && o.flags.constructor === Number)
		delete o["flags"]; //LEGACY
	Material.prototype.configure.call( this, o ); //it will call setProperty
	//LS.cloneObject( o, this );
	if(o.properties)
		this.properties = LS.cloneObject( o.properties );
	this.computeCode();
}

/**
* gets all the properties and its types
* @method getPropertiesInfo
* @return {Object} object with name:type
*/
SurfaceMaterial.prototype.getPropertiesInfo = function()
{
	var o = {
		color: LS.TYPES.VEC3,
		opacity: LS.TYPES.NUMBER,
		shader_name: LS.TYPES.STRING,
		blend_mode: LS.TYPES.NUMBER,
		code: LS.TYPES.STRING
	};

	//from this material
	for(var i in this.properties)
	{
		var prop = this.properties[i];
		o[prop.name] = prop.type;
	}	

	return o;
}

/**
* Event used to inform if one resource has changed its name
* @method onResourceRenamed
* @param {Object} resources object where all the resources are stored
* @return {Texture}
*/
SurfaceMaterial.prototype.onResourceRenamed = function (old_name, new_name, resource)
{
	//global
	Material.prototype.onResourceRenamed.call( this, old_name, new_name, resource );

	//specific
	for(var i = 0, l = this.properties.length; i < l; ++i )
	{
		var prop = this.properties[i];
		if( prop.value == old_name)
			prop.value = new_name;
	}
}


/**
* gets all the properties and its types
* @method getProperty
* @return {Object} object with name:type
*/
SurfaceMaterial.prototype.getProperty = function( name )
{
	if(this[name])
		return this[name];

	if( name.substr(0,4) == "tex_")
	{
		var tex = this.textures[ name.substr(4) ];
		if(!tex) return null;
		return tex.texture;
	}

	for(var i = 0, l = this.properties.length; i < l; ++i )
	{
		var prop = this.properties[i];
		if(prop.name == name)
			return prop.value;
	}	

	return null;
}

/**
* assign a value to a property in a safe way
* @method setProperty
* @param {Object} object to configure from
*/
SurfaceMaterial.prototype.setProperty = function(name, value)
{
	//redirect to base material
	if( Material.prototype.setProperty.call(this,name,value) )
		return true;

	if(name == "shader_name")
		this.shader_name = value;

	for(var i = 0, l = this.properties.length; i < l; ++i )
	{
		var prop = this.properties[i];
		if(prop.name != name)
			continue;
		prop.value = value;
		return true;
	}

	if( this[name] !== undefined)
		this[name] = value;
	else
		return false;
	return true;
}

/*
SurfaceMaterial.prototype.setPropertyValueFromPath = function( path, value, offset )
{
	offset = offset || 0;
	if( path.length < (offset+1) )
		return;
	return this.setProperty( path[offset], value );
}
*/

SurfaceMaterial.prototype.getPropertyInfoFromPath = function( path )
{
	if( path.length < 1)
		return;

	var info = Material.prototype.getPropertyInfoFromPath.call(this,path);
	if(info)
		return info;

	var varname = path[0];

	for(var i = 0, l = this.properties.length; i < l; ++i )
	{
		var prop = this.properties[i];
		if(prop.name != varname)
			continue;

		return {
			node: this._root,
			target: this,
			name: prop.name,
			value: prop.value,
			type: prop.type
		};
	}

	return;
}


SurfaceMaterial.prototype.getTextureChannels = function()
{
	var channels = [];

	for(var i = 0, l = this.properties.length; i < l; ++i )
	{
		var prop = this.properties[i];
		if(prop.type != "texture" && prop.type != "cubemap" && prop.type != "sampler" )
			continue;
		channels.push( prop.name );
	}

	return channels;
}

/**
* Assigns a texture to a channel
* @method setTexture
* @param {String} channel 
* @param {Texture} texture
*/
SurfaceMaterial.prototype.setTexture = function( channel, texture, sampler_options ) {
	if(!channel)
		throw("SurfaceMaterial.prototype.setTexture channel must be specified");

	var sampler = null;


	//special case
	if(channel == "environment")
		return Material.prototype.setTexture.call(this, channel, texture, sampler_options );

	for(var i = 0; i < this.properties.length; ++i)
	{
		var prop = this.properties[i];
		if(prop.type != "texture" && prop.type != "cubemap" && prop.type != "sampler")
			continue;

		if(channel && prop.name != channel) //assign to the channel or if there is no channel just to the first one
			continue;

		//assign sampler
		sampler = this.textures[ channel ];
		if(!sampler)
			sampler = this.textures[channel] = { texture: texture, uvs: "0", wrap: 0, minFilter: 0, magFilter: 0 }; //sampler

		if(sampler_options)
			for(var i in sampler_options)
				sampler[i] = sampler_options[i];

		prop.value = prop.type == "sampler" ? sampler : texture;
		break;
	}

	//preload texture
	if(texture && texture.constructor == String && texture[0] != ":")
		LS.ResourcesManager.load( texture );

	return sampler;
}

/**
* Collects all the resources needed by this material (textures)
* @method getResources
* @param {Object} resources object where all the resources are stored
* @return {Texture}
*/
SurfaceMaterial.prototype.getResources = function (res)
{
	for(var i = 0, l = this.properties.length; i < l; ++i )
	{
		var prop = this.properties[i];
		if(prop.type != "texture" && prop.type != "cubemap" && prop.type != "sampler")
			continue;
		if(!prop.value)
			continue;

		var texture = prop.type == "sampler" ? prop.value.texture : prop.value;
		if( typeof( texture ) == "string" )
			res[ texture ] = GL.Texture;
	}

	return res;
}

LS.registerMaterialClass( SurfaceMaterial );
LS.SurfaceMaterial = SurfaceMaterial;

SurfaceMaterial.code_template = "\n\
\n\
\n\
\\color.vs\n\
\n\
precision mediump float;\n\
attribute vec3 a_vertex;\n\
attribute vec3 a_normal;\n\
attribute vec2 a_coord;\n\
#pragma shaderblock \"vertex_color\"\n\
#pragma shaderblock \"coord1\"\n\
#ifdef BLOCK_COORD1\n\
	attribute vec2 a_coord1;\n\
	varying vec2 v_uvs1;\n\
#endif\n\
#ifdef BLOCK_VERTEX_COLOR\n\
	attribute vec4 a_color;\n\
	varying vec4 v_vertex_color;\n\
#endif\n\
\n\
//varyings\n\
varying vec3 v_pos;\n\
varying vec3 v_normal;\n\
varying vec2 v_uvs;\n\
varying vec3 v_local_pos;\n\
varying vec3 v_local_normal;\n\
\n\
//matrices\n\
uniform mat4 u_model;\n\
uniform mat4 u_normal_model;\n\
uniform mat4 u_view;\n\
uniform mat4 u_viewprojection;\n\
\n\
//globals\n\
uniform float u_time;\n\
uniform vec4 u_viewport;\n\
uniform float u_point_size;\n\
\n\
#pragma snippet \"input\"\n\
#pragma shaderblock \"light\"\n\
#pragma shaderblock \"morphing\"\n\
#pragma shaderblock \"skinning\"\n\
\n\
//camera\n\
uniform vec3 u_camera_eye;\n\
{{vs_out}}\n\
void main() {\n\
	\n\
	vec4 vertex4 = vec4(a_vertex,1.0);\n\
	v_local_pos = a_vertex;\n\
	v_local_normal = a_normal;\n\
	v_normal = a_normal;\n\
	v_uvs = a_coord;\n\
	#ifdef BLOCK_COORD1\n\
		v_uvs1 = a_coord1;\n\
	#endif\n\
	#ifdef BLOCK_VERTEX_COLOR\n\
		v_vertex_color = a_color;\n\
	#endif\n\
  \n\
  //deforms\n\
  {{vs_local}}\n\
  applyMorphing( vertex4, v_normal );\n\
  applySkinning( vertex4, v_normal );\n\
	\n\
	//vertex\n\
	v_pos = (u_model * vertex4).xyz;\n\
  \n\
  applyLight(v_pos);\n\
  \n\
	//normal\n\
	v_normal = (u_normal_model * vec4(v_normal,0.0)).xyz;\n\
    {{vs_global}}\n\
	gl_Position = u_viewprojection * vec4(v_pos,1.0);\n\
}\n\
\n\
\\color.fs\n\
\n\
precision mediump float;\n\
\n\
//varyings\n\
varying vec3 v_pos;\n\
varying vec3 v_normal;\n\
varying vec3 v_local_pos;\n\
varying vec3 v_local_normal;\n\
varying vec2 v_uvs;\n\
#pragma shaderblock \"vertex_color\"\n\
#pragma shaderblock \"coord1\"\n\
#ifdef BLOCK_COORD1\n\
	varying vec2 v_uvs1;\n\
#endif\n\
#ifdef BLOCK_VERTEX_COLOR\n\
	varying vec4 v_vertex_color;\n\
#endif\n\
\n\
//globals\n\
uniform vec3 u_camera_eye;\n\
uniform vec4 u_clipping_plane;\n\
uniform float u_time;\n\
uniform vec4 u_background_color;\n\
uniform vec4 u_material_color;\n\
\n\
#pragma snippet \"input\"\n\
#pragma shaderblock \"light\"\n\
#pragma shaderblock \"applyReflection\"\n\
\n\
#pragma snippet \"perturbNormal\"\n\
#pragma snippet \"testClippingPlane\"\n\
\n\
{{fs_out}}\n\
\n\
void main() {\n\
	Input IN = getInput();\n\
	if(testClippingPlane(u_clipping_plane,IN.worldPos) < 0.0)\n\
		discard;\n\
	\n\
	IN.vertex = v_local_pos;\n\
	IN.normal = v_local_normal;\n\
	#ifdef BLOCK_VERTEX_COLOR\n\
		IN.color = v_vertex_color;\n\
	#endif\n\
	#ifdef BLOCK_COORD1\n\
		IN.uv1 = v_uvs1;\n\
	#endif\n\
	SurfaceOutput o = getSurfaceOutput();\n\
	surf(IN,o);\n\
	vec4 final_color = vec4(0.0);\n\
	Light LIGHT = getLight();\n\
	FinalLight final_light = computeLight( o, IN, LIGHT );\n\
	final_color.xyz = applyLight( o, final_light );\n\
	final_color.a = o.Alpha;\n\
	if( o.Reflectivity > 0.0 )\n\
		final_color = applyReflection( IN, o, final_color );\n\
	\n\
	gl_FragColor = final_color;\n\
}\n\
\n\
\\shadow.vs\n\
\n\
precision mediump float;\n\
attribute vec3 a_vertex;\n\
attribute vec3 a_normal;\n\
attribute vec2 a_coord;\n\
#ifdef USE_COLORS\n\
attribute vec4 a_color;\n\
#endif\n\
\n\
//varyings\n\
varying vec3 v_pos;\n\
varying vec3 v_normal;\n\
varying vec3 v_local_pos;\n\
varying vec3 v_local_normal;\n\
varying vec2 v_uvs;\n\
\n\
//matrices\n\
uniform mat4 u_model;\n\
uniform mat4 u_normal_model;\n\
uniform mat4 u_view;\n\
uniform mat4 u_viewprojection;\n\
\n\
//globals\n\
uniform float u_time;\n\
uniform vec4 u_viewport;\n\
uniform float u_point_size;\n\
\n\
#pragma snippet \"input\"\n\
#pragma shaderblock \"light\"\n\
#pragma shaderblock \"morphing\"\n\
#pragma shaderblock \"skinning\"\n\
\n\
//camera\n\
uniform vec3 u_camera_eye;\n\
{{vs_out}}\n\
void main() {\n\
	\n\
	vec4 vertex4 = vec4(a_vertex,1.0);\n\
	v_local_pos = a_vertex;\n\
	v_local_normal = a_normal;\n\
	v_normal = a_normal;\n\
	v_uvs = a_coord;\n\
  \n\
  //deforms\n\
  {{vs_local}}\n\
  applyMorphing( vertex4, v_normal );\n\
  applySkinning( vertex4, v_normal );\n\
	\n\
	//vertex\n\
	v_pos = (u_model * vertex4).xyz;\n\
  \n\
  applyLight(v_pos);\n\
  \n\
	//normal\n\
	v_normal = (u_normal_model * vec4(v_normal,0.0)).xyz;\n\
    {{vs_global}}\n\
	gl_Position = u_viewprojection * vec4(v_pos,1.0);\n\
}\n\
\\shadow.fs\n\
\n\
precision mediump float;\n\
\n\
//varyings\n\
varying vec3 v_pos;\n\
varying vec3 v_normal;\n\
varying vec2 v_uvs;\n\
varying vec3 v_local_pos;\n\
varying vec3 v_local_normal;\n\
\n\
//globals\n\
uniform vec3 u_camera_eye;\n\
uniform vec4 u_clipping_plane;\n\
uniform vec4 u_material_color;\n\
\n\
uniform mat3 u_texture_matrix;\n\
\n\
#pragma snippet \"input\"\n\
#pragma snippet \"surface\"\n\
#pragma snippet \"perturbNormal\"\n\
#define SHADOWMAP\n\
\n\
{{fs_out}}\n\
\n\
void main() {\n\
	Input IN = getInput();\n\
	IN.vertex = v_local_pos;\n\
	IN.normal = v_local_normal;\n\
	SurfaceOutput o = getSurfaceOutput();\n\
	surf(IN,o);\n\
	gl_FragColor = vec4(o.Albedo,o.Alpha);\n\
}\n\
";