const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const readline = require('readline');

const ayncExit = new (require('./AsyncExit'))();//singleton
const utils = require('./utils');

const JembaRunner = require('./JembaRunner');

class CliWorker {
    constructor(config) {
        this.config = config;
        this.jembaRunner = new JembaRunner(config);

        this.cmdHistoryPath = `${config.dataDir}/cmdHistory.json`;
        this.cmdHistory = [];
    }

    async run() {
        const argv = this.config.argv;

        if (argv._.length) {

            await this.runFiles(argv._);

            /*unexpected behavior on external execution
            if (!process.stdin.isTTY)
                await this.runIO();
            */

        } else if (process.stdin.isTTY) {
            await this.runTTY();
        } else {
            await this.runIO();
        }
    }

    processConsoleCommand(cmd) {
        switch (cmd) {
            case '.help':
                console.log(
`.directives  Print list of available directives
.exit        Exit the REPL
.help        Print this help message`);
                break;
            //case '.exit' processed inside runTTY()
            case '.directives':
                console.log(
`//=shorthand           Allow using shorts inside script:
                        "!." => "await db."
                        "!!." => "return await db."
                        "$$" => "u.vars."                        
//=purejs              Do not use shorthand
//=setIncludeDir(path) Set script including directory to "path"
//=include(path)       Load specified script in place
//=debug               Show result function body (without includes) instead of running it
//=debug-full          Show full result function body (with includes) instead of running it
={                     REPL mode: start multiline script
=}                     REPL mode: finish and run multiline script`);
                break;
            default:
                return false;
        }

        return true;
    }

    async loadCmdHistory() {
        let loadedHistory = [];
        if (await fs.pathExists(this.cmdHistoryPath)) {
            loadedHistory = await fs.readFile(this.cmdHistoryPath, 'utf8');
            loadedHistory = JSON.parse(loadedHistory);
        }

        const joinedHistory = this.cmdHistory.concat(loadedHistory);
        const uniq = new Set();
        const result = [];
        for (const rec of joinedHistory) {
            if (!uniq.has(rec.time)) {
                result.push(rec);
                uniq.add(rec.time);
            }
        }

        result.sort((a, b) => b.time - a.time);

        this.cmdHistory = result;
    }

    async saveCmdHistory() {
        await this.loadCmdHistory();

        await fs.writeFile(this.cmdHistoryPath, JSON.stringify(this.cmdHistory, null, 2));
    }

