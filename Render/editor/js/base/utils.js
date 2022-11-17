///@INFO: UNCOMMON
/**
* Picking is used to detect which element is below one pixel (using the GPU) or using raycast
*
* @class Picking
* @namespace LS
* @constructor
*/
var Picking = {

	picking_color_offset: 10, //color difference between picking objects
	_picking_points: [], //used during picking fetching
	_picking_nodes: null, //created before picking

	//picking
	_pickingMap: null,
	_picking_color: new Uint8Array(4),
	_picking_depth: 0,
	_picking_next_color_id: 0,
	_picking_render_settings: new RenderSettings(),
	_picking_position: vec3.create(), //last picking position in world coordinates
	_use_scissor_test: true,

	/**
	* Renders the pixel and retrieves the color to detect which object it was, slow but accurate
	* @method getNodeAtCanvasPosition
	* @param {number} x in canvas coordinates
	* @param {number} y in canvas coordinates
	* @param {Camera} camera default is all cameras
	* @param {number} layers default is 0xFFFF which is all
	* @param {Scene} scene default is GlobalScene
	*/
	getNodeAtCanvasPosition: function( x, y, camera, layers, scene )
	{
		var instance = this.getInstanceAtCanvasPosition( x, y, camera, layers, scene );
		if(!instance)
			return null;

		if(instance.constructor == LS.SceneNode)
			return instance;

		if(instance._root && instance._root.constructor == LS.SceneNode)
			return instance._root;

		if(instance.node)
			return instance.node;

		return null;
	},

	/**
	* Returns the instance under a screen position
	* @method getInstanceAtCanvasPosition
	* @param {number} x in canvas coordinates (0,0 is bottom-left)
	* @param {number} y in canvas coordinates
	* @param {Camera} camera
	* @param {number} layers default is 0xFFFF which is all
	* @param {Scene} scene
	* @return {Object} the info supplied by the picker (usually a SceneNode)
	*/
	getInstanceAtCanvasPosition: function( x, y, camera, layers, scene )
	{
		scene = scene || LS.GlobalScene;

		if(!camera)
			camera = LS.Renderer.getCameraAtPosition( x, y, scene._cameras );

		if(!camera)
			return null;

		this._picking_nodes = {};

		//render all Render Instances
		this.getPickingColorFromBuffer( scene, camera, x, y, layers );
		this._picking_color[3] = 0; //remove alpha, because alpha is always 255
		var id = new Uint32Array(this._picking_color.buffer)[0]; //get only element

		var instance_info = this._picking_nodes[id];
		this._picking_nodes = {};
		return instance_info;
	},	

	/**
	* Returns a color you should use to paint this node during picking rendering
	* you tell what info you want to retrieve associated with this object if it is clicked
	* @method getNextPickingColor
	* @param {*} info
	* @return {vec3} array containing all the RenderInstances that collided with the ray
	*/
	getNextPickingColor: function( info )
	{
		this._picking_next_color_id += this.picking_color_offset;
		var pick_color = new Uint32Array(1); //store four bytes number
		pick_color[0] = this._picking_next_color_id; //with the picking color for this object
		var byte_pick_color = new Uint8Array( pick_color.buffer ); //read is as bytes
		//byte_pick_color[3] = 255; //Set the alpha to 1

		if(!this._picking_nodes) //not necessary but used for debug
			this._picking_nodes = {};
		this._picking_nodes[ this._picking_next_color_id ] = info;
		return vec4.fromValues( byte_pick_color[0] / 255, byte_pick_color[1] / 255, byte_pick_color[2] / 255, 1 );
	},

	//x,y must be in canvas coordinates (0,0 is bottom-left)
	getPickingColorFromBuffer: function( scene, camera, x, y, layers )
	{
		//create texture
		if(this._pickingMap == null || this._pickingMap.width != gl.canvas.width || this._pickingMap.height != gl.canvas.height )
		{
			this._pickingMap = new GL.Texture( gl.canvas.width, gl.canvas.height, { format: gl.RGBA, filter: gl.NEAREST });
			this._pickingFBO = new GL.FBO([this._pickingMap]);
			//LS.ResourcesManager.textures[":picking"] = this._pickingMap; //debug the texture
		}

		var small_area = this._use_scissor_test;
		LS.Renderer._current_target = this._pickingMap;

		this._pickingFBO.bind();

			//var viewport = camera.getLocalViewport();
			//camera._real_aspect = viewport[2] / viewport[3];
			//gl.viewport( viewport[0], viewport[1], viewport[2], viewport[3] );

			if(small_area)
			{
				gl.scissor(x-1,y-1,2,2);
				gl.enable(gl.SCISSOR_TEST);
			}

			this.renderPickingBuffer( scene, camera, layers, [x,y] );

			gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE, this._picking_color );

			var depth = (this._picking_color[3] / 255);
			var linear_depth = camera.near * (depth + 1.0) / (camera.far + camera.near - depth * (camera.far - camera.near));
			this._last_depth = linear_depth * (camera.far - camera.near) + camera.near;
			this._picking_position = camera.unproject([x,y,depth],null,this._picking_position);
			//console.log(this._picking_color,this._last_depth);

			if(small_area)
				gl.disable(gl.SCISSOR_TEST);

		this._pickingFBO.unbind();

		LS.Renderer._current_target = null; //??? deprecated

		//if(!this._picking_color) this._picking_color = new Uint8Array(4); //debug
		return this._picking_color;
	},

	//pos must be in canvas coordinates (0,0 is bottom-left)
	renderPickingBuffer: function( scene, camera, layers, pos )
	{
		if(layers === undefined)
			layers = 0xFFFF;
		var picking_render_settings = this._picking_render_settings;

		LS.Renderer.enableCamera( camera, this._picking_render_settings );

		gl.clearColor(0,0,0,0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		this._picking_next_color_id = 0;
		LS.Renderer.setRenderPass( PICKING_PASS );
		picking_render_settings.layers = layers;

		//check instances colliding with cursor using a ray against AABBs
		var instances = null;
		if( pos ) //not tested yet
		{
			var ray = camera.getRay( pos[0], pos[1] );
			var instances_collisions = LS.Physics.raycastRenderInstances( ray.origin, ray.direction, { add_instances_without_aabb: true } );
			if( instances_collisions )
			{
				instances = Array( instances_collisions.length );
				for(var i = 0; i < instances_collisions.length; ++i)
					instances[i] = instances_collisions[i].instance;
			}
			//console.log("Instances ray collided:", instances_collisions.length);
		}
		else
			instances = scene._instances;

		LS.Renderer.renderInstances( picking_render_settings, instances );

		//Nodes
		/* done in EditorView
		var ray = null;
		if(mouse_pos)
		{
			ray = camera.getRayInPixel( pos[0], pos[1] );
			ray.end = vec3.add( vec3.create(), ray.origin, vec3.scale(vec3.create(), ray.direction, 10000 ) );
		}

		for(var i = 0, l = scene._nodes.length; i < l; ++i)
		{
			var node = scene._nodes[i];
			if(!node.visible)
				continue;

			//nodes with special pickings?
			if(node.renderPicking)
				node.renderPicking(ray);

			if( node.transform )
			{
				var pos = vec3.create();
				mat4.multiplyVec3(pos, node.transform.getGlobalMatrixRef(), pos); //create a new one to store them
			}

			for(var j in node._components)
			{
				var component = node._components[j];
				if(component.renderPicking)
					component.renderPicking(ray);
			}
		}
		*/

		LEvent.trigger( scene, "renderPicking", pos );
		LEvent.trigger( LS.Renderer, "renderPicking", pos );

		LS.Renderer.setRenderPass( COLOR_PASS );
	},

	addPickingPoint: function( position, size, info )
	{
		size = size || 5.0;
		var color = LS.Picking.getNextPickingColor( info );
		this._picking_points.push([ position,color,size]);
	},

	renderPickingPoints: function()
	{
		//render all the picking points 
		if(this._picking_points.length)
		{
			var points = new Float32Array( this._picking_points.length * 3 );
			var colors = new Float32Array( this._picking_points.length * 4 );
			var sizes = new Float32Array( this._picking_points.length );
			for(var i = 0; i < this._picking_points.length; i++)
			{
				points.set( this._picking_points[i][0], i*3 );
				colors.set( this._picking_points[i][1], i*4 );
				sizes[i] = this._picking_points[i][2];
			}
			LS.Draw.setPointSize(1);
			LS.Draw.setColor([1,1,1,1]);
			gl.disable( gl.DEPTH_TEST ); //because nodes are show over meshes
			LS.Draw.renderPointsWithSize( points, colors, sizes );
			gl.enable( gl.DEPTH_TEST );
			this._picking_points.length = 0;
		}
	},

	visualize: function(v)
	{
		//to visualize picking buffer
		LS.Renderer.setRenderPass( v ? LS.PICKING_PASS : LS.COLOR_PASS );
		LS.GlobalScene.requestFrame();
	}
};


