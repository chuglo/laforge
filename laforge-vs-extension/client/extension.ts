import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('laforge');

    // Lint all currently open documents when the extension activates
    vscode.workspace.textDocuments.forEach((document) => {
      if (isLaForgeFile(document)) {
          console.log(`Linting already open file: ${document.fileName}`);
          lintLaForgeFile(document, diagnosticCollection);
      }
    });

    // Lint the file when first opened
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => {
            if (isLaForgeFile(document)) {
                lintLaForgeFile(document, diagnosticCollection);
            }
        })
    );

    // Lint on save
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (isLaForgeFile(document)) {
          lintLaForgeFile(document, diagnosticCollection);
        }
      })
    );

    // Clear diagnostics when the file is closed
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument((document) => {
            if (isLaForgeFile(document)) {
                diagnosticCollection.delete(document.uri);
            }
        })
    );
}

export function deactivate() {}

// Check if the file is a LaForge file (e.g., based on file extension)
function isLaForgeFile(document: vscode.TextDocument): boolean {
    return document.languageId === 'json' || document.fileName.endsWith('.laforge');
}

// As of right now, this just looks for a lack of commas in "included_hosts" arrays from env.laforge files
// and ensures that it can see the existence of other laforge files referenced in env.laforge files
function lintLaForgeFile(
    document: vscode.TextDocument,
    diagnosticCollection: vscode.DiagnosticCollection
) {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const laforgeRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    if (!laforgeRoot) {
        console.error('Workspace root is not defined.');
        return;
    }

    // Regex to match included_hosts and paths inside quotes
    const arrayRegex = /included_hosts\s*=\s*\[([\s\S]*?)\]/g;
    const pathRegex = /"([^"]+)"/g;

    let match: RegExpExecArray | null;

    // Process each match of included_hosts
    while ((match = arrayRegex.exec(text)) !== null) {
        const arrayContent = match[1];
        const arrayStart = match.index;

        processArrayContent(arrayContent, arrayStart, text, laforgeRoot, pathRegex, diagnostics);
    }

    // Set diagnostics for the document
    diagnosticCollection.set(document.uri, diagnostics);
}

function processArrayContent(
    arrayContent: string,
    arrayStart: number,
    text: string,
    laforgeRoot: string,
    pathRegex: RegExp,
    diagnostics: vscode.Diagnostic[]
) {
    const lines = arrayContent.split('\n');

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();

        // Skip empty lines or full-line comments
        if (!trimmedLine || trimmedLine.startsWith('//')) return;

        // Remove inline comments
        const lineWithoutComments = trimmedLine.split('//')[0].trim();
        if (!lineWithoutComments) return;

        checkMissingComma(lineWithoutComments, index, lines, text, arrayStart, diagnostics);
        checkFileExistence(lineWithoutComments, laforgeRoot, pathRegex, text, arrayStart, diagnostics);
    });
}

function checkMissingComma(
    line: string,
    index: number,
    lines: string[],
    text: string,
    arrayStart: number,
    diagnostics: vscode.Diagnostic[]
) {
    const hasComma = line.endsWith(',');
    const isLastElement = index === lines.length - 1 || lines[index + 1].trim().startsWith(']');

    if (!hasComma && !isLastElement) {
        const elementStart = text.indexOf(line, arrayStart);
        const range = new vscode.Range(
            textToPosition(text, elementStart),
            textToPosition(text, elementStart + line.length)
        );

        diagnostics.push(
            new vscode.Diagnostic(
                range,
                `Missing comma after: "${line}"`,
                vscode.DiagnosticSeverity.Error
            )
        );
    }
}

function checkFileExistence(
    line: string,
    laforgeRoot: string,
    pathRegex: RegExp,
    text: string,
    arrayStart: number,
    diagnostics: vscode.Diagnostic[]
) {
    let match: RegExpExecArray | null;

    while ((match = pathRegex.exec(line)) !== null) {
        const relativePath = match[1];

        // Ensure the file path has the `.laforge` extension
        const filePath = relativePath.endsWith('.laforge')
            ? path.join(laforgeRoot, relativePath)
            : path.join(laforgeRoot, `${relativePath}.laforge`);

        console.log(`Checking file: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            console.log(`File not found: ${filePath}`);
            const elementStart = text.indexOf(relativePath, arrayStart);
            const range = new vscode.Range(
                textToPosition(text, elementStart),
                textToPosition(text, elementStart + relativePath.length)
            );

            diagnostics.push(
                new vscode.Diagnostic(
                    range,
                    `Referenced file does not exist in workspace: "${relativePath}"`,
                    vscode.DiagnosticSeverity.Error
                )
            );
        }
    }
}

function textToPosition(text: string, offset: number): vscode.Position {
    const lines = text.slice(0, offset).split('\n');
    const line = lines.length - 1;
    const character = lines[line].length;
    return new vscode.Position(line, character);
}
