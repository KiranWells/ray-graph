/**
 * A collection of  utilities
 */

/**
 * A set of utilities to help with using WebGL
 * @class
 */
class WebGlUtils {
  _canvas;
  gl;
  /**
   * Creates a new utility object that uses a given canvas
   * @param {HTMLCanvasElement} canvasElement - the canvas to get context from
   */
  constructor(canvasElement) {
    //basic boilerplate for webgl code
    this._canvas = canvasElement;
    this.gl = this._canvas.getContext("webgl2", {preservedrawingbuffer:true});
  }

  /**
   * Sets the canvas to the specified width.
   * If arguments are omitted, the window size is used
   * @param {number} [width] - the width to set
   * @param {number} [height] - the height to set
   */
  resizeCanvas(width, height) {
    width = width || document.body.parentNode.clientWidth;
    height = height || document.body.parentNode.clientHeight;
    this._canvas.width = width;
    this._canvas.height = height;
  };

  /**
   * Creates a new WebGL shader program and compiles it from code.
   * @param {string} vertexCode - the code to use in the vertex shader
   * @param {string} fragmentCode - the code to use in the fragment shader
   * @returns {WebGLProgram} A reference to the compiled program
   */
  createShader(vertexCode, fragmentCode) {
    var vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(vertexShader, vertexCode);
    this.gl.compileShader(vertexShader);
    var success = this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS);
    if (!success) {
      console.log(this.gl.getShaderInfoLog(vertexShader));
      this.gl.deleteShader(vertexShader);
    }
    var fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(fragmentShader, fragmentCode);
    this.gl.compileShader(fragmentShader);

    var success = this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS);
    if (!success) {
      console.log(this.gl.getShaderInfoLog(fragmentShader));
      this.gl.deleteShader(fragmentShader);
    }
    var shader = this.gl.createProgram();
    this.gl.attachShader(shader, vertexShader);
    this.gl.attachShader(shader, fragmentShader);
    this.gl.linkProgram(shader);

    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    return shader;
  };

  /**
   * Creates a new WebGL data buffer and assigns it the given data.
   * @param {number} type - the type of WebGL buffer - array or element array
   * @param {Array} bufferData - the data to assign to the buffer
   * @returns {WebGLBuffer} A reference to the new buffer
   */
  createBuffer(type, bufferData) {
    var glData = null;
    if (type === this.gl.ARRAY_BUFFER) {
      glData = new Float32Array(bufferData);
    }
    if (type === this.gl.ELEMENT_ARRAY_BUFFER) {
      glData = new Uint16Array(bufferData);
    }

    var buffer = this.gl.createBuffer();
    this.gl.bindBuffer(type, buffer);
    this.gl.bufferData(type, glData, this.gl.STATIC_DRAW);
    this.gl.bindBuffer(type, null);
    return buffer;
  };

  /**
   * Creates a new WebGL frame buffer from a texture
   * @param {WebGLTexture} texture - the texture to assign to the framebuffer
   * @param {number} [attachment] - the number of texture attachment to use
   * @returns {WebGLFramebuffer} A reference to the new buffer
   */
  createFrameBuffer(texture, attachment) {
    if (attachment === null || attachment === undefined) {
      attachment = this.gl.COLOR_ATTACHMENT0;
    }
    var fb = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, attachment, this.gl.TEXTURE_2D, texture, 0);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    return fb;
  };

  /**
   * Creates a new WebGL texImage2D and assigns it the given data
   * @param {number} [format=gl.RGBA] - the image format to use
   * @param {number} width - the width of the image
   * @param {number} height - the height of the image
   * @param {ArrayBufferView} [data=null] - the data to insert in the imaage
   * @returns {WebGLTexture} A reference to the texture
   */
  createTexture(format, width, height, data) {
    if (format === null || format === undefined)
      format = this.gl.RGBA;
    if (width === null || width === undefined)
      width = 1;
    if (height === null || height === undefined)
      height = 1;
    if (data === undefined)
      data = null;

    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      format,
      width,
      height,
      0,
      format,
      this.gl.UNSIGNED_BYTE,
      data
    );

    //check for power of 2
    if (!(width & (width - 1 == 0) && height & (width - 1 == 0))) {
      //not power of 2
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    }

    return texture;
  };

  /**
   * Creates a new WebGL texImage2D from an image url
   * @param {string} url - the image format to use
   * @param {number} [format=gl.RGBA] - the image format to use
   * @param {number} [wrap_s=gl.REPEAT] - the wrap to use in the s direction
   * @param {number} [wrap_t=gl.REPEAT] - the wrap to use in the t direction
   * @param {number} [minFilter=gl.LINEAR] - the filter to use for downsizing
   * @param {number} [maxFilter=gl.LINEAR] - the filter to use for upsizing
   * @returns {WebGLTexture} A reference to the texture
   */
  loadTexture(
    url,
    format,
    wrap_s,
    wrap_t,
    minFilter,
    maxFilter
  ) {
    if (format === null || format === undefined)
      format = this.gl.RGBA;
    if (wrap_s === null || wrap_s === undefined)
      wrap_s = this.gl.REPEAT;
    if (wrap_t === null || wrap_t === undefined)
      wrap_t = this.gl.REPEAT;
    if (minFilter === null || minFilter === undefined)
      minFilter = this.gl.LINEAR;
    if (maxFilter === null || maxFilter === undefined)
      maxFilter = this.gl.LINEAR;
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    // bright pink for contrast(if no texture is found)
    var tempPixel = new Uint8Array([200, 100, 255, 255]);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      format,
      1,
      1,
      0,
      format,
      this.gl.UNSIGNED_BYTE,
      tempPixel
    );

    //load the image
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = function() {
      //document.body.appendChild(image);
      this._gl.bindTexture(this._gl.TEXTURE_2D, texture);
      this._gl.texImage2D(this._gl.TEXTURE_2D, 0, format, format, this._gl.UNSIGNED_BYTE, image);

      //check for power of 2
      if (image.width & (image.width - 1 == 0) &&
        image.height & (image.width - 1 == 0)) {
        //it is power of 2
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, wrap_s);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, wrap_t);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, minFilter);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAX_FILTER, maxFilter);
        this._gl.generateMipmaps(this._gl.TEXTURE_2D);
      } else {
        //not power of 2
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
        //this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAX_FILTER, maxFilter);
      }
    };
    image.src = url;

    return texture;
  }
}

