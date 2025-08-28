"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showInlineInputBox = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Shows an input box with a decoration at the cursor position
 * @param editor The editor to show the input box in
 * @param placeholder The placeholder text for the input box
 * @returns A promise that resolves with the user's input, or undefined if cancelled
 */
async function showInlineInputBox(editor, placeholder = 'Enter instructions for lazy edit') {
    return new Promise((resolve) => {
        // Create a decoration type for highlighting the cursor position
        const decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: '🔍 Edit Instructions',
                color: new vscode.ThemeColor('editorInfo.foreground'),
                margin: '0 0 0 10px',
                fontStyle: 'italic'
            },
            isWholeLine: true,
            backgroundColor: new vscode.ThemeColor('editorInfo.background'),
            border: '1px solid ' + new vscode.ThemeColor('editor.findMatchHighlightBorder')
        });
        // Get the cursor position
        const position = editor.selection.active;
        const range = new vscode.Range(position.line, 0, position.line, 0);
        // Apply the decoration
        editor.setDecorations(decorationType, [range]);
        // Create an input box for direct user instructions
        const inputOptions = {
            prompt: 'Lazy Edit Instructions',
            placeHolder: placeholder,
            validateInput: value => {
                return value && value.trim().length === 0 ? 'Input cannot be empty' : null;
            },
            ignoreFocusOut: true
        };
        // Show the input box and wait for user input
        vscode.window.showInputBox(inputOptions).then(value => {
            // Remove the decoration when done
            editor.setDecorations(decorationType, []);
            // Resolve with the trimmed value or undefined
            resolve(value ? value.trim() : undefined);
        });
    });
}
exports.showInlineInputBox = showInlineInputBox;
//# sourceMappingURL=inlineInput.js.map