///@INFO: UNCOMMON
function Cloner(o)
{
	this.enabled = true;

	this.mode = Cloner.GRID_MODE;

	this.createProperty( "count", vec3.fromValues(10,1,1) );
	this.createProperty( "size", vec3.fromValues(100,100,100) );

	this.mesh = null;
	this.lod_mesh = null;
	this.material = null;

	this._instances_matrix = [];

	this._RI = new LS.RenderInstance( null, this );

	if(o)
		this.configure(o);
}

Cloner.GRID_MODE = 1;
Cloner.RADIAL_MODE = 2;
Cloner.MESH_MODE = 3;
Cloner.CHILDREN_MODE = 4;
Cloner.CUSTOM_MODE = 5;

Cloner.icon = "mini-icon-cloner.png";

//vars
Cloner["@mesh"] = { type: "mesh" };
Cloner["@lod_mesh"] = { type: "mesh" };
Cloner["@mode"] = { type:"enum", values: { "Grid": Cloner.GRID_MODE, "Radial": Cloner.RADIAL_MODE, /* "Mesh": Cloner.MESH_MODE ,*/ "Children": Cloner.CHILDREN_MODE, "Custom": Cloner.CUSTOM_MODE } };
Cloner["@count"] = { type:"vec3", min:1, step:1, precision: 0 };

