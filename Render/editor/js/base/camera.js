// ******* CAMERA **************************

/**
* Camera contains the info about a camera (matrices, near far planes, clear color, etc)
* @class Camera
* @namespace LS.Components
* @constructor
* @param {Object} object to configure from
*/

function Camera(o)
{
	this.enabled = true;
	this.layers = 3;

	this.clear_color = true;
	this.clear_depth = true;

	this._type = Camera.PERSPECTIVE;

	//contain the eye, center, up if local space
	this._eye = vec3.clone( Camera.DEFAULT_EYE ); //TODO: change to position
	this._center = vec3.clone( Camera.DEFAULT_CENTER );	//TODO: change to target
	this._up = vec3.clone( Camera.DEFAULT_UP );

	//in global coordinates
	this._global_eye = vec3.clone(this._eye);
	this._global_center = vec3.clone(this._center);
	this._global_up = vec3.clone(this._up);
	this._global_front = vec3.create();
	vec3.sub( this._global_front, this._global_center, this._global_eye );
	vec3.normalize( this._global_front, this._global_front );

	//clipping planes
	this._near = 0.1;
	this._far = 1000;

	//orthographics planes (near and far took from ._near and ._far)
	this._ortho = new Float32Array([-1,1,-1,1]);

	this._aspect = 1.0; //must be one, otherwise it gets deformed, the final one used is in final_aspect
	this._fov = 45; //persp
	this._frustum_size = 50; //ortho
	this._final_aspect = 1.0; //the one used when computing the projection matrix

	//viewport in normalized coordinates: left, bottom, width, height
	this._viewport = new Float32Array([0,0,1,1]);
	this._viewport_in_pixels = vec4.create(); //viewport in screen coordinates
	this._last_viewport_in_pixels = vec4.create(); //updated when the camera is enabled from Renderer.enableCamera

	this._background_color = vec4.fromValues(0,0,0,1);

	//in case we want to overwrite the view matrix manually
	this._use_custom_projection_matrix = false; 

	//in case we want to overwrite the shader of all visible objects
	this.overwrite_material = null;

	this._view_matrix = mat4.create();
	this._projection_matrix = mat4.create();
	this._viewprojection_matrix = mat4.create();
	this._model_matrix = mat4.create(); //inverse of viewmatrix (used for local vectors)
	this._previous_viewprojection_matrix = mat4.create(); //viewmatrix from previous frame, used in some algorithms

	//lazy upload
	this._must_update_view_matrix = true;
	this._must_update_projection_matrix = true;
	this._rendering_index = -1; //tells the number of this camera in the rendering process

	//used for render to texture
	this._frame = null;
	this.show_frame = true;

	if(o) 
		this.configure(o);
	//this.updateMatrices(); //done by configure

	this._uniforms = {
		u_view: this._view_matrix,
		u_viewprojection: this._viewprojection_matrix,
		u_camera_eye: this._global_eye,
		u_camera_front: this._global_front,
		u_camera_planes: vec2.fromValues( this.near, this.far ),
		u_camera_perspective: vec3.create(),
		u_background_color: this._background_color,
		u_previous_viewprojection: this._previous_viewprojection_matrix
	};

	this._frustum_planes = this.updateFrustumPlanes(); //to create
	this.updateMatrices();

	//LEvent.bind(this,"cameraEnabled", this.onCameraEnabled.bind(this));
}

Camera.icon = "mini-icon-camera.png";

Camera.main = null; //to store the main camera of the scene
Camera.current = null; //to store the current camera

Camera.PERSPECTIVE = 1;
Camera.ORTHOGRAPHIC = 2; //orthographic adapted to aspect ratio of viewport
Camera.ORTHO2D = 3; //orthographic with manually defined left,right,top,bottom

Camera.DEFAULT_EYE = [0,0,0];
Camera.DEFAULT_CENTER = [0,0,-100];
Camera.DEFAULT_UP = [0,1,0];

Camera["@type"] = { type: "enum", values: { "perspective": Camera.PERSPECTIVE, "orthographic": Camera.ORTHOGRAPHIC, "ortho2D": Camera.ORTHO2D } };
Camera["@eye"] = { type: "vec3", widget: "position" };
Camera["@center"] = { type: "vec3", widget: "position" };
Camera["@layers"] = { type: "layers" };

// used when rendering a cubemap to set the camera view direction (crossx and crossy are for when generating a CROSS cubemap image)

//OLD VERSION, it doesnt make sense but is the one that works perfectly
Camera.cubemap_camera_parameters = [
	{ name: "posx", dir: vec3.fromValues(1,0,0), up: vec3.fromValues(0,-1,0), crossx:2, crossy:1 },
	{ name: "negx", dir: vec3.fromValues(-1,0,0), up: vec3.fromValues(0,-1,0), crossx:0, crossy:1 },
	{ name: "posy", dir: vec3.fromValues(0,1,0), up: vec3.fromValues(0,0,1), crossx:1, crossy:0 },
	{ name: "negy", dir: vec3.fromValues(0,-1,0), up: vec3.fromValues(0,0,-1), crossx:1, crossy:2 },
	{ name: "posz", dir: vec3.fromValues(0,0,1), up: vec3.fromValues(0,-1,0), crossx:1, crossy:1 },
	{ name: "negz", dir: vec3.fromValues(0,0,-1), up: vec3.fromValues(0,-1,0), crossx:3, crossy:1 }
];
//*/
/*
Camera.cubemap_camera_parameters = [
	{ name: "posx", dir: vec3.fromValues(-1,0,0), up: vec3.fromValues(0,1,0), right: vec3.fromValues(0,0,-1), crossx:0, crossy:1 },
	{ name: "negx", dir: vec3.fromValues(1,0,0), up: vec3.fromValues(0,1,0), right: vec3.fromValues(0,0,1), crossx:2, crossy:1 },
	{ name: "posy", dir: vec3.fromValues(0,-1,0), up: vec3.fromValues(0,0,-1), right: vec3.fromValues(1,0,0), crossx:1, crossy:2 },
	{ name: "negy", dir: vec3.fromValues(0,1,0), up: vec3.fromValues(0,0,1), right: vec3.fromValues(-1,0,0), crossx:1, crossy:0 },
	{ name: "posz", dir: vec3.fromValues(0,0,-1), up: vec3.fromValues(0,1,0), right: vec3.fromValues(1,0,0), crossx:1, crossy:1 },
	{ name: "negz", dir: vec3.fromValues(0,0,1), up: vec3.fromValues(0,1,0), right: vec3.fromValues(-1,0,0), crossx:3, crossy:1 }
];

//*/

/*
Texture.cubemap_camera_parameters = [
	{ type:"posX", dir: vec3.fromValues(-1,0,0), 	up: vec3.fromValues(0,1,0),	right: vec3.fromValues(0,0,-1) },
	{ type:"negX", dir: vec3.fromValues(1,0,0),		up: vec3.fromValues(0,1,0),	right: vec3.fromValues(0,0,1) },
	{ type:"posY", dir: vec3.fromValues(0,-1,0), 	up: vec3.fromValues(0,0,-1), right: vec3.fromValues(1,0,0) },
	{ type:"negY", dir: vec3.fromValues(0,1,0),		up: vec3.fromValues(0,0,1),	right: vec3.fromValues(-1,0,0) },
	{ type:"posZ", dir: vec3.fromValues(0,0,-1), 	up: vec3.fromValues(0,1,0),	right: vec3.fromValues(1,0,0) },
	{ type:"negZ", dir: vec3.fromValues(0,0,1),		up: vec3.fromValues(0,1,0),	right: vec3.fromValues(-1,0,0) }
];
*/

Camera.prototype.onResourceRenamed = function( old_name, new_name )
{
	if(old_name == this.overwrite_material)
		this.overwrite_material = new_name;
}

Camera.prototype.getResources = function (res)
{
	if(this.overwrite_material && this.overwrite_material.constructor === String)
		res[ this.overwrite_material ] = true;
	return res;
}


/**
* Camera type, could be Camera.PERSPECTIVE or Camera.ORTHOGRAPHIC
* @property type {vec3}
* @default Camera.PERSPECTIVE;
*/
Object.defineProperty( Camera.prototype, "type", {
	get: function() {
		return this._type;
	},
	set: function(v) {
		if(	this._type != v)
		{
			this._must_update_view_matrix = true;
			this._must_update_projection_matrix = true;
		}
		this._type = v;
	},
	enumerable: true
});

/**
* The position of the camera (in local space, node space)
* @property eye {vec3}
* @default [0,100,100]
*/
Object.defineProperty( Camera.prototype, "eye", {
	get: function() {
		return this._eye;
	},
	set: function(v) {
		this._eye.set(v);
		this._must_update_view_matrix = true;
	},
	enumerable: true
});

/**
* The center where the camera points (in local space, node space)
* @property center {vec3}
* @default [0,0,0]
*/
Object.defineProperty( Camera.prototype, "center", {
	get: function() {
		return this._center;
	},
	set: function(v) {
		this._center.set(v);
		this._must_update_view_matrix = true;
	},
	enumerable: true
});

