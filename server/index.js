/*const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const compression = require('compression');
const http = require('http');
const WebSocket = require ('ws');
*/
const argv = require('minimist')(process.argv.slice(2));

const ayncExit = new (require('./core/AsyncExit'))();
ayncExit.init();

let config = null;
let log = null;

async function initWebUI() {
    //config
    config = require('./config');
}

async function mainWebUI() {
}

async function initCli() {
    //config
    config = require('./config');
}

async function mainCli() {
    const CliWorker = require('./core/CliWorker');
    
    const cliWorker = new CliWorker();
    await cliWorker.run(config);
}

(async() => {
    try {
        if (argv['web-ui']) {
            await initWebUI();
            await mainWebUI();
        } else {
            await initCli();
            await mainCli();
        }
    } catch (e) {
        if (log)
            log(LM_FATAL, e.stack);
        else
            console.error(e.stack);
        ayncExit.exit(1);
    }
})();
