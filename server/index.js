const fs = require('fs-extra');
/*const path = require('path');
const http = require('http');
const WebSocket = require('ws');
*/
const argv = require('minimist')(process.argv.slice(2));

const ayncExit = new (require('./core/AsyncExit'))();//singleton
ayncExit.init();

let config = null;
let log = null;

async function init() {
    //config
    config = require('./config');
    config.argv = argv;

    //logger
    const appLogger = new (require('./core/AppLogger'))();//singleton
    await appLogger.init(config);
    log = appLogger.log;

    //dirs
    log(`${config.name} v${config.version}, Node.js ${process.version}`);
    log('Initializing');

    await fs.ensureDir(config.dataDir);

    //connections
    const jembaConnManager = new (require('./db/JembaConnManager'))(config);//singleton
    await jembaConnManager.init(argv['auto-repair']);
}

async function mainWebUI() {
}

async function mainCli() {
    const CliWorker = require('./core/CliWorker');

    const cliWorker = new CliWorker(config);
    await cliWorker.run();
}

(async() => {
    try {
        await init();
        if (argv['web-ui']) {
            await mainWebUI();
        } else {
            await mainCli();
        }
        ayncExit.exit(0);
    } catch (e) {
        if (log)
            log(LM_FATAL, e.stack);

        console.error(e.stack);
        ayncExit.exit(1);
    }
})();