Cloner.prototype.onAddedToScene = function(scene)
{
	LEvent.bind(scene, "collectRenderInstances", this.onCollectInstances, this);
	//LEvent.bind(scene, "afterCollectData", this.onUpdateInstances, this);
}

Cloner.prototype.onRemovedFromScene = function(scene)
{
	LEvent.unbind(scene, "collectRenderInstances", this.onCollectInstances, this);
	//LEvent.unbind(scene, "afterCollectData", this.onUpdateInstances, this);
}

Cloner.prototype.getMesh = function() {
	if( this.mesh && this.mesh.constructor === String )
		return LS.ResourcesManager.meshes[ this.mesh ];
	return this.mesh;
}

Cloner.prototype.getLODMesh = function() {
	if( this.lod_mesh && this.lod_mesh.constructor === String )
		return LS.ResourcesManager.meshes[this.lod_mesh];
	return this.lod_mesh;
}

Cloner.prototype.getAnyMesh = function() {
	return (this.getMesh() || this.getLODMesh());
}

Cloner.prototype.getResources = function(res)
{
	if( this.mesh && this.mesh.constructor === String )
		res[this.mesh] = Mesh;
	if( this.lod_mesh && this.lod_mesh.constructor === String )
		res[this.lod_mesh] = Mesh;
	return res;
}

Cloner.prototype.onResourceRenamed = function( old_name, new_name, resource )
{
	if( this.mesh == old_name )
		this.mesh = new_name;

	if( this.lod_mesh == old_name )
		this.lod_mesh = new_name;
}

Cloner.prototype.onCollectInstances = function(e, instances)
{
	if(!this.enabled)
		return;

	var mesh = this.getAnyMesh();
	if(!mesh)
		return null;

	var node = this._root;
	if(!this._root)
		return;

	var RI = this._RI;
	var is_static = this._root.flags && this._root.flags.is_static;
	var transform = this._root.transform;
	RI.layers = node.layers;

	RI.fromNode( this._root, true );
	RI.setMatrix( LS.IDENTITY, LS.IDENTITY ); //RI matrix is ignored in instanced rendering

	//material (after flags because it modifies the flags)
	var material = null;
	if(this.material)
		material = LS.ResourcesManager.getResource( this.material );
	else
		material = this._root.getMaterial();
	RI.setMaterial( material );

	//buffers from mesh and bounding
	RI.setMesh( mesh, this.primitive );
	RI.use_bounding = false; //TODO: use the bounding

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

	RI.collision_mesh = mesh;

	//compute the matrices for every instance
	this.computeInstancesMatrix(RI);

	//no instances?
	if(this._instances_matrix.length == 0)
		return;

	instances.push( RI );
}

