function versionText(config) {
    return `${config.name} v${config.version}, jembaDb v${config.jembaDbVersion}, Node.js ${process.version}`;
}

module.exports = {
    versionText,
};