/**
* The distance between the center and the eye point
* When focalLength is modified it will change the center so it matches the distance.
* @property focalLength {Number}
* @default (depends)
*/
var tmp = vec3.create();

Object.defineProperty( Camera.prototype, "focalLength", {
	get: function() {
		return vec3.distance( this._eye, this._center );
	},
	set: function(v) {
		v = Math.max(0.001,v); //avoid 0
		vec3.sub( tmp, this._center, this._eye );
		var length = vec3.length(tmp);
		if(length < 0.0001)
			tmp.set([0,0,-1]);
		else
			v /= length;
		vec3.scaleAndAdd( tmp, this._eye, tmp, v );
		this._center.set( tmp );
		this._must_update_view_matrix = true;
	},
	enumerable: true
});


/**
* The up vector of the camera (in local space, node space)
* @property up {vec3}
* @default [0,1,0]
*/
Object.defineProperty( Camera.prototype, "up", {
	get: function() {
		return this._up;
	},
	set: function(v) {
		this._up.set(v);
		this._must_update_view_matrix = true;
	},
	enumerable: true
});

/**
* The near plane
* @property near {number}
* @default 1
*/
Object.defineProperty( Camera.prototype, "near", {
	get: function() {
		return this._near;
	},
	set: function(v) {
		if(	this._near != v)
			this._must_update_projection_matrix = true;
		this._near = v;
	},
	enumerable: true
});

/**
* The far plane
* @property far {number}
* @default 1000
*/
Object.defineProperty( Camera.prototype, "far", {
	get: function() {
		return this._far;
	},
	set: function(v) {
		if(	this._far != v)
			this._must_update_projection_matrix = true;
		this._far = v;
	},
	enumerable: true
});

/**
* The camera aspect ratio
* @property aspect {number}
* @default 1
*/
Object.defineProperty( Camera.prototype, "aspect", {
	get: function() {
		return this._aspect;
	},
	set: function(v) {
		if(	this._aspect != v)
			this._must_update_projection_matrix = true;
		this._aspect = v;
	},
	enumerable: true
});

//this is set by the renderer, it is the final aspect that will be used (taking into account viewport size)
Object.defineProperty( Camera.prototype, "final_aspect", {
	get: function() {
		return this._final_aspect;
	},
	set: function(v) {
		if(	this._final_aspect != v)
			this._must_update_projection_matrix = true;
		this._final_aspect = v;
	},
	enumerable: false
});

/**
* The field of view in degrees
* @property fov {number}
* @default 45
*/
Object.defineProperty( Camera.prototype, "fov", {
	get: function() {
		return this._fov;
	},
	set: function(v) {
		if(	this._fov != v)
			this._must_update_projection_matrix = true;
		this._fov  = v;
	},
	enumerable: true
});

/**
* The frustum size when working in ORTHOGRAPHIC
* @property frustum_size {number}
* @default 50
*/

Object.defineProperty( Camera.prototype, "frustum_size", {
	get: function() {
		return this._frustum_size;
	},
	set: function(v) {
		if(	this._frustum_size == v)
			return;

		//this._must_update_view_matrix = true;
		this._must_update_projection_matrix = true;
		this._frustum_size  = v;
	},
	enumerable: true
});

/**
* The frustum size when working in pure ORTHOGRAPHIC 
* left,right,bottom,top (near and far are in the near,far properties)
* @property orthographic {vec4} 
* @default 50
*/

Object.defineProperty( Camera.prototype, "orthographic", {
	get: function() {
		return this._ortho;
	},
	set: function(v) {
		if(	!v || v.length < 4)
			return;
		this._ortho.set(v);
		this._must_update_projection_matrix = true;
	},
	enumerable: true
});

/**
* The view matrix of the camera 
* @property view_matrix {vec4}
*/
Object.defineProperty( Camera.prototype, "view_matrix", {
	get: function() {
		return this._view_matrix;
	},
	set: function(v) {
		this.fromViewMatrix(v);
	},
	enumerable: true
});

/**
* The projection matrix of the camera (cannot be set manually, use setCustomProjectionMatrix instead)
* @property projection_matrix {mat4}
*/
Object.defineProperty( Camera.prototype, "projection_matrix", {
	get: function() {
		return this._projection_matrix;
	},
	set: function(v) {
		throw("projection matrix cannot be set manually, use setCustomProjectionMatrix instead.");
	},
	enumerable: true
});


/**
* The viewport in normalized coordinates (left,bottom, width, height)
* @property viewport {vec4}
*/
Object.defineProperty( Camera.prototype, "viewport", {
	get: function() {
		return this._viewport;
	},
	set: function(v) {
		this._viewport.set(v);
	},
	enumerable: true
});

/**
* @property viewport_offset {vec2}
*/
Object.defineProperty( Camera.prototype, "viewport_offset", {
	get: function() {
		return this._viewport.subarray(0,2);
	},
	set: function(v) {
		this._viewport.set(v);
	},
	enumerable: true
});

/**
* @property viewport_size {vec2}
*/
Object.defineProperty( Camera.prototype, "viewport_size", {
	get: function() {
		return this._viewport.subarray(2,4);
	},
	set: function(v) {
		this._viewport.set(v,2);
	},
	enumerable: true
});

/**
* the clear color
* @property background_color {vec4}
*/
Object.defineProperty( Camera.prototype, "background_color", {
	get: function() {
		return this._background_color;
	},
	set: function(v) {
		this._background_color.set(v);
	},
	enumerable: true
});

/**
* the clear alpha value
* @property background_alpha {Number}
*/
Object.defineProperty( Camera.prototype, "background_alpha", {
	get: function() {
		return this._background_color[3];
	},
	set: function(v) {
		this._background_color[3] = v;
	},
	enumerable: true
});

/**
* returns the texture from the render frame context
* @property render_to_texture {GL.Texture} 
*/

Object.defineProperty( Camera.prototype, "render_to_texture", {
	get: function() {
		return !!this._frame;
	},
	set: function(v) {
		if(!v)
		{
			this._frame = null;
			return;
		}
		if(!this._frame)
			this._frame = new LS.RenderFrameContext();
	},
	enumerable: true
});

/**
* contains the RenderFrameContext where the scene was stored
* @property frame {LS.RenderFrameContext} 
*/
Object.defineProperty( Camera.prototype, "frame", {
	set: function(v) {
		throw("frame cannot be assigned manually, enable render_to_texture");
	},
	get: function() {
		return this._frame;
	},
	enumerable: true //its ok, serialize is manual
});

/**
* contains the color texture used by the RenderFrameContext
* @property frame_color_texture {GL.Texture} 
*/
Object.defineProperty( Camera.prototype, "frame_color_texture", {
	set: function(v) {
		throw("frame_color_texture cannot be assigned manually, enable render_to_texture");
	},
	get: function(v) {
		if(!this._frame)
			return null;
		return this._frame.getColorTexture();
	},
	enumerable: true //its ok, serialize is manual
});

/**
* contains the depth texture used by the RenderFrameContext
* @property frame_depth_texture {GL.Texture} 
*/
Object.defineProperty( Camera.prototype, "frame_depth_texture", {
	set: function(v) {
		throw("frame_depth_texture cannot be assigned manually, enable render_to_texture");
	},
	get: function() {
		if(!this._frame)
			return null;
		return this._frame.getDepthTexture();
	},
	enumerable: true //its ok, serialize is manual
});


/**
* to force updating projection and view matrix
* @property mustUpdate {Boolean}
*/
Object.defineProperty( Camera.prototype, "mustUpdate", {
	get: function() {
		return this._must_update_projection_matrix || this._must_update_view_matrix;
	},
	set: function(v) {
		this._must_update_projection_matrix = this._must_update_view_matrix = v;
	},
	enumerable: true
});


Camera.prototype.onAddedToNode = function(node)
{
	if(!node.camera)
		node.camera = this;
	LEvent.bind( node, "transformChanged", this.onNodeMoved, this );
}

Camera.prototype.onRemovedFromNode = function(node)
{
	if(node.camera == this)
		delete node.camera;
	LEvent.unbind( node, "transformChanged", this.onNodeMoved, this );
}

Camera.prototype.onAddedToScene = function(scene)
{
	if(!LS.Camera.main)
		LS.Camera.main = this;
	LEvent.bind( scene, "collectCameras", this.onCollectCameras, this ); //here because we store them in node
}

Camera.prototype.onRemovedFromScene = function(scene)
{
	if(LS.Camera.main == this)
	{
		var cams = scene.root.findComponents("Camera");
		if(cams && cams.length)
			LS.Camera.main = cams[0];
	}

	LEvent.unbind( scene, "collectCameras", this.onCollectCameras, this );

	if(this._frame) //free memory
		this._frame.clear();

	if( this._binded_render_frame )
	{
		LEvent.unbind(this, "enableFrameContext", this.enableRenderFrameContext, this );
		LEvent.unbind(this, "showFrameContext", this.disableRenderFrameContext, this );
		this._binded_render_frame = false;
	}
}