Cloner.prototype.computeInstancesMatrix = function( RI )
{
	var global = this._root.transform.getGlobalMatrixRef();
	RI.instanced_models = this._instances_matrix;

	var countx = this._count[0]|0;
	var county = this._count[1]|0;
	var countz = this._count[2]|0;

	var node = this._root;
	var hsize = vec3.create();
	var offset = vec3.create();
	var tmp = vec3.create();
	var zero = vec3.create();
	RI.picking_node = null; //?

	//Set position according to the cloner mode
	if(this.mode == Cloner.GRID_MODE)
	{
		var total = countx * county * countz;
		this._instances_matrix.length = total;
		if( total == 0 )
			return;

		//compute offsets
		vec3.scale( hsize, this.size, 0.5 );
		if( countx > 1) offset[0] = this.size[0] / ( countx - 1);
		else hsize[0] = 0;
		if( county > 1) offset[1] = this.size[1] / ( county - 1);
		else hsize[1] = 0;
		if( countz > 1) offset[2] = this.size[2] / ( countz - 1);
		else hsize[2] = 0;

		var i = 0;

		for(var x = 0; x < countx; ++x)
		for(var y = 0; y < county; ++y)
		for(var z = 0; z < countz; ++z)
		{
			var model = this._instances_matrix[i];
			if(!model)
				model = this._instances_matrix[i] = mat4.create();
			tmp[0] = x * offset[0] - hsize[0];
			tmp[1] = y * offset[1] - hsize[1];
			tmp[2] = z * offset[2] - hsize[2];
			mat4.translate( model, global, tmp );
			++i;
		}
	}
	else if(this.mode == Cloner.RADIAL_MODE)
	{
		var total = countx;
		this._instances_matrix.length = total;
		if( total == 0 )
			return;
		var offset = Math.PI * 2 / total;

		for(var i = 0; i < total; ++i)
		{
			var model = this._instances_matrix[i];
			if(!model)
				model = this._instances_matrix[i] = mat4.create();
			tmp[0] = Math.sin( offset * i ) * this.size[0];
			tmp[1] = 0;
			tmp[2] = Math.cos( offset * i ) * this.size[0];
			model.set( global );
			mat4.translate( model, model, tmp );
			mat4.rotateY( model,model, offset * i );
		}
	}
	else if(this.mode == Cloner.CHILDREN_MODE)
	{
		if(!this._root || !this._root._children)
		{
			this._instances_matrix.length = 0;
			return;
		}

		var total = this._root._children.length;
		this._instances_matrix.length = total;
		if( total == 0 )
			return;

		for(var i = 0; i < total; ++i)
		{
			var model = this._instances_matrix[i];
			if(!model)
				model = this._instances_matrix[i] = mat4.create();
			var childnode = this._root._children[i];
			if(!childnode)
				continue;
			if( childnode.transform )
				childnode.transform.getGlobalMatrix( model );
		}
	}
	else if( this.mode == Cloner.CUSTOM_MODE )
	{
		//nothing, should be done by a script modifying this._instances_matrix
	}
}

Cloner.prototype.setInstancesMatrices = function(a)
{
	this._instances_matrix = a;
}

