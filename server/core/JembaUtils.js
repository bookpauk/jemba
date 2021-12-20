const { JembaDbThread } = require('jembadb');

class JembaUtils {
    constructor() {
        this.dbConn = {};
    }

    use(connName) {
        if (!this.dbConn[connName])
            this.dbConn[connName] = new JembaDbThread();

        return this.dbConn[connName];
    }

    cwd() {
        return process.cwd();
    }
    
}

module.exports = JembaUtils;