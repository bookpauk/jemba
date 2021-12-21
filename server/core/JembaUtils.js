const { JembaDbThread } = require('jembadb');
const ayncExit = new (require('./AsyncExit'))();//singleton

class JembaUtils {
    constructor() {
        this.dbConn = {};
    }

    use(connName) {
        let db = this.dbConn[connName];
        if (!db) {
            db = new JembaDbThread();
            ayncExit.add(db.closeDb.bind(db));
            this.dbConn[connName] = db;
        }

        return db;
    }

    cwd() {
        return process.cwd();
    }

}

module.exports = JembaUtils;