/*
Cloner.prototype.onCollectInstances = function(e, instances)
{
	if(!this.enabled)
		return;

	var mesh = this.getMesh();
	if(!mesh) 
		return null;

	var node = this._root;
	if(!this._root)
		return;

	this.updateRenderInstancesArray();

	var RIs = this._RIs;
	var material = this.material || this._root.getMaterial();
	var flags = 0;

	if(!RIs)
		return;

	//resize the instances array to fit the new RIs (avoids using push)
	var start_array_pos = instances.length;
	instances.length = start_array_pos + RIs.length;

	//update parameters
	for(var i = 0, l = RIs.length; i < l; ++i)
	{
		var RI = RIs[i];

		RI.setMesh(mesh);
		RI.layers = node.layers;
		RI.setMaterial( material );
		instances[ start_array_pos + i ] = RI;
	}
}

Cloner.prototype.updateRenderInstancesArray = function()
{
	var total = 0;
	if(this.mode === Cloner.GRID_MODE)
		total = (this.count[0]|0) * (this.count[1]|0) * (this.count[2]|0);
	else if(this.mode === Cloner.RADIAL_MODE)
		total = this.count[0]|0;
	else if(this.mode === Cloner.MESH_MODE)
	{
		total = 0; //TODO
	}
	else if(this.mode === Cloner.CHILDREN_MODE)
	{
		if(this._root && this._root._children)
			total = this._root._children.length;
	}

	if(!total) 
	{
		if(this._RIs)
			this._RIs.length = 0;
		return;
	}

	if(!this._RIs || this._RIs.length != total)
	{
		//create RIs
		if(!this._RIs)
			this._RIs = new Array(total);
		else
			this._RIs.length = total;

		for(var i = 0; i < total; ++i)
			if(!this._RIs[i])
				this._RIs[i] = new LS.RenderInstance(this._root, this);
	}
}

Cloner.prototype.onUpdateInstances = function(e, dt)
{
	if(!this.enabled)
		return;

	var RIs = this._RIs;
	if(!RIs || !RIs.length)
		return;

	var global = this._root.transform.getGlobalMatrix(mat4.create());

	var countx = this._count[0]|0;
	var county = this._count[1]|0;
	var countz = this._count[2]|0;

	var node = this._root;

	//Set position according to the cloner mode
	if(this.mode == Cloner.GRID_MODE)
	{
		//compute offsets
		var hsize = vec3.scale( vec3.create(), this.size, 0.5 );
		var offset = vec3.create();
		if( countx > 1) offset[0] = this.size[0] / ( countx - 1);
		else hsize[0] = 0;
		if( county > 1) offset[1] = this.size[1] / ( county - 1);
		else hsize[1] = 0;
		if( countz > 1) offset[2] = this.size[2] / ( countz - 1);
		else hsize[2] = 0;

		var i = 0;
		var tmp = vec3.create(), zero = vec3.create();
		for(var x = 0; x < countx; ++x)
		for(var y = 0; y < county; ++y)
		for(var z = 0; z < countz; ++z)
		{
			var RI = RIs[i];
			if(!RI)
				return;
			tmp[0] = x * offset[0] - hsize[0];
			tmp[1] = y * offset[1] - hsize[1];
			tmp[2] = z * offset[2] - hsize[2];
			mat4.translate( RI.matrix, global, tmp );
			RI.setMatrix( RI.matrix ); //force normal matrix generation
			mat4.multiplyVec3( RI.center, RI.matrix, zero );
			++i;
			RI.picking_node = null;
		}
	}
	else if(this.mode == Cloner.RADIAL_MODE)
	{
		var offset = Math.PI * 2 / RIs.length;
		var tmp = vec3.create(), zero = vec3.create();
		for(var i = 0, l = RIs.length; i < l; ++i)
		{
			var RI = RIs[i];
			if(!RI)
				return;

			tmp[0] = Math.sin( offset * i ) * this.size[0];
			tmp[1] = 0;
			tmp[2] = Math.cos( offset * i ) * this.size[0];
			RI.matrix.set( global );
			mat4.translate( RI.matrix, RI.matrix, tmp );
			mat4.rotateY( RI.matrix,RI.matrix, offset * i );
			RI.setMatrix( RI.matrix ); //force normal matrix generation
			mat4.multiplyVec3( RI.center, RI.matrix, zero );
			RI.picking_node = null;
		}
	}
	else if(this.mode == Cloner.CHILDREN_MODE)
	{
		if(!this._root || !this._root._children)
			return;

		for(var i = 0, l = RIs.length; i < l; ++i)
		{
			var RI = RIs[i];
			if(!RI)
				return;
			var childnode = this._root._children[i];
			if(!childnode)
				continue;
			if( childnode.transform )
				childnode.transform.getGlobalMatrix( global );
			RI.setMatrix( global );
			RI.picking_node = childnode;
		}
	}
}
*/


