module.exports = {
    up: [
        ['create', {
            table: 'webui'
        }],
    ],    
    down: [
        ['drop', {
            table: 'webui'
        }],
    ]
};
