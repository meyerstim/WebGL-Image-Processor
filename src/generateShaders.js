// Used to check for available FRAG shaders in enclosed folder "fragmentShader"
// Used to update and provide Processor with current and new shaders programs.
const fs = require('fs');
const path = require('path');

const shadersDir = path.join(__dirname, '../fragmentShader');
const outputFile = path.join(__dirname, '../dist', 'shaders.js');

let shaders = {};
let shaderFiles = fs.readdirSync(shadersDir)
    .filter(file => file.match(/FRAG_(\w+)\.txt$/));

// Checks if FRAG_STANDARD is present
const standardIndex = shaderFiles.indexOf('FRAG_STANDARD.txt');
if (standardIndex !== -1) {
    // Place FRAG_STANDARD at top of list
    const standardFile = shaderFiles.splice(standardIndex, 1)[0];
    shaderFiles.unshift(standardFile);
}

shaderFiles.forEach(file => {
    const shaderName = file.match(/FRAG_(\w+)\.txt$/)[1];
    const shaderContent = fs.readFileSync(path.join(shadersDir, file), 'utf8');
    shaders[shaderName] = shaderContent;
});

fs.writeFileSync(outputFile, `export const shaders = ${JSON.stringify(shaders, null, 2)};`);
console.log(`Shaders written to ${outputFile}`);