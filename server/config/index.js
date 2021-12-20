const path = require('path');
const pckg = require('../../package.json');

if (process.env.NODE_ENV === undefined) 
    process.env.NODE_ENV = 'production';

let execDir = path.resolve(__dirname, '..');
if (process.pkg)//production standalone package (pkg)
    execDir = path.dirname(process.execPath);

const dataDir = `${execDir}/jemba-config`;

module.exports = {
    branch: process.env.NODE_ENV,
    version: pckg.version,
    name: pckg.name,

    dataDir: dataDir,
    logDir: `${dataDir}/log`,
    publicDir: `${execDir}/public`,
    loggingEnabled: true,

    jembaDb: [
        {
            dbName: 'config',
            openAll: true,
        },
    ],

    server: {
        ip: '0.0.0.0',
        port: '12280',
    },
};

