var RenderModule = {

  _tab_name: "Scene",
  _camera: null,
  shaders_url: "",

  init: function ()
  {
    console.log("render module init!");

    this.tab = LiteGUI.main_tabs.addTabContent(this._tab_name, {
      id: "visortab",
      size: "full"
    });
    this.tab.content.style.overflow = "hidden";

    var visorarea = this.visorarea = new LiteGUI.Area({
      id: "visorarea",
      height: "100%",
      autoresize: true,
      immediateResize: true
    });
    visorarea.split("vertical", [null, 260], true);
    visorarea.getSection(0).content.innerHTML = "<div id='visor'><div id='maincanvas'></div><div id='statusbar'><span class='msg'></span></div></div>";
    
    this.tab.add(visorarea);
    //document.body.appendChild(visorarea);

    var canvas_container = document.getElementById("maincanvas");
    this.canvas_manager = new CanvasManager({
      webgl_version: 1,
      container: canvas_container,
      full: true,
      antialiasing: true
    });
    this.canvas_manager.addWidget(this, -10);

    // combine LS.Renderer.init into this function

  },

  vertexShaderSource : '' +
    'attribute vec4 apos;' +
    'void main(){' +
    'float radian = radians(30.0);' +
    'float cos = cos(radian);' +
    'float sin = sin(radian);' +
    'mat4 mx = mat4(1,0,0,0,  0,cos,-sin,0,  0,sin,cos,0,  0,0,0,1);'+
    'mat4 my = mat4(cos,0,-sin,0,  0,1,0,0,  sin,0,cos,0,  0,0,0,1);'+
    '   gl_Position = mx*my*apos;' +
    '}',
  fragShaderSource : '' +
    'void main(){' +
    '   gl_FragColor = vec4(1.0,0.0,0.0,1.0);' +
    '}',

  initshader: function()
  {
    var vs = gl.createShader(gl.VERTEX_SHADER);
    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(vs, this.vertexShaderSource);
    gl.shaderSource(fs, this.fragShaderSource);
    gl.compileShader(vs);
    gl.compileShader(fs);
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);
    return program;
  },

  render: function (context, force_render)
  {
    //console.log("run render!!");
    var program = this.initshader();
    var aposLocation = gl.getAttribLocation(program, 'apos');
    var data = new Float32Array([
      0.5, 0.5, 0.5,
      -0.5, 0.5, 0.5,
      -0.5, -0.5, 0.5,
      0.5, -0.5, 0.5,

      0.5, 0.5, -0.5,
      -0.5, 0.5, -0.5,
      -0.5, -0.5, -0.5,
      0.5, -0.5, -0.5,

      0.5, 0.5, 0.5,
      0.5, 0.5, -0.5,

      -0.5, 0.5, 0.5,
      -0.5, 0.5, -0.5,

      -0.5, -0.5, 0.5,
      -0.5, -0.5, -0.5,

      0.5, -0.5, 0.5,
      0.5, -0.5, -0.5,
    ]);

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.vertexAttribPointer(aposLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aposLocation);

    gl.drawArrays(gl.LINE_LOOP, 0, 4);
    gl.drawArrays(gl.LINE_LOOP, 4, 4);
    gl.drawArrays(gl.LINES, 8, 8);
  }
}

CORE.registerModule(RenderModule);
