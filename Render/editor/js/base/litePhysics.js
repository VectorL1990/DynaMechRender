///@INFO: UNCOMMON
/* This is in charge of basic physics actions like ray tracing against the colliders */

/**
* Contains information about the collision of a ray and the scene
* - position: vec3
* - node: SceneNode
* - instance: could be a RenderInstance or a PhysicsInstance
* - distance: number
* @class Collision
* @namespace LS
* @constructor
* @param {SceneNode} node
* @param {PhysicsInstance|RenderInstance} instance
* @param {vec3} position collision position
* @param {number} distance
*/
function Collision( node, instance, position, distance, normal, hit )
{
	this.position = vec3.create();
	if(position)
		this.position.set(position);
	this.node = node || null; //the node belonging to this colliding object
	this.instance = instance || null; //could be a RenderInstance or a PhysicsInstance
	this.distance = distance || 0; //distance from the ray start
	this.normal = normal;
	this.hit = hit; //contains info about the collision in local space
}

Collision.isCloser = function(a,b) { return a.distance - b.distance; }

LS.Collision = Collision;





/**
* PhysicsInstance contains info of a colliding object. Used to test collisions with the scene
*
* @class PhysicsInstance
* @namespace LS
* @constructor
*/
function PhysicsInstance( node, component )
{
	this.uid = LS.generateUId("PHSX"); //unique identifier for this RI
	this.layers = 3|0;

	this.type = PhysicsInstance.BOX; //SPHERE, MESH
	this.mesh = null; 

	//where does it come from
	this.node = node;
	this.component = component;

	//transformation
	this.matrix = mat4.create();
	this.center = vec3.create(); //in world space

	//for visibility computation
	this.oobb = BBox.create(); //local object oriented bounding box
	this.aabb = BBox.create(); //world axis aligned bounding box
}

PhysicsInstance.BOX = 1;
PhysicsInstance.SPHERE = 2;
PhysicsInstance.PLANE = 3;
PhysicsInstance.CAPSULE = 4;
PhysicsInstance.MESH = 5;
PhysicsInstance.FUNCTION = 6; //used to test against a internal function

/**
* Computes the instance bounding box in world space from the one in local space
*
* @method updateAABB
*/
PhysicsInstance.prototype.updateAABB = function()
{
	BBox.transformMat4( this.aabb, this.oobb, this.matrix );
}

PhysicsInstance.prototype.setMesh = function(mesh)
{
	this.mesh = mesh;
	this.type = PhysicsInstance.MESH;	
	BBox.setCenterHalfsize( this.oobb, BBox.getCenter( mesh.bounding ), BBox.getHalfsize( mesh.bounding ) );
}

LS.PhysicsInstance = PhysicsInstance;