/**
 * A wrapper class to handle creating a pseudo-compute shader
 * using WebGL. It takes code and uniforms and draws to a given buffer
 * for you.
 * @class
 */
class ComputeShader {
  _originalCode = "";
  _code = "";
  _program;
  // the basic code for the vertex shader
  // renders all vertices directly at z = 0.5
  _vertexShaderCode =
    "#version 300 es\nin vec2 v;void main(){gl_Position=vec4(v,.5,1.);}";
  _triangleData = [];
  _uniforms = {};
  _textures = [];
  _canvas;
  _defines = {};
  buffer;
  gl;
  width = null;
  height = null;
  loaded = false;
  _onerror = (message) => {console.log(message)};

  _time = 0;

  /**
   * Creates a new Compute Shader
   * @constructor
   * @param {HTMLCanvasElement} canvas - the canvas to use
   * @param {string} fragmentCode - the code to run
   * @param {WebGLFramebuffer} [buffer=null] - the framebuffer to draw to. If ommitted, draws to the canvas
   */
  constructor(canvas, fragmentCode, buffer) {
    if (canvas) {
      this._canvas = canvas;
      this.gl = canvas.getContext("webgl2");
    }
    if (fragmentCode) {
      this._code = fragmentCode;
      this._compile();
    }
    if (buffer) {
      this.buffer = buffer;
    }
  }

  /**
   * the code to run in the fragment shader
   * @param {string} fragmentCode
   * @property
   */
  set code(fragmentCode) {
    this._originalCode = fragmentCode;
    this._compile();
  }

  /**
   * the canvas to be rendered with
   * @param {HTMLCanvasElement} canvasEl
   * @property
   */
  set canvas(canvasEl) {
    this._canvas = canvasEl;
    this.gl = canvasEl.getContext("webgl2");
  }

  /**
   * a function which is called when compilation fails
   * @param {Function} onerror
   * @property
   */
  set onerror(onerror) {
    if (typeof(onerror) !== "function")
      onerror = (message) => {console.log(message)};
    this._onerror = onerror;
  }

