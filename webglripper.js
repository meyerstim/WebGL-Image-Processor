// Declare global variables to store references to the window, pixel data, and WebGL context.
let _window = window;
let gl;
let contextNames = ["webgl2", "webgl", "experimental-webgl"]; // Possible version of WebGL-contexts

// Create config object for handling WebGL settings and keycodes.
_window.Settings = {
	CaptureSceneKeyCode: 45, // Insert Key
	CaptureTexturesKeyCode: 45, // Insert Key
	isDebug: true, // Debug Printing if enabled
	counter: 0, // value for toggling image processing
	version: 0, // value for setting contextNames
	multipleCanvases: 0, // iterator for existance of multiple canvases on one website
	// Coordinates for partial image processing area
	// TODO Boxcraft oder ähnliches integrieren, um Koordinaten abzurufen. Und diese dann setzen, für Verarbeitung im Fragment shader
	coordinatesLeftBottom: [150.0, 110.0], // Standard with 0.0 is set to full canvas
	coordinatesRightTop: [280.0, 260.0], // Standard with 0.0 is set to full canvas
	globalFragmentShaderSetting: 'STANDARD' // Setting for different fragment shaders (Options: FRAG_SMILEY, FRAG_AREA, NULL->Standard)
};

const FRAG_SMILEY = `
precision mediump float;
uniform vec2 resolution; // Canvas size
void main() {
    vec2 center = vec2(0.5, 0.5); // Center of Smiley in normalised coordinates
    float radius = 0.4; // Radius Smiley
    float eyeRadius = 0.05; 
    float mouthWidth = 0.05; 
    float smileRadius = 0.3;
    // Transform Pixel-coordinates to normalised coordinates
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec2 uvCentered = uv - center;
    // Calculation distance from center
    float dist = length(uvCentered);
    // Draw Face
    vec3 color = vec3(0.0);
    if (dist < radius) {
        color = vec3(1.0, 1.0, 0.0); // face in yellow
        // Eyes
        vec2 leftEyePos = center + vec2(-0.15, 0.1);
        vec2 rightEyePos = center + vec2(0.15, 0.1);
        float leftEyeDist = length(uv - leftEyePos);
        float rightEyeDist = length(uv - rightEyePos);
        if (leftEyeDist < eyeRadius || rightEyeDist < eyeRadius) {
            color = vec3(0.0);
        }
        // Mouth
        float mouthDist = length(uvCentered + vec2(0.0, -0.15));
        if (mouthDist < smileRadius + mouthWidth && mouthDist > smileRadius - mouthWidth && uv.y < center.y) {
            color = vec3(1.0, 0.0, 0.0); // mouth in red
        }
    }
    gl_FragColor = vec4(color, 1.0);
}`;

const FRAG_AREA = `
precision mediump float;
varying vec2 texCoords;
uniform sampler2D texture;
uniform vec2 resolution; // Canvas-size
uniform vec2 bottomLeft; // Uniform-Variable for left bottom corner
uniform vec2 topRight; // Uniform-Variable for right top corner
void main() {
    vec4 texColor = texture2D(texture, texCoords);
    // Transformation of normalised texCoords in screen coordinates
    vec2 screenCoords = texCoords * resolution;
    // Check if pixel in selected area
    if (screenCoords.x >= bottomLeft.x && screenCoords.x <= topRight.x &&
        screenCoords.y >= bottomLeft.y && screenCoords.y <= topRight.y) {
        // Pixel processing with desired algorithm
        float brightness = max(max(texColor.r, texColor.g), texColor.b);
        if (brightness >= 0.6) {
            float redIntensity = (brightness - 0.6) / (1.0 - 0.6);
            gl_FragColor = vec4(redIntensity, 0.0, 0.0, 1.0); // Roter Ton
        } else {
            gl_FragColor = texColor; // Original value, of not above treshold
        }        		
    } else {
        // No processing for individual pixel if out of selected area
        gl_FragColor = texColor;
    }
}`;

