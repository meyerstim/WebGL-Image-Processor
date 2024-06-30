# WebGL Image Processor
Perform real-time image processing and vertex transformation on existing WebGL contents of other websites without access to their server infrastrucutre or data. You can use the tool on websites whereever WebGL is used as visualization framework. To perform different processing algorithms existing fragment shaders can be used or new ones can be added.

# How to use?

Drag the above available bookmarklet to your browsers bookmark list. When on a compatible site, click the bookmarklet and the neccessary JavaScript gets automatically injected. A User Interface will show up, to choose between different settings and shaders. To start processing now press your Insert key. To disable processing at anytime press the same key again.

# Which types of processing can be done?

Image processing / Shaders: 
- Dynamic color highlighting
- Area selection processing 
- Edge Detection
- Color Inverter 
- Gaussian Blur
- Contrast enhancement
- Sharpening
- Pseudocoloring of grayscale images
- Full content replacement

Vertex Transformation: 
- Scaling of the existing content in X and Y direction.

# How can I develop my own processing algorithms?

Program a new fragment shader, according to the existing ones. Add it into the directory "fragmentShader" and run npm to compile the program again. As soon as the new and custom version is deployed, your shader will show up in the list of available.

# Can I contribute to the framework?

Yes, your're welcome to. Whether it is a new shader / processing algorithm or some work onto the backend, just let us know by submitting a pull request on the linked GitHub Repository.
