const { JembaDb, JembaDbThread } = require('jembadb');
const ayncExit = new (require('./AsyncExit'))();//singleton

class JembaUtils {
    constructor() {
        this._dbConn = {};
        this.vars = {};//public
    }

    _use(connName, thread) {
        let db = this._dbConn[connName];
        if (!db) {
            if (thread)
                db = new JembaDbThread();
            else
                db = new JembaDb();
            ayncExit.add(db.closeDb.bind(db));
            this._dbConn[connName] = db;
        }

        return db;
    }

    use(connName) {
        return this._use(connName);
    }

    useThread(connName) {
        return this._use(connName, true);
    }

    cwd() {
        return process.cwd();
    }

}

module.exports = JembaUtils;