const FRAG_STANDARD = ` 
precision mediump float;
varying vec2 texCoords;
uniform sampler2D texture;
void main() {
	vec4 texColor = texture2D(texture, texCoords);
	float brightness = max(max(texColor.r, texColor.g), texColor.b);
	if (brightness >= 0.6) {
		float redIntensity = (brightness - 0.6) / (1.0 - 0.6);
		gl_FragColor = vec4(redIntensity, 0.0, 0.0, 1.0); // Proper red tone
	} else {
		gl_FragColor = texColor; // Original color
	}
}`;

// Function to log messages to the console if debugging is enabled.
let LogToParent = function () {
	if (!_window.Settings.isDebug)
		return;
	_window.console.log('[WebGLRipper]', ...arguments);
};

_window.RIPPERS = [];

// Event listener for keydown events to toggle image processing.
document.addEventListener('keydown', function (event) {
	if (event.keyCode === _window.Settings.CaptureSceneKeyCode && !event.shiftKey) {
		if (_window.Settings.counter === 0) {
			_window.RIPPERS[0]._StartCapturing = true;
			_window.RIPPERS[0]._isCapturing = true;
			_window.Settings.counter = 1;
			LogToParent("Image-Processing activated.")
		} else {
			_window.RIPPERS[0]._StartCapturing = false;
			_window.RIPPERS[0]._IsEnabled = false;
			_window.RIPPERS[0]._isCapturing = false;
			_window.Settings.counter = 0;
			LogToParent("Image-Processing deactivated.")
		}
	}
});

// Defines a class to wrap around WebGL functionality.
class WebGLWrapper {
	_StartCapturing = false;
	_IsEnabled = true;
	_IsWebGL2 = false;
	_GLViewport = {x: 0, y: 0, width: 0, height: 0};
	_GLContext = null;
	_isCapturing = false;
	imageProcessingProgram = null;

	// Constructor initializes the wrapper with a WebGL context
	constructor(gl) {
		this._GLContext = gl;
		this.initializeShaderProgram();
	}

