const fs = require('fs').promises;
const path = require('path');
const JembaUtils = require('./JembaUtils');

class JembaRunner {
    constructor(config) {
        this.jembaUtils = new JembaUtils();

        //default settings
        const scriptMode = config.argv['script-mode'];
        if (scriptMode && !['shorthand', 'purejs'].includes(scriptMode))
            throw new Error(`Unknown --script-mode param value: ${scriptMode}`);

        this.argvIncludeDir = config.argv['include-dir'];
        this.defaultScriptMode = (scriptMode ? scriptMode : 'shorthand');//'shorthand', 'purejs'
        this.defaultIncludeDir = (this.argvIncludeDir ? this.argvIncludeDir : (config.defaultIncludeDir ? config.defaultIncludeDir : process.cwd()));
        this.defaultDebug = config.argv['debug'];
        this.defaultDebugFull = config.argv['debug-full'];
    }

    substShorthand(text) {
        return text.replace(/!!\./g, 'return await db.').replace(/!\./g, 'await db.').replace(/\$\$/g, 'u.vars.');
    }

    //recursive
    async includeScript(includeDir, includeFile) {
        const filePath = path.resolve(includeDir, includeFile);        
        if (this.includedPaths[filePath])
            throw new Error(`File has been included already: ${filePath}`);

        this.includedPaths[filePath] = true;
        try {
            includeDir = path.dirname(filePath);

            const includeText = await fs.readFile(filePath, 'utf8');
            return await this.prepareScript(includeText.split('\n'), includeDir);
        } finally {
            delete this.includedPaths[filePath];
        }
    }

    //recursive
    async prepareScript(inputLines, includeDir, prepareDebug = false) {
        const scriptBlocks = [];
        let lines = null;

        const addNewBlock = (mode) => {
            lines = [];
            scriptBlocks.push({
                mode,
                lines
            });
        };

        let scriptMode = this.defaultScriptMode;
        addNewBlock(scriptMode);

        for (const line of inputLines) {
            if (line.indexOf('//=') === 0) {//directive, one of ['=shorthand', '=purejs', '=setIncludeDir(path)', '=include(path)', '=debug', '=debug-full', '={', '=}']
                const directive = line.substring(3);
                addNewBlock('purejs');
                lines.push(line);

                if (directive == 'shorthand' || directive == 'purejs') {
                    scriptMode = directive;

                } else if (directive == 'debug') {
                    this.debug = true;

                } else if (directive == 'debug-full') {
                    this.debugFull = true;

                } else { 
                    const includeDirMatch = line.match(/^\/\/=setIncludeDir\(['"](.*)["']\)$/);
                    const includeMatch = line.match(/^\/\/=include\(['"](.*)["']\)$/);

                    if (includeDirMatch) {
                        includeDir = includeDirMatch[1];
                    } else if (includeMatch) {
                        const includeFile = includeMatch[1];
                        if (!prepareDebug)
                            lines.push(await this.includeScript(includeDir, includeFile));
                    } else {
                        throw new Error(`Error parsing directive: ${directive}`);
                    }
                }

                addNewBlock(scriptMode);
            } else {
                lines.push(line);
            }            
        }

        let result = '';
        for (const block of scriptBlocks) {
            if (block.lines.length) {
                if (result != '')
                    result += '\n';

                if (block.mode == 'purejs') {
                    result += block.lines.join('\n');
                } else {
                    result += this.substShorthand(block.lines.join('\n'));
                }
            }
        }

        return result;
    }

    async prepareScriptFunc(inputLines, prepareDebug = false) {
        this.includedPaths = {};
        const script = await this.prepareScript(inputLines, this.defaultIncludeDir, prepareDebug);

        return `async(db, u) => { ${script}\n}`;
    }

    async run(inputLines) {
        const u = this.jembaUtils;
        const db = u.use('default');

        this.debug = this.defaultDebug;
        this.debugFull = this.defaultDebugFull;

        let scriptFunc = await this.prepareScriptFunc(inputLines);

        if (this.debug) {
            scriptFunc = await this.prepareScriptFunc(inputLines, this.debug);
            return scriptFunc;
        } if (this.debugFull) {
            return scriptFunc;
        } else {
            const runScript = new Function(`'use strict'; return ${scriptFunc}`)();
            return await runScript(db, u);
        }
    }
}

module.exports = JembaRunner;