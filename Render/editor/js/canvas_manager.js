
var CanvasManager = {

  /**
   * 
   * @param {*} params 
   */
  init: function (params) {
    console.log("canvasmanager.init params is: ");
    console.log(params);
    this.widgets = [];
    this.container_width = 500;
    this.container_height = 500;
    var container_name = "body";
    var container = document.querySelector(container_name);
    console.log("gl is: ");
    console.log(params.gl);
    container.appendChild(params.gl.canvas);
  },
}

CORE.registerModule(CanvasManager);

