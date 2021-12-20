module.exports = {
    up: [
        ['create', {
            table: 'cli-config'
        }],
        ['create', {
            table: 'webui-config'
        }],
    ],    
    down: [
        ['drop', {
            table: 'cli-config'
        }],
        ['drop', {
            table: 'webui-config'
        }],
    ]
};
