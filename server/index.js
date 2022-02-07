const fs = require('fs-extra');
const utils = require('./core/utils');
/*const path = require('path');
const http = require('http');
const WebSocket = require('ws');
*/
const argv = require('minimist')(process.argv.slice(2), {boolean: true});

const ayncExit = new (require('./core/AsyncExit'))();//singleton

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
    log(utils.versionText(config));
    log('Initializing');

    await fs.ensureDir(config.dataDir);

    //connections
    const jembaConnManager = new (require('./db/JembaConnManager'))();//singleton
    await jembaConnManager.init(config, argv['auto-repair']);
}

function showHelp() {
    console.log(utils.versionText(config));
    console.log(
`Usage: jemba [options] [script.jemba] [scripts...]

Options:
  --auto-repair  Auto repair jemba-config DB
  --debug        Show result function body (without includes) instead of running it
  --debug-full   Show full result function body (with includes) instead of running it
  --help         Print jemba command line options
  --web-ui       Run jemba in WebUI mode (http server)
`);
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
        if (argv['help'])
            showHelp();
        else if (argv['web-ui']) {
            await mainWebUI();
        } else {
            await mainCli();
        }
        log('Exit(0)');
        ayncExit.exit(0);
    } catch (e) {
        if (log)
            log(LM_FATAL, e.stack);

        console.error(e.stack);
        ayncExit.exit(1);
    }
})();