/**
* Physics is in charge of all physics testing methods
* Right now is mostly used for testing collisions with rays agains the colliders in the scene
*
* @class Physics
* @namespace LS
* @constructor
*/
var Physics = {

	/**
	* Cast a ray that traverses the scene checking for collisions with Colliders
	* @method raycast
	* @param {vec3} origin in world space
	* @param {vec3} direction in world space
	* @param {Object} options ( max_dist maxium distance, layers which layers to check, scene, first_collision )
	* @return {Array} Array of Collision objects containing all the nodes that collided with the ray or null in the form of a LS.Collision
	*/
	raycast: function( origin, direction, options )
	{
		options = options || {};

		if(!origin || !direction)
			throw("Physics.raycast: origin or direction missing.");

		var layers = options.layers;
		if(layers === undefined)
			layers = 0xFFFF;
		var max_distance = options.max_distance || Number.MAX_VALUE;
		var scene = options.scene || LS.GlobalScene;
		var first_collision = options.first_collision;

		var colliders = options.colliders || scene._colliders;
		var collisions = [];

		var compute_normal = !!options.normal;

		if(!colliders)
			return null;

		var local_origin = vec3.create();
		var local_direction = vec3.create();

		//for every instance
		for(var i = 0; i < colliders.length; ++i)
		{
			var instance = colliders[i]; //of LS.Collider

			if( (layers & instance.layers) === 0 )
				continue;

			//test against AABB
			var collision_point = vec3.create();
			var collision_normal = null;
			if( !geo.testRayBBox(origin, direction, instance.aabb, null, collision_point, max_distance) )
				continue;

			var model = instance.matrix;
			var hit = null;

			//spheres are tested in world space, is cheaper (if no non-uniform scales...)
			if( instance.type == PhysicsInstance.SPHERE )
			{
				if(!geo.testRaySphere( origin, direction, instance.center, instance.oobb[3], collision_point, max_distance))
					continue;
				if(compute_normal)
					collision_normal = vec3.sub( vec3.create(), collision_point, instance.center );
			}
			else if( instance.type == PhysicsInstance.PLANE )
			{
				var N = vec3.fromValues(0,1,0);
				mat4.rotateVec3( N, model, N );
				if(!geo.testRayPlane( origin, direction, instance.center, N, collision_point, max_distance))
					continue;
				if(compute_normal)
					collision_normal = N;
			}
			else //the rest test first with the local BBox
			{
				//ray to local instance coordinates
				var inv = mat4.invert( mat4.create(), model );
				mat4.multiplyVec3( local_origin, inv, origin);
				mat4.rotateVec3( local_direction, inv, direction);

				//test against OOBB (a little bit more expensive)
				if( !geo.testRayBBox( local_origin, local_direction, instance.oobb, null, collision_point, max_distance) )
					continue;

				//if mesh use Octree
				if( instance.type == PhysicsInstance.MESH )
				{
					var octree = instance.mesh.octree;
					if(!octree)
						octree = instance.mesh.octree = new GL.Octree( instance.mesh );
					hit = octree.testRay( local_origin, local_direction, 0.0, max_distance );
					if(!hit)
						continue;

					mat4.multiplyVec3( collision_point, model, hit.pos );
					if(compute_normal)
						collision_normal = mat4.rotateVec3( vec3.create(), model, hit.normal );

				}
				else //if just a BBox collision
				{
					vec3.transformMat4( collision_point, collision_point, model );
				}
			}

			var distance = vec3.distance( origin, collision_point );
			collisions.push( new LS.Collision( instance.node, instance, collision_point, distance, collision_normal, hit ));

			if(first_collision)
				return collisions;
		}

		//sort collisions by distance
		collisions.sort( Collision.isCloser );
		return collisions;
	},

	/**
	* Test if a sphere collides with any of the colliders in the scene
	* @method testSphere
	* @param {vec3} origin in world space
	* @param {radius} radius
	* @param {Object} options layers, colliders, scene
	* @return {PhysicsInstance} the first PhysicsObject that collided with, otherwise null
	*/
	testSphere: function( origin, radius, options )
	{
		options = options || {};
		var layers = options.layers;
		if(layers === undefined)
			layers = 0xFFFF;
		var scene = options.scene || LS.GlobalScene;

		var colliders = options.colliders || scene._colliders;
		var collisions = [];

		var local_origin = vec3.create();

		if(!colliders)
			return null;

		//for every instance
		for(var i = 0; i < colliders.length; ++i)
		{
			var instance = colliders[i];

			if( (layers & instance.layers) === 0 )
				continue;

			//test against AABB
			if( !geo.testSphereBBox( origin, radius, instance.aabb ) )
				continue;

			var model = instance.matrix;

			//ray to local
			var inv = mat4.invert( mat4.create(), model );
			mat4.multiplyVec3( local_origin, inv, origin);

			//test in world space, is cheaper
			if( instance.type == LS.PhysicsInstance.SPHERE)
			{
				if( vec3.distance( origin, local_origin ) > (radius + BBox.getRadius(instance.oobb)) )
					continue;
			}
			else //the rest test first with the local BBox
			{
				//test against OOBB (a little bit more expensive)
				if( !geo.testSphereBBox( local_origin, radius, instance.oobb) )
					continue;

				if( instance.type == LS.PhysicsInstance.MESH )
				{
					var octree = instance.mesh.octree;
					if(!octree)
						octree = instance.mesh.octree = new GL.Octree( instance.mesh );
					if( !octree.testSphere( local_origin, radius ) )
						continue;
				}
			}

			return instance;
		}

		return null;
	},

	//test collision between two PhysicsInstance 
	testCollision: function( A, B )
	{
		//test AABBs
		if( !geo.testBBoxBBox( A.aabb, B.aabb ) )
			return false;

		return true; //TODO

		//conver A to B local Space

		//test box box

		//test box sphere

		//test box mesh

		//test sphere box

		//test sphere sphere

		//mesh mesh not supported

		//return true;
	},

	testAllCollisions: function( on_collision, layers, scene )
	{
		if(layers === undefined)
			layers = 0xFFFF;
		scene = scene || LS.GlobalScene;

		var colliders = scene._colliders;
		var l = colliders.length;

		var collisions = false;

		for(var i = 0; i < l; ++i)
		{
			var instance_A = colliders[i];

			if( (layers & instance_A.layers) === 0 )
				continue;

			for(var j = i+1; j < l; ++j)
			{
				var instance_B = colliders[j];

				if( (layers & instance_B.layers) === 0 )
					continue;

				if( this.testCollision( instance_A, instance_B ) )
				{
					if(on_collision)
						on_collision( instance_A, instance_B );
					collisions = true;
				}
			}
		}

		return collisions;
	},

	/**
	* Cast a ray that traverses the scene checking for collisions with RenderInstances instead of colliders
	* Similar to Physics.raycast but using the RenderInstances (if options.triangle_collision it builds Octrees for the RIs whose OOBB collides with the ray)
	* @method raycastRenderInstances
	* @param {vec3} origin in world space
	* @param {vec3} direction in world space
	* @param {Object} options { instances: array of instances, if not the scene will be used, triangle_collision: true if you want to test against triangles, max_distance: maxium ray distance, layers, scene, max_distance, first_collision : returns the first collision (which could be not the closest one) }
	* @return {Array} array containing all the RenderInstances that collided with the ray in the form [SceneNode, RenderInstance, collision point, distance]
	*/
	raycastRenderInstances: function( origin, direction, options )
	{
		options = options || {};
		var layers = options.layers;
		if(layers === undefined)
			layers = 0xFFFF;
		var max_distance = options.max_distance || Number.MAX_VALUE;
		var scene = options.scene || LS.GlobalScene;

		var triangle_collision = !!options.triangle_collision;
		var first_collision = !!options.first_collision;
		var compute_normal = !!options.normal;
		var ignore_transparent = !!options.ignore_transparent;

		var instances = options.instances || scene._instances;
		if(!instances || !instances.length)
			return null;

		var collisions = [];

		var local_origin = vec3.create();
		var local_direction = vec3.create();

		//for every instance
		for(var i = 0, l = instances.length; i < l; ++i)
		{
			var instance = instances[i];

			if((layers & instance.layers) === 0 ) //|| !(instance.flags & RI_RAYCAST_ENABLED) 
				continue;

			if(instance.material && instance.material.render_state.blend && ignore_transparent)
				continue; //avoid semitransparent

			if( !instance.use_bounding && options.add_instances_without_aabb)
			{
				collisions.push( new LS.Collision( instance.node, instance, vec3.clone(origin), 0, vec3.clone(direction), null ) );
				continue;
			}

			//test against AABB
			var collision_point = vec3.create();
			if( !geo.testRayBBox( origin, direction, instance.aabb, null, collision_point, max_distance ) )
				continue;

			var model = instance.matrix;
			var hit = null;

			//ray to local
			var inv = mat4.invert( mat4.create(), model );
			mat4.multiplyVec3( local_origin, inv, origin );
			mat4.rotateVec3( local_direction, inv, direction );

			//test against OOBB (a little bit more expensive)
			if( !geo.testRayBBox( local_origin, local_direction, instance.oobb, null, collision_point, max_distance) )
				continue;

			//check which mesh to use
			var collision_normal = null;
			
			//test against mesh
			if( triangle_collision )
			{
				var collision_mesh = instance.lod_mesh || instance.mesh;
				var octree = collision_mesh.octree;
				if(!octree)
					octree = collision_mesh.octree = new GL.Octree( collision_mesh );
				hit = octree.testRay( local_origin, local_direction, 0.0, max_distance );
				if(!hit)
					continue;
				mat4.multiplyVec3( collision_point, model, hit.pos );
				if(compute_normal)
					collision_normal = mat4.rotateVec3( vec3.create(), model, hit.normal );
			}
			else
				vec3.transformMat4( collision_point, collision_point, model );

			//compute distance
			var distance = vec3.distance( origin, collision_point );
			if(distance < max_distance)
				collisions.push( new LS.Collision( instance.node, instance, collision_point, distance, collision_normal, hit ) );

			if(first_collision)
				return collisions;
		}

		collisions.sort( LS.Collision.isCloser );
		return collisions;
	},

	/**
	* Cast a ray that traverses the scene checking for collisions with RenderInstances instead of colliders
	* Similar to Physics.raycast but using the RenderInstances (if options.triangle_collision it builds Octrees for the RIs whose OOBB collides with the ray)
	* @method raycastRenderInstances
	* @param {vec3} origin in world space
	* @param {vec3} direction in world space
	* @param {LS.SceneNode} node 
	* @param {Object} options ( triangle_collision: true if you want to test against triangles, max_distance: maxium ray distance, layers, scene, max_distance, first_collision : returns the first collision (which could be not the closest one) )
	* @return {Array} array containing all the RenderInstances that collided with the ray in the form [SceneNode, RenderInstance, collision point, distance]
	*/
	raycastNode: function( origin, direction, node, options )
	{
		options = options || {};
		options.instances = node._instances;
		return this.raycastRenderInstances( origin, direction, options );
	}
}


LS.Physics = Physics;
///@FILE:../src/components/transform.js
///@INFO: BASE
/**
* Transform that contains the position (vec3), rotation (quat) and scale (vec3) 
* It uses lazy update to recompute the matrices.
* @class Transform
* @namespace LS.Components
* @constructor
* @param {Object} object to configure from
*/

function Transform( o )
{
	//packed data (helpful for animation stuff)
	this._data = new Float32Array( 3 + 4 + 3 ); //pos, rot, scale, also known as trans10

	//TSR
	this._position = this._data.subarray(0,3);
	this._rotation = this._data.subarray(3,7);
	quat.identity(this._rotation);
	this._scaling = this._data.subarray(7,10);
	this._scaling[0] = this._scaling[1] = this._scaling[2] = 1;

	//matrices
	this._local_matrix = mat4.create();
	this._global_matrix = mat4.create();

	this._uid = null;
	this._root = null;
	this._parent = null;

	this._must_update = false; //local matrix must be redone
	this._version = 0;

	/* JS feature deprecated
	if(Object.observe)
	{
		var inner_transform_change = (function(c) { 
			this._must_update = true;
		}).bind(this);
		Object.observe( this._position, inner_transform_change );
		Object.observe( this._rotation, inner_transform_change );
		Object.observe( this._scaling, inner_transform_change );
		Object.observe( this._data, inner_transform_change );
	}
	*/

	if(o)
		this.configure(o);
}

Transform.temp_matrix = mat4.create();
Transform.icon = "mini-icon-gizmo.png";
Transform.ZERO = vec3.create();
Transform.UP = vec3.fromValues(0,1,0);
Transform.RIGHT = vec3.fromValues(1,0,0);
Transform.FRONT = vec3.fromValues(0,0,-1);

Transform.TRANS10_IDENTITY = new Float32Array([0,0,0,0,0,0,1,1,1,1]);

Transform["@rotation"] = { type: "quat"};
Transform["@data"] = { type: "trans10" };

//what is this used for??
Transform.properties = {
	position:"vec3",
	scaling:"vec3",
	rotation:"quat"
};

Transform.prototype.onAddedToNode = function(node)
{
	if(!node.transform)
		node.transform = this;
}

Transform.prototype.onRemovedFromNode = function(node)
{
	if(node.transform == this)
		delete node["transform"];
}

