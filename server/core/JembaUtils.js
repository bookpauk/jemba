const { JembaDb, JembaDbThread } = require('jembadb');
const ayncExit = new (require('./AsyncExit'))();//singleton

class JembaUtils {
    constructor() {
        this._dbConn = {};

        //public exported methods & objects
        this.vars = {};
        this.cwd = process.cwd;
        this.require = require;
    }

    _use(connName, thread) {
        let db = this._dbConn[connName];
        if (!db) {
            if (thread)
                db = new JembaDbThread();
            else
                db = new JembaDb();
            ayncExit.add(db.unlock.bind(db));
            this._dbConn[connName] = db;
        }

        return db;
    }

    //public exported methods
    use(connName) {
        return this._use(connName);
    }

    useThread(connName) {
        return this._use(connName, true);
    }
}

module.exports = JembaUtils;