  /**
   * the preprocessor macros which will be defined in the shader
   * @param {Any} object - a key-value set of defines (null is treated as no value)
   * @property
   */
  set defines(object) {
    this._defines = {};
    if (object == undefined || object == null) return;
    for (let key in object) {
      if (object[key] !== undefined && object[key] !== null)
        this._defines[key] = object[key];
      else
        this._defines[key] = "";
    }
    this._compile();
  }

  /**
   * Passes the uniforms to the program
   * @param {any} uniformsObject - an object where the keys represent names of the uniform 
   *   and the values the data to set that uniform to
   */
  pass(uniformsObject) {
    for (let name in uniformsObject) {
      if (!this._uniforms[name]) {
        // generate a new uniform object by finding a type and setting name
        let type = this._getType(name);
        this._uniforms[name] = {
          location: this.gl.getUniformLocation(this._program, name),
          type: type,
          value: uniformsObject[name],
          hasChanged: true,
        };
      } else {
        // modify the existing object
        this._uniforms[name].value = uniformsObject[name];
        this._uniforms[name].hasChanged = true;
      }
    }
  }

  /**
   * Binds a texture to the given uniform
   * @param {string} name - the name of the uniform to set; should be declared in the shader code
   * @param {WebGLTexture} texture - the texture to attach
   */
  bindTexture(name, texture) {
    let type = this._getType(name);
    if (type != "sampler2D") {
      type = type == "" ? "not a uniform in the code": type;
      console.error(`${name} is not a 2D texture. It is ${type}. (ComputeShader:passTexture)`);
    }
    let tex = {
      value: texture,
      location: this.gl.getUniformLocation(this._program, name),
      hasChanged: true
    }
    for (let i = 0; i < this._textures.length; i++) {
      let t = this._textures[i];
      if (t.location == tex.location) {
        // this was previously bound
        // remove the old texture
        this._textures.splice(i, 1);
        i--;
      }
    }
    this._textures.push(tex);
  }