/**
* The position relative to its parent in vec3 format
* @property position {vec3}
*/
Object.defineProperty( Transform.prototype, 'position', {
	get: function() { return this._position; },
	set: function(v) { 
		if(!v || !v.length)
			return;
		this._position.set(v); 
		this._must_update = true; 
	},
	enumerable: true
});

Object.defineProperty( Transform.prototype, 'x', {
	get: function() { return this._position[0]; },
	set: function(v) { 
		this._position[0] = v; 
		this._must_update = true; 
	},
	enumerable: false
});

Object.defineProperty( Transform.prototype, 'y', {
	get: function() { return this._position[1]; },
	set: function(v) { 
		this._position[1] = v; 
		this._must_update = true; 
	},
	enumerable: false
});

Object.defineProperty( Transform.prototype, 'z', {
	get: function() { return this._position[2]; },
	set: function(v) { 
		this._position[2] = v; 
		this._must_update = true; 
	},
	enumerable: false
});

/*
Object.defineProperty( Transform.prototype, 'pitch', {
	get: function() { return 0; },
	set: function(v) { 
		this.rotateX(v);
		this._must_update = true; 
	},
	enumerable: false
});
*/

/**
* The orientation relative to its parent in quaternion format
* @property rotation {quat}
*/
Object.defineProperty( Transform.prototype, 'rotation', {
	get: function() { return this._rotation; },
	set: function(v) { 
		this._rotation.set(v);
		this._must_update = true;
	},
	enumerable: true //avoid problems
});

/**
* The scaling relative to its parent in vec3 format (default is [1,1,1])
* @property scaling {vec3}
*/
Object.defineProperty( Transform.prototype, 'scaling', {
	get: function() { return this._scaling; },
	set: function(v) { 
		if(v.constructor === Number)
			this._scaling[0] = this._scaling[1] = this._scaling[2] = v;
		else
			this._scaling.set(v);
		this._must_update = true;
	},
	enumerable: true
});

/**
* The scaling relative to its parent in vec3 format (default is [1,1,1])
* @property scaling {vec3}
*/
Object.defineProperty( Transform.prototype, 'uniform_scaling', {
	get: function() { return this._scaling[0]; },
	set: function(v) { 
		this._scaling[0] = this._scaling[1] = this._scaling[2] = v;
		this._must_update = true;
	},
	enumerable: true
});

/**
* The local matrix transform relative to its parent in mat4 format
* @property matrix {mat4}
*/
Object.defineProperty( Transform.prototype, 'matrix', {
	get: function() { 
		if(this._must_update)
			this.updateMatrix();
		return this._local_matrix;
	},
	set: function(v) { 
		this.fromMatrix(v);	
	},
	enumerable: true
});

//this is used to speed up copying between transforms and for animation (better to animate one track than several)
Object.defineProperty( Transform.prototype, 'data', {
	get: function() { 
		return this._data;
	},
	set: function(v) { 
		this._data.set(v);	
		this._must_update = true;
	},
	enumerable: false
});

//in degrees
Object.defineProperty( Transform.prototype, 'xrotation', {
	get: function() { return 0; },
	set: function(v) { 
		this.rotateX(v * DEG2RAD);
	},
	enumerable: false
});

//in degrees
Object.defineProperty( Transform.prototype, 'yrotation', {
	get: function() { return 0; },
	set: function(v) { 
		this.rotateY(v * DEG2RAD);
	},
	enumerable: false
});

//in degrees
Object.defineProperty( Transform.prototype, 'zrotation', {
	get: function() { return 0; },
	set: function(v) { 
		this.rotateZ(v * DEG2RAD);
	},
	enumerable: false
});



/**
* The position relative to its parent in vec3 format
* @property position {vec3}
*/
Object.defineProperty( Transform.prototype, 'globalPosition', {
	get: function() { return this.getGlobalPosition(); },
	set: function(v) { 
	},
	enumerable: true
});

/**
* The matrix transform relative to world coordinates
* @property globalMatrix {mat4}
*/
Object.defineProperty( Transform.prototype, 'globalMatrix', {
	get: function() { 
		this.updateGlobalMatrix();
		return this._global_matrix;
	},
	set: function(v) { 
		throw("globalMatrix cannot be set, use fromMatrix(m,true)");
	},
	enumerable: true
});

/**
* The forward vector in global coordinates
* @property forward {mat4}
*/
Object.defineProperty( Transform.prototype, 'forward', {
	get: function() { 
		this.updateGlobalMatrix();
		return mat4.rotateVec3( vec3.create(), this._global_matrix, LS.FRONT );
	},
	set: function(v) { 
		throw("forward cannot be set");
	},
	enumerable: false //dont worry, it uses its own serialize
});

/**
* Force object to update matrices in case they were modified
* @property mustUpdate {boolean}
*/
Object.defineProperty( Transform.prototype, 'mustUpdate', {
	get: function() { 
		return this._must_update;
	},
	set: function(v) { 
		this._must_update = true;
	},
	enumerable: false
});

Transform.prototype.getPropertiesInfo = function(v)
{
	if(v == "output")
	{
		return {
			position:"vec3",
			scaling:"vec3",
			rotation:"quat",
			matrix:"mat4",
			globalPosition:"vec3",
			globalMatrix:"mat4"
		};
	} 
	else //if(v == "input")
	{
		return {
			position:"vec3",
			scaling:"vec3",
			rotation:"quat",
			matrix:"mat4"
		};
	}
}


/**
* Copy the transform from another Transform
* @method copyFrom
* @param {Transform} src
*/
Transform.prototype.copyFrom = function(src)
{
	this.configure( src.serialize() );
}

/**
* Configure from a serialized object
* @method configure
* @param {Object} object with the serialized info
*/
Transform.prototype.configure = function(o)
{
	if(o.uid) this.uid = o.uid;
	if(o.position) this._position.set( o.position );
	if(o.scaling) this._scaling.set( o.scaling );

	if(o.rotation && o.rotation.length == 4)
		this._rotation.set( o.rotation );
	if(o.rotation && o.rotation.length == 3)
	{
		quat.identity( this._rotation );
		var R = quat.setAngleAxis( quat.create(), [1,0,0], o.rotation[0] * DEG2RAD);
		quat.multiply(this._rotation, this._rotation, R ); 
		quat.setAngleAxis( R, [0,1,0], o.rotation[1] * DEG2RAD );
		quat.multiply(this._rotation, this._rotation, R ); 
		quat.setAngleAxis( R, [0,0,1], o.rotation[2] * DEG2RAD );
		quat.multiply(this._rotation, this._rotation, R ); 
	}

	this._must_update = true;
	this.updateGlobalMatrix();
	this._on_change();
}

/**
* Serialize the object 
* @method serialize
* @return {Object} object with the serialized info
*/
Transform.prototype.serialize = function( simplified )
{
	
	var o = {
		object_class: "Transform",
		uid: this.uid,
		position: [ this._position[0],this._position[1],this._position[2] ],
		rotation: [ this._rotation[0],this._rotation[1],this._rotation[2],this._rotation[3] ],
		scaling: [ this._scaling[0],this._scaling[1],this._scaling[2] ]
	};

	if( !this.isIdentity() && !simplified )
		o.matrix = toArray( this._local_matrix );; //could be useful

	return o;
}

Transform.prototype.isIdentity = function()
{
	for(var i = 0; i < this._local_matrix.length; ++i)
		if( Math.abs( this._local_matrix[i] - LS.IDENTITY[i] ) > 0.001 )
			return false;
	return true;
}

/**
* Reset this transform
* @method identity
*/
Transform.prototype.identity = function()
{
	vec3.copy(this._position, LS.ZEROS );
	quat.identity( this._rotation );
	vec3.copy(this._scaling, LS.ONES );
	mat4.identity(this._local_matrix);
	mat4.identity(this._global_matrix);
	this._version += 1;
	this._must_update = false;
}

Transform.prototype.reset = Transform.prototype.identity;

/**
* Sets the rotation to identity
* @method resetRotation
*/
Transform.prototype.resetRotation = function()
{
	quat.identity( this._rotation );
	this._version += 1;
	this._must_update = true;
	this._on_change();
}

