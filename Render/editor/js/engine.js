
// global param is set at the end of immediate invoked function(IIF)
(function (global) {
  // setup animation frame which drives engine running
  global.requestAnimationFrame = global.requestAnimationFrame ||
                                 global.mozRequestAnimationFrame || 
                                 global.webkitRequestAnimationFrame || 
                                 function (callback) {
                                   setTimeout(callback, 1000 / 60);
                                  };

  // global Engine variable
  var Engine = global.Engine = {};
  // gl context, used to 
  Engine.gl = null;
  // request frame id
  Engine._requestFrame_id = null;
  // renderer, which used to trigger draw
  Engine.renderer = null;



  /**
   * 
   * @param {*} params 
   */
  Engine.init_engine = function (params) {
    console.log("Engine.init_engine params");
    console.log(params);

    this.gl = GL.create({
      version: params.webgl_version,
      width: params.width,
      height: params.height,
    });
    window.gl = this.gl;
    this.gl.canvas.width = params.width;
    this.gl.canvas.height = params.height;
    this.gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    this.gl.enable(gl.CULL_FACE);
    this.gl.enable(gl.DEPTH_TEST);

    if (this.gl == null) {
      throw ("gl is null, init engine failed");
    }
  }

  /**
   * 
   * @param {*} params 
   */
  Engine.start_loop = function (params) {
    console.log("Engine.start_loop params");
    console.log(params);
    // params contains gl context
    // if context is null, we should return fail
    if (params.Renderer == null) {
      throw ("renderer is null, init engine failed");
    }
    this.renderer = params.Renderer;
    if (this.gl == null) {
      throw ("gl is null, start engine loop failed");
    }
    var post = global.requestAnimationFrame;

    function loop() {
      if (Engine.gl.destroyed) {
        return;
      }
      Engine._requestFrame_id = global.requestAnimationFrame(loop);

      // trigger draw function
      Engine.renderer.render();
    }

    this._requestFrame_id = post(loop);
  }

}) (typeof (window) != "undefined" ? window : (typeof (self) != "undefined" ? self : global));





