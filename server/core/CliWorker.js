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
        await this.configDb.open({table: 'cli-config'});

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
            const writeln = (text = '') => process.stdout.write(`${text}\n`); 
            const prompt = (text = '') => process.stdout.write(`\r>${text}`);

            writeln(`${this.config.name} v${this.config.version}, jembaDb v${this.config.jembaDbVersion}, Node.js ${process.version}`);
            prompt(cmd);
            process.stdin.on('keypress', async(str, key) => {
                console.log(str, key, key.sequence.length);

                if (key.sequence.length == 1 && !key.ctrl) {
                    if (key.name != 'backspace') {
                        cmd += key.sequence;
                    } else if (cmd.length > 0) {
                        cmd = cmd.substring(0, cmd.length - 1);
                        prompt(cmd + ' ');
                    }
                    prompt(cmd);
                }

                if (key.name == 'return') {
                    try {
                        writeln();
                        if (cmd.trim() != '')
                            await this.processLines([cmd]);
                    } catch(e) {
                        process.stdout.write(`ERROR: ${e.message}\n`);
                    }
                    cmd = '';
                    prompt(cmd);
                }

                if (key.name == 'c' && key.ctrl) {
                    writeln();
                    ayncExit.exit(1);
                }
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