/**
* Sets the position to 0,0,0
* @method resetPosition
*/
Transform.prototype.resetPosition = function()
{
	vec3.copy( this._position, LS.ZEROS );
	this._version += 1;
	this._must_update = true;
	this._on_change(true);
}

/**
* Sets the scale to 1,1,1
* @method resetScale
*/
Transform.prototype.resetScale = function()
{
	vec3.copy( this._scaling, LS.ONES );
	this._version += 1;
	this._must_update = true;
	this._on_change(true);
}


/**
* Returns a copy of the local position
* @method getPosition
* @param {vec3} out [optional] where to store the result, otherwise one vec3 is created and returned
* @return {vec3} the position
*/
Transform.prototype.getPosition = function(out)
{
	out = out || vec3.create();
	out.set( this._position );
	return out;
}

/**
* Returns a copy of the global position
* @method getGlobalPosition
* @param {vec3} out [optional] where to store the result, otherwise one vec3 is created and returned
* @return {vec3} the position
*/
Transform.prototype.getGlobalPosition = function(out)
{
	out = out || vec3.create();
	if(this._parent) 
		return mat4.multiplyVec3( out, this.getGlobalMatrix(), Transform.ZERO ); //cannot reuse matrix in getGlobalMatrix, is recursive
	return vec3.copy(out, this._position );
}

/**
* Returns the rotation in quaternion array (a copy)
* @method getRotation
* @param {quat} out [optional] where to store the result, otherwise one quat is created and returned
* @return {quat} the rotation
*/
Transform.prototype.getRotation = function(out)
{
	out = out || quat.create();
	return vec3.copy(out,this._rotation);
}

/**
* Returns the global rotation in quaternion array (a copy)
* @method getRotation
* @param {quat} out [optional] where to store the result, otherwise one quat is created and returned
* @return {quat} the rotation
*/
Transform.prototype.getGlobalRotation = function(out)
{
	out = out || quat.create();
	if( !this._parent )
	{
		quat.copy(out, this._rotation);
		return out;
	}

	var aux = this._parent;
	quat.copy(out,this._rotation);
	while(aux)
	{
		quat.multiply(out, aux._rotation, out);
		aux = aux._parent;
	}
	return out;
}


/**
* Returns the scale (its a copy)
* @method getScale
* @param {vec3} out [optional] where to store the result, otherwise one vec3 is created and returned
* @return {vec3} the scale
*/
Transform.prototype.getScale = function(out)
{
	out = out || vec3.create();
	return vec3.copy(out,this._scaling);
}

/**
* Returns a copy of the global scale (this is not correct, there is no global_scale factor, because due to rotations the axis could change)
* @method getGlobalScale
* @param {vec3} out [optional] where to store the result, otherwise one vec3 is created and returned
* @return {vec3} the scale
*/
Transform.prototype.getGlobalScale = function(out)
{
	out = out || vec3.create();
	if( this._parent )
	{
		var aux = this;
		vec3.copy(out,this._scaling);
		while(aux._parent)
		{
			vec3.multiply(out, out, aux._scaling);
			aux = aux._parent;
		}
		return out;
	}
	return vec3.copy(out, this._scaling);
}

/**
* update the local Matrix to match the position,scale and rotation
* @method updateMatrix
*/
Transform.prototype.updateMatrix = function()
{
	mat4.fromRotationTranslation( this._local_matrix , this._rotation, this._position );
	mat4.scale(this._local_matrix, this._local_matrix, this._scaling);
	this._must_update = false;
	this._version += 1;
	this.updateDescendants();
}
Transform.prototype.updateLocalMatrix = Transform.prototype.updateMatrix;

/**
* updates the global matrix using the parents transformation
* @method updateGlobalMatrix
* @param {bool} fast it doesnt recompute parent matrices, just uses the stored one, is faster but could create errors if the parent doesnt have its global matrix update
*/
Transform.prototype.updateGlobalMatrix = function (fast)
{
	if(this._must_update)
		this.updateMatrix();
	if (this._parent)
		mat4.multiply( this._global_matrix, fast ? this._parent._global_matrix : this._parent.getGlobalMatrix( this._parent._global_matrix ), this._local_matrix );
	else
		this._global_matrix.set( this._local_matrix ); 
}

/**
* Returns a copy of the local matrix of this transform (it updates the matrix automatically)
* @method getMatrix
* @param {mat4} out [optional] where to store the result, otherwise one mat4 is created and returned
* @return {mat4} the matrix
*/
Transform.prototype.getMatrix = function (out)
{
	out = out || mat4.create();
	if(this._must_update)
		this.updateMatrix();
	return mat4.copy(out, this._local_matrix);
}
Transform.prototype.getLocalMatrix = Transform.prototype.getMatrix; //alias

/**
* Returns the original local matrix of this transform (it updates the matrix automatically)
* @method getLocalMatrixRef
* @return {mat4} the matrix in array format
*/
Transform.prototype.getLocalMatrixRef = function ()
{
	if(this._must_update)
		this.updateMatrix();
	return this._local_matrix;
}


/**
* Returns a copy of the global matrix of this transform (it updates the matrix automatically)
* @method getGlobalMatrix
* @param {mat4} out optional
* @param {boolean} fast this flags skips recomputing parents matrices
* @return {mat4} the matrix in array format
*/
Transform.prototype.getGlobalMatrix = function (out, fast)
{
	if(this._must_update)
		this.updateMatrix();
	out = out || mat4.create();
	if (this._parent)
		mat4.multiply( this._global_matrix, fast ? this._parent._global_matrix : this._parent.getGlobalMatrix( this._parent._global_matrix ), this._local_matrix );
	else
		mat4.copy( this._global_matrix, this._local_matrix ); 
	return mat4.copy(out, this._global_matrix);
}

/**
* Returns a copy of the global matrix of this transform (it updates the matrix automatically)
* @method getGlobalMatrix
* @return {mat4} the matrix in array format
*/
Transform.prototype.getGlobalMatrixRef = function (fast)
{
	this.updateGlobalMatrix(fast);
	return this._global_matrix;
}



/**
* Returns an array with all the ancestors
* @method getAncestors
* @return {Array} 
*/
Transform.prototype.getAncestors = function()
{
	var r = [ this ];
	var aux = this;
	while(aux = aux._parent)
		r.unshift(aux);	
	return r;
}

/**
* Returns a quaternion with all parents rotations
* @method getGlobalRotation
* @return {quat} Quaternion
*/
/*
Transform.prototype.getGlobalRotation = function (q)
{
	q = q || quat.create();
	q.set(this._rotation);

	//concatenate all parents rotations
	var aux = this._parent;
	while(aux)
	{
		quat.multiply(q,q,aux._rotation);
		aux = aux._parent;
	}
	return q;
}
*/
/**
* Returns a Matrix with all parents rotations
* @method getGlobalRotationMatrix
* @return {mat4} Matrix rotation
*/
/*
Transform.prototype.getGlobalRotationMatrix = function (m)
{
	var q = quat.clone(this._rotation);

	var aux = this._parent;
	while(aux)
	{
		quat.multiply(q, q, aux._rotation);
		aux = aux._parent;
	}

	m = m || mat4.create();
	return mat4.fromQuat(m,q);
}
*/


/**
* Returns the local matrix of this transform without the rotation or scale
* @method getGlobalTranslationMatrix
* @return {mat4} the matrix in array format
*/
Transform.prototype.getGlobalTranslationMatrix = function ()
{
	var pos = this.getGlobalPosition();
	return mat4.fromValues(1,0,0,0, 0,1,0,0, 0,0,1,0, pos[0], pos[1], pos[2], 1);
}

/**
* Returns the global rotation in quaternion array (a copy)
* @method getGlobalRotationMatrix
* @return {mat4} the rotation
*/
Transform.prototype.getGlobalRotationMatrix = function(out)
{
	var out = out || mat4.create();
	if( !this._parent )
		return mat4.fromQuat( out, this._rotation );
		
	var r = mat4.create();
	var aux = this;
	while( aux )
	{
		mat4.fromQuat(r, aux._rotation);
		mat4.multiply(out,out,r);
		aux = aux._parent;
	}
	return out;
}