    async runTTY() {
        return new Promise((resolve, reject) => { (async() => {
            await this.loadCmdHistory();

            readline.emitKeypressEvents(process.stdin);

            process.stdin.setRawMode(true);

            let cmd = '';
            let multiCmd = [];
            let multiOn = false;
            let curPos = 0;

            const writeln = (text = '') => process.stdout.write(`${text}\n`); 
            const prompt = () => {
                process.stdout.write(`\x1B[2K\r> ${multiOn && cmd.indexOf('=') !== 0 ? '  ' : ''}${cmd}`);
                let toLeft = cmd.length - curPos;
                process.stdout.write('\x1B[D'.repeat(toLeft));
            }

            let fh = [];
            let fhIndex = 0;
            let prevKey = '';
            const filterHistory = () => {
                fhIndex = 0;
                const result = this.cmdHistory.filter((rec) => (rec.cmd.indexOf(cmd) == 0)).map((rec) => rec.cmd);
                if (result.length) {
                    if (result[0] !== cmd) {
                        result.unshift(cmd);
                        fhIndex++;
                    }
                    if (result[result.length - 1] !== cmd)
                        result.push(cmd);
                }
                return result;
            }

            writeln(utils.versionText(this.config));
            writeln(`Type ".help" for more info`);
            prompt();

            const onKeyPress = async(str, key) => {
                //console.log(key, str, key.sequence.length);

                switch (key.name) {
                    case 'up':
                        if (prevKey == 'up' || prevKey == 'down') {
                            if (fhIndex < fh.length - 1)
                                fhIndex++;                        
                        } else {
                            fh = filterHistory();
                        }
                        if (fh.length) {
                            cmd = fh[fhIndex];
                            curPos = cmd.length;
                        }
                        break;
                    case 'down':
                        if (prevKey == 'up' || prevKey == 'down') {
                            if (fhIndex > 0)
                                fhIndex--;                        
                        } else {
                            fh = filterHistory();
                        }
                        if (fh.length) {
                            cmd = fh[fhIndex];
                            curPos = cmd.length;
                        }
                        break;
                    case 'left': 
                        if (curPos > 0) curPos--;
                        break;
                    case 'right': 
                        if (curPos < cmd.length) curPos++;
                        break;
                    case 'home': 
                        curPos = 0;
                        break;
                    case 'end': 
                        curPos = cmd.length;
                        break;
                    case 'backspace':
                        if (curPos > 0) {
                            cmd = `${cmd.slice(0, curPos - 1)}${cmd.slice(curPos)}`;
                            if (curPos > 0)
                                curPos--;
                        }
                        break;
                    case 'delete':
                        if (curPos < cmd.length) {
                            cmd = `${cmd.slice(0, curPos)}${cmd.slice(curPos + 1)}`;
                        }
                        break;
                    case 'return': 
                    case 'enter': 
                        try {
                            writeln();
                            if (cmd.trim() != '') {
                                if (!this.cmdHistory.length || this.cmdHistory[0].cmd !== cmd) {
                                    this.cmdHistory.unshift({time: Date.now(), cmd});
                                    while (this.cmdHistory.length > 1000)
                                        this.cmdHistory.pop();

                                    await this.saveCmdHistory();
                                }

                                if (!this.processConsoleCommand(cmd)) {
                                    switch (cmd) {
                                        case '.exit':
                                            ayncExit.exit(1);
                                            return;                                        
                                        case '={':
                                            multiOn = true;
                                            break;
                                        case '=}':
                                            try {
                                                await this.processLines(multiCmd);
                                            } finally {
                                                multiOn = false;
                                                multiCmd = [];
                                            }
                                            break;

                                        default:
                                            if (multiOn)
                                                multiCmd.push(cmd);
                                            else
                                                await this.processLines([cmd]);
                                            break;
                                    }
                                }
                            }
                        } catch(e) {
                            process.stdout.write(`ERROR: ${e.message}\n`);
                        }
                        cmd = '';
                        curPos = 0;
                        break;
                    default: 
                        if (key.sequence.length == 1 && !key.ctrl) {
                            cmd = `${cmd.slice(0, curPos)}${key.sequence}${cmd.slice(curPos)}`;
                            curPos++;
                        }

                        if (key.name == 'c' && key.ctrl) {
                            writeln();
                            ayncExit.exit(1);
                            return;
                        }

                        break;
                }

                prompt();
                prevKey = key.name;
            };

            let busy = false;
            let keyQueue = [];
            process.stdin.on('keypress', async(str, key) => {
                keyQueue.push([str, key]);
                if (busy)
                    return;

                busy = true;
                try {
                    while (keyQueue.length) {
                        const item = keyQueue.shift();
                        await onKeyPress(item[0], item[1]);
                    }
                } catch(e) {
                    reject(e);
                } finally {
                    busy = false;
                }
            });
        })().catch(reject); });
    }

    async runIO() {
        return new Promise((resolve, reject) => {
            try {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: null,
                });

                const inputLines = [];
                rl.on('line', (line) => {
                    inputLines.push(line);
                });    

                rl.on('close', async() => {
                    try {
                        await this.processLines(inputLines);
                        resolve();
                    } catch(e) {
                        reject(e);
                    }
                });
            } catch(e) {
                reject(e);
            }
        });
    }

    async runFiles(files) {
        let inputLines = [];
        for (const file of files) {
            const includeText = await fs.readFile(file, 'utf8');

            inputLines = includeText.split('\n');

            this.config.defaultIncludeDir = path.dirname(path.resolve(file));
            this.jembaRunner = new JembaRunner(this.config);

            await this.processLines(inputLines);
        }

    }

    async processLines(inputLines) {
        let result = await this.jembaRunner.run(inputLines);

        if (result === undefined)
            result = 'undefined';
        else if (_.isObject(result))
            result = JSON.stringify(result, null, 2);
        else
            result = result.toString();

        process.stdout.write(result + '\n');
    }
}

module.exports = CliWorker;