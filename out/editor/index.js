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
exports.registerEditorCommands = void 0;
const vscode = __importStar(require("vscode"));
const utils_1 = require("../utils");
const lazyEdit_1 = require("./lazyEdit");
const inlineInput_1 = require("./inlineInput");
const ghostCompletion_1 = require("./ghostCompletion");
/**
 * Register the editor commands
 * @param context The extension context
 * @param apiClient The API client to use for the editor
 */
function registerEditorCommands(context, apiClient) {
    // Initialize ghost completion manager
    const ghostCompletionManager = ghostCompletion_1.GhostCompletionManager.getInstance(apiClient);
    context.subscriptions.push({
        dispose: () => ghostCompletionManager.dispose()
    });
    // Register the lazy edit command
    const lazyEditCommand = vscode.commands.registerCommand('claudeCodeAssistant.lazyEdit', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        // Get the selection or entire document
        const selection = editor.selection;
        const document = editor.document;
        // Get the selected text or entire document
        let code;
        if (selection.isEmpty) {
            // Use entire document if no selection
            code = document.getText();
        }
        else {
            // Use selected text
            code = document.getText(selection);
        }
        // Get language ID
        const language = (0, utils_1.getLanguageId)(document.languageId);
        // Show an inline input box at the cursor position
        const userInput = await (0, inlineInput_1.showInlineInputBox)(editor, 'e.g., Refactor this code to use async/await');
        if (userInput) {
            // Show progress notification
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Applying lazy edit...',
                cancellable: true
            }, async (progress, token) => {
                progress.report({ message: 'Processing your request...' });
                // Apply the lazy edit directly with user instructions
                const result = await (0, lazyEdit_1.applyLazyEdit)(apiClient, {
                    editor,
                    selection,
                    languageId: language,
                    entireDocument: selection.isEmpty,
                    userInstructions: userInput
                });
                if (result.success) {
                    vscode.window.showInformationMessage('Lazy edit applied successfully!');
                }
                else {
                    vscode.window.showErrorMessage(`Failed to apply lazy edit: ${result.error}`);
                }
            });
        }
    });
    // Add the command to the context
    context.subscriptions.push(lazyEditCommand);
}
exports.registerEditorCommands = registerEditorCommands;
// No exports needed
//# sourceMappingURL=index.js.map