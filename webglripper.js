	let _window = window;
	let pixelContainer;
	let pixelContainerConvert;
	let gl;
	let version;

// Create config object
	_window.WEBGLRipperSettings = {
		// Settings
		CaptureSceneKeyCode: 45, // Insert Key
		CaptureTexturesKeyCode: 45, // Insert Key
		isDebug: true, // Debug Printing
		counter: 0
	};

	let LogToParent = function () {
		if (!_window.WEBGLRipperSettings.isDebug)
			return;
		_window.console.log('[WebGLRipper]', ...arguments);
	};


	_window.RIPPERS = [];
	_window.MODELS = [];

	document.addEventListener('keydown', function (event) {
		if (event.keyCode == _window.WEBGLRipperSettings.CaptureSceneKeyCode && !event.shiftKey) {
			/*LogToParent("Starting capturing...");

                LogToParent("Started capture on: ", _window.RIPPERS[ 0 ]);*/
			// TODO Functionality, that recording ist getting turned on and off, each time, when pressing the insert button
			if (_window.WEBGLRipperSettings.counter === 0) {
				_window.RIPPERS[0]._StartCapturing = true;
				_window.RIPPERS[0]._isCapturing = true;
				_window.WEBGLRipperSettings.counter = 1;
				LogToParent("Image-Processing activated.")
			} else {
				pixelZeroCounter = 0;

				_window.RIPPERS[0]._StartCapturing = false;
				_window.RIPPERS[0]._IsEnabled = false;
				_window.RIPPERS[0]._isCapturing = false;
				_window.WEBGLRipperSettings.counter = 0;
				LogToParent("Image-Processing deactivated.")

			}
		}
	});

	class WebGLRipperWrapper {
		_StartCapturing = false;

		_IsEnabled = true;
		_IsWebGL2 = false;
		_GLViewport = {x: 0, y: 0, width: 0, height: 0};
		_GLContext = null;

		_isCapturing = false;

		constructor(gl) {
			this._GLContext = gl;
		}

		hooked_viewport(self, gl, args, oFunc) { // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/viewport
			let _x = args[0];
			let _y = args[1];
			let _width = args[2];
			let _height = args[3];

			self._GLViewport = {x: _x, y: _y, width: _width, height: _height};
			oFunc.apply(gl, args);

			//console.log("FUNKTION im Viewport");
			// Überprüfe, ob _GLViewport definiert ist
			if (!self._GLViewport || self._GLViewport.width === undefined || self._GLViewport.height === undefined) {
				//console.error("NEU: Viewport ist nicht definiert oder unvollständig.");
				return;
			}

			const saveBuffer = gl.createBuffer();

			let width = self._GLViewport.width;  // Breite des Viewports
			let height = self._GLViewport.height; // Höhe des Viewports

			//pixelContainerConvert = new Uint8Array(width * height * 4);
			//pixelContainer = new Uint8Array(pixelContainerConvert.length / 4);   // RGBA für jedes Pixel


			// Read pixel-values from Framebuffer
			//gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixelContainerConvert);
			//for (let i = 0; i < pixelContainerConvert.length; i += 4) pixelContainer[i / 4] = pixelContainerConvert[i];
		}


		hooked_drawArrays(self, gl, args, oFunc) { // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawArrays

		}

		hooked_drawElements(self, gl, args, oFunc) { // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawElements

			// TODO Image processing

			if (_window.WEBGLRipperSettings.counter == 1) {

				// Texture setup to store current content
				var texture = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, self._GLViewport.width, self._GLViewport.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

				// Bind Framebuffer
				var framebuffer = gl.createFramebuffer();
				gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
				gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

				gl.bindFramebuffer(gl.FRAMEBUFFER, null);

				// Copy the current content of the canvas into the texture
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, self._GLViewport.width, self._GLViewport.height, 0);


				// Prepare shaders for drawing back to the canvas
				var vertexShaderSource = `
        		attribute vec2 position;
        		varying vec2 texCoords;
        		void main() {
            		texCoords = (position + 1.0) / 2.0;
            		gl_Position = vec4(position, 0, 1);
        	}`;

<<<<<<< Updated upstream
				// Image processing is defined here in this shader, currently coloring pixels in red, which have an value over 0.95 of 1.0 -> Similar to highlighting, just for testing
				// TODO Here fragment shader for highlighting, uncomment and comment the one below for using either the other shader and vice versa
				var fragmentShaderSource = `
				precision mediump float;
=======

		const fragmentShaderSource = `
            precision mediump float;
>>>>>>> Stashed changes
            	varying vec2 texCoords;
            	uniform sampler2D texture;
            	void main() {
                	vec4 texColor = texture2D(texture, texCoords);
                	float brightness = max(max(texColor.r, texColor.g), texColor.b);
<<<<<<< Updated upstream
                	if (brightness >= 0.3) {
                    	float redIntensity = (brightness - 0.3) / (1.0 - 0.3);
=======
                	if (brightness >= 0.6) {
                    	float redIntensity = (brightness - 0.6) / (1.0 - 0.6);
>>>>>>> Stashed changes
                    	gl_FragColor = vec4(redIntensity, 0.0, 0.0, 1.0); // Proper red tone
                	} else {
                    	gl_FragColor = texColor; // Original color
                	}
            }`;

<<<<<<< Updated upstream
				// TODO Here fragment shader for Sobel edge detection, uncomment and comment the one above for using either the other shader and vice versa
				/*var fragmentShaderSource = `
                    precision mediump float;

                    varying vec2 texCoords;
                    uniform sampler2D texture;
                    uniform vec2 texSize;

                    void main() {
                        float dx = 1.0 / texSize.x;
                        float dy = 1.0 / texSize.y;

                        vec3 grad_x = vec3(0.0);
                        vec3 grad_y = vec3(0.0);

                        vec3 texTL = texture2D(texture, texCoords + vec2(-dx, -dy)).rgb; // Top-left
                        vec3 texTC = texture2D(texture, texCoords + vec2(0.0, -dy)).rgb; // Top-center
                        vec3 texTR = texture2D(texture, texCoords + vec2(dx, -dy)).rgb;  // Top-right
                        vec3 texCL = texture2D(texture, texCoords + vec2(-dx, 0.0)).rgb; // Center-left
                        vec3 texCC = texture2D(texture, texCoords).rgb;                  // Center-center
                        vec3 texCR = texture2D(texture, texCoords + vec2(dx, 0.0)).rgb;  // Center-right
                        vec3 texBL = texture2D(texture, texCoords + vec2(-dx, dy)).rgb;  // Bottom-left
                        vec3 texBC = texture2D(texture, texCoords + vec2(0.0, dy)).rgb;  // Bottom-center
                        vec3 texBR = texture2D(texture, texCoords + vec2(dx, dy)).rgb;   // Bottom-right

                        // Apply Sobel operator for X gradient
                           grad_x += texTL * vec3(-1.0) + texTC * vec3(0.0) + texTR * vec3(1.0);
                        grad_x += texCL * vec3(-2.0) + texCC * vec3(0.0) + texCR * vec3(2.0);
                        grad_x += texBL * vec3(-1.0) + texBC * vec3(0.0) + texBR * vec3(1.0);
=======
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
>>>>>>> Stashed changes

                        // Apply Sobel operator for Y gradient
                        grad_y += texTL * vec3(-1.0) + texTC * vec3(-2.0) + texTR * vec3(-1.0);
                        grad_y += texCL * vec3(0.0) + texCC * vec3(0.0) + texCR * vec3(0.0);
                        grad_y += texBL * vec3(1.0) + texBC * vec3(2.0) + texBR * vec3(1.0);

                        float edgeStrength = length(grad_x + grad_y);
                        gl_FragColor = vec4(vec3(edgeStrength), 1.0);
                }
                `;*/

<<<<<<< Updated upstream
				var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
				var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
				var shaderProgram = createProgram(gl, vertexShader, fragmentShader);

				gl.useProgram(shaderProgram);
=======
			// Create and bind Framebuffer, to render into texture instead of canvas
			var framebuffer = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
>>>>>>> Stashed changes

				var texSizeLocation = gl.getUniformLocation(shaderProgram, 'texSize');
				gl.uniform2f(texSizeLocation, self._GLViewport.width, self._GLViewport.height);  // Set the texture size

				// Setup quad geometry (Plane which is placed on top of the current canvas, to draw on)
				var vertices = new Float32Array([
					-1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
					-1.0, 1.0, 1.0, -1.0, 1.0, 1.0
				]);
				var positionBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
				var positionLocation = gl.getAttribLocation(shaderProgram, 'position');
				gl.enableVertexAttribArray(positionLocation);
				gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

				var textureLocation = gl.getUniformLocation(shaderProgram, 'texture');
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.uniform1i(textureLocation, 0);

<<<<<<< Updated upstream
				// Draw the before created content
				gl.drawArrays(gl.TRIANGLES, 0, 6);
=======
			// Redraw scene, but with modified shader program for pixel / image processing
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
			gl.deleteTexture(texture);
>>>>>>> Stashed changes

				function createShader(gl, type, source) {
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

				function createProgram(gl, vertexShader, fragmentShader) {
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
			}
			// TODO End image processing
		}
	}
<<<<<<< Updated upstream
=======

}
>>>>>>> Stashed changes

	function RegisterGLFunction(_GL, _RipperWrapper, _Method) {
		if (_GL[_Method] == undefined) return;
		let hookFunc = _RipperWrapper[`hooked_${_Method}`];
		if (!hookFunc) {
			LogToParent(`Wrapper didn't have the method '${_Method}' defined!`);
			_RipperWrapper[`hooked_${_Method}`] = function (self, gl, args) {
				// To prevent errors create a 'fake' method
				LogToParent(`${_Method}: `, args);
			};
			hookFunc = _RipperWrapper[`hooked_${_Method}`];
			if (!hookFunc) {
				LogToParent(`Failed to hook: gl.${_Method}, aborting!`);
				return;
			}
		}
		let originalFunc = _GL[_Method];
		_GL[_Method] = function () {
			let rv = hookFunc(_RipperWrapper, this, arguments, originalFunc);
			if (rv)
				return rv;
			return originalFunc.apply(this, arguments);
		};
		//LogToParent(`Successfully hooked into gl.${_Method}`);
	}


	LogToParent("Attempting to hook into canvas 'getContext' func!");
	let canvas = document.getElementsByTagName('canvas')
	let contextNames = ["webgl2", "webgl", "experimental-webgl"];
	for (version = 0; version < contextNames.length; version++) {
		gl = canvas[0].getContext(contextNames[version])
		console.log("One run, Version: " + contextNames[version])
		if (gl != null) {
			break;
		}
		LogToParent("Found no supported WebGL context")
	}

	try {
		//window.HTMLCanvasElement.prototype.getContext('webgl2')
		if (!gl._hooked) {
			let glRipper = new WebGLRipperWrapper(gl);
			glRipper._IsWebGL2 = (contextNames[version] == 'webgl2');
			RegisterGLFunction(gl, glRipper, "viewport");
			RegisterGLFunction(gl, glRipper, "drawArrays");
			RegisterGLFunction(gl, glRipper, "drawElements");

			_window.RIPPERS.push(glRipper);
			gl._hooked = true;
			LogToParent(`Injected into ` + contextNames[version] + ` context!`, _window.RIPPERS);
		}
	} catch (error) {
		LogToParent("As no supported WebGL context was found, WebGLWrapper could not be setup and functions can't be hooked.\n For further information regard following error message: \n" + error)
	}