Camera.prototype.onNodeMoved = function()
{
	this._must_update_view_matrix = true;
}

Camera.prototype.isRenderedToTexture = function()
{
	return this.enabled && this.render_to_texture;
}

Camera.prototype.onCollectCameras = function(e, cameras)
{
	if(!this.enabled)
		return;

	if(!this.isRenderedToTexture())
		cameras.push(this);
	else
		cameras.unshift(this); //put at the begining

	//in case we need to render to a texture this camera
	//not very fond of this part, but its more optimal
	if(this._frame)
	{
		if(!this._binded_render_frame)
		{
			LEvent.bind(this, "enableFrameContext", this.enableRenderFrameContext, this );
			LEvent.bind(this, "showFrameContext", this.disableRenderFrameContext, this );
			this._binded_render_frame = true;
		}
	}
	else if( this._binded_render_frame )
	{
		LEvent.unbind(this, "enableFrameContext", this.enableRenderFrameContext, this );
		LEvent.unbind(this, "showFrameContext", this.disableRenderFrameContext, this );
		this._binded_render_frame = false;
	}
}

/**
* Positions the camera at eye, pointing at center, and facing up as vertical.
* If the camera is a node camera, then the node transform is modified (plus the center to match the focalLength)
* @method lookAt
* @param {vec3} eye
* @param {vec3} center
* @param {vec3} up
*/
Camera.prototype.lookAt = function( eye, center, up )
{
	if( this._root && this._root.transform )
	{
		//transform from global to local
		if(this._root._parentNode && this._root._parentNode.transform )
		{
			eye = this._root._parentNode.transform.globalToLocal( eye, vec3.create() );
			center = this._root._parentNode.transform.globalToLocal( center, vec3.create() );
			up = this._root._parentNode.transform.globalVectorToLocal( up, vec3.create() );
		}
		this._root.transform.lookAt(eye,center,up);
		this._eye.set(LS.ZEROS);
		this._up.set([0,1,0]);
		this.focalLength = vec3.distance( eye, center ); //changes the center
	}
	else
	{
		vec3.copy(this._eye, eye);
		vec3.copy(this._center, center);
		vec3.copy(this._up,up);
	}
	this._must_update_view_matrix = true;
}

/**
* Positions the camera using a matrix that contains the position an orientation (NOT FULLY TESTED)
* If the camera is a node camera, then the node transform is modified (plus the center to match the focalLength)
* @method lookAtFromMatrix
* @param {mat4} matrix
* @param {boolean} is_model if false the matrix is assumed to be a view matrix, otherwise a model (inverse of view)
*/
Camera.prototype.lookAtFromMatrix = function( matrix, is_model )
{
	if( this._root && this._root.transform )
	{
		if(!is_model) //convert view to model
		{
			var m = mat4.create();
			matrix = mat4.invert(m, matrix);
		}
		this._root.transform.matrix = matrix;
		this._eye.set(LS.ZEROS);
		this._up.set([0,1,0]);
		this._must_update_view_matrix = true;
		this.focalLength = 1; //changes center
	}
	else
	{
		var inv = mat4.create();
		mat4.invert( inv, matrix );
		var view = is_model ? inv : matrix;
		var model = is_model ? matrix : inv;

		this._view_matrix.set( view );
		vec3.transformMat4( this._eye, LS.ZEROS, model );
		vec3.transformMat4( this._center, LS.FRONT, model );
		mat4.rotateVec3( this._up, model, LS.TOP );
	}
}

/**
* resets eye, center and up, so they are in [0,0,0],[0,0,-focalDist] and [0,1,0]
* @method resetVectors
* @param {number} focalDist [optional] it not set it will be 1
*/
Camera.prototype.resetVectors = function(focalDist)
{
	focalDist = focalDist || 1;
	this._eye.set([0,0,0]);
	this._center.set([0,0,-focalDist]);
	this._up.set([0,1,0]);
	this._must_update_view_matrix = true;
}

/**
* Update matrices according to the eye,center,up,fov,aspect,...
* @method updateMatrices
*/
Camera.prototype.updateMatrices = function( force )
{
	//if is a camera in a node we cannot assure the node hasnt change its transform (TODO feature)
	this._must_update_view_matrix = this._must_update_view_matrix || (this._root && !this._root._is_root);

	//nothing to update?
	if(!this._must_update_projection_matrix && !this._must_update_view_matrix && !force)
		return;

	//update projection
	if( (this._must_update_projection_matrix || force) && !this._use_custom_projection_matrix )
	{
		if(this.type == Camera.ORTHOGRAPHIC)
			mat4.ortho(this._projection_matrix, -this._frustum_size*this._final_aspect*0.5, this._frustum_size*this._final_aspect*0.5, -this._frustum_size*0.5, this._frustum_size*0.5, this._near, this._far);
		else if (this.type == Camera.ORTHO2D)
			mat4.ortho(this._projection_matrix, this._ortho[0], this._ortho[1], this._ortho[2], this._ortho[3], this._near, this._far);
		else
			mat4.perspective(this._projection_matrix, this._fov * DEG2RAD, this._final_aspect, this._near, this._far);
	}

	//update view (if is a camera in a node we cannot assure it hasnt change its transform)
	if( this._must_update_view_matrix || force )
	{
		if(this._root && this._root._is_root) //in root node
			mat4.lookAt( this._view_matrix, this._eye, this._center, this._up );
		else
			mat4.lookAt( this._view_matrix, this.getEye(this._global_eye), this.getCenter(this._global_center), this.getUp(this._global_up) );
		mat4.invert(this._model_matrix, this._view_matrix );
	}

	mat4.multiply(this._viewprojection_matrix, this._projection_matrix, this._view_matrix );
	this.updateFrustumPlanes();

	this._must_update_view_matrix = false;
	this._must_update_projection_matrix = false;
}

/**
* Update the frustum planes according to viewprojection_matrix, used for visibility testing
* @method updateFrustumPlanes
* @return {Float32Array} planes
*/
Camera.prototype.updateFrustumPlanes = function()
{
	if(!this._frustum_planes)
		this._frustum_planes = new Float32Array(24);
	geo.extractPlanes( this._viewprojection_matrix, this._frustum_planes );
	return this._frustum_planes;
}

/**
* returns the inverse of the viewmatrix
* @method getModelMatrix
* @param {mat4} m optional output container
* @return {mat4} matrix
*/
Camera.prototype.getModelMatrix = function(m)
{
	m = m || mat4.create();
	if(this._must_update_view_matrix)
		this.updateMatrices();
	return mat4.copy( m, this._model_matrix );
}

/**
* returns the viewmatrix
* @method getViewMatrix
* @param {mat4} m optional output container
* @return {mat4} matrix
*/
Camera.prototype.getViewMatrix = function(m)
{
	m = m || mat4.create();
	if(this._must_update_view_matrix)
		this.updateMatrices();
	return mat4.copy( m, this._view_matrix );
}

/**
* returns the projection matrix
* @method getProjectionMatrix
* @param {mat4} m optional output container
* @return {mat4} matrix
*/
Camera.prototype.getProjectionMatrix = function(m)
{
	m = m || mat4.create();
	if(this._must_update_projection_matrix)
		this.updateMatrices();
	return mat4.copy( m, this._projection_matrix );
}

/**
* returns the view projection matrix
* @method getViewProjectionMatrix
* @param {mat4} m optional output container
* @param {boolean} force optional force to update
* @return {mat4} matrix
*/
Camera.prototype.getViewProjectionMatrix = function(m, force)
{
	m = m || mat4.create();
	if(this._must_update_view_matrix || this._must_update_projection_matrix || force )
		this.updateMatrices();
	return mat4.copy( m, this._viewprojection_matrix );
}

/**
* returns the model view projection matrix computed from a passed model
* @method getModelViewProjectionMatrix
* @param {mat4} model model matrix
* @param {mat4} out optional output container
* @return {mat4} matrix
*/
Camera.prototype.getModelViewProjectionMatrix = function(model, out)
{
	out = out || mat4.create();
	if(this._must_update_view_matrix || this._must_update_projection_matrix)
		this.updateMatrices();
	return mat4.multiply( out, this._viewprojection_matrix, model );
}

/**
* apply a transform to all the vectors (eye,center,up) using a matrix
* @method updateVectors
* @param {mat4} model matrix
*/
Camera.prototype.updateVectors = function(model)
{
	var front = vec3.subtract(vec3.create(), this._center, this._eye);
	var dist = vec3.length(front);
	this._eye = mat4.multiplyVec3(vec3.create(), model, vec3.create() );
	this._center = mat4.multiplyVec3(vec3.create(), model, vec3.fromValues(0,0,-dist));
	this._up = mat4.rotateVec3(vec3.create(), model, vec3.fromValues(0,1,0));
	this.updateMatrices();
}

