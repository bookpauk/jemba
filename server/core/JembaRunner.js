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

        const includeDir = config.argv['include-dir'];
        this.defaultScriptMode = (scriptMode ? scriptMode : 'shorthand');//'shorthand', 'purejs'
        this.defaultIncludeDir = (includeDir ? includeDir : process.cwd());
        this.defaultDebug = config.argv['debug'];
    }

    substShorthand(text) {
        return text.replace(/!!\./g, 'return await db.').replace(/!\./g, 'await db.').replace(/\$/g, 'u.vars.');
    }

    //recursive
    async includeScript(scriptMode, includeDir, includeFile) {
        const filePath = path.resolve(includeDir, includeFile);        
        if (this.includedPaths[filePath])
            throw new Error(`File has been included already: ${filePath}`);

        this.includedPaths[filePath] = true;
        try {
            includeDir = path.dirname(filePath);

            const includeText = await fs.readFile(filePath, 'utf8');            
            return await this.prepareScript(includeText.split('\n'), scriptMode, includeDir);
        } finally {
            delete this.includedPaths[filePath];
        }
    }

    //recursive
    async prepareScript(inputLines, scriptMode, includeDir) {
        const scriptBlocks = [];
        let lines = [];

        const addNewBlock = () => {
            scriptBlocks.push({
                mode: scriptMode,
                lines
            });
            lines = [];
        };

        for (const line of inputLines) {
            if (line.indexOf('=') === 0) {//directive, one of ['=shorthand', '=purejs', '=setIncludeDir(path)', '=include(path)', '=debug', '={', '=}']
                const directive = line.substring(1);            

                if (directive == '{' || directive == '}') {
                    //quiet
                } else if (directive == 'shorthand' || directive == 'purejs') {
                    scriptMode = directive;

                } else if (directive == 'debug') {
                    this.debug = true;

                } else { 
                    const includeDirMatch = line.match(/^=setIncludeDir\(['"](.*)["']\)$/);
                    const includeMatch = line.match(/^=include\(['"](.*)["']\)$/);

                    if (includeDirMatch) {
                        includeDir = includeDirMatch[1];
                    } else if (includeMatch) {
                        const includeFile = includeMatch[1];
                        lines.push(await this.includeScript(scriptMode, includeDir, includeFile));
                    } else {
                        throw new Error(`Error parsing directive: ${directive}`);
                    }
                }

                addNewBlock();
            } else {
                lines.push(line);
            }            
        }
        addNewBlock();

        let result = '';
        for (const block of scriptBlocks) {
            if (block.lines.length) {
                if (block.mode == 'purejs') {
                    result += block.lines.join('\n');
                } else {
                    result += this.substShorthand(block.lines.join('\n'));
                }

            }
        }

        return result;
    }

    async prepareScriptFunc(inputLines) {
        this.includedPaths = {};
        const script = await this.prepareScript(inputLines, this.defaultScriptMode, this.defaultIncludeDir);

        return `async(db, u) => { \n${script}\n}`;
    }

    async run(inputLines) {
        const u = this.jembaUtils;
        const db = u.use('default');

        this.debug = this.defaultDebug;

        const scriptFunc = await this.prepareScriptFunc(inputLines);
        const runScript = new Function(`'use strict'; return ${scriptFunc}`)();

        if (this.debug)
            return scriptFunc;
        else
            return await runScript(db, u);
    }
}

module.exports = JembaRunner;