GL.Buffer = function Buffer(target, data, spacing, stream_type, gl) {
  if (gl == null) {
    throw ("gl is null, create buffer failed");
  }

  this.gl = gl;
  this.buffer = null;
  this.target = target;
  this.attribute = null;
  // data is a js array(type), which contains an element "buffer"
  // which differs from "buffer" stored in gpu
  this.data = data;
  this.spacing = spacing || 3;
  if (this.data && this.gl) {
    this.upload(stream_type);
  }
}

Buffer.prototype.upload = function (stream_type) {
  if (!gl) {
    throw ("gl is null, buffer upload failed");
  }
  if (!this.data) {
    throw ("upload data is empty, upload failed");
  }
  if (!data.buffer) {
    throw ("which means data is not array type, upload failed");
  }
  this.buffer = gl.createBuffer();
  this.buffer.lenth = this.data.length;
  this.buffer.spacing = this.spacing;
  switch (data.constructor) {
    case Int8Array:
      this.buffer.gl_type = gl.BYTE;
      break;
    default:
      throw ("unsupported buffer type");
  }

  if (this.target == gl.ARRAY_BUFFER && (this.buffer.gl_type == gl.INT || this.buffer.gl_type == gl.UNSIGNED_INT)) {
    this.buffer.gl_type = gl.FLOAT;
    data = new Float32Array(data);
  }

  gl.bindBuffer(this.target, this.buffer);
  gl.bufferData(this.target, data, stream_type);
}