/**
* transform a local coordinate to global coordinates
* @method getLocalPoint
* @param {vec3} v vector
* @param {vec3} dest where to store the output, if not provided a vec3 is created
* @return {vec3} v in global coordinates
*/
Camera.prototype.getLocalPoint = function( v, dest )
{
	dest = dest || vec3.create();

	if( this._root && this._root.transform )
		return mat4.multiplyVec3( dest, this._root.transform.getGlobalMatrixRef(), v );

	if(this._must_update_view_matrix)
		this.updateMatrices();

	return mat4.multiplyVec3( dest, this._model_matrix, v );
}

/**
* rotate a local coordinate to global coordinates (skipping translation)
* @method getLocalVector
* @param {vec3} v vector
* @param {vec3} dest where to store the output, if not provided a vec3 is created
* @return {vec3} v in global coordinates
*/

Camera.prototype.getLocalVector = function(v, dest)
{
	dest = dest || vec3.create();

	if( this._root && this._root.transform )
		return mat4.rotateVec3( dest, this._root.transform.getGlobalMatrixRef(), v );

	if(this._must_update_view_matrix)
		this.updateMatrices();

	return mat4.rotateVec3( dest, this._model_matrix, v );
}

/**
* Returns the eye (position of the camera) in global coordinates
* Takes into account if it is a camera attached to a node
* The result of this function wont match the _eye property if the camera is a node camera
* @method getEye
* @param {vec3} out output vector [optional]
* @return {vec3} position in global coordinates
*/
Camera.prototype.getEye = function( out )
{
	out = out || vec3.create();
	out[0] = this._eye[0];
	out[1] = this._eye[1];
	out[2] = this._eye[2];
	if( this._root && this._root.transform )
		return this._root.transform.getGlobalPosition( out );
	return out;
}


/**
* returns the center of the camera (position where the camera is pointing) in global coordinates
* @method getCenter
* @param {vec3} out output vector [optional]
* @return {vec3} position in global coordinates
*/
Camera.prototype.getCenter = function( out )
{
	out = out || vec3.create();

	if( this._root && this._root.transform )
		return mat4.multiplyVec3( out, this._root.transform.getGlobalMatrixRef(), this._center );
	out[0] = this._center[0];
	out[1] = this._center[1];
	out[2] = this._center[2];
	return out;
}

/**
* returns the front vector of the camera
* @method getFront
* @param {vec3} out output vector [optional]
* @return {vec3} position in global coordinates
*/
Camera.prototype.getFront = function( out )
{
	out = out || vec3.create();

	if(this._root && this._root.transform)
	{
		out[0] = out[1] = 0; out[2] = -1;
		return mat4.rotateVec3(out, this._root.transform.getGlobalMatrixRef(), out );
	}

	vec3.sub( out, this._center, this._eye ); 
	return vec3.normalize(out, out);
}

/**
* returns the up vector of the camera
* @method getUp
* @param {vec3} out output vector [optional]
* @return {vec3} position in global coordinates
*/
Camera.prototype.getUp = function( out )
{
	out = out || vec3.create();
	out[0] = this._up[0];
	out[1] = this._up[1];
	out[2] = this._up[2];

	if(this._root && this._root.transform)
	{
		return mat4.rotateVec3( out, this._root.transform.getGlobalMatrixRef(), out );
	}
	return out;
}

/**
* returns the top vector of the camera (different from up, this one is perpendicular to front and right)
* @method getTop
* @param {vec3} out output vector [optional]
* @return {vec3} position in global coordinates
*/
Camera.prototype.getTop = function( out )
{
	out = out || vec3.create();
	var front = vec3.sub( vec3.create(), this._center, this._eye ); 
	var right = vec3.cross( vec3.create(), this._up, front );
	var top = vec3.cross( out, front, right );
	vec3.normalize(top,top);
	if(this._root && this._root.transform && this._root._parentNode)
		return mat4.rotateVec3( top, this._root.transform.getGlobalMatrixRef(), top );
	return top;
}

/**
* returns the right vector of the camera 
* @method getRight
* @param {vec3} out output vector [optional]
* @return {vec3} position in global coordinates
*/
Camera.prototype.getRight = function( out )
{
	out = out || vec3.create();
	var front = vec3.sub( vec3.create(), this._center, this._eye ); 
	var right = vec3.cross( out, this._up, front );
	vec3.normalize(right,right);
	if(this._root && this._root.transform && this._root._parentNode)
		return mat4.rotateVec3( right, this._root.transform.getGlobalMatrixRef(), right );
	return right;
}

//DEPRECATED: use property eye instead

Camera.prototype.setEye = function(v)
{
	this._eye.set( v );
	this._must_update_view_matrix = true;
}

Camera.prototype.setCenter = function(v)
{
	this._center.set( v );
	this._must_update_view_matrix = true;
}

/**
* set camera in perspective mode and sets the properties
* @method setPerspective
* @param {number} fov in degrees
* @param {number} aspect the aspect modifier (not the real final aspect, leave it to one)
* @param {number} near distance
* @param {number} far distance
*/
Camera.prototype.setPerspective = function( fov, aspect, near, far )
{
	this._fov = fov;
	this._aspect = aspect;
	this._near = near;
	this._far = far;
	this._type = Camera.PERSPECTIVE;
	this._must_update_projection_matrix = true;
}

/**
* set camera in orthographic mode and sets the planes
* @method setOrthographic
* @param {number} left
* @param {number} right
* @param {number} bottom
* @param {number} top
* @param {number} near
* @param {number} far
*/
Camera.prototype.setOrthographic = function( left, right, bottom,top, near, far )
{
	this._near = near;
	this._far = far;
	this._ortho.set([left,right,bottom,top]);
	this._type = Camera.ORTHO2D;
	this._must_update_projection_matrix = true;
}

/**
* moves the camera by adding the delta vector to center and eye
* @method move
* @param {vec3} delta
*/
Camera.prototype.move = function(v)
{
	if(this._root && this._root.transform)
	{
		this._root.transform.move(v);
		this._must_update_view_matrix = true;
		return;
	}

	vec3.add(this._center, this._center, v);
	vec3.add(this._eye, this._eye, v);
	this._must_update_view_matrix = true;
}

/**
* rotate the camera around its center
* @method rotate
* @param {number} angle_in_deg
* @param {vec3} axis
* @param {boolean} in_local_space allows to specify if the axis is in local space or global space
*/
Camera.prototype.rotate = (function() { 
	var tmp_quat = quat.create();
	var tmp_vec3 = vec3.create();
	
	return function( angle_in_deg, axis, in_local_space )
	{
		if(angle_in_deg == 0)
			return;

		if(this._root && this._root.transform)
		{
			this._root.transform.rotate( angle_in_deg, axis, !in_local_space );
			this._must_update_view_matrix = true;
			return;
		}

		if( in_local_space )
			this.getLocalVector( axis, tmp_vec3 );
		else
			tmp_vec3.set( axis );

		var R = quat.setAxisAngle( tmp_quat, tmp_vec3, angle_in_deg * 0.0174532925 );
		var front = vec3.subtract( tmp_vec3, this._center, this._eye );

		vec3.transformQuat( front, front, R );
		vec3.add(this._center, this._eye, front);
		this._must_update_view_matrix = true;
	};
})();

/**
* Rotates the camera eye around a center
* @method orbit
* @param {number} angle_in_deg
* @param {vec3} axis
* @param {vec3} center optional
*/
Camera.prototype.orbit = (function() { 
	var tmp_quat = quat.create();
	var tmp_vec3 = vec3.create();

	return function( angle_in_deg, axis, center )
	{
		angle_in_deg = angle_in_deg || 0;

		if(angle_in_deg == 0)
			return;

		if(!axis)
			throw("axis missing");

		if(this._root && this._root.transform)
		{
			this._root.transform.orbit( angle_in_deg, axis, center || this.getCenter() );
			this._must_update_view_matrix = true;
			return;
		}

		center = center || this._center;
		var R = quat.setAxisAngle( tmp_quat, axis, angle_in_deg * 0.0174532925 );
		var front = vec3.subtract( tmp_vec3, this._eye, center );
		vec3.transformQuat( front, front, R );
		vec3.add( this._eye, center, front );
		this._must_update_view_matrix = true;
	};
})();

//this is too similar to setDistanceToCenter, must be removed
Camera.prototype.orbitDistanceFactor = function(f, center)
{
	center = center || this._center;
	var front = vec3.subtract( vec3.create(), this._eye, center );
	vec3.scale(front, front, f);
	vec3.add(this._eye, center, front);
	this._must_update_view_matrix = true;
}

/**
* Pans the camera (move acording to view)
* @method panning
* @param {number} x
* @param {number} y
*/
Camera.prototype.panning = (function(x,y) { 
	var tmp_top = vec3.create();
	var tmp_right = vec3.create();
	var tmp = vec3.create();

	return function( x,y, factor )
	{
		factor = factor || 1;
		this.getLocalVector( LS.TOP, tmp_top );
		this.getLocalVector( LS.RIGHT, tmp_right );
		vec3.scaleAndAdd( tmp, LS.ZEROS, tmp_top, y * factor );
		vec3.scaleAndAdd( tmp, tmp, tmp_right, x * factor );
		this.move( tmp );
	};
})();


