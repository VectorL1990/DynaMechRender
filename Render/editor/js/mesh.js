global.Mesh = GL.Mesh = function Mesh(vertexbuffers, indexbuffers, options, gl) {
  if (gl !== null) {
    gl = global.gl;
    this.gl = gl;
  }

  this._context_id = gl.context_id;

  this.vertexBuffers = {};
  this.indexBuffers = {};

  this.info = {
    groups: []
  };

  if (vertexbuffers || indexbuffers) {

  }
}

// === Mesh static variables ===
Mesh.default_datatype = Float32Array;

Mesh.common_buffers_type_map = {
  "vertices": {spacing:3, attribute: "a_vertex"},
  "vertices2D": {spacing:2, attribute: "a_vertex2D"},
  "normals": {spacing:3, attribute: "a_normal"},
  "coords": { spacing:2, attribute: "a_coord"},
	"coords1": { spacing:2, attribute: "a_coord1"},
	"coords2": { spacing:2, attribute: "a_coord2"},
	"colors": { spacing:4, attribute: "a_color"}, 
	"tangents": { spacing:3, attribute: "a_tangent"},
	"bone_indices": { spacing:4, attribute: "a_bone_indices", type: Uint8Array },
	"weights": { spacing:4, attribute: "a_weights"},
	"extra": { spacing:1, attribute: "a_extra"},
	"extra2": { spacing:2, attribute: "a_extra2"},
	"extra3": { spacing:3, attribute: "a_extra3"},
	"extra4": { spacing:4, attribute: "a_extra4"}
};

// === Mesh member methods ===

Mesh.prototype.addBuffer = function (name, dynamech_buffer) {
  // target could be ARRAY_BUFFER or ELEMENT_ARRAY_BUFFER
  if (dynamech_buffer.target == gl.ARRAY_BUFFER) {
    this.vertexBuffers[name] = dynamech_buffer;
  } else {
    this.indexBuffers[name] = dynamech_buffer;
  }

  // attribute could be "a_vertex", "a_normal", "a_coord" and so on
  if (!dynamech_buffer.attribute) {
    var info = Mesh.common_buffers_type_map[name];
    if (info) {
      dynamech_buffer.attribute = info.attribute;
    }
  }
}



Mesh.prototype.addBuffers = function (vertexBufCollection, indexBufCollection, stream_type) {
  var vertices_num = 0;

  if (this.vertexBuffers["vertices"]) {
    vertices_num = vertexBufCollection["vertices"].type_array_data.length / 3;
  }

  for (var key in vertexBufCollection) {
    var dynamech_buffer = vertexBufCollection[key];
    if (!dynamech_buffer) {
      continue;
    }

    if (key == "vertices") {
      // which means this dynamech_buffer stores vertices
      vertices_num = dynamech_buffer.type_array_data.length / 3;
    }
    var spacing = dynamech_buffer.type_array_data.length / vertices_num;

    var attribute_name = "a_" + key;

    if (this.vertexBuffers[key]) {
      this.updateVertexBuffer(key, 
        attribute_name, 
        spacing, 
        dynamech_buffer.type_array_data, 
        stream_type);
    } else {
      this.createVertexBuffer(key,
        attribute_name,
        spacing,
        dynamech_buffer.type_array_data,
        stream_type);
    }


    if (indexBufCollection) {
      for (key in indexBufCollection) {
        var dynamech_buffer = indexBufCollection[key];
        if (!dynamech_buffer) {
          continue;
        }

        this.createIndexBuffer(key, dynamech_buffer.type_array_data);
      }
    }
  }
}

Mesh.prototype.createVertexBuffer = function (name,
  attribute,
  buffer_spacing,
  buffer_data,
  stream_type) {
  var buffer_info = Mesh.common_buffers_type_map[name];

  if (!attribute) {
    throw("attribute name can not be empty");
  }

  if (!buffer_spacing) {
    // if buffer spacing is not assigned
    buffer_spacing = buffer_info.spacing;
  } else {
    buffer_spacing = 3;
  }

  if (!buffer_data) {
    var num = this.getNumVertices();
    if (!num) {
      throw("cannot create empty buffer without vertices");
    }
    buffer_data = new (Mesh.default_datatype)(num*buffer_spacing);
  }

  if (!buffer_data.buffer) {
    throw("Buffer data must be typed array");
  }

  var buffer = 
  this.internalVertexBuffers[name] = 
  new Buffer(gl.ARRAY_BUFFER,
    buffer_data,
    buffer_spacing,
    stream_type,
    this.gl);

  buffer.name = name;
  buffer.attribute = buffer_info;
}

