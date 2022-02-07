module.exports = {
    up: [
        ['create', {
            table: 'cli'
        }],
        ['create', {
            table: 'webui'
        }],
    ],    
    down: [
        ['drop', {
            table: 'cli'
        }],
        ['drop', {
            table: 'webui'
        }],
    ]
};
