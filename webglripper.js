// Declare global variables to store references to the window, pixel data, and WebGL context.
let _window = window;
let pixelContainer;
let pixelContainerConvert;
let gl;
let version = 0;
let multi = 0;
let contextNames = ["webgl2", "webgl", "experimental-webgl"];

// Create config object for handling WebGL settings and keycodes.
_window.WEBGLRipperSettings = {
	CaptureSceneKeyCode: 45, // Insert Key
	CaptureTexturesKeyCode: 45, // Insert Key
	isDebug: true, // Debug Printing if enabled
	counter: 0 // value for toggling image processing
};

// Function to log messages to the console if debugging is enabled.
let LogToParent = function () {
	if (!_window.WEBGLRipperSettings.isDebug)
		return;
	_window.console.log('[WebGLRipper]', ...arguments);
};

_window.RIPPERS = [];

// Event listener for keydown events to toggle image processing.
document.addEventListener('keydown', function (event) {
	if (event.keyCode == _window.WEBGLRipperSettings.CaptureSceneKeyCode && !event.shiftKey) {
		if (_window.WEBGLRipperSettings.counter === 0) {
			_window.RIPPERS[0]._StartCapturing = true;
			_window.RIPPERS[0]._isCapturing = true;
			_window.WEBGLRipperSettings.counter = 1;
			LogToParent("Image-Processing activated.")
		} else {
			_window.RIPPERS[0]._StartCapturing = false;
			_window.RIPPERS[0]._IsEnabled = false;
			_window.RIPPERS[0]._isCapturing = false;
			_window.WEBGLRipperSettings.counter = 0;
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


		const fragmentShaderSource = `
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
		const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
		const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
		// Custom vertex and fragment shader get linked
		this.imageProcessingProgram = this.createProgram(gl, vertexShader, fragmentShader);
	}

	// Handle viewport changes and apply the image processing shader (resolution conversion)
	hooked_viewport(self, gl, args, oFunc) {
		if (_window.WEBGLRipperSettings.counter == 1) {
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

			/*let width = self._GLViewport.width;  // Breite des Viewports
            let height = self._GLViewport.height; // Höhe des Viewports

            pixelContainerConvert = new Uint8Array(width * height * 4);
            pixelContainer = new Uint8Array(pixelContainerConvert.length / 4);   // RGBA für jedes Pixel
            // Read pixel-values from Framebuffer
            gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixelContainerConvert);
            for (let i = 0; i < pixelContainerConvert.length; i += 4) pixelContainer[i / 4] = pixelContainerConvert[i];*/
		}
	}

	// Process image data when drawElements is triggered.
	hooked_drawElements(self, gl, args, oFunc) {
		if (_window.WEBGLRipperSettings.counter == 1) {
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
			var resolutionLocation = gl.getUniformLocation(self.imageProcessingProgram, 'resolution');
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
for (multi = 0; multi < canvases.length; multi++) {
	LogToParent("Hooking in Canvas: " + (multi+1) + " / " + canvases.length)
	for (version = 0; version < contextNames.length; version++) {
		gl = canvases[multi].getContext(contextNames[version]);
		if (gl != null) {
			break;
		}
		LogToParent("Found no supported WebGL context")
	}
	// Error handling, if no (supported) WebGL context could be set up
	try {
		if (!gl._hooked) {
			// Creates new Instanz of WebGLWrapper for received context
			let glRipper = new WebGLWrapper(gl);
			glRipper._IsWebGL2 = (contextNames[version] == 'webgl2');
			// Registers hooked functions in WebGL-Context.
			RegisterGLFunction(gl, glRipper, "viewport");
			RegisterGLFunction(gl, glRipper, "drawElements");

			_window.RIPPERS.push(glRipper);
			gl._hooked = true;
			LogToParent(`Injected into ` + contextNames[version] + ` context of Canvas ` +  (multi+1));
		}
	} catch (error) {
		LogToParent("As no supported WebGL context was found, WebGLWrapper could not be setup and functions can't be hooked.\n For further information regard following error message: \n" + error)
	}
}