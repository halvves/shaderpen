const debounce = require("lodash/debounce");

function remap(value, low1, high1, low2, high2) {
    return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}

export default class ShaderPen {
  constructor(shaderString, noRender, options) {
    // shadertoy differences
    const ioTest = /\(\s*out\s+vec4\s+(\S+)\s*,\s*in\s+vec2\s+(\S+)\s*\)/;
    const io = shaderString.match(ioTest);
    shaderString = shaderString.replace('mainImage', 'main');
    shaderString = shaderString.replace(ioTest, '()');

    // shadertoy built in uniforms
    const uniforms = this.uniforms = {
      iResolution: {
        type: 'vec3',
        value: [window.innerWidth, window.innerHeight, 0],
      },
      iTime: {
        type: 'float',
        value: 0,
      },
      iTimeDelta: {
        type: 'float',
        value: 0,
      },
      iFrame: {
        type: 'int',
        value: 0,
      },
      iMouse: {
        type: 'vec4',
        value: [0, 0, 0, 0],
      },
    };
    
    this.options = options;
    this.debouncedLogMIDIState = debounce(this.logMIDIState, 1000);
    this.setupMIDIBindings();

    // create default string values
    shaderString = (io ? `#define ${io[1]} gl_FragColor\n#define ${io[2]} gl_FragCoord.xy\n` : '') + shaderString;
    shaderString = Object.keys(uniforms)
      .map((key) => ({
      name: key,
      type: uniforms[key].type,
    }))
      .reduce((a, uniform) => (
      a + `uniform ${uniform.type} ${uniform.name};\n`
    ), '') + shaderString;
    shaderString = 'precision highp float;\n' + shaderString;

    // create, position, and add canvas
    const canvas = this.canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = 'fixed';
    canvas.style.left = 0;
    canvas.style.top = 0;
    document.body.append(canvas);

    // get webgl context and set clearColor
    const gl = this.gl = canvas.getContext('webgl');
    gl.clearColor(0, 0, 0, 0);

    // compile basic vertex shader to make rect fill screen
    const vertexShader = this.vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, `
      attribute vec2 position;
      void main() {
      gl_Position = vec4(position, 0.0, 1.0);
      }
    `);
    gl.compileShader(vertexShader);