/**
* Returns the local matrix of this transform without the scale
* @method getGlobalTranslationRotationMatrix
* @return {mat4} the matrix in array format
*/
Transform.prototype.getGlobalTranslationRotationMatrix = function ()
{
	var pos = this.getGlobalPosition();
	return mat4.fromRotationTranslation(mat4.create(), this.getGlobalRotation(), pos);
}
Transform.prototype.getGlobalMatrixWithoutScale = Transform.prototype.getGlobalTranslationRotationMatrix;



/**
* Returns the matrix for the normals in the shader
* @method getNormalMatrix
* @return {mat4} the matrix in array format
*/
Transform.prototype.getNormalMatrix = function (m)
{
	if(this._must_update)
		this.updateMatrix();

	m = m || mat4.create();
	if (this._parent)
		mat4.multiply( this._global_matrix, this._parent.getGlobalMatrix(), this._local_matrix );
	else
		m.set(this._local_matrix); //return local because it has no parent
	return mat4.transpose(m, mat4.invert(m,m) );
}

/**
* Configure the transform from a local Matrix (do not tested carefully)
* @method fromMatrix
* @param {mat4} matrix the matrix in array format
* @param {bool} is_global tells if the matrix is in global space [optional]
*/
Transform.prototype.fromMatrix = (function() { 

	var global_temp = mat4.create();
	var temp_mat4 = mat4.create();
	var temp_mat3 = mat3.create();
	var temp_vec3 = vec3.create();
	//var scale_temp = mat4.create();
	
	return function fromMatrix( m, is_global )
	{
		if(is_global && this._parent)
		{
			mat4.copy(this._global_matrix, m); //assign to global
			var M_parent = this._parent.getGlobalMatrix( global_temp ); //get parent transform
			var r = mat4.invert( M_parent, M_parent ); //invert
			if(!r)
				return;
			m = mat4.multiply( this._local_matrix, M_parent, m ); //transform from global to local
		}

		//pos
		var M = temp_mat4;
		M.set(m);
		mat4.multiplyVec3( this._position, M, LS.ZEROS );

		//compute scale
		this._scaling[0] = vec3.length( mat4.rotateVec3( temp_vec3, M, LS.RIGHT) );
		this._scaling[1] = vec3.length( mat4.rotateVec3( temp_vec3, M, LS.TOP) );
		this._scaling[2] = vec3.length( mat4.rotateVec3( temp_vec3, M, LS.BACK) );

		//apply scale, why the inverse? ??
		//mat4.scale( scale_temp, M, [1/this._scaling[0], 1/this._scaling[1], 1/this._scaling[2]] );

		//quat.fromMat4(this._rotation, M);
		//*
		//normalize system vectors
		vec3.normalize( M.subarray(0,3), M.subarray(0,3) );
		vec3.normalize( M.subarray(4,7), M.subarray(4,7) );
		vec3.normalize( M.subarray(8,11), M.subarray(8,11) );

		var M3 = mat3.fromMat4( temp_mat3, M );
		quat.fromMat3AndQuat( this._rotation, M3 );

		/* works with default fromMat3, not with fromMat3AndQuat
		var M3 = mat3.fromMat4( temp_mat3, M );
		mat3.transpose( M3, M3 ); //why transpose?!?!
		quat.fromMat3( this._rotation, M3 );
		quat.normalize( this._rotation, this._rotation );
		//*/

		if(m != this._local_matrix)
			mat4.copy(this._local_matrix, m);
		this._must_update = false;
		this._version += 1;
		this._on_change(true);
	}
})();

/**
* Configure the transform from a global Matrix (do not tested carefully)
* @method fromGlobalMatrix
* @param {mat4} matrix the matrix in array format
*/
Transform.prototype.fromGlobalMatrix = function(m)
{
	this.fromMatrix(m,true);	
}

Transform.fromMatrix4ToTransformData = (function() { 

	var global_temp = mat4.create();
	var temp_mat4 = mat4.create();
	var temp_mat3 = mat3.create();
	var temp_vec3 = vec3.create();
	
	return function fromMatrix4ToTransformData( m, out )
	{
		var data = out || new Float32Array( 3 + 4 + 3 ); //pos, rot, scale
		var position = data.subarray(0,3);
		var rotation = data.subarray(3,7);
		quat.identity(rotation);
		var scaling = data.subarray(7,10);

		//pos
		var M = temp_mat4;
		M.set(m);
		mat4.multiplyVec3( position, M, LS.ZEROS );

		//extract scaling by 
		scaling[0] = vec3.length( mat4.rotateVec3( temp_vec3, M, LS.RIGHT) );
		scaling[1] = vec3.length( mat4.rotateVec3( temp_vec3, M, LS.TOP) );
		scaling[2] = vec3.length( mat4.rotateVec3( temp_vec3, M, LS.BACK) );

		//quat.fromMat4( rotation, M ); //doesnt work

		//normalize axis vectors
		vec3.normalize( M.subarray(0,3), M.subarray(0,3) );
		vec3.normalize( M.subarray(4,7), M.subarray(4,7) );
		vec3.normalize( M.subarray(8,11), M.subarray(8,11) );

		var M3 = mat3.fromMat4( temp_mat3, M );
		mat3.transpose( M3, M3 );
		quat.fromMat3( rotation, M3 );
		quat.normalize( rotation, rotation );

		return data;
	}
})();


/**
* Configure the transform rotation from a vec3 Euler angles (heading,attitude,bank)
* @method setRotationFromEuler
* @param {mat4} src, the matrix in array format
*/
Transform.prototype.setRotationFromEuler = function(v)
{
	quat.fromEuler( this._rotation, v );
	this._must_update = true;
	this._on_change();
}

/**
* sets the position
* @method setPosition
* @param {number} x 
* @param {number} y
* @param {number} z 
*/
Transform.prototype.setPosition = function(x,y,z)
{
	if(arguments.length == 3)
		vec3.set(this._position, x,y,z);
	else
		vec3.copy(this._position, x);
	this._must_update = true;
	this._on_change(true);
}

/**
* sets the rotation from a quaternion or from an angle(rad) and axis
* @method setRotation
* @param {quat} rotation in quaterion format or angle
*/
Transform.prototype.setRotation = function(q_angle,axis)
{
	if(axis)
		quat.setAxisAngle( this._rotation, axis, q_angle );
	else
		quat.copy(this._rotation, q_angle );
	this._must_update = true;
	this._on_change(true);
}

/**
* sets the scale
* @method setScale
* @param {number} x 
* @param {number} y
* @param {number} z 
*/
Transform.prototype.setScale = function(x,y,z)
{
	if(arguments.length == 3)
		vec3.set(this._scaling, x,y,z);
	else
		vec3.set(this._scaling, x,x,x);
	this._must_update = true;
	this._on_change(true);
}

/**
* translates object in local coordinates (using the rotation and the scale)
* @method translate
* @param {number} x 
* @param {number} y
* @param {number} z 
*/
Transform.prototype.translate = (function(){
	var tmp = vec3.create();
	var tmp2 = vec3.create();
	
	return function(x,y,z)
	{
		if(arguments.length == 3)
		{
			tmp2[0] = x; tmp2[1] = y; tmp2[2] = z;
			vec3.add( this._position, this._position, this.transformVector(tmp2, tmp) );
		}
		else
			vec3.add( this._position, this._position, this.transformVector(x, tmp) );
		this._must_update = true;
		this._on_change(true);
	};
})();

/**
* translates object in local coordinates (adds to the position)
* @method translateGlobal
* @param {number} x 
* @param {number} y
* @param {number} z 
*/
Transform.prototype.translateGlobal = function(x,y,z)
{
	if(arguments.length == 3)
		vec3.add( this._position, this._position, [x,y,z] );
	else
		vec3.add( this._position, this._position, x );
	this._must_update = true;
	this._on_change(true);
}

