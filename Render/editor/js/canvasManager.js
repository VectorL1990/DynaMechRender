

/**
 * Constructor
 * @param {*} container 
 * @param {*} options 
 */
function CanvasManager(options)
{
  this.widgets = [];

  this.init(options);
}

CanvasManager.prototype.init = function (options) {
  console.log("canvasManager init");
  var container = document.querySelector("body");

  var antialiasing = true;
  var webgl_version = 1;
  if (options.webgl_version) {
    webgl_version = options.webgl_version;
  }
  gl = GL.create({
    version: webgl_version,
    antialiasing: antialiasing,
    alpha: false,
    stencil: true,
    premultipliedAlpha: false,
    width: 640,
    height: 480,
  });

  gl.canvas.width = options.width;
  gl.canvas.height = options.height;

  gl.ondraw = this.ondraw.bind(this);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  container.appendChild(gl.canvas);
  this.canvas = gl.canvas;
  this.gl = gl;
  gl.animate();
}

CanvasManager.prototype.initBuffers = function () {
  // Create a buffer for the square's positions.

  const positionBuffer = gl.createBuffer();

  // Select the positionBuffer as the one to apply buffer
  // operations to from here out.

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Now create an array of positions for the square.

  const positions = [
    1.0,  1.0,
    -1.0,  1.0,
    1.0, -1.0,
    -1.0, -1.0,
  ];

  // Now pass the list of positions into WebGL to build the
  // shape. We do this by creating a Float32Array from the
  // JavaScript array, then use it to fill the current buffer.

  gl.bufferData(gl.ARRAY_BUFFER,
                new Float32Array(positions),
                gl.STATIC_DRAW);

  return {position: positionBuffer,};
}

CanvasManager.prototype.loadShader = function (type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object

  gl.shaderSource(shader, source);

  // Compile the shader program

  gl.compileShader(shader);

  // See if it compiled successfully

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

CanvasManager.prototype.initShaderProgram = function (vsSource, fsSource) {
  const vertexShader = this.loadShader(gl.VERTEX_SHADER, vsSource);
  const fragmentShader = this.loadShader(gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

CanvasManager.prototype.drawScene = function(programInfo, buffers) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

  // Clear the canvas before we start drawing on it.

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Create a perspective matrix, a special matrix that is
  // used to simulate the distortion of perspective in a camera.
  // Our field of view is 45 degrees, with a width/height
  // ratio that matches the display size of the canvas
  // and we only want to see objects between 0.1 units
  // and 100 units away from the camera.

  const fieldOfView = 45 * Math.PI / 180;   // in radians
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();

  // note: glmatrix.js always has the first argument
  // as the destination to receive the result.
  mat4.perspective(projectionMatrix,
                  fieldOfView,
                  aspect,
                  zNear,
                  zFar);

  // Set the drawing position to the "identity" point, which is
  // the center of the scene.
  const modelViewMatrix = mat4.create();

  // Now move the drawing position a bit to where we want to
  // start drawing the square.

  mat4.translate(modelViewMatrix,     // destination matrix
                modelViewMatrix,     // matrix to translate
                [-0.0, 0.0, -6.0]);  // amount to translate

  // Tell WebGL how to pull out the positions from the position
  // buffer into the vertexPosition attribute.
  {
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
        programInfo.attribLocations.vertexPosition);
  }

  // Tell WebGL to use our program when drawing

  gl.useProgram(programInfo.program);

  // Set the shader uniforms

  gl.uniformMatrix4fv(
      programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix);
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.modelViewMatrix,
      false,
      modelViewMatrix);

  {
    const offset = 0;
    const vertexCount = 4;
    gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
  }
}

CanvasManager.prototype.ondraw = function ()
{
  const vsSource = `
    attribute vec4 aVertexPosition;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    void main() {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    }
  `;

  // Fragment shader program

  const fsSource = `
    void main() {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
  `;

  // Initialize a shader program; this is where all the lighting
  // for the vertices and so forth is established.
  const shaderProgram = this.initShaderProgram(vsSource, fsSource);

  // Collect all the info needed to use the shader program.
  // Look up which attribute our shader program is using
  // for aVertexPosition and look up uniform locations.
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
    },
  };

  // Here's where we call the routine that builds all the
  // objects we'll be drawing.
  const buffers = this.initBuffers();

  // Draw the scene
  this.drawScene(programInfo, buffers);
}

CanvasManager.prototype.testinit = function (options)
{
  console.log("canvasManager init!!!");
  var container = options.container || "body";
  if (container.constructor === String) {
    container = document.querySelector(container);
  }

  var antialiasing = true;
  
  var webgl_version = 1;
  if (options.webgl_version) {
    webgl_version = options.webgl_version;
  }

  try
  {
    window.gl = GL.create({
      version: webgl_version,
      antialiasing: antialiasing,
      alpha: false,
      stencil: true,
      premultipliedAlpha: false,
      width: "100%",
      height: "100%",
    });
  }
  catch (err)
  {
    console.error(err);
    console.error("webgl not supported");
    return false;
  }

  gl.canvas.width = options.width;
  gl.canvas.height = options.height;

  gl.ondraw = this.ondraw.bind(this);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  container.appendChild(gl.canvas);
  this.canvas = gl.canvas;
  this.gl = gl;
  gl.animate();
  
}

CanvasManager.prototype.addWidget = function (widget, priority)
{
  widget.canvas_priority = priority;
  this.widgets.push(widget);
  this.widgets.sort(
    function(a,b)
    {
      return a.canvas_priority - b.canvas_priority;
    }
  );
}

CanvasManager.prototype.testondraw = function ()
{
  for (var i = 0; i < this.widgets.length; ++i)
  {
    if (this.widgets[i].render)
    {
      if (this.widgets[i].render(gl, this.must_update) == true)
      {
        break;
      }
    }
  }
  this.must_update = false;
}