    // compile fragment shader from string passed in
    const fragmentShader = this.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, shaderString);
    gl.compileShader(fragmentShader);

    // make program from shaders
    const program = this.program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // vertices for basic rectangle to fill screen
    const vertices = this.vertices = new Float32Array([
      -1, 1, 1, 1, 1, -1,
      -1, 1, 1, -1, -1, -1,
    ]);

    const buffer = this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.useProgram(program);

    program.position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(program.position);
    gl.vertexAttribPointer(program.position, 2, gl.FLOAT, false, 0, 0);

    // get all uniform locations from shaders
    Object.keys(uniforms).forEach((key, i) => {
      uniforms[key].location = gl.getUniformLocation(program, key);
    });

    // report webgl errors
    this.reportErrors();

    // bind contexts
    this._bind(
      'mouseDown',
      'mouseMove',
      'mouseUp',
      'render',
      'resize', 
      'setupMIDIBindings',
      'onMIDIMessage',
      'logMIDIState'
    );

    // add event listeners
    window.addEventListener('mousedown', this.mouseDown);
    window.addEventListener('mousemove', this.mouseMove);
    window.addEventListener('mouseup', this.mouseUp);
    window.addEventListener('resize', this.resize);

    // auto render unless otherwise specified
    if (noRender !== 'NO_RENDER') {
      this.render();
    }
  }

  _bind(...methods) {
    methods.forEach((method) => this[method] = this[method].bind(this));
  }

  mouseDown(e) {
    this.mousedown = true;
    this.uniforms.iMouse.value[2] = e.clientX;
    this.uniforms.iMouse.value[3] = e.clientY;
  }

  mouseMove(e) {
    if (this.mousedown) {
      this.uniforms.iMouse.value[0] = e.clientX;
      this.uniforms.iMouse.value[1] = e.clientY;
    }
  }

  mouseUp(e) {
    this.mousedown = false;
    this.uniforms.iMouse.value[2] = 0;
    this.uniforms.iMouse.value[3] = 0;
  }

  setupMIDIBindings() {
    // Check that the user requested it
    if (!this.options || !this.options.midiBindings) return;

    // Check browser support
    if (!navigator.requestMIDIAccess) {
      console.log('WebMIDI is not supported in this browser.');
      return;
    }

    // Reverse mapping for quick lookup
    this.midiList = {};
    const bindings = this.options.midiBindings;
    for (let i = 0; i < bindings.length; i += 1) {
      const b = bindings[i];
      if (!Array.isArray(b) || b.length < 2) {
        console.log('Invalid MIDI command/note: ' + b);
        console.log('It should be an array of [command, note].')
        continue;
      }
      // Create a uniform for each requested binding, with variable names
      // MIDI1, MIDI2, etc. in the order requested by the user.
      const messageKey = b[0] + '_' + b[1];
      const bindingOptions = b.length >= 3 && b[2] ? b[2] : {};
      bindingOptions.variableName = bindingOptions.variableName || 'MIDI' + (i + 1);
      const defaultValue = typeof bindingOptions.initial == "number" ? bindingOptions.initial : 1;
      this.uniforms[bindingOptions.variableName] = {
        type: 'float',
        value: defaultValue,
      };
      this.midiList[messageKey] = bindingOptions;
    }

    const onMIDISuccess = midiAccess => {
      if (this.options.midiLogs)
        console.log("Successful MIDI setup:", midiAccess);
      for (var input of midiAccess.inputs.values()) {
        input.onmidimessage = this.onMIDIMessage;
      }
    };

    const onMIDIFailure = () => {
      console.log('Could not setup MIDI devices.');
    };

    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
  }

  onMIDIMessage(midiMessage) {
    if (!this.midiList) {
      console.log("Missing MIDI list setup.");
      return;
    }
    if (!midiMessage) {
      console.log("Invalid MIDI message: " + midiMessage);
      return;
    }
    const messageKey = midiMessage.data[0] + '_' + midiMessage.data[1];
    const bindingOptions = this.midiList[messageKey];
    if (!bindingOptions) {
      // console.log('Unbound MIDI message: ' + midiMessage.data.toString());
      return;
    }
    
    let value = midiMessage.data[2] / 127;
    if (bindingOptions.from != null && bindingOptions.to != null) {
      value = remap(value, 0, 1, bindingOptions.from, bindingOptions.to);
    }

    this.uniforms[bindingOptions.variableName].value = value;
    this.debouncedLogMIDIState();
  }

  logMIDIState() {
    if (!this.options.midiLogs) return;
    console.log("==== Current MIDI state ====");
    for (let key in this.uniforms) {
      if (key.indexOf("MIDI") !== 0) continue;
      console.log(key, this.uniforms[key].value.toFixed(2));
    }
  }

  render(timestamp) {
    const gl = this.gl;

    let delta = this.lastTime ? ((timestamp - this.lastTime) / 1000) : 0;
    this.lastTime = timestamp;

    this.uniforms.iTime.value += delta;
    this.uniforms.iTimeDelta.value = delta;
    this.uniforms.iFrame.value++;

    gl.clear(gl.COLOR_BUFFER_BIT);

    Object.keys(this.uniforms).forEach((key) => {
      const t = this.uniforms[key].type;
      const method = t.match(/vec/) ? `${t[t.length - 1]}fv` : `1${t[0]}`;
      gl[`uniform${method}`](this.uniforms[key].location, this.uniforms[key].value);
    });

    gl.drawArrays(gl.TRIANGLES, 0, this.vertices.length / 2);

    requestAnimationFrame(this.render);
  }

  reportErrors() {
    const gl = this.gl;

    if (!gl.getShaderParameter(this.vertexShader, gl.COMPILE_STATUS)) {
      console.log(gl.getShaderInfoLog(this.vertexShader));
    }

    if (!gl.getShaderParameter(this.fragmentShader, gl.COMPILE_STATUS)) {
      console.log(gl.getShaderInfoLog(this.fragmentShader));
    }

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.log(gl.getProgramInfoLog(this.program));
    }
  }

  resize() {
    this.canvas.width = this.uniforms.iResolution.value[0] = window.innerWidth;
    this.canvas.height = this.uniforms.iResolution.value[1] = window.innerHeight;

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
}