	// Method to create and compile a shader
	createShader(gl, type, source) {
		var shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error('Shader compile failed: ' + gl.getShaderInfoLog(shader));
			gl.deleteShader(shader);
			return null;
		}
		return shader;
	}

	// Method to create a shader program from vertex and fragment shaders
	createProgram(gl, vertexShader, fragmentShader) {
		var program = gl.createProgram();
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error('Program linking failed: ' + gl.getProgramInfoLog(program));
			gl.deleteProgram(program);
			return null;
		}
		return program;
	}

	// Initializes shaders and stores the custom shader program for image processing
	initializeShaderProgram() {
		const gl = this._GLContext;
		const vertexShaderSource = `
            attribute vec2 position;
        		varying vec2 texCoords;
        		void main() {
            		texCoords = (position + 1.0) / 2.0;
            		gl_Position = vec4(position, 0, 1);
        	}`;

		// Sets the used Fragment shader, by evaluation the value of '_window.Settings.globalFragmentShaderSetting'
		function chooseShaderOption(globalFragmentShaderSetting) {
			if (globalFragmentShaderSetting === 'FRAG_AREA') {
				LogToParent("Using Fragment shader for processing: AREA")
				LogToParent("Coordinates of selection:" + _window.Settings.coordinatesLeftBottom[0] + ", " + _window.Settings.coordinatesLeftBottom[1] + " : " + _window.Settings.coordinatesRightTop[0] + ", " + _window.Settings.coordinatesRightTop[1])
				return FRAG_AREA;
			} else if (globalFragmentShaderSetting === 'FRAG_SMILEY') {
				LogToParent("Using Fragment shader for processing: SMILEY")
				return FRAG_SMILEY;
			} else {
				LogToParent("Using Fragment shader for processing: STANDARD")
				return FRAG_STANDARD;
			}
		}

		// Fragment shader is set by above function, to be able to decide out of different shaders
		const fragmentShaderSource = chooseShaderOption(_window.Settings.globalFragmentShaderSetting);

		const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
		const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
		// Custom vertex and fragment shader get linked
		this.imageProcessingProgram = this.createProgram(gl, vertexShader, fragmentShader);
	}

	// Handle viewport changes and apply the image processing shader (resolution conversion)
	hooked_viewport(self, gl, args, oFunc) {
		if (_window.Settings.counter == 1) {
			let _x = args[0];
			let _y = args[1];
			let _width = args[2];
			let _height = args[3];

			self._GLViewport = {x: _x, y: _y, width: _width, height: _height};
			oFunc.apply(gl, args);

			// Check if _GLViewport is defined
			if (!self._GLViewport || self._GLViewport.width === undefined || self._GLViewport.height === undefined) {
				LogToParent("ERROR: Viewport is not defined or incomplete");
				return;
			}

			//Checks if shader program had been initialised and assigned correctly
			if (self.imageProcessingProgram && gl.getUniformLocation(self.imageProcessingProgram, 'resolution')) {
				// custom shader program is now used for all operations
				gl.useProgram(self.imageProcessingProgram);
				var resolutionLocation = gl.getUniformLocation(self.imageProcessingProgram, 'resolution');
				gl.uniform2f(resolutionLocation, _width, _height);
			}
		}
	}

	hooked_drawArrays(self, gl, args, oFunc) {
		if (_window.Settings.counter === 1) {
			// Execute the original draw call to capture current state
			oFunc.apply(gl, args);

			// Setup empty texture to store framebuffer content
			var texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, self._GLViewport.width, self._GLViewport.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

			// Create and bind Framebuffer, to render into texture instead of canvas
			var framebuffer = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

			gl.bindFramebuffer(gl.FRAMEBUFFER, null);


			gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, 0);

			// IMAGE processing:
			// use custom shader program
			gl.useProgram(self.imageProcessingProgram);

			// Variables for fragment shader; Coordinates used to do partial processing
			// TODO Make coordinated dynamic with boxcraft selection, otherwise allways full processing
			var bottomLeftLocation = gl.getUniformLocation(self.imageProcessingProgram, 'bottomLeft');
			var topRightLocation = gl.getUniformLocation(self.imageProcessingProgram, 'topRight');
			var resolutionLocation = gl.getUniformLocation(self.imageProcessingProgram, 'resolution');
			gl.uniform2f(bottomLeftLocation, _window.Settings.coordinatesLeftBottom[0], _window.Settings.coordinatesLeftBottom[1]);
			gl.uniform2f(topRightLocation, _window.Settings.coordinatesRightTop[0], _window.Settings.coordinatesRightTop[1]);
			gl.uniform2f(resolutionLocation, gl.drawingBufferWidth, gl.drawingBufferHeight);

			var textureLocation = gl.getUniformLocation(self.imageProcessingProgram, 'texture');
			gl.activeTexture(gl.TEXTURE0);
			// bind created texture which contains framebuffer content
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.uniform1i(textureLocation, 0);

			// Redraw scene, but with modified shader program for pixel / image processing
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
			gl.deleteTexture(texture);

		} else {
			oFunc.apply(gl, args);
		}
	}


	// Process image data when drawElements is triggered.
	hooked_drawElements(self, gl, args, oFunc) {
		if (_window.Settings.counter == 1) {
			// Execute the original draw call to capture current state
			oFunc.apply(gl, args);

			// Setup empty texture to store framebuffer content
			var texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, self._GLViewport.width, self._GLViewport.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

			// Create and bind Framebuffer, to render into texture instead of canvas
			var framebuffer = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

			gl.bindFramebuffer(gl.FRAMEBUFFER, null);


			gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, 0);

			// IMAGE processing:
			// use custom shader program
			gl.useProgram(self.imageProcessingProgram);

			// Variables for fragment shader; Coordinates used to do partial processing
			// TODO Make coordinated dynamic with boxcraft selection, otherwise allways full processing
			var bottomLeftLocation = gl.getUniformLocation(self.imageProcessingProgram, 'bottomLeft');
			var topRightLocation = gl.getUniformLocation(self.imageProcessingProgram, 'topRight');
			var resolutionLocation = gl.getUniformLocation(self.imageProcessingProgram, 'resolution');
			gl.uniform2f(bottomLeftLocation, _window.Settings.coordinatesLeftBottom[0], _window.Settings.coordinatesLeftBottom[1]);
			gl.uniform2f(topRightLocation, _window.Settings.coordinatesRightTop[0], _window.Settings.coordinatesRightTop[1]);
			gl.uniform2f(resolutionLocation, gl.drawingBufferWidth, gl.drawingBufferHeight);

			var textureLocation = gl.getUniformLocation(self.imageProcessingProgram, 'texture');
			gl.activeTexture(gl.TEXTURE0);
			// bind created texture which contains framebuffer content
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.uniform1i(textureLocation, 0);

			// Redraw scene, but with modified shader program for pixel / image processing
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
			gl.deleteTexture(texture);

		} else {
			oFunc.apply(gl, args);
		}
	}

}