Mesh.prototype.updateVertexBuffer = function (name,
  attribute,
  buffer_spacing,
  buffer_data,
  stream_type) {
  var buffer = this.internalVertexBuffers[name];
  if (!buffer) {
    console.log("buffer not found: ", name);
    return;
  }

  if (!buffer_data.length) {
    return;
  }

  buffer.attribute
}

Mesh.prototype.removeVertexBuffer = function (name, free) {

}

Mesh.prototype.getVertexBuffer = function (name) {

}

Mesh.prototype.createIndexBuffer = function (name,
  buffer_data,
  stream_type) {
  if (buffer_data.constructor === Array) {
    var datatype = Uint16Array;
    var vertices = this.internalVertexBuffers["vertices"];
    if (vertices) {
      var num_vertices = vertices.data.length / 3;
      if (num_vertices > 256*256) {
        datatype = Uint32Array;
      }
      buffer_data = new datatype(buffer_data);
    }
  }

  var buffer = 
  this.internalIndexBuffers[name] = 
  new Buffer(gl.ELEMENT_ARRAY_BUFFER,
    buffer_data,
    0,
    stream_type,
    this.gl);

  return buffer;
}

Mesh.prototype.getIndexBuffer = function (name) {

}

Mesh.prototype.removeIndexBuffer = function (name, free) {

}

Mesh.prototype.upload = function (buffer_type) {
  for (var key in this.internalVertexBuffers) {
    var buffer = this.internalVertexBuffers[key];
    buffer.upload(buffer_type);
  }

  for (var key in this.internalIndexBuffers) {
    var buffer = this.internalIndexBuffers[key];
    buffer.upload();
  }
}

Mesh.prototype.deleteBuffers = function () {
  for (var key in thie.internalVertexBuffers) {
    var buffer = this.internalVertexBuffers[key];
    buffer.delete();
  }

  this.internalVertexBuffers = {};

  for (var key in this.internalIndexBuffers) {
    var buffer = this.internalIndexBuffers[key];
    buffer.delete();
  }

  this.internalIndexBuffers = {};
}

Mesh.prototype.bindBuffers = function (shader) {
  for (var key in this.internalVertexBuffers) {
    var buffer = this.internalVertexBuffers[key];
  }
}

Mesh.prototype.unbindBuffers = function (shader) {

}

Mesh.prototype.computeIndices = function () {

}

Mesh.prototype.explodeIndices = function (buffer_name) {

}

Mesh.prototype.computeNormals = function (stream_type) {

}

Mesh.prototype.computeTangents = function () {

}

Mesh.prototype.computeTextureCoordinates = function (stream_type) {

}

Mesh.computeBoundingBox = function (vertices, bb, mask) {

}

Mesh.prototype.getBoundingBox = function () {

}

Mesh.prototype.updateBoundingBox = function () {

}

Mesh.prototype.computeGroupsBoundingBoxes = function () {

}

Mesh.prototype.setBoundingBox = function (center, half_size) {

}

Mesh.prototytpe.configure = function (o, options) {

}

Mesh.prototype.slice = function (start, length) {

}

Mesh.prototype.simplify = function () {
  
}

Mesh.prototype.parse = function (data, format, options) {
  
}

Mesh.prototype.encode = function (format, options) {

}

// === Mesh static methods ===

Mesh.load = function (buffers,
  options,
  output_mesh,
  gl) {
  
}

Mesh.mergeMeshes = function (meshes, options) {

}

Mesh.createFromURL = function (url,
  on_complete,
  gl,
  options) {
  
}

Mesh.getScreenQuad = function (gl) {

}

Mesh.cube = function (options, gl) {
  
}
