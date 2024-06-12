import { shaders } from '../dist/shaders';
async function startWebGLRipper() {
    // Declare global variables to store references to the window, pixel data, and WebGL context.
    let _window = window;
    let gl;
    let contextNames = ["webgl2", "webgl", "experimental-webgl"];
    let xValue = 1.0; //Vertex-Transformation Factor
    let yValue = 1.0; //Vertex-Transformation Factor


    // Add the popup with a dropdown menu to the HTML document
    function createShaderSelectorPopup() {
        let popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.top = '10px';
        popup.style.left = '10px';
        popup.style.padding = '10px';
        popup.style.backgroundColor = 'white';
        popup.style.border = '2px solid red';
        popup.style.fontWeight = 'bold';
        popup.style.zIndex = '10000'; // Ensures the dropdown is above other elements
        popup.style.pointerEvents = 'auto'; // Ensures the dropdown is interactable
        popup.style.width = '220px'; // Set a fixed width to ensure consistency
        popup.style.opacity = '0.95'; // Make the entire popup 50% transparent
        popup.style.color = 'black'; // Ensures all text inside the popup is black
        let shaderOptions = Object.keys(shaders).map(shader => `<option value="${shader}">${shader}</option>`).join('');
        popup.innerHTML = `

        <label for="shaderSelector">Select Fragment Shader:</label></br>
        <select id="shaderSelector" style="height: 40px; width: 200px;">
            ${shaderOptions}
        </select></br></br>
    
        <label for="Vertex scaling">Vertex scaling (0.0 - 1.0):</label></br>
        <div style="display: flex; justify-content: space-between; width: 200px;">
            <label for="xValue">X-Direction</label>
            <label for="yValue">Y-Direction</label>
        </div>
        <div style="display: flex; justify-content: space-between; width: 200px;">
            <input type="number" id="xValue" min="0.0" max="1.0" step="0.05" value="1.0" style="width: 90px; height: 40px;"></br>
            <input type="number" id="yValue" min="0.0" max="1.0" step="0.05" value="1.0" style="width: 90px; height: 40px;">
        </div>
        <div id="header" style="cursor: move; background-color: #f1f1f1; height: 10px; margin-top: 10px;"></div>
        `;
        document.body.appendChild(popup);

        // Draggable functionality
        let header = document.getElementById('header');
        let offsetX, offsetY, isDragging = false;
        header.addEventListener('mousedown', function (e) {
            isDragging = true;
            offsetX = e.clientX - popup.offsetLeft;
            offsetY = e.clientY - popup.offsetTop;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        function onMouseMove(e) {
            if (isDragging) {
                popup.style.left = (e.clientX - offsetX) + 'px';
                popup.style.top = (e.clientY - offsetY) + 'px';
            }
        }
        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        //Evaluation of inputs for every change
        let shaderSelector = document.getElementById('shaderSelector');
        shaderSelector.addEventListener('change', function () {
            _window.Settings.globalFragmentShaderSetting = shaderSelector.value;
            updateShaderProgram();
        });

        document.getElementById('xValue').addEventListener('change', function () {
            xValue = parseFloat(document.getElementById('xValue').value);
            if (isNaN(xValue) || xValue < 0.0 || xValue > 1.0) {
                alert('Enter a valid value between 0.0 and 1.0 for scaling in X direction.');
            }
        });

        document.getElementById('yValue').addEventListener('change', function () {
            yValue = parseFloat(document.getElementById('yValue').value);
            if (isNaN(yValue) || yValue < 0.0 || yValue > 1.0) {
                alert('Enter a valid value between 0.0 and 1.0 for scaling in Y direction.');
            }
        });
    }

    function chooseShaderOption(globalFragmentShaderSetting) {
        return shaders[globalFragmentShaderSetting];
    }

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
        globalFragmentShaderSetting: 'ORIGINAL' // Setting for different fragment shaders (Options: FRAG_SMILEY, FRAG_AREA, NULL->Standard)
    };

    // Function to log messages to the console if debugging is enabled.
    let LogToParent = function () {
        if (!_window.Settings.isDebug) return;
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
        _GLViewport = { x: 0, y: 0, width: 0, height: 0 };
        _GLContext = null;
        _isCapturing = false;
        imageProcessingProgram = null;
        originalUniformMatrix4fv = null;

        // Constructor initializes the wrapper with a WebGL context
        constructor(gl) {
            this._GLContext = gl;
            this.initializeShaderProgram();
            this.hookUniformMatrix4fv();
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
        initializeShaderProgram(){
            const gl = this._GLContext;
            const vertexShaderSource = `
                attribute vec2 position;
                varying vec2 texCoords;
                void main() {
                    texCoords = (position + 1.0) / 2.0;
                    gl_Position = vec4(position, 0, 1);
                }`;

            const fragmentShaderSource = chooseShaderOption(_window.Settings.globalFragmentShaderSetting);
            const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
            const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
            this.imageProcessingProgram = this.createProgram(gl, vertexShader, fragmentShader);
        }

        // Overwrites the uniformMatrix4fv method to apply a scaling transformation on matrices
        hookUniformMatrix4fv() {
            const gl = this._GLContext;
            const originalUniformMatrix4fv = gl.uniformMatrix4fv;
            gl.uniformMatrix4fv = (location, transpose, value) => {
                if (location && this._isCapturing) {
                    if (value && value.length === 16) {
                        let scaleMatrix = new Float32Array([
                            xValue, 0, 0, 0,
                            0, yValue, 0, 0,
                            0, 0, 1, 0,
                            0, 0, 0, 1
                        ]);

                        value = this.multiplyMatrices(value, scaleMatrix);
                    }
                }
                originalUniformMatrix4fv.call(gl, location, transpose, value);
            };
        }

        // Multiplies two 4x4 matrices and returns the resulting matrix
        multiplyMatrices(a, b) {
            let result = new Float32Array(16);
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    result[i * 4 + j] = 0;
                    for (let k = 0; k < 4; k++) {
                        result[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
                    }
                }
            }
            return result;
        }


        // Handle viewport changes and apply the image processing shader (resolution conversion)
        hooked_viewport(self, gl, args, oFunc) {
            if (_window.Settings.counter == 1) {
                let _x = args[0];
                let _y = args[1];
                let _width = args[2];
                let _height = args[3];

                self._GLViewport = { x: _x, y: _y, width: _width, height: _height };
                oFunc.apply(gl, args);

                // Check if _GLViewport is defined
                if (!self._GLViewport || self._GLViewport.width === undefined || self._GLViewport.height === undefined) {
                    LogToParent("ERROR: Viewport is not defined or incomplete");
                    return;
                }

                //Checks if shader program had been initialised and assigned correctly
                if (self.imageProcessingProgram && gl.getUniformLocation(self.imageProcessingProgram, 'resolution')) {
                    gl.useProgram(self.imageProcessingProgram);
                    var resolutionLocation = gl.getUniformLocation(self.imageProcessingProgram, 'resolution');
                    gl.uniform2f(resolutionLocation, _width, _height);
                }
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
                // TODO Make coordinates dynamic with boxcraft selection, otherwise allways full processing
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

                // Set texSize uniform
                var texSizeLocation = gl.getUniformLocation(self.imageProcessingProgram, 'texSize');
                gl.uniform2f(texSizeLocation, self._GLViewport.width, self._GLViewport.height);

                // Redraw scene, but with modified shader program for pixel / image processing
                gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
                gl.deleteTexture(texture);

            } else {
                oFunc.apply(gl, args);
            }
        }

        // Method to update shader program when the dropdown selection changes
        updateShaderProgram() {
            this.initializeShaderProgram();
        }
    }

    // Register custom functions to intercept standard WebGL calls
    // Rebuilt from https://github.com/Rilshrink/WebGLRipper
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

    function updateShaderProgram(){}

    function initializeWebGL() {
        // Setup
        // Initialize the wrapper and set up the interception
        LogToParent("Attempting to hook into available Canvases!");
        // Call for all available canvases
        let canvases = document.querySelectorAll('canvas');
        // Iterate through all available canvases to check whether there is a available context to do processing on
        if (canvases.length != 0) {
            for (_window.Settings.multipleCanvases = 0; _window.Settings.multipleCanvases < canvases.length; _window.Settings.multipleCanvases++) {
                LogToParent("Hooking in Canvas: " + (_window.Settings.multipleCanvases + 1) + " / " + canvases.length)
                for (let version = 0; version < contextNames.length; _window.Settings.version++) {
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
                        RegisterGLFunction(gl, glRipper, "UniformMatrix4fv");

                        // Method to update shader program when the dropdown selection changes
                        updateShaderProgram = function () {
                            glRipper.initializeShaderProgram();
                        }

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
    }

    initializeWebGL();
    createShaderSelectorPopup();
}

(function() {
    startWebGLRipper();
})();