  /**
   * executes the code and puts the result in the framebuffer
   * @param {any} [uniformsObject] - the uniforms to update (see pass for details)
   */
  execute(uniformsObject) {
    if (uniformsObject) {
      this.pass(uniformsObject);
    }
    var width = this.width, height = this.height;
    if (!width) {
      width = this.gl.drawingBufferWidth;
    }
    if (!height) {
      height = this.gl.drawingBufferHeight;
    }
    this.pass({
      u_resolution: [width, height],
      u_time: this._time++
    });

    for (let name in this._uniforms) {
      let uniform = this._uniforms[name];
      if (uniform.hasChanged) {
        this._passUniform(uniform);
      }
    }

    for (let unit in this._textures) {
      let texture = this._textures[unit];
      if (texture.hasChanged) {
        this._passTexture(Number(unit), texture);
      }
    }
    //set the framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.buffer);

    //clear the canvas
    this.gl.clearColor(1.0, 0.0, 1.0, 1.0);
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.clearDepth(1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    //draw the image
    this.gl.viewport(0, 0, this._canvas.width, this._canvas.height);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    //unbind the framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  /**
   * Prepares the code for compilation, adding preprocessor definitions
   * @private
   */
  _precompile() {
    if (this._originalCode.length === 0) return;
    if (this._defines.length !== 0) {
      // insert the defines after the #version directive
      let definesStr = "";
      for (let key in this._defines) {
        let val = this._defines[key];
        definesStr += `#define ${key} ${val}\n`;
      }
      let versionIndex = this._originalCode.indexOf("#version");
      if (versionIndex === -1) {
        // insert at the beginning
        this._code = definesStr + this._originalCode;
      } else {
        // get the location after index of the first newline after version
        let afterVersion = this._originalCode.substr(versionIndex).indexOf("\n") + versionIndex + 1;
        this._code = this._originalCode.substr(0, afterVersion) + "\n" + definesStr + this._originalCode.substr(afterVersion);
      }
    } else {
      this._code = this._originalCode;
    }
  }

  /**
   * Compiles the code and sets the program for rendering
   * @returns {any} Whether the compilation has succeeded
   * @private
   */
  _compile() {
    // prepare the code for compilation
    this._precompile();

    if (!this.gl || !this._code) {
      // can't compile, exit
      return;
    }

    // create the gl shader sections
    // vertex
    var vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(vertexShader, this._vertexShaderCode);
    this.gl.compileShader(vertexShader);
    var success = this.gl.getShaderParameter(
      vertexShader,
      this.gl.COMPILE_STATUS
    );
    if (!success) {
      console.warn(this.gl.getShaderInfoLog(vertexShader));
      this.gl.deleteShader(vertexShader);
      let lines = this._vertexShaderCode.split("\n");
      let text = "";
      for (let i in lines) {
        text += `${i}: ${lines[i]}\n`
      }
      this._onerror("Error in vertex shader:\n\n" + text);
      return success;
    }

    // fragment
    var fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(fragmentShader, this._code);
    this.gl.compileShader(fragmentShader);

    success = this.gl.getShaderParameter(
      fragmentShader,
      this.gl.COMPILE_STATUS
    );
    if (!success) {
      console.warn(this.gl.getShaderInfoLog(fragmentShader));
      this.gl.deleteShader(fragmentShader);
      let lines = this._code.split("\n");
      let text = "";
      for (let i in lines) {
        text += `${i}: ${lines[i]}\n`
      }
      this._onerror("Error in fragment shader:\n\n" + text);
      return success;
    }
    this._program = this.gl.createProgram();
    this.gl.attachShader(this._program, vertexShader);
    this.gl.attachShader(this._program, fragmentShader);
    this.gl.linkProgram(this._program);

    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    // create buffers and data
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    // uses a default square spanning the entire screen
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([1, 1, -1, -1, -1, 1, 1, -1, 1, 1, -1, -1]),
      this.gl.STATIC_DRAW
    );
    // pass the basic triangle data to the shader
    const cornerLocation = this.gl.getAttribLocation(this._program, "v");

    this.gl.vertexAttribPointer(cornerLocation, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(cornerLocation);

    this.gl.useProgram(this._program);

    if (success) {
      this.loaded = true;
      // clear out all uniforms, the program has changed
      this._uniforms = {};
    }
    return success;
  }

  /**
   * Sets a specific uniform
   * @param {any} uniform - an object with a name, value, type, and location
   * @private
   */
  _passUniform(uniform) {
    if (uniform.location == -1) {
      return;
    }
    this.gl.useProgram(this._program);
    let val;
    switch (uniform.type) {
      case "float":
        val = uniform.value;
        if (!Array.isArray(uniform.value)) {
          val = [uniform.value];
        }
        this.gl.uniform1fv(uniform.location, val);
        break;

      case "vec2":
        this.gl.uniform2fv(uniform.location, uniform.value);
        break;

      case "vec3":
        this.gl.uniform3fv(uniform.location, uniform.value);
        break;

      case "vec4":
        this.gl.uniform4fv(uniform.location, uniform.value);
        break;

      case "int":
        val = uniform.value;
        if (!Array.isArray(uniform.value)) {
          val = [uniform.value];
        }
        this.gl.uniform1iv(uniform.location, val);
        break;

      case "ivec2":
        this.gl.uniform2iv(uniform.location, uniform.value);
        break;

      case "ivec3":
        this.gl.uniform3iv(uniform.location, uniform.value);
        break;

      case "ivec4":
        this.gl.uniform4iv(uniform.location, uniform.value);
        break;

      default:
        console.error(
          `Type: ${uniform.type} not supported. Value: ${uniform.value} (ComputeShader.execute)`
        );
    }
  }

  /**
   * Sets a specific texture
   * @param {number} unit - the unit to bind to
   * @param {any} texture - the texture to bind in
   * @private
   */
  _passTexture(unit, texture) {
    if (texture.location == -1) {
      return;
    }
    this.gl.uniform1i(texture.location, unit);
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture.value);
  }

  /**
   * Finds and returns the type of a named uniform
   * @param {string} name - the name of the uniform
   * @private
   */
  _getType(name) {
    let type = "";
    let index = this._code.search(new RegExp("\\b" + name + "\\b")) - 1;
    if (index == -2) {
      return "";
    }
    while (!this._code[index].match(/[a-zA-Z0-9_\[\]]/)) {
      index--;
    }
    while (this._code[index].match(/[a-zA-Z0-9_\[\]]/)) {
      if (this._code[index] == "]") {
        while (!this._code[index].match(/\[/)) {
          index--;
        }
        index--;
      }
      type = this._code[index] + type;
      index--;
    }
    return type;
  }
}