/**
* changes the distance between eye and center ( it could move the center or the eye, depending on the parameters )
* @method setDistanceToCenter
* @param {number} new_distance
* @param {boolean} move_eye if this is true it moves the eye closer, otherwise it moves the center closer to the eye
*/
Camera.prototype.setDistanceToCenter = function( new_distance, move_eye )
{
	if(this._root)
	{
		console.warn("cannot use setDistanceToCenter in a camera attached to a node");
		return;
	}

	var front = vec3.sub( vec3.create(), this._center, this._eye );
	var dist = vec3.length( front );
	if(move_eye)
		vec3.scaleAndAdd( this._eye, this._center, front, -new_distance / dist  );
	else
		vec3.scaleAndAdd( this._center, this._eye, front, new_distance / dist );
	this._must_update_view_matrix = true;
}

/**
* orients the camera (changes where is facing) according to the rotation supplied
* @method setOrientation
* @param {quat} q
*/
Camera.prototype.setOrientation = function(q, use_vr)
{
	var center = this.getCenter();
	var eye = this.getEye();
	var up = [0,1,0];

	var to_target = vec3.sub( vec3.create(), center, eye );
	var dist = vec3.length( to_target );

	var front = null;
	front = vec3.fromValues(0,0,-dist);

	if(use_vr)
	{
		vec3.rotateY( front, front, Math.PI * -0.5 );
		vec3.rotateY( up, up, Math.PI * -0.5 );
	}

	vec3.transformQuat(front, front, q);
	vec3.transformQuat(up, up, q);

	if(use_vr)
	{
		vec3.rotateY( front, front, Math.PI * 0.5 );
		vec3.rotateY( up, up, Math.PI * 0.5 );
	}

	this.center = vec3.add( vec3.create(), eye, front );
	this.up = up;

	this._must_update_view_matrix = true;
}

/**
* orients the camera (changes where is facing) using euler angles (yaw,pitch,roll)
* @method setEulerAngles
* @param {Number} yaw
* @param {Number} pitch
* @param {Number} roll
*/
Camera.prototype.setEulerAngles = function(yaw,pitch,roll)
{
	var q = quat.create();
	quat.fromEuler(q, [yaw, pitch, roll] );
	this.setOrientation(q);
}

/**
* uses a view matrix to compute the eye,center,up vectors
* @method fromViewMatrix
* @param {mat4} mat the given view matrix
*/
Camera.prototype.fromViewMatrix = function(mat)
{
	if( this._root && this._root.transform )
	{
		var model = mat4.invert( mat4.create(), mat );
		this._root.transform.fromMatrix( model, true );
		return;
	}

	var M = mat4.invert( mat4.create(), mat );
	this.eye = vec3.transformMat4( vec3.create(), LS.ZEROS, M );
	this.center = vec3.transformMat4( vec3.create(), LS.FRONT, M );
	this.up = mat4.rotateVec3( vec3.create(), M, LS.TOP );
	this._must_update_view_matrix = true;
}

/**
* overwrites the current projection matrix with a given one (it also blocks the camera from modifying the projection matrix)
* @method setCustomProjectionMatrix
* @param {mat4} mat the given projection matrix (or null to disable it)
*/
Camera.prototype.setCustomProjectionMatrix = function( mat )
{
	if(!mat)
	{
		this._use_custom_projection_matrix = false;
		this._must_update_projection_matrix = true;
	}
	else
	{
		this._use_custom_projection_matrix = true;
		this._projection_matrix.set( mat );
		this._must_update_projection_matrix = false;
		mat4.multiply( this._viewprojection_matrix, this._projection_matrix, this._view_matrix );
	}
}


/**
* Sets the viewport in pixels (using the gl.canvas as reference)
* @method setViewportInPixels
* @param {number} left
* @param {number} right
* @param {number} width
* @param {number} height
*/
Camera.prototype.setViewportInPixels = function(left,bottom,width,height)
{
	this._viewport[0] = left / gl.canvas.width;
	this._viewport[1] = bottom / gl.canvas.height;
	this._viewport[2] = width / gl.canvas.width;
	this._viewport[3] = height / gl.canvas.height;
}


/**
* Converts a 3D point to its 2D position in canvas space
* @method project
* @param {vec3} vec 3D position we want to proyect to 2D
* @param {vec4} [viewport=null] viewport info (if omited full canvas viewport is used)
* @param {vec3} result where to store the result, if omited it is created
* @return {vec3} the coordinates in 2D
*/

Camera.prototype.project = function( vec, viewport, result, skip_reverse )
{
	result = result || vec3.create();

	if(!vec)
		throw("camera project parameter 'vec' cannot be null");

	viewport = this.getLocalViewport(viewport);

	if( this._must_update_view_matrix || this._must_update_projection_matrix )
		this.updateMatrices();

	//from https://github.com/hughsk/from-3d-to-2d/blob/master/index.js
	var m = this._viewprojection_matrix;

	vec3.project( result, vec, this._viewprojection_matrix, viewport );
	if(!skip_reverse)
		result[1] = viewport[3] - result[1] + viewport[1]*2; //why 2? no idea, but it works :(
	return result;
}

/**
* It tells you the 2D position of a node center in the screen
* @method projectNodeCenter
* @param {vec3} vec 3D position we want to proyect to 2D
* @param {vec4} [viewport=null] viewport info (if omited full canvas viewport is used)
* @param {vec3} result where to store the result, if omited it is created
* @return {vec3} the coordinates in 2D
*/
Camera.prototype.projectNodeCenter = function( node, viewport, result, skip_reverse )
{
	var center = node.transform ? node.transform.getGlobalPosition() : LS.ZEROS;
	return this.project( center, viewport, result, skip_reverse );
}

/**
* Converts a screen space 2D vector (with a Z value) to its 3D equivalent position
* @method unproject
* @param {vec3} vec [screenx,screeny,normalized z] position we want to get in 3D
* @param {vec4} [viewport=null] viewport info (if omited full canvas viewport is used)
* @param {vec3} result where to store the result, if omited it is created
* @return {vec3} the coordinates in 3D
*/
Camera.prototype.unproject = function( vec, viewport, result )
{
	viewport = this.getLocalViewport(viewport);
	if( this._must_update_view_matrix || this._must_update_projection_matrix )
		this.updateMatrices();
	return vec3.unproject(result || vec3.create(), vec, this._viewprojection_matrix, viewport );
}

/**
* returns the viewport in pixels applying the local camera viewport to the full viewport of the canvas
* @method getLocalViewport
* @param {vec4} [viewport=null] viewport info, otherwise the canvas dimensions will be used (not the current viewport)
* @param {vec4} [result=vec4] where to store the result, if omited it is created
* @return {vec4} the viewport info of the camera in pixels
*/
Camera.prototype.getLocalViewport = function( viewport, result )
{
	result = result || vec4.create();

	//if no viewport specified, use the full canvas viewport as reference
	if(!viewport)
	{
		result[0] = gl.canvas.width * this._viewport[0]; //asume starts in 0
		result[1] = gl.canvas.height * this._viewport[1]; //asume starts in 0
		result[2] = gl.canvas.width * this._viewport[2];
		result[3] = gl.canvas.height * this._viewport[3];
		return result;
	}

	//apply viewport
	result[0] = Math.floor(viewport[2] * this._viewport[0] + viewport[0]);
	result[1] = Math.floor(viewport[3] * this._viewport[1] + viewport[1]);
	result[2] = Math.ceil(viewport[2] * this._viewport[2]);
	result[3] = Math.ceil(viewport[3] * this._viewport[3]);
	return result;
}

/**
* transform from mouse coordinates (0,0 is top-left on the canvas) to local camera viewport coordinates (0,0 is bottom-left corner of the camera viewport)
* @method mouseToViewport
* @param {vec2} pos in mouse coordinates
* @return {vec2} the pos in local camera viewport coordinates
*/
Camera.prototype.mouseToViewport = function(pos, out)
{
	out = out || vec2.create();
	var v = this._last_viewport_in_pixels;
	out[0] = pos[0] - v[0];
	out[1] = v[3] - (pos[1] - v[1]);
	return out;
}