// Register custom functions to intercept standard WebGL calls
function RegisterGLFunction(_GL, _RipperWrapper, _Method) {
	if (_GL[_Method] === undefined) return;
	let hookFunc = _RipperWrapper[`hooked_${_Method}`];
	// Error if function type does not exist / is not defined
	if (!hookFunc) {
		LogToParent(`Wrapper didn't have the method '${_Method}' defined!`);
		return;
	}
	// Stores original function
	let originalFunc = _GL[_Method];
	// Replaces original function with custom version of it -> Overwrite / Monkey patching
	_GL[_Method] = function () {
		let rv = hookFunc(_RipperWrapper, this, arguments, originalFunc);
		if (rv) return rv;
		return originalFunc.apply(this, arguments);
	};
}

// Setup
// Initialize the wrapper and set up the interception
LogToParent("Attempting to hook into available Canvases!");
// Call for all available canvases
let canvases = document.querySelectorAll('canvas');
// Iterate through all available canvases to check whether there is a available context to do processing on
if (canvases.length != 0) {
	for (_window.Settings.multipleCanvases = 0; _window.Settings.multipleCanvases < canvases.length; _window.Settings.multipleCanvases++) {
		LogToParent("Hooking in Canvas: " + (_window.Settings.multipleCanvases + 1) + " / " + canvases.length)
		for (version = 0; version < contextNames.length; _window.Settings.version++) {
			gl = canvases[_window.Settings.multipleCanvases].getContext(contextNames[_window.Settings.version]);
			if (gl != null) {
				break;
			}
			LogToParent("Found no supported WebGL context.")
		}
		// Error handling, if no (supported) WebGL context could be set up
		try {
			if (!gl._hooked) {
				// Creates new Instance of WebGLWrapper for received context
				let glRipper = new WebGLWrapper(gl);
				glRipper._IsWebGL2 = (contextNames[_window.Settings.version] == 'webgl2');
				// Registers hooked functions in WebGL-Context.
				RegisterGLFunction(gl, glRipper, "viewport");
				RegisterGLFunction(gl, glRipper, "drawElements");
				RegisterGLFunction(gl, glRipper, "drawArrays");


				// Sets processing coordinates to full context size as standard, if no other value is set
				// TODO Set coordinates for area of processing here, future integration of boxcraft for manual selection by user on canvas
				if (_window.Settings.coordinatesLeftBottom[0] === 0.0 && _window.Settings.coordinatesLeftBottom[1] === 0.0) {
					_window.Settings.coordinatesLeftBottom = [0.0, 0.0];
				}
				if (_window.Settings.coordinatesRightTop[0] === 0.0 && _window.Settings.coordinatesRightTop[1] === 0.0) {
					_window.Settings.coordinatesRightTop = [gl.drawingBufferWidth, gl.drawingBufferHeight];
				}

				_window.RIPPERS.push(glRipper);
				gl._hooked = true;
				LogToParent(`Injected into ` + contextNames[_window.Settings.version] + ` context of Canvas ` + (_window.Settings.multipleCanvases + 1));
			}
		} catch (error) {
			LogToParent("As no supported WebGL context was found, WebGLWrapper could not be setup and functions can't be hooked.\n For further information regard following error message: \n" + error)
		}
	}
} else {
	LogToParent("No canvas was found on this website, thus no webgl context could be retrieved for image processing.")
}
