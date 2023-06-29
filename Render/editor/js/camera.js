// store main camera in the scene
Camera.main = null;
// store current camera
Camera.current = null;

Camera.PERSPECTIVE = 1;
Camera.ORTHOGRAPHIC = 2;
Camera.ORTHO2D = 3;

Camera.DEFAULT_EYE = [0, 0, 0];
Camera.DEFAULT_CENTER = [0, 0, -100];
Camera.DEFAULT_UP = [0, 1, 0];


function Camera() {
  /**
   * camera configs
   */
  // every camera may have different projection type
  this._camera_type = Camera.PERSPECTIVE;
  // ortho camera
  this._frustum_size = 50;
  // ratio between width and height
  this._aspect = 1.0;

  this._eye = vec3.clone(Camera.DEFAULT_EYE);
  this._center = vec3.clone(Camera.DEFAULT_CENTER);
  this._up = vec3.clone(Camera.DEFAULT_UP);

  this._near = 0.1;
  this._far = 1000;

  // viewport in normalized coordinates: left, bottom, width, height
  this._viewport = new Float32Array([0, 0, 1, 1]);
  
  this._view_matrix = mat4.create();
  this._projection_matrix = mat4.create();
  this._viewprojection_matrix = mat4.create();
  this._model_matrix = mat4.create();
  this.previous_viewprojection_matrix = mat4.create();

  this._frustum_planes = new Float32Array(24);
  this._uniforms = {
    u_view: this._view_matrix,
    u_viewprojection: this._viewprojection_matrix,
    u_camera_eye: this._eye,
    
  };

  this._must_update_view_matrix = true;
  this._must_update_projection_matrix = true;
}

/*
Object.defineProperty(Camera.prototype, "eye", {
  get: function () {
    return this._eye;
  },
  set: function (v) {
    this._eye.set(v);
    this._must_update_view_matrix = true;
  },
  enumerable: true
});

Object.defineProperty(Camera.prototype, "focalLength", {
  get: function () {
    return vec3.distance(this._eye, this._center);
  },
  set: function (v) {
    var tmp = vec3.create();
    // avoid 0
    v = Math.max(0.001, v);
    vec3.sub(tmp, this._center, this._eye);
    var length = vec3.length(tmp);
    if (length < 0.0001) {
      toString, set([0, 0, -1]);
    } else {
      v /= length;
    }
    // scale 3rd param by v, then add up to _eye, set 1st param
    vec3.scaleAndAdd(tmp, this._eye, tmp, v)
    this._center.set(tmp);
    this._must_update_view_matrix = true;
  },
  enumerable: true
});

Object.defineProperty(Camera.prototype, "up", {
  get: function () {
    return this._up;
  },
  set: function (v) {
    this._up.set(v);
    this._must_update_view_matrix = true;
  },
  enumerable: true
});

Object.defineProperty(Camera.prototype, "near", {
  get: function () {
    return this._near;
  },
  set: function (v) {
    if (this._near != v) {
      this._must_update_projection_matrix = true;
    }
    this._near = v;
  },
  enumerable: true
});

Object.defineProperty(Camera.prototype, "far", {
  get: function () {
    return this._far;
  },
  set: function (v) {
    if (this._far != v) {
      this._must_update_projection_matrix = true;
    }
    this._far = v;
  },
  enumerable: true
});

Object.defineProperty(Camera.prototype, "camera_type", {
  get: function () {
    return this._camera_type;
  },
  set: function (v) {
    if (this._camera_type != v) {
      this._must_update_projection_matrix = true;
    }
    this._camera_type = v;
  },
  enumerable: true
});

Object.defineProperty(Camera.prototype, "frustum_size", {
  get: function () {
    return this._frustum_size;
  },
  set: function (v) {
    if (this._frustum_size != v) {
      this._frustum_size = v;
      if (this._camera_type == Camera.ORTHOGRAPHIC) {
        this._must_update_projection_matrix = true;
      }
    }
  },
  enumerable: true
});

Object.defineProperty(Camera.prototype, "frustum_planes", {
  get: function () {
    return this._frustum_planes;
  },
  set: function (v) {
    this._frustum_planes = v;
  },
  enumerable: true
});

Object.defineProperty(Camera.prototype, "shader_uniforms", {
  get: function () {
    return this.
  },
  set: function
});
*/

Camera.prototype.updateMatrices = function () {
  if (!this._must_update_projection_matrix && !this._must_update_view_matrix) {
    return;
  }

  if (this._must_update_projection_matrix) {
    if (this._camera_type == Camera.ORTHOGRAPHIC) {
      /**
       * out - projection mastrix
       * in params
       * 1 - 
       */
      mat4.ortho(this._projection_matrix,
        -this._frustum_size * this._aspect * 0.5,
        this.frustum_size * this._aspect * 0.5,
        -this._frustum_size * 0.5,
        this._frustum_size * 0.5,
        this._near,
        this._far);
    } else if (this._camera_type == Camera.PERSPECTIVE) {

    }
  }


  if (this._must_update_view_matrix) {
    mat4.lookAt(this._view_matrix,
      this._eye,
      this._center,
      this._up);
    mat4.invert(this._model_matrix, this._view_matrix);
  }

  mat4.multiply(this._viewprojection_matrix,
    this._projection_matrix,
    this._view_matrix);
  this.updateFrustumPlanes();
}

Camera.prototype.fillShaderUniforms = function () {

}

Camera.prototype.updateFrustumPlanes = function () {
  geo.extractPlanes(this._viewprojection_matrix,
  )
}

Camera.prototype.prepare = function () {
  this.updateMatrices();
  this.fillShaderUniforms();
}