/**
* given an x and y position, returns the ray {start, dir}
* @method getRay
* @param {number} x in canvas coordinates (bottom-left is 0,0)
* @param {number} y in canvas coordinates (bottom-left is 0,0)
* @param {vec4} viewport viewport coordinates (if omited full viewport is used using the camera viewport)
* @param {boolean} skip_local_viewport ignore the local camera viewport configuration when computing the viewport
* @param {LS.Ray} result [optional] to reuse ray
* @return {LS.Ray} {origin:vec3, direction:vec3} or null is values are undefined or NaN
*/
Camera.prototype.getRay = (function(){
	var tmp_pos = vec3.create();
	var tmp_eye = vec3.create();
	return function getRay( x, y, viewport, skip_local_viewport, result )
	{
		//apply camera viewport
		if(!skip_local_viewport)
			viewport = this.getLocalViewport( viewport, this._viewport_in_pixels );
		else
			viewport = gl.viewport_data;

		//flip Y
		//y = (viewport[3] - y) - viewport[1];

		if( this._must_update_view_matrix || this._must_update_projection_matrix )
			this.updateMatrices();
		tmp_pos[0] = x; tmp_pos[1] = y; tmp_pos[2] = 1;
		var pos = vec3.unproject( tmp_pos, tmp_pos, this._viewprojection_matrix, viewport );
		if(!pos)
			return null;

		var eye = null;
		if(this.type == Camera.ORTHOGRAPHIC)
		{
			tmp_eye[0] = x; tmp_eye[1] = y; tmp_eye[2] = 0;
			eye = vec3.unproject( tmp_eye, tmp_eye, this._viewprojection_matrix, viewport );
		}
		else
			eye = this.getEye( tmp_eye );

		var dir = vec3.subtract( pos, pos, eye );
		vec3.normalize(dir, dir);

		result = result || new LS.Ray();
		result.origin.set(eye);
		result.direction.set(dir);
		return result;
	}
})();

Camera.prototype.getRayInPixel = Camera.prototype.getRay; //LEGACY

/**
* Returns true if the 2D point (in screen space coordinates) is inside the camera viewport area
* @method isPoint2DInCameraViewport
* @param {number} x in canvas coordinates (0,0 is bottom-left)
* @param {number} y in canvas coordinates (0,0 is bottom-left)
* @param {vec4} viewport viewport coordinates (if omited full viewport is used)
* @return {boolean} 
*/
Camera.prototype.isPoint2DInCameraViewport = function( x, y, viewport )
{
	var v = this.getLocalViewport( viewport, this._viewport_in_pixels );
	if( x < v[0] || x > v[0] + v[2] ||
		y < v[1] || y > v[1] + v[3] )
		return false;
	return true;
}

/**
* Returns true if the 3D point is inside the camera frustum
* @method testSphereInsideFrustum
* @param {vec3} center
* @param {vec3} radius
* @return {boolean} 
*/
Camera.prototype.testSphereInsideFrustum = function( center, radius )
{
	return geo.frustumTestSphere( this._frustum_planes, center, radius || 0 ) != CLIP_OUTSIDE;
}


Camera.prototype.configure = function(o)
{
	if(o.uid !== undefined) this.uid = o.uid;
	if(o.layers !== undefined) this.layers = o.layers;

	if(o.enabled !== undefined) this.enabled = o.enabled;
	if(o.type !== undefined) this._type = o.type;

	if(o.eye !== undefined) this._eye.set(o.eye);
	if(o.center !== undefined) this._center.set(o.center);
	if(o.up !== undefined) this._up.set(o.up);

	if(o.near !== undefined) this._near = o.near;
	if(o.far !== undefined) this._far = o.far;
	if(o.fov !== undefined) this._fov = o.fov;
	if(o.aspect !== undefined) this._aspect = o.aspect;
	if(o.final_aspect !== undefined) this._final_aspect = o.final_aspect;
	if(o.frustum_size !== undefined) this._frustum_size = o.frustum_size;
	if(o.viewport !== undefined) this._viewport.set( o.viewport );
	if(o.orthographic !== undefined) this._ortho.set( o.orthographic );

	if(o.background_color !== undefined) this._background_color.set( o.background_color );

	if(o.render_to_texture !== undefined) this.render_to_texture = o.render_to_texture;
	if(o.frame && this._frame) this._frame.configure( o.frame );
	if(o.show_frame !== undefined) this.show_frame = o.show_frame;

	if(o.clear_color !== undefined) this.clear_color = !!o.clear_color;
	if(o.clear_depth !== undefined) this.clear_depth = !!o.clear_depth;

	this.updateMatrices( true );
}

Camera.prototype.serialize = function()
{
	var o = {
		object_class: "Camera",
		uid: this.uid,
		layers: this.layers,
		enabled: this.enabled,
		type: this._type,
		eye: vec3.toArray(this._eye),
		center: vec3.toArray(this._center),
		up: vec3.toArray(this._up),
		near: this._near,
		far: this._far,
		fov: this._fov,
		aspect: this._aspect,
		orthographic: vec4.toArray(this._ortho),
		background_color: vec4.toArray(this._background_color),
		frustum_size: this._frustum_size,
		viewport: toArray( this._viewport ),
		render_to_texture: this.render_to_texture,
		frame: this._frame ? this._frame.serialize() : null,
		show_frame: this.show_frame,
		clear_color: this.clear_color,
		clear_depth: this.clear_depth
	};

	//clone
	return o;
}

//Layer stuff
Camera.prototype.checkLayersVisibility = function( layers )
{
	return (this.layers & layers) !== 0;
}

Camera.prototype.getLayers = function()
{
	var r = [];
	for(var i = 0; i < 32; ++i)
	{
		if( this.layers & (1<<i) )
			r.push( this._root.scene.layer_names[i] || ("layer"+i) );
	}
	return r;
}

Camera.prototype.setLayer = function(num, value) 
{
	var f = 1<<num;
	this.layers = (this.layers & (~f));
	if(value)
		this.layers |= f;
}

Camera.prototype.isInLayer = function(num)
{
	return (this.layers & (1<<num)) !== 0;
}

//Mostly used for gizmos
Camera.prototype.getTransformMatrix = function( element )
{
	if( this._root && this._root.transform )
		return null; //use the node transform

	var p = null;
	if (element == "center")
		p = this._center;
	else
		p = this._eye;

	var T = mat4.create();
	mat4.setTranslation( T, p );
	return T;
}

Camera.prototype.applyTransformMatrix = function( matrix, center, element )
{
	if( this._root && this._root.transform )
		return false; //ignore transform

	var p = null;
	if (element == "center")
		p = this._center;
	else
		p = this._eye;
	mat4.multiplyVec3( p, matrix, p );
	this._must_update_view_matrix = true;
	return true;
}


//Rendering stuff ******************************************

//used when rendering to a texture
Camera.prototype.enableRenderFrameContext = function()
{
	if(!this._frame)
		return;
	this._frame.enable(null,null,this);
}

Camera.prototype.disableRenderFrameContext = function()
{
	if(!this._frame)
		return;
	this._frame.disable();
	if(this.show_frame)
		LS.Renderer.showRenderFrameContext( this._frame, this );
}

Camera.prototype.prepare = function()
{
	this._previous_viewprojection_matrix.set( this._viewprojection_matrix );
	this.updateMatrices(); 
	this.fillShaderUniforms();
}

Camera.prototype.fillShaderUniforms = function()
{
	var uniforms = this._uniforms;
	uniforms.u_camera_planes[0] = this.near;
	uniforms.u_camera_planes[1] = this.far;
	if(this.type == LS.Camera.PERSPECTIVE)
		uniforms.u_camera_perspective.set( [ this.fov * DEG2RAD, 512 / Math.tan( this.fov * DEG2RAD ) ] );
	else
		uniforms.u_camera_perspective.set( [ this._frustum_size, 512 / this._frustum_size ] );
	uniforms.u_camera_perspective[2] = this._projection_matrix[5]; //[1][1]

	this.getEye( uniforms.u_camera_eye );
	this.getFront( uniforms.u_camera_front );

	return uniforms;
}

/**
* Camera controller
* Allows to move a camera with the user input. It uses the first camera attached to the same node
* @class CameraController
* @constructor
* @param {String} object to configure from
*/

function CameraController(o)
{
	this.enabled = true;

	this.no_button_action = CameraController.NONE;
	this.left_button_action = CameraController.ORBIT;
	this.right_button_action = CameraController.PAN;
	this.middle_button_action = CameraController.PAN;
	//this.touch_button_action = CameraController.ORBIT;
	this.mouse_wheel_action = CameraController.CHANGE_DISTANCE;

	this.keyboard_walk = false;
	this.keyboard_walk_plane = false;
	this.lock_mouse = false;

	this.rot_speed = 1;
	this.walk_speed = 10;
	this.wheel_speed = 1;
	this.smooth = false;
	this.render_crosshair = false;

	this._moving = vec3.fromValues(0,0,0);

	this._collision_none = vec3.create();
	this._collision_left = vec3.create();
	this._collision_middle = vec3.create();
	this._collision_right = vec3.create();
	this._dragging = false; //true if the mousedown was caught so the drag belongs to this component
	this._camera = null;

	this.configure(o);
}

CameraController.NONE = 0; //no action

CameraController.ORBIT = 1; //orbits around the center
CameraController.ORBIT_HORIZONTAL = 2; //orbits around the center only around Y axis

CameraController.ROTATE = 5; //rotates relative to the camera
CameraController.ROTATE_HORIZONTAL = 6; //moves relative to the camera

CameraController.PAN = 10; //moves paralel to the near plane
CameraController.PAN_XZ = 11; //pans only in the XZ plane

