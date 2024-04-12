# WebGLRipper
A tool used to retrieve textures from WebGL applets

# How to use?

Load it as an extension into your Browser (tested only with Chrome so far).
Code gets automatically injected in any website using WebGL, while the extension is loaded in your browser.

# How to rip?

When on a WebGL compatible website, press "insert" key, to start the recording. Press it againg to stop it. 
For performance issues, only when you stop the recording, then the current textures are being output into the console of the Browser.
When removing the printout to the console later on, it can be adapted, that everytime anything changes, the textures will be sent to output. 
But while printing it into the console for developing and debugging purposes, the program would slow down too much, as printing to the console takes a lot of time.