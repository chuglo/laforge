import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

// Create the connection and text document manager
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// On server initialization
connection.onInitialize(() => {
  connection.console.log("LaForge Language Server Initialized");
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
    },
  };
});

// Define validation rules
type ValidationRule = (text: string, document: TextDocument) => Diagnostic[];

const checkMissingCommas: ValidationRule = (text, document) => {
  const diagnostics: Diagnostic[] = [];
  const missingCommaRegex = /\[([^\]]*?[^,\s])\s+("[^\]]")/g;
  let match: RegExpExecArray | null;

  while ((match = missingCommaRegex.exec(text))) {
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: document.positionAt(match.index),
        end: document.positionAt(match.index + match[0].length),
      },
      message: "Missing comma between array elements.",
      source: "laforge-linter",
    });
  }

  return diagnostics;
};

const validationRules: ValidationRule[] = [checkMissingCommas];

// Debounced diagnostic logic
let debounceTimeout: NodeJS.Timeout;
documents.onDidChangeContent((change) => {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    const text = change.document.getText();
    const diagnostics = validationRules.flatMap((rule) => rule(text, change.document));
    connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
  }, 200);
});

// Start listening for documents and connection
documents.listen(connection);
connection.listen();

connection.console.log("LaForge Language Server is now listening.");