/**
* rotate object in local space (axis is in local space)
* @method rotate
* @param {number} angle_in_deg 
* @param {vec3} axis
* @param {boolean} is_global tells if the axis is in global coordinates or local coordinates
*/
Transform.prototype.rotate = (function(){

	var temp = quat.create();
	var temp_axis = quat.create();

	return function(angle_in_deg, axis, is_global )
	{
		if( is_global ) //convert global vector to local
			axis = this.globalVectorToLocal( axis, temp_axis );
		quat.setAxisAngle( temp, axis, angle_in_deg * 0.0174532925 );
		quat.multiply( this._rotation, this._rotation, temp );
		this._must_update = true;
		this._on_change(true);
	}
})();

/**
* rotate object in local space in local X axis
* @method rotateX
* @param {number} angle_in_rad
*/
Transform.prototype.rotateX = function(angle_in_rad)
{
	quat.rotateX( this._rotation, this._rotation, angle_in_rad  );
	this._must_update = true;
	this._on_change(true);
}

/**
* rotate object in local space in local Y axis
* @method rotateY
* @param {number} angle_in_rad 
*/
Transform.prototype.rotateY = function(angle_in_rad)
{
	quat.rotateY( this._rotation, this._rotation, angle_in_rad );
	this._must_update = true;
	this._on_change();
}

/**
* rotate object in local space in local Z axis
* @method rotateZ
* @param {number} angle_in_rad 
*/
Transform.prototype.rotateZ = function(angle_in_rad)
{
	quat.rotateZ( this._rotation, this._rotation, angle_in_rad );
	this._must_update = true;
	this._on_change(true);
}


/**
* rotate object in global space (axis is in global space)
* @method rotateGlobal
* @param {number} angle_in_deg 
* @param {vec3} axis
*/
Transform.prototype.rotateGlobal = function(angle_in_deg, axis)
{
	var R = quat.setAxisAngle(quat.create(), axis, angle_in_deg * 0.0174532925);
	quat.multiply(this._rotation, R, this._rotation);
	this._must_update = true;
	this._on_change(true);
}

/**
* rotate object in local space using a quat
* @method rotateQuat
* @param {quat} quaternion
*/
Transform.prototype.rotateQuat = function(quaternion)
{
	quat.multiply(this._rotation, this._rotation, quaternion);
	this._must_update = true;
	this._on_change(true);
}

/**
* rotate object in global space using a quat
* @method rotateQuatGlobal
* @param {quat} quaternion
*/
Transform.prototype.rotateQuatGlobal = function(quaternion)
{
	quat.multiply(this._rotation, quaternion, this._rotation);
	this._must_update = true;
	this._on_change(true);
}

/**
* scale the object
* @method scale
* @param {number} x 
* @param {number} y
* @param {number} z 
*/
Transform.prototype.scale = function(x,y,z)
{
	if(arguments.length == 3)
		vec3.multiply(this._scaling, this._scaling, [x,y,z]);
	else
		vec3.multiply(this._scaling, this._scaling,x);
	this._must_update = true;
	this._on_change(true);
}

/**
* This method is static (call it from Transform.interpolate)
* interpolate the transform between two transforms and stores the result in another Transform
* @method interpolate
* @param {Transform} a 
* @param {Transform} b
* @param {number} factor from 0 to 1 
* @param {Transform} the destination
*/
Transform.interpolate = function( a, b, factor, result )
{
	vec3.lerp( result._scaling, a._scaling, b._scaling, factor); //scale
	vec3.lerp( result._position, a._position, b._position, factor); //position
	quat.slerp( result._rotation, a._rotation, b._rotation, factor); //rotation
	this._must_update = true;
	this._on_change();
}

/**
* Orbits around a point
* @method orbit
* @param {number} angle_in_deg
* @param {vec3} axis
* @param {vec3} center in local coordinates
*/
Transform.prototype.orbit = (function() { 
	var tmp_quat = quat.create();
	var tmp_vec3 = vec3.create();

	return function( angle_in_deg, axis, center )
	{
		if(!center)
			throw("Transform orbit requires a center");

		var R = quat.setAxisAngle( tmp_quat, axis, angle_in_deg * 0.0174532925 );
		tmp_vec3.set( this._position );
		vec3.sub(tmp_vec3, tmp_vec3, center );
		vec3.transformQuat( tmp_vec3, tmp_vec3, R );
		vec3.add(tmp_vec3, tmp_vec3, center );
		this._position.set( tmp_vec3 );
		this._must_update = true;
	};
})();


/**
* Orients the transform to look from one position to another
* @method lookAt
* @param {vec3} position
* @param {vec3} target
* @param {vec3} up
* @param {boolean} in_world tells if the values are in world coordinates (otherwise asume its in local coordinates)
*/
Transform.prototype.lookAt = (function() { 
	var temp = mat4.create();
	return function( pos, target, up, in_world )
	{
		//compute matrix in world space
		mat4.lookAt(temp, pos, target, up);
		mat4.invert(temp, temp);
		//pass it to fromMatrix
		this.fromMatrix(temp, true);
	}
})();


/**
* Orients the transform to look at a position
* @method orientTo
* @param {vec3} target the position where to look at
* @param {boolean} in_world tells if the target is in world coordinates (otherwise asume its in local coordinates)
* @param {vec3} top [optional] a helper top vector, otherwise [0,1,0] is assumed
* @param {bool} iterative_method [optional] uses an iterative method which smoothes a little bit the result over time but gives better results
*/
Transform.prototype.orientTo = (function() { 

	//avoid garbage
	var GM = mat4.create();
	var temp = mat3.create();
	var temp4 = mat4.create();
	var temp_front = vec3.create();
	var temp_right = vec3.create();
	var temp_top = vec3.create();
	var temp_pos = vec3.create();
	//function
	return function( pos, in_world, top, iterative_method )
	{
		top = top || LS.TOP;
		//convert to local space
		/*
		if(in_world && this._parent)
		{
			this._parent.globalToLocal( pos, temp_front );
		}
		else
			temp_front.set( pos );
		*/

		if(in_world)
		{
			this.getGlobalPosition( temp_pos );
			vec3.sub( temp_front, pos, temp_pos );
		}
		else
			temp_front.set( pos );

		vec3.scale( temp_front,temp_front,-1); //reverse?

		//vec3.sub( temp_front, temp_pos, temp_front );
		vec3.normalize( temp_front, temp_front );
		if(iterative_method)
		{
			mat3.setColumn( temp, LS.RIGHT, 0 );
			mat3.setColumn( temp, top, 1 );
			mat3.setColumn( temp, temp_front, 2 );
			quat.fromMat3AndQuat( this._rotation, temp );
		}
		else
		{
			/*
			vec3.cross( temp_right, temp_front, top );
			vec3.normalize( temp_right, temp_right );
			vec3.cross( temp_top, temp_right, temp_front );
			vec3.normalize( temp_top, temp_top );
			quat.lookRotation( this._rotation, temp_front, temp_top );
			*/
			quat.lookRotation( this._rotation, temp_front, top );

			/* using mat4 doesnt work
			temp4.set(temp_right);
			temp4.set(temp_top,4);
			temp4.set(temp_front,8);
			mat4.transpose(temp4,temp4);
			quat.fromMat4( this._rotation, temp4 );
			*/
			
			/* using mat3, doesnt work
			mat3.setColumn( temp, temp_right, 0 );
			mat3.setColumn( temp, temp_top, 1 );
			mat3.setColumn( temp, temp_front, 2 );
			mat3.transpose( temp, temp );
			quat.fromMat3( this._rotation, temp );
			*/
		}
		quat.normalize( this._rotation, this._rotation );
		this._must_update = true;
	}
})();