CameraController.CHANGE_DISTANCE = 15; //scales the center from eye to center
CameraController.WALK = 16; //moves forward or backward
CameraController.ELEVATE = 17; //moves forward or backward
CameraController.FOV = 18; //changes zoom (FOV)


CameraController.icon = "mini-icon-cameracontroller.png";

CameraController.mode_values = { 
		"None": CameraController.NONE,
		"Orbit": CameraController.ORBIT,
		"Orbit Horizontal": CameraController.ORBIT_HORIZONTAL, 
		"Rotate": CameraController.ROTATE,
		"Rotate Horizontal": CameraController.ROTATE_HORIZONTAL, 
		"Pan": CameraController.PAN,
		"Pan XZ": CameraController.PAN_XZ,
		"Change Distance": CameraController.CHANGE_DISTANCE,
		"Walk": CameraController.WALK,
		"Elevate": CameraController.ELEVATE
	};

CameraController.wheel_values = { 
		"None": CameraController.NONE,
		"Change Distance": CameraController.CHANGE_DISTANCE,
		"FOV": CameraController.FOV,
		"Walk": CameraController.WALK,
		"Elevate": CameraController.ELEVATE
};

CameraController["@no_button_action"] = { type:"enum", values: CameraController.mode_values };
CameraController["@left_button_action"] = { type:"enum", values: CameraController.mode_values };
CameraController["@middle_button_action"] = { type:"enum", values: CameraController.mode_values };
CameraController["@right_button_action"] = { type:"enum", values: CameraController.mode_values };
CameraController["@mouse_wheel_action"] = { type:"enum", values: CameraController.wheel_values };

CameraController.prototype.onAddedToScene = function( scene )
{
	LEvent.bind( scene, LS.EVENT.START,this.onStart,this);
	LEvent.bind( scene, LS.EVENT.FINISH,this.onFinish,this);
	LEvent.bind( scene, LS.EVENT.MOUSEDOWN,this.onMouse,this);
	LEvent.bind( scene, LS.EVENT.MOUSEMOVE,this.onMouse,this);
	LEvent.bind( scene, LS.EVENT.MOUSEWHEEL,this.onMouse,this);
	LEvent.bind( scene, LS.EVENT.TOUCHSTART,this.onTouch,this);
	LEvent.bind( scene, LS.EVENT.TOUCHMOVE,this.onTouch,this);
	LEvent.bind( scene, LS.EVENT.TOUCHEND,this.onTouch,this);
	LEvent.bind( scene, LS.EVENT.KEYDOWN,this.onKey,this);
	LEvent.bind( scene, LS.EVENT.KEYUP,this.onKey,this);
	LEvent.bind( scene, LS.EVENT.UPDATE,this.onUpdate,this);
	LEvent.bind( scene, LS.EVENT.RENDERGUI,this.onRenderGUI,this);
}

CameraController.prototype.onRemovedFromScene = function( scene )
{
	LEvent.unbindAll( scene, this );
}

CameraController.prototype.onStart = function(e)
{
	if(this.lock_mouse)
	{
		LS.Input.lockMouse(true);
	}
}

CameraController.prototype.onFinish = function(e)
{
	if(this.lock_mouse)
	{
		LS.Input.lockMouse(false);
	}
}

CameraController.prototype.onUpdate = function(e)
{
	if(!this._root || !this.enabled) 
		return;

	//get first camera attached to this node
	var cam = this._root.camera;

	//no camera or disabled, then nothing to do
	if(!cam || !cam.enabled)
		return;

	//move using the delta vector
	if(this._moving[0] != 0 || this._moving[1] != 0 || this._moving[2] != 0)
	{
		var delta = cam.getLocalVector( this._moving );
		if( this.keyboard_walk_plane )
			delta[1] = 0;
		if(vec3.length(delta))
		{
			vec3.normalize( delta, delta );
			vec3.scale(delta, delta, this.walk_speed * (this._fast ? 10 : 1));

			if(this._root.transform) //attached to node
			{
				this._root.transform.translateGlobal(delta);
				cam.updateMatrices();
			}
			else
			{
				cam.move(delta);
				cam.updateMatrices();
			}
		}
	}

	if(this.smooth)
	{
		this._root.scene.requestFrame();
	}
}

CameraController.prototype.processMouseButtonDownEvent = function( mode, mouse_event, coll_point )
{
	var node = this._root;
	var cam = this._camera = node.camera;
	if(!cam || !cam.enabled)
		return;

	var is_global_camera = node._is_root;
	var changed = false;

	if(mode == CameraController.PAN)
		this.testPerpendicularPlane( mouse_event.canvasx, gl.canvas.height - mouse_event.canvasy, cam.getCenter(), coll_point );
	else if(mode == CameraController.PAN_XZ)
		this.testOriginPlane( mouse_event.canvasx, gl.canvas.height - mouse_event.canvasy, coll_point );

	return changed;
}

CameraController.prototype.processMouseButtonMoveEvent = function( mode, mouse_event, coll_point )
{
	var node = this._root;
	var cam = this._camera = node.camera;
	if(!cam || !cam.enabled)
		return;

	var is_global_camera = node._is_root;
	var changed = false;

	if(mode == CameraController.NONE)
		return false;

	if(mode == CameraController.ORBIT)
	{
		var yaw = mouse_event.deltax * this.rot_speed;
		var pitch = -mouse_event.deltay * this.rot_speed;
		var eye = cam.getEye();
		var center = cam.getCenter();
		var front = cam.getFront();
		var right = cam.getRight();
		var up = cam.getUp();

		//yaw rotation
		if( Math.abs(yaw) > 0.0001 )
		{
			if(is_global_camera)
			{
				cam.orbit( -yaw, [0,1,0] );
				cam.updateMatrices();
			}
			else
			{
				var v = vec3.create();
				vec3.sub( v, eye, center );
				vec3.rotateY(v,v,yaw*DEG2RAD);
				vec3.scale( front, v, -1 );
				vec3.normalize( front, front );
				vec3.add( eye,v,center );
			}
			changed = true;
		}

		//pitch rotation
		var problem_angle = vec3.dot( up, front );
		if( !(problem_angle > 0.99 && pitch > 0 || problem_angle < -0.99 && pitch < 0)) //avoid strange behaviours
		{
			if(is_global_camera)
			{
				cam.orbit( -pitch, right, this.orbit_center );
			}
			else
			{
				/*
				var eye = cam.getEye();
				var center = cam.getCenter();
				*/
				var v = vec3.create();
				vec3.sub( v, eye, center );
				var R = quat.create();
				quat.setAxisAngle(R,right,-pitch*DEG2RAD);
				vec3.transformQuat(v,v,R);
				vec3.add( eye,v,center );
				//var center = cam.getCenter();
				//node.transform.globalToLocal( center, center );
				//node.transform.orbit( -pitch, right, center );
			}
			changed = true;
		}

		if(changed)
		{
			if(!is_global_camera)
				node.transform.lookAt(eye,center,[0,1,0],true);
			cam.updateMatrices();
		}
	}
	else if(mode == CameraController.ORBIT_HORIZONTAL)
	{
		var yaw = mouse_event.deltax * this.rot_speed;

		if( Math.abs(yaw) > 0.0001 )
		{
			if(is_global_camera)
			{
				cam.orbit( -yaw, [0,1,0] );
				cam.updateMatrices();
			}
			else
			{
				var center = cam.getCenter();
				node.transform.globalToLocal( center, center );
				node.transform.orbit( -yaw, [0,1,0], center );
				cam.updateMatrices();
			}
			changed = true;
		}
	}
	else if(mode == CameraController.ROTATE || mode == CameraController.ROTATE_HORIZONTAL )
	{
		var top = LS.TOP; //cam.getLocalVector(LS.TOP);
		cam.rotate( -mouse_event.deltax * this.rot_speed * 0.2, top );
		cam.updateMatrices();

		if( mode == CameraController.ROTATE )
		{
			var right = cam.getLocalVector(LS.RIGHT);
			if(is_global_camera)
			{
				cam.rotate(-mouse_event.deltay * this.rot_speed * 0.2,right);
				cam.updateMatrices();
			}
			else
			{
				node.transform.rotate( -mouse_event.deltay * this.rot_speed * 0.2, LS.RIGHT );
				cam.updateMatrices();
			}
		}
		changed = true;
	}
	else if(mode == CameraController.PAN)
	{
		var collision = vec3.create();
		var center = vec3.create();
		var delta = vec3.create();

		cam.getCenter( center );
		this.testPerpendicularPlane( mouse_event.canvasx, gl.canvas.height - mouse_event.canvasy, center, collision );
		vec3.sub( delta, coll_point, collision );

		if(is_global_camera)
		{
			cam.move( delta );
			cam.updateMatrices();
		}
		else
		{
			node.transform.translateGlobal( delta );
			cam.updateMatrices();
		}

		changed = true;	
	}
	else if(mode == CameraController.PAN_XZ)
	{
		var collision = vec3.create();
		var delta = vec3.create();
		this.testOriginPlane( mouse_event.canvasx, gl.canvas.height - mouse_event.canvasy, collision );
		vec3.sub( delta, coll_point, collision );
		if(is_global_camera)
			cam.move( delta );
		else
			node.transform.translateGlobal( delta );
		cam.updateMatrices();

		changed = true;
	}
	else if(mode == CameraController.CHANGE_DISTANCE)
	{
		var factor = mouse_event.deltay * this.wheel_speed;
		cam.orbitDistanceFactor(1 + factor * -0.05 );
		cam.updateMatrices();
		changed = true;
	}
	else if(mode == CameraController.WALK)
	{
		var delta = cam.getLocalVector( [0,0, mouse_event.deltay * this.walk_speed] );
		cam.move(delta);
		cam.updateMatrices();
		changed = true;
	}
	else if(mode == CameraController.ELEVATE)
	{
		cam.move([0,mouse_event.deltay * this.walk_speed,0]);
		cam.updateMatrices();
		changed = true;
	}

	return changed;
}

