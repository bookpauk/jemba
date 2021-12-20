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
    }

    substShorthand(text) {
        return text.replace(/!!\./g, 'return await db.').replace(/!\./g, 'await db.');
    }

    //recursive
    async includeScript(scriptMode, includeDir, includeFile) {
        const filePath = path.resolve(includeDir, includeFile);
        return (`----> include ${scriptMode}, ${filePath}`);
    }

    //recursive
    async prepareScript(inputLines, scriptMode, includeDir) {
        const scriptBlocks = [];
        let lines = [];

        const addNewBlock = () => {
            scriptBlocks.push({
                mode: this.scriptMode,
                lines
            });
            lines = [];
        };

        for (const line of inputLines) {
            if (line.indexOf('=') === 0) {//directive, one of ['=shorthand', '=purejs', '=includeDir(path)', '=include(path)']                
                const directive = line.substring(1);            

                if (directive == 'shorthand' || directive == 'purejs') {                    
                    this.scriptMode = directive;
                } else { 
                    const includeDirMatch = line.match(/=includeDir\(['"](.*)["']\)/);
                    const includeMatch = line.match(/=include\(['"](.*)["']\)/);

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
                    result += block.lines.join('\n') + '\n';
                } else {
                    result += this.substShorthand(block.lines.join('\n')) + '\n';                     
                }

            }
        }

        return result;
    }

    async prepareScriptFunc(inputLines) {
        this.includeStack = [];
        const script = await this.prepareScript(inputLines, this.defaultScriptMode, this.defaultIncludeDir);

        return `async(db, u) => { ${script} }`;
    }

    async run(inputLines) {
        const u = this.jembaUtils;
        const db = u.use('default');

        const scriptFunc = await this.prepareScriptFunc(inputLines);
        const runScript = new Function(`return ${scriptFunc}`)();

        return await runScript(db, u);
    }
}

module.exports = JembaRunner;