/**
* Orients the transform so the axis points in that direction
* @method orientAxis
* @param {vec3} vector the vector to use as axis
* @param {number} axis a enum that could be LS.POSX, LS.POSY, LS.POSZ, LS.NEGX, LS.NEGY, LS.NEGZ
*/
Transform.prototype.orientAxis = (function() { 
	//avoid garbage
	var GM = mat4.create();
	var temp = mat3.create();
	//function
	return function( vector, axis )
	{
		switch(axis)
		{
			case LS.POSX: 
				mat3.setColumn( temp, vector, 0 ); //x
				mat3.setColumn( temp, LS.TOP, 1 ); //y
				mat3.setColumn( temp, LS.FRONT, 2 ); //z
				break;
			case LS.POSY:
				mat3.setColumn( temp, LS.RIGHT, 0 ); //x
				mat3.setColumn( temp, vector, 1 ); //y
				mat3.setColumn( temp, LS.FRONT, 2 ); //z
				break;
			case LS.POSZ:
				mat3.setColumn( temp, LS.RIGHT, 0 ); //x
				mat3.setColumn( temp, LS.TOP, 1 ); //y
				mat3.setColumn( temp, vector, 2 ); //z
				break;
			case LS.NEGX: 
				mat3.setColumn( temp, vector, 0 ); //x
				mat3.setColumn( temp, LS.BOTTOM, 1 ); //y
				mat3.setColumn( temp, LS.BACK, 2 ); //z
				break;
			case LS.NEGY:
				mat3.setColumn( temp, LS.LEFT, 0 ); //x
				mat3.setColumn( temp, vector, 1 ); //y
				mat3.setColumn( temp, LS.BACK, 2 ); //z
				break;
			case LS.NEGZ:
				mat3.setColumn( temp, LS.LEFT, 0 ); //x
				mat3.setColumn( temp, LS.BOTTOM, 1 ); //y
				mat3.setColumn( temp, vector, 2 ); //z
				break;
			default:
				return;
		}
		quat.fromMat3( this._rotation, temp );
		this._must_update = true;
	}
})();

//Events
Transform.prototype._on_change = function(only_events)
{
	if(!only_events)
		this._must_update = true;
	/**
	 * Fired when the node has changed its transform
	 *
	 * @event changed
	 */
	LEvent.trigger(this, "changed", this);
	if(this._root)
		LEvent.trigger(this._root, "transformChanged", this);
}

//Transform
/**
* returns the [0,0,-1] vector in global space
* @method getFront
* @return {vec3}
*/
Transform.prototype.getFront = function(out) {
	return vec3.transformQuat(out || vec3.create(), Transform.FRONT, this.getGlobalRotation() );
}

/**
* returns the [0,1,0] vector in global space
* @method getTop
* @return {vec3}
*/
Transform.prototype.getTop = function(out) {
	return vec3.transformQuat(out || vec3.create(), Transform.UP, this.getGlobalRotation() );
}

/**
* returns the [1,0,0] vector in global space
* @method getRight
* @return {vec3}
*/
Transform.prototype.getRight = function(out) {
	return vec3.transformQuat(out || vec3.create(), Transform.RIGHT, this.getGlobalRotation() );
}

/**
* Multiplies a point by the local matrix (not global)
* If no destination is specified a new vector is created
* @method transformPoint
* @param {vec3} point
* @param {vec3} destination (optional)
*/
Transform.prototype.transformPoint = function(vec, dest) {
	dest = dest || vec3.create();
	if( this._must_update )
		this.updateMatrix();
	return mat4.multiplyVec3( dest, this._local_matrix, vec );
}


/**
* convert from local coordinates to global coordinates
* If no destination is specified a new vector is created
* @method localToGlobal
* @param {vec3} point
* @param {vec3} destination (optional)
*/
Transform.prototype.localToGlobal = function(vec, dest) {
	dest = dest || vec3.create();
	if(this._must_update)
		this.updateMatrix();
	return mat4.multiplyVec3( dest, this.getGlobalMatrixRef(), vec );
}

/**
* same as localToGlobal
* @method transformPointGlobal
* @param {vec3} point
* @param {vec3} destination (optional)
*/
Transform.prototype.transformPointGlobal = Transform.prototype.localToGlobal;

/**
* convert from global coordinates to local coordinates
* @method globalToLocal
* @param {vec3} point
* @param {vec3} destination (optional)
* @return {vec3} the global coordinate in local coordinates
*/
Transform.prototype.globalToLocal = (function(){ 
	var inv = mat4.create();
	return function(vec, dest) {
		dest = dest || vec3.create();
		if(this._must_update)
			this.updateMatrix();
		if( !mat4.invert( inv, this.getGlobalMatrixRef() ) )
			return dest;
		return mat4.multiplyVec3( dest, inv, vec );
	};
})();

/**
* Applies the transformation to a vector (rotate but not translate)
* @method transformVector
* @param {vec3} vector
* @param {vec3} destination (optional)
*/
Transform.prototype.transformVector = function( vec, dest ) {
	return vec3.transformQuat( dest || vec3.create(), vec, this._rotation );
}

/**
* Applies the transformation to a vector (rotate but not translate)
* @method localVectorToGlobal
* @param {vec3} vector
* @param {vec3} destination (optional)
*/
Transform.prototype.localVectorToGlobal = function(vec, dest) {
	return vec3.transformQuat( dest || vec3.create(), vec, this.getGlobalRotation() );
}

Transform.prototype.transformVectorGlobal = Transform.prototype.localVectorToGlobal;

Transform.prototype.globalVectorToLocal = function(vec, dest) {
	var Q = this.getGlobalRotation();
	quat.invert(Q,Q);
	return vec3.transformQuat(dest || vec3.create(), vec, Q );
}

/**
* Apply a transform to this transform
* @method applyTransform
*/
Transform.prototype.applyTransform = function( transform, center, is_global )
{
	//is local

	//apply translation
	vec3.add( this._position, this._position, transform._position );

	//apply rotation
	quat.multiply( this._rotation, this._rotation, transform._rotation );

	//apply scale
	vec3.multiply( this._scaling, this._scaling, transform._scaling );

	this._must_update = true; //matrix must be redone?
}



/**
* Applies the transformation using a matrix
* @method applyTransformMatrix
* @param {mat4} matrix with the transform
* @param {vec3} center different pivot [optional] if omited 0,0,0 will be used
* @param {bool} is_global (optional) tells if the transformation should be applied in global space or local space
*/
Transform.prototype.applyTransformMatrix = (function(){ 
	var T = mat4.create();
	var inv_center = vec3.create();
	var iT = mat4.create();
	var M = mat4.create();
	var temp = mat4.create();
	
	return function(matrix, center, is_global)
	{
		var M = matrix;

		if(center)
		{
			mat4.setTranslation( T, center);
			vec3.scale( inv_center, center, -1 );
			mat4.setTranslation( iT, inv_center);

			mat4.multiply( M, T, matrix );
			mat4.multiply( M, M, iT );
		}


		if(!this._parent)
		{
			if(is_global)
			{
				this.applyLocalTransformMatrix( M );
				return;
			}

			//is local
			this.applyLocalTransformMatrix( M );
			return;
		}

		/*
		//convert transform to local coordinates
		var GM = this.getGlobalMatrix();
		var temp_mat = mat4.multiply( mat4.create(), M, GM );

		var PGM = this._parent._global_matrix;
		var inv_pgm = mat4.invert( mat4.create(), PGM );

		mat4.multiply(temp_mat, inv_pgm, temp_mat );
		this.applyLocalTransformMatrix( temp_mat );
		//*/

		//*
		var GM = this.getGlobalMatrix();
		var PGM = this._parent._global_matrix;
		mat4.multiply( this._global_matrix, M, GM );

		if(!mat4.invert( temp, PGM ))
			return;
		
		mat4.multiply( this._local_matrix, temp, this._global_matrix );
		this.fromMatrix( this._local_matrix );
		//*/
	};
})();