//triggered on mouse move, or button clicked
CameraController.prototype.onMouse = function(e, mouse_event)
{
	if(!this._root || !this.enabled) 
		return;
	
	var node = this._root;
	var scene = node.scene;
	var cam = node.camera;
	if(!cam || !cam.enabled)
		return;

	var is_global_camera = node._is_root;

	if(!mouse_event)
		mouse_event = e;

	if(mouse_event.eventType == "mousewheel")
	{
		var wheel = mouse_event.wheel > 0 ? 1 : -1;

		switch( this.mouse_wheel_action )
		{
			case CameraController.CHANGE_DISTANCE: 
				cam.orbitDistanceFactor(1 + wheel * -0.05 * this.wheel_speed );
				cam.updateMatrices();
				break;
			case CameraController.FOV: 
				cam.fov = cam.fov - wheel;
				cam.updateMatrices();
				break;
		}

		node.scene.requestFrame();
		return;
	}

	var changed = false;

	if(mouse_event.eventType == "mousedown")
	{
		if(this.lock_mouse && !document.pointerLockElement && scene._state == LS.PLAYING)
			LS.Input.lockMouse(true);

		if( LS.Input.Mouse.isButtonPressed( GL.LEFT_MOUSE_BUTTON ) )
			changed |= this.processMouseButtonDownEvent( this.left_button_action, mouse_event, this._collision_left );
		if( LS.Input.Mouse.isButtonPressed( GL.MIDDLE_MOUSE_BUTTON ) )
			changed |= this.processMouseButtonDownEvent( this.middle_button_action, mouse_event, this._collision_middle );
		if( LS.Input.Mouse.isButtonPressed( GL.RIGHT_MOUSE_BUTTON ) )
			changed |= this.processMouseButtonDownEvent( this.right_button_action, mouse_event, this._collision_right );
		this._dragging = true;
	}

	if(!mouse_event.dragging)
		this._dragging = false;

	//mouse move
	if( ( mouse_event.eventType == "mousemove" || mouse_event.eventType == "touchmove" ) && (this.lock_mouse && ( document.pointerLockElement || mouse_event.is_touch )) )
		changed |= this.processMouseButtonMoveEvent( this.no_button_action, mouse_event, this._collision_none  );

	//regular mouse dragging
	if( mouse_event.eventType == "mousemove" && mouse_event.dragging && this._dragging )
	{
		if( LS.Input.Mouse.isButtonPressed( GL.LEFT_MOUSE_BUTTON ) )
			changed |= this.processMouseButtonMoveEvent( this.left_button_action, mouse_event, this._collision_left  );
		if( LS.Input.Mouse.isButtonPressed( GL.MIDDLE_MOUSE_BUTTON ) )
			changed |= this.processMouseButtonMoveEvent( this.middle_button_action, mouse_event, this._collision_middle  );
		if( LS.Input.Mouse.isButtonPressed( GL.RIGHT_MOUSE_BUTTON ) )
			changed |= this.processMouseButtonMoveEvent( this.right_button_action, mouse_event, this._collision_right  );
	}

	if(changed)
		this._root.scene.requestFrame();
}

//manage pinching and dragging two fingers in a touch pad
CameraController.prototype.onTouch = function( e, touch_event)
{
	if(!this._root || !this.enabled) 
		return;
	
	var node = this._root;
	var cam = node.camera;
	if(!cam || !cam.enabled)
		return;

	var is_global_camera = node._is_root;

	if(!touch_event)
		touch_event = e;

	//console.log( e );
	//touch!
	if( touch_event.type == "touchstart" )
	{
		if( touch_event.touches.length == 2)
		{
			var distx = touch_event.touches[0].clientX - touch_event.touches[1].clientX;
			var disty = touch_event.touches[0].clientY - touch_event.touches[1].clientY;
			this._touch_distance = Math.sqrt(distx*distx + disty*disty);
			this._touch_center = [ (touch_event.touches[0].clientX + touch_event.touches[1].clientX) * 0.5,
									(touch_event.touches[0].clientY + touch_event.touches[1].clientY) * 0.5 ];
			touch_event.preventDefault();
			return false; //block
		}
	}
	if( touch_event.type == "touchmove" )
	{
		if(touch_event.touches.length == 2)
		{
			var distx = touch_event.touches[0].clientX - touch_event.touches[1].clientX;
			var disty = touch_event.touches[0].clientY - touch_event.touches[1].clientY;
			var distance = Math.sqrt(distx*distx + disty*disty);
			if(distance < 0.1)
				distance = 0.1;
			var delta_dist = this._touch_distance / distance;
			this._touch_distance = distance;
			//console.log( delta_dist );
			cam.orbitDistanceFactor( delta_dist );
			cam.updateMatrices();

			var delta_x = (touch_event.touches[0].clientX + touch_event.touches[1].clientX) * 0.5 - this._touch_center[0];
			var delta_y = (touch_event.touches[0].clientY + touch_event.touches[1].clientY) * 0.5 - this._touch_center[1];
			var panning_factor = cam.focalLength / gl.canvas.width;
			cam.panning( -delta_x, delta_y, panning_factor );
			this._touch_center[0] = (touch_event.touches[0].clientX + touch_event.touches[1].clientX) * 0.5;
			this._touch_center[1] = (touch_event.touches[0].clientY + touch_event.touches[1].clientY) * 0.5;

			cam.updateMatrices();
			this._root.scene.requestFrame();
			touch_event.preventDefault();
			return false; //block
		}
	}
}

CameraController.prototype.testOriginPlane = function(x,y, result)
{
	var cam = this._root.camera;
	var ray = cam.getRay( x, gl.canvas.height - y );
	var result = result || vec3.create();

	//test against plane at 0,0,0
	if( geo.testRayPlane( ray.origin, ray.direction, LS.ZEROS, LS.TOP, result ) )
		return true;
	return false;
}

CameraController.prototype.testPerpendicularPlane = function(x,y, center, result)
{
	var cam = this._root.camera;
	var ray = cam.getRay( x, gl.canvas.height - y );

	var front = cam.getFront();
	var center = center || cam.getCenter();
	var result = result || vec3.create();

	//test against plane
	if( geo.testRayPlane( ray.origin, ray.direction, center, front, result ) )
		return true;
	return false;
}

CameraController.prototype.onKey = function(e, key_event)
{
	if(!this._root || !this.enabled) 
		return;

	//keyboard movement
	if( this.keyboard_walk )
	{
		if(key_event.keyCode == 87)
		{
			if(key_event.type == "keydown")
				this._moving[2] = -1;
			else
				this._moving[2] = 0;
		}
		else if(key_event.keyCode == 83)
		{
			if(key_event.type == "keydown")
				this._moving[2] = 1;
			else
				this._moving[2] = 0;
		}
		else if(key_event.keyCode == 65)
		{
			if(key_event.type == "keydown")
				this._moving[0] = -1;
			else
				this._moving[0] = 0;
		}
		else if(key_event.keyCode == 68)
		{
			if(key_event.type == "keydown")
				this._moving[0] = 1;
			else
				this._moving[0] = 0;
		}
		else if(key_event.keyCode == 16) //shift in windows chrome
		{
			if(key_event.type == "keydown")
				this._fast = true;
			else if(key_event.type == "keyup")
				this._fast = false;
		}
	}

	//LEvent.trigger(Scene,"change");
}

CameraController.prototype.onRenderGUI = function()
{
	if(!this.render_crosshair || !this.enabled || !this._camera || !this._camera.enabled || !LS.Input.isMouseLocked() )
		return;
	var ctx = gl;
	gl.start2D();
	ctx.fillStyle = "rgba(0,0,0,0.5)";
	ctx.fillRect( gl.viewport_data[2] * 0.5 - 1, gl.viewport_data[3] * 0.5 - 1, 4, 4 );
	ctx.fillStyle = "rgba(255,255,255,1)";
	ctx.fillRect( gl.viewport_data[2] * 0.5, gl.viewport_data[3] * 0.5, 2, 2 );
	gl.finish2D();
}

