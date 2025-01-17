const path = require('path');
//const { extensions } = require('vscode');

module.exports = [
    {
        target: 'node',
        entry: './client/extension.ts',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'extension.js',
            libraryTarget: 'commonjs2',
        },
        resolve: {
            extensions: ['.js', '.ts'],
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: 'ts-loader',
                },
            ],
        },
        externals: {
            vscode: 'commonjs vscode'
        },
    },
    {
        target: 'node',
        entry: './server/server.ts',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'server.js',
            libraryTarget: 'commonjs2',
        },
        resolve: {
            extensions: ['.js', '.ts'],
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: 'ts-loader',
                },
            ],
        },
        externals: {
            vscode: 'commonjs vscode'
        },
    }
];