//applies matrix to position, rotation and scale individually, doesnt take into account parents
Transform.prototype.applyLocalTransformMatrix = (function() {
	var temp = vec3.create();
	var temp_mat3 = mat3.create();
	var temp_mat4 = mat4.create();
	var temp_quat = quat.create();

	return (function( M )
	{
		//apply translation
		vec3.transformMat4( this._position, this._position, M );

		//apply scale
		mat4.rotateVec3( temp, M, [1,0,0] );
		this._scaling[0] *= vec3.length( temp );
		mat4.rotateVec3( temp, M, [0,1,0] );
		this._scaling[1] *= vec3.length( temp );
		mat4.rotateVec3( temp, M, [0,0,1] );
		this._scaling[2] *= vec3.length( temp );

		//apply rotation
		var m = mat4.invert( temp_mat4, M );
		if(!m)
			return;

		mat4.transpose(m, m);
		var m3 = mat3.fromMat4( temp_mat3, m);
		var q = quat.fromMat3( temp_quat, m3);
		quat.normalize(q, q);
		quat.multiply( this._rotation, q, this._rotation );

		this._must_update = true; //matrix must be redone?
		this._on_change();
	});
})();


/*
Transform.prototype.applyTransformMatrix = function(matrix, center, is_global)
{
	var M = matrix;

	if(center)
	{
		var T = mat4.setTranslation( mat4.create(), center);
		var inv_center = vec3.scale( vec3.create(), center, -1 );
		var iT = mat4.setTranslation( mat4.create(), inv_center);

		M = mat4.create();
		mat4.multiply( M, T, matrix );
		mat4.multiply( M, M, iT );
	}

	if(!this._parent)
	{
		if(is_global)
			mat4.multiply(this._local_matrix, M, this._local_matrix);
		else
			mat4.multiply(this._local_matrix, this._local_matrix, M);
		this.fromMatrix(this._local_matrix);
		mat4.copy(this._global_matrix, this._local_matrix); //no parent? then is the global too
		return;
	}

	var GM = this.getGlobalMatrix();
	var PGM = this._parent._global_matrix;
	var temp = mat4.create();
	mat4.multiply( this._global_matrix, M, GM );

	mat4.invert(temp,PGM);
	mat4.multiply(this._local_matrix, temp, this._global_matrix );
	this.fromMatrix(this._local_matrix);
}
*/

//marks descendants to be updated
Transform.prototype.updateDescendants = function()
{
	if(!this._root)
		return;
	var children = this._root._children;
	if(!children)
		return;

	for(var i = 0; i < children.length; ++i)
	{
		var node = children[i];
		if(!node.transform) //bug: what if the children doesnt have a transform but the grandchilden does?! TODO FIX THIS
			continue;
		node.transform._must_update = true;
		node.transform._version += 1;
		if(node._children && node._children.length)
			node.transform.updateDescendants();
	}
}

///@INFO: UNCOMMON
function Collider(o)
{
	this.enabled = true;
	this.shape = 1;
	this.mesh = null;
	this.size = vec3.fromValues(0.5,0.5,0.5); //in local space?
	this.center = vec3.create(); //in local space?
	this.use_mesh_bounding = false;
	if(o)
		this.configure(o);
}

Collider.icon = "mini-icon-collider.png";

Collider.PLANE = LS.PhysicsInstance.PLANE;
Collider.BOX = LS.PhysicsInstance.BOX;
Collider.SPHERE = LS.PhysicsInstance.SPHERE;
Collider.MESH = LS.PhysicsInstance.MESH;

//vars
Collider["@size"] = { type: "vec3", step: 0.01 };
Collider["@center"] = { type: "vec3", step: 0.01 };
Collider["@mesh"] = { type: "mesh" };
Collider["@shape"] = { type:"enum", values: {"Plane":Collider.PLANE, "Box": Collider.BOX, "Sphere": Collider.SPHERE, "Mesh": Collider.MESH }};

//Collider["@adjustToNodeBounding"] = { type:"action" };

Collider.prototype.onAddedToScene = function(scene)
{
	LEvent.bind( scene, "collectPhysicInstances", this.onGetColliders, this);
}

Collider.prototype.onRemovedFromScene = function(scene)
{
	LEvent.unbind( scene, "collectPhysicInstances", this.onGetColliders, this);
}

Collider.prototype.getMesh = function() {
	if(typeof(this.mesh) === "string")
		return LS.ResourcesManager.meshes[this.mesh];
	return this.mesh;
}

Collider.prototype.getResources = function(res)
{
	if(!this.mesh) return;
	if(typeof(this.mesh) == "string")
		res[this.mesh] = Mesh;
	return res;
}

Collider.prototype.onResourceRenamed = function (old_name, new_name, resource)
{
	if(this.mesh == old_name)
		this.mesh = new_name;
}

/*
Collider.prototype.adjustToNodeBounding = function()
{
	var final_bounding = BBox.create();
	var components = this._root.getComponents();
	for(var i = 0: i < components.length; ++i)
	{
		var component = components[i];
		if(!component.getMesh)
			continue;
		var mesh = component.getMesh();
		if(!mesh)
			continue;
		var bounding = mesh.getBoundingBox();
		if(!bounding)
			return;
		//TODO: merge all the boundings
	}
}
*/

Collider.prototype.onGetColliders = function(e, colliders)
{
	if(!this.enabled)
		return;

	var PI = this._PI;
	if(!PI)
		this._PI = PI = new LS.PhysicsInstance(this._root, this);

	if(this._root.transform)
		PI.matrix.set( this._root.transform._global_matrix );

	PI.type = this.shape;
	PI.layers = this._root.layers;

	//get mesh
	var mesh = null;
	if(PI.type === LS.PhysicsInstance.MESH || this.use_mesh_bounding)
		mesh = this.getMesh();

	//spherical collider
	if(PI.type === LS.PhysicsInstance.SPHERE)
	{
		if(mesh)
			BBox.copy( PI.oobb, mesh.bounding );
		else
			BBox.setCenterHalfsize( PI.oobb, this.center, [this.size[0],this.size[0],this.size[0]]);
	}
	else if(PI.type === LS.PhysicsInstance.BOX)
	{
		if(mesh)
			BBox.copy( PI.oobb, mesh.bounding );
		else
			BBox.setCenterHalfsize( PI.oobb, this.center, this.size);
	}
	else if(PI.type === LS.PhysicsInstance.PLANE)
	{
		this.size[1] = 0.0001; //flatten
		BBox.setCenterHalfsize( PI.oobb, this.center, this.size );
	}

	if(mesh)
		vec3.copy( PI.center, BBox.getCenter( mesh.bounding ) );
	else
		vec3.copy( PI.center, this.center );

	//convert center from local to world space
	vec3.transformMat4( PI.center, PI.center, PI.matrix );

	if(PI.type === LS.PhysicsInstance.MESH)
	{
		if(!mesh)
			return;
		PI.setMesh(mesh);
	}

	colliders.push(PI);
}

///@INFO: UNCOMMON
/**
* Rotator rotate a mesh over time
* @class Rotator
* @namespace Components
* @constructor
* @param {String} object to configure from
*/

function Rotator(o)
{
	this.enabled = true;
	this.speed = 10;
	this.axis = [0,1,0];
	this.local_space = true;
	this.swing = false;
	this.swing_amplitude = 45;

	if(o)
		this.configure(o);
}

Rotator.icon = "mini-icon-rotator.png";

Rotator.prototype.onAddedToScene = function(scene)
{
	LEvent.bind(scene,"update",this.onUpdate,this);
}


Rotator.prototype.onRemovedFromScene = function(scene)
{
	LEvent.unbind(scene,"update",this.onUpdate,this);
}

Rotator.prototype.onUpdate = function(e,dt)
{
	if(!this._root || !this.enabled)
		return;

	var scene = this._root.scene;

	if(!this._default)
		this._default = this._root.transform.getRotation();

	vec3.normalize(this.axis,this.axis);

	if(this.swing)
	{
		var R = quat.setAxisAngle(quat.create(), this.axis, Math.sin( this.speed * scene._global_time * 2 * Math.PI) * this.swing_amplitude * DEG2RAD );
		quat.multiply( this._root.transform._rotation, R, this._default);
		this._root.transform._must_update = true;
	}
	else
	{
		if(this.local_space)
			this._root.transform.rotate(this.speed * dt,this.axis);
		else
			this._root.transform.rotateGlobal(this.speed * dt,this.axis);
	}

	if(scene)
		scene.requestFrame();
}