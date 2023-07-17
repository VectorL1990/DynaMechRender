global.Mesh = GL.Mesh = function Mesh(in_vertexBuffers, in_indexBuffers, options, gl) {
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

  if (in_vertexBuffers || in_indexBuffers) {

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
    vertices_num = vertexBufCollection["vertices"].typed_array_data.length / 3;
  }

  for (var key in vertexBufCollection) {
    var dynamech_buffer = vertexBufCollection[key];
    if (!dynamech_buffer) {
      continue;
    }

    if (key == "vertices") {
      // which means this dynamech_buffer stores vertices
      vertices_num = dynamech_buffer.typed_array_data.length / 3;
    }
    var spacing = dynamech_buffer.typed_array_data.length / vertices_num;

    var attribute_name = "a_" + key;

    if (this.vertexBuffers[key]) {
      this.updateVertexBuffer(key, 
        attribute_name, 
        spacing, 
        dynamech_buffer.typed_array_data, 
        stream_type);
    } else {
      this.createVertexBuffer(key,
        attribute_name,
        spacing,
        dynamech_buffer.typed_array_data,
        stream_type);
    }


    if (indexBufCollection) {
      for (key in indexBufCollection) {
        var dynamech_buffer = indexBufCollection[key];
        if (!dynamech_buffer) {
          continue;
        }

        this.createIndexBuffer(key, dynamech_buffer.typed_array_data);
      }
    }
  }
}

Mesh.prototype.createVertexBuffer = function (name,
  attribute, // which could be vertices, normals, coords, tangents and so on
  buffer_spacing,
  typed_array_data,
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

  if (!typed_array_data) {
    var num = this.getNumVertices();
    if (!num) {
      throw("cannot create empty buffer without vertices");
    }
    typed_array_data = new (Mesh.default_datatype)(num*buffer_spacing);
  }

  if (!typed_array_data.buffer) {
    throw("Buffer data must be typed array");
  }

  var gl_buffer = 
  this.vertexBuffers[name] = 
  new Buffer(gl.ARRAY_BUFFER,
    typed_array_data,
    buffer_spacing,
    stream_type,
    this.gl);

  gl_buffer.name = name;
  gl_buffer.attribute = buffer_info;
  return gl_buffer;
}

Mesh.prototype.updateVertexBuffer = function (name,
  attribute,
  buffer_spacing,
  typed_array_data,
  stream_type) {
  var dynamech_buffer = this.vertexBuffers[name];
  if (!dynamech_buffer) {
    console.log("buffer not found: ", name);
    return;
  }

  if (!typed_array_data.length) {
    return;
  }

  dynamech_buffer.attribute = attribute;
  dynamech_buffer.spacing = buffer_spacing;
  dynamech_buffer.typed_array_data = typed_array_data;
  dynamech_buffer.upload(stream_type);
}

Mesh.prototype.removeVertexBuffer = function (attribute, free) {
  var dynamech_buffer = this.vertexBuffers[attribute];
  if (!dynamech_buffer) {
    return;
  }
  if (free) {
    dynamech_buffer.delete();
  }
  delete this.vertexBuffers[attribute];
}

Mesh.prototype.getVertexBuffer = function (attribute) {
  return this.vertexBuffers[attribute];
}

Mesh.prototype.createIndexBuffer = function (name,
  typed_array_data,
  stream_type) {

  var dynamech_buffer = 
  this.indexBuffers[name] = 
  new Buffer(gl.ELEMENT_ARRAY_BUFFER,
    typed_array_data,
    0,
    stream_type,
    this.gl);

  return dynamech_buffer;
}

Mesh.prototype.getIndexBuffer = function (name) {
  return this.indexBuffers[name];
}

Mesh.prototype.removeIndexBuffer = function (name, free) {
  var dynamech_buffer = this.indexBuffers[name];
  if (!dynamech_buffer) {
    return;
  }
  if (free) {
    dynamech_buffer.delete();
  }
  delete this.indexBuffers[name];
}

Mesh.prototype.upload = function (buffer_type) {
  for (var key in this.vertexBuffers) {
    var dynamech_buffer = this.vertexBuffers[key];
    dynamech_buffer.upload(buffer_type);
  }

  for (var key in this.indexBuffers) {
    var dynamech_buffer = this.indexBuffers[key];
    dynamech_buffer.upload();
  }
}

Mesh.prototype.deleteBuffers = function () {
  for (var key in this.vertexBuffers) {
    var dynamech_buffer = this.vertexBuffers[key];
    dynamech_buffer.delete();
  }

  this.vertexBuffers = {};

  for (var key in this.indexBuffers) {
    var dynamech_buffer = this.indexBuffers[key];
    dynamech_buffer.delete();
  }

  this.indexBuffers = {};
}

Mesh.prototype.bindBuffers = function (shader) {
  for (var key in this.vertexBuffers) {
    var dynamech_buffer = this.vertexBuffers[key];
    var attribute = dynamech_buffer.attribute;
    var location = shader.attributes[attribute];
    if (!dynamech_buffer.gl_buffer) {
      continue;
    }
    this.gl.bindBuffer(gl.ARRAY_BUFFER, dynamech_buffer.gl_buffer);
    this.gl.enableVertexAttribArray(location);
    this.gl.vertexAttribPointer(location,
      dynamech_buffer.gl_buffer.spacing,
      dynamech_buffer.gl_buffer.gl_type,
      false,
      0,
      0);
  }
}

Mesh.prototype.unbindBuffers = function (shader) {
  for (var key in this.vertexBuffers) {
    var dynamech_buffer = this.vertexBuffers[key];
    var attribute = dynamech_buffer.attribute;
    var location = shader.attributes[attribute];
    if (!dynamech_buffer.gl_buffer) {
      continue;
    }
    gl.disableVertexAttribArray(shader.attributes[attribute]);
  }
}

Mesh.prototype.computeIndices = function () {
  var new_vertices = [];

  var indexer = {};
  var origin_length = this.vertexBuffers["vertices"].typed_array_data.length / 3;
  for (var i = 0; i < origin_length; ++i) {
    // get specific vertice
    var vertice = origin_length.subarray(i * 3, (i + 1) * 3);
    // multiply 1000 to change it to integer
    var key = (vertice[0] * 1000) | 0;

    var j = 0;
    var candidates = []
    var candidate_length = 0;
    if (key in indexer) {
      candidates = indexer[key];
      // which means indexer contains key
      candidate_length = indexer[key].length;
      for (; j < candidate_length; j++) {
        var candidate_vertice = new_vertices[candidates[j]];
        if (vec3.sqrDist(vertice, candidate_vertice) < 0.01) {
          // which means we find a very closed vertice pair
          indices.push(j);
          break;
        }
      }
    }

    if (candidates && j != candidate_length) {
      continue;
    }

    var index = j;
    new_vertices.push[vertice];
    if (key in indexer) {
      indexer[key].push(vertex);
    } else {
      indexer[key] = [index];
    }

    if (origin_normals_data) {
      new_normals.push(origin_normals_data.subarray(i * 3, (i + 1) * 3));
    }
    if (origin_coords_data) {
      new_coords.push(origin_coords_data.subarray(i * 2, (i + 1) * 2));
    }
    indices.push(index);
  }
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