/**
* Allows to easily test interaction between the user and the scene, attach the InteractiveController to the root and the mouse down,move and up events will
* be processed using a raycast and trigger events.
* @namespace LS
* @class InteractiveController
* @constructor
* @param {Object} last serialized data [optional]
*/
function InteractiveController(o)
{
	this.enabled = true;
	this.mode = InteractiveController.PICKING;
	this.layers = 3;

	this._last_collision = null;

	if(o)
		this.configure(o);
}

InteractiveController.icon = "mini-icon-cursor.png";

InteractiveController.PICKING = 1;
InteractiveController.BOUNDING = 2;
InteractiveController.COLLIDERS = 3;
InteractiveController.RENDER_INSTANCES = 4;

InteractiveController["@mode"] = { type: "enum", values: { "Picking": InteractiveController.PICKING, "Bounding": InteractiveController.BOUNDING, "Colliders": InteractiveController.COLLIDERS }};
InteractiveController["@layers"] = { type: "layers" };

InteractiveController.prototype.onAddedToScene = function(scene)
{
	LEvent.bind( scene, "mousedown", this._onMouse, this );
	LEvent.bind( scene, "mousemove", this._onMouse, this );
	LEvent.bind( scene, "mouseup", this._onMouse, this );
}

InteractiveController.prototype.onRemovedFromScene = function(scene)
{
	LEvent.unbindAll( scene, this );
}

InteractiveController.prototype.getNodeUnderMouse = function( e )
{
	var layers = this.layers;

	if(this.mode == InteractiveController.PICKING)
		return LS.Picking.getNodeAtCanvasPosition( e.canvasx, e.canvasy, null, layers );

	var camera = LS.Renderer.getCameraAtPosition( e.canvasx, e.canvasy );
	if(!camera)
		return null;
	var ray = camera.getRay( e.canvasx, e.canvasy );

	if(this.mode == InteractiveController.BOUNDING)
	{
		var collisions = LS.Physics.raycastRenderInstances( ray.origin, ray.direction, { layers: layers } );
		if(!collisions || !collisions.length)
			return null;
		this._last_collision = collisions[0];
		return collisions[0].node;
	}

	if(this.mode == InteractiveController.RENDER_INSTANCES)
	{
		var collisions = LS.Physics.raycastRenderInstances( ray.origin, ray.direction, { layers: layers, triangle_collision: true } );
		if(!collisions || !collisions.length)
			return null;
		this._last_collision = collisions[0];
		return collisions[0].node;
	}

	if(this.mode == InteractiveController.COLLIDERS)
	{
		var collisions = LS.Physics.raycast( ray.origin, ray.direction, { layers: layers } );
		if(!collisions || !collisions.length)
			return null;
		this._last_collision = collisions[0];
		return collisions[0].node;
	}

	return null;

}

InteractiveController.prototype._onMouse = function(type, e)
{
	if(!this.enabled)
		return;

	//Intereactive: check which node was clicked (this is a mode that helps clicking stuff)
	if(e.eventType == "mousedown" || e.eventType == "mousewheel" )
	{
		var node = this.getNodeUnderMouse(e);
		this._clicked_node = node;
		if(this._clicked_node && e.eventType == "mousedown" && e.button == 0 )
		{
			console.log("Node clicked: " + this._clicked_node.name );
			LEvent.trigger( this._clicked_node, "clicked", this._clicked_node ); //event in node clicked
			LEvent.trigger( this._root, "node_clicked", this._clicked_node ); //event in this node
			LEvent.trigger( this._root.scene, "node_clicked", this._clicked_node ); //event in scene
			if(this.onNodeClicked) //extra method, if you inject a new method in this component
				this.onNodeClicked( this._clicked_node );
		}
	}

	var levent = null; //levent dispatched

	//send event to clicked node
	if(this._clicked_node) // && this._clicked_node.flags.interactive)
	{
		e.scene_node = this._clicked_node;
		levent = LEvent.trigger( this._clicked_node, e.eventType, e );
	}

	if(e.eventType == "mouseup")
		this._clicked_node = null;

	if(this._clicked_node)
		return true;
}


