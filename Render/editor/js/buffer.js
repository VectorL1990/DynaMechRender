GL.Buffer = function Buffer(target, data, spacing, stream_type, gl) {
  if (gl == null) {
    throw ("gl is null, create buffer failed");
  }

  this.gl = gl;
  // in order to differ from variable "buffer" contained in typedArray
  // rename this variable as glbuffer
  this.gl_buffer = null;

  // it could be GL.ARRAY_BUFFER, GL.ELEMENT_ARRAY_BUFFER
  this.target = target;

  // attribute in shader, it could be
  // "a_vertex", "a_normal", "a_coord"
  this.attribute = null;

  // data is a js array(type), which contains an element "buffer"
  // differed from "buffer" stored in gpu
  this.typed_array_data = data;
  this.spacing = spacing || 3;
  if (this.typed_array_data && this.gl) {
    this.upload(stream_type);
  }
}

// === Buffer member methods ===

Buffer.prototype.bind = function (location, gl) {
  gl.bindBuffer(gl.ARRAY_BUFFER, this.gl_buffer);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, this.spacing, this.gl_buffer.gl_type, false, 0, 0);
}

Buffer.prototype.unbind = function (location, gl) {
  this.gl.disableVertexAttribArray(location);
}

Buffer.prototype.upload = function (stream_type) {
  if (!gl) {
    throw ("gl is null, buffer upload failed");
  }
  if (!this.typed_array_data) {
    throw ("upload data is empty, upload failed");
  }
  if (!this.typed_array_data.buffer) {
    throw ("which means data is not array type, upload failed");
  }
  this.gl_buffer = gl.createBuffer();
  this.gl_buffer.lenth = this.typed_array_data.length;
  this.gl_buffer.spacing = this.spacing;
  switch (this.typed_array_data.constructor) {
    case Int8Array:
      this.gl_buffer.gl_type = gl.BYTE;
      break;
    case Uint8ClampedArray:
    case Uint8Array:
      this.gl_buffer.gl_type = gl.UNSIGNED_BYTE;
      break;
    case Int16Array:
      this.gl_buffer.gl_type = gl.SHORT;
      break;
    case Uint16Array:
      this.gl_buffer.gl_type = gl.UNSIGNED_SHORT;
      break;
    case Int32Array:
      this.gl_buffer.gl_type = gl.INT;
      break;
    case Uint32Array:
      this.gl_buffer.gl_type = gl.UNSIGNED_INT;
      break;
    case Float32Array:
      this.gl_buffer.gl_type = gl.FLOAT;
      break;
    default:
      throw ("unsupported buffer type");
  }

  if (this.target == gl.ARRAY_BUFFER && 
    (this.gl_buffer.gl_type == gl.INT || this.gl_buffer.gl_type == gl.UNSIGNED_INT)) {
    console.log("webgl doesn't support int32 as vertex buffer, convert to float")
    this.gl_buffer.gl_type = gl.FLOAT;
    this.typed_array_data = new Float32Array(this.typed_array_data);
  }

  gl.bindBuffer(this.target, this.gl_buffer);
  gl.bufferData(this.target, this.typed_array_data, stream_type);
}

Buffer.prototype.setData = function (in_data, offset) {
  if (!in_data.buffer) {
    throw("in data must be typed array");
  }
  offset = offset || 0;
  if (!this.typed_array_data) {
    this.typed_array_data = in_data;
    this.upload();
    return;
  } else if (this.typed_array_data.length < in_data.length) {
    throw("buffer is not long enough");
  }

  if (this.typed_array_data.length == in_data.length) {
    this.typed_array_data.set(in_data);
    this.upload();
    return;
  }

  var new_data_array = new Uint8Array(in_data.buffer, in_data.buffer.byteOffset, in_data.buffer.byteLength);
  var origin_data_array = new Uint8Array(this.typed_array_data.buffer);
  origin_data_array.set(new_data_array, offset);
  this.uploadRange(offset, new_data_array.length);
}

Buffer.prototype.uploadRange = function (start, size) {
  if (!this.typed_array_data) {
    throw("typed_array_data is empty");
  }
  if (!this.typed_array_data.buffer) {
    throw("buffer stored in type array is empty");
  }
  var partial_data = new Uint8Array(this.typed_array_data.buffer, start, size);
  this.gl.bindBuffer(this.target, this.gl_buffer);
  this.gl.bufferSubData(this.target, start, partial_data);
}

Buffer.prototype.clone = function () {
  var buffer = new Buffer();
  for (var key in this) {
    buffer[key] = this[key];
  }
  return buffer;
}

Buffer.prototype.delete = function() {
  this.gl.deleteBuffer(this.gl_buffer);
  this.gl_buffer = null;
}
