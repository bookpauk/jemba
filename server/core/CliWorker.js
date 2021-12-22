const _ = require('lodash');
const readline = require('readline');

const ayncExit = new (require('./AsyncExit'))();//singleton
const jembaConnManager = new (require('../db/JembaConnManager'))();//singleton

const JembaRunner = require('./JembaRunner');

class CliWorker {
    constructor(config) {
        this.config = config;
        this.jembaRunner = new JembaRunner(config);
        this.configDb = jembaConnManager.db['config'];
    }

    async run() {
        await this.configDb.open({table: 'cli'});

        if (process.stdin.isTTY) {
            await this.runTTY();
        } else {
            await this.runIO();
        }
    }

    async runTTY() {
        return new Promise(() => {
            readline.emitKeypressEvents(process.stdin);

            process.stdin.setRawMode(true);

            let cmd = '';
            let curPos = 0;
            const writeln = (text = '') => process.stdout.write(`${text}\n`); 
            const prompt = () => {
                process.stdout.write(`\r>${cmd} \r>${cmd}`);
                let toLeft = cmd.length - curPos;
                while (toLeft-- > 0)
                    process.stdout.write('\x1B[D');
            }

            writeln(`${this.config.name} v${this.config.version}, jembaDb v${this.config.jembaDbVersion}, Node.js ${process.version}`);            
            prompt();
            process.stdin.on('keypress', async(str, key) => {
                //console.log(str, key, key.sequence.length);

                switch (key.name) {
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
                        try {
                            writeln();
                            if (cmd.trim() != '')
                                await this.processLines([cmd]);
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
            });
        });
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