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
exports.applyLazyEdit = void 0;
const vscode = __importStar(require("vscode"));
const utils_1 = require("./utils");
const utils_2 = require("../utils");
const abortManager_1 = require("./abortManager");
/**
 * Apply a lazy edit to the given editor
 * @param apiClient The API client to use for the edit
 * @param options The options for the lazy edit
 * @returns A promise that resolves with the result of the lazy edit
 */
async function applyLazyEdit(apiClient, options) {
    const { editor, selection, languageId, entireDocument } = options;
    const document = editor.document;
    // Get the current model from configuration to ensure we're using the same model as the chat panel
    const config = vscode.workspace.getConfiguration('claudeCodeAssistant');
    const currentModel = config.get('model');
    // Update the API client's model if it's different from the current one
    if (currentModel && currentModel !== apiClient.getModel()) {
        apiClient.setModel(currentModel);
    }
    try {
        // Show a progress notification
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Applying lazy edit...',
            cancellable: true
        }, async (progress, token) => {
            // Create abort controller
            const abortManager = abortManager_1.LazyEditAbortManager.getInstance();
            const editId = `lazy-edit-${Date.now()}`;
            const abortController = abortManager.get(editId);
            // Handle cancellation
            token.onCancellationRequested(() => {
                abortManager.abort(editId);
                return { success: false, error: 'Operation cancelled' };
            });
            progress.report({ message: 'Getting document content...' });
            // Get the content to edit
            let textToEdit;
            let editRange;
            if (entireDocument || !selection || selection.isEmpty) {
                // Edit the entire document
                textToEdit = document.getText();
                const lastLine = document.lineCount - 1;
                const lastChar = document.lineAt(lastLine).text.length;
                editRange = new vscode.Range(0, 0, lastLine, lastChar);
            }
            else {
                // Edit the selected text
                textToEdit = document.getText(selection);
                editRange = selection;
            }
            progress.report({ message: 'Preparing edit prompt...' });
            // Create the prompt for the lazy edit
            const prompt = (0, utils_1.createLazyEditPrompt)(textToEdit, document.fileName, options.userInstructions);
            progress.report({ message: 'Sending to API...' });
            // Send the prompt to the API
            const request = {
                input: prompt,
                language: (0, utils_2.getLanguageId)(languageId),
                maxTokens: 4000
            };
            const response = await apiClient.agentRequest(request);
            progress.report({ message: 'Processing response...' });
            // Extract the code from the response
            const extractedCode = (0, utils_1.extractCodeFromResponse)(response);
            if (!extractedCode) {
                return {
                    success: false,
                    error: 'Failed to extract code from API response'
                };
            }
            // Process the response to handle UNCHANGED_CODE markers
            const processedCode = (0, utils_1.processLazyEditResponse)(textToEdit, extractedCode);
            progress.report({ message: 'Applying edits...' });
            // Apply the edits to the editor
            const editSuccess = await (0, utils_1.applyEditToEditor)(editor, processedCode, new vscode.Selection(editRange.start, editRange.end));
            if (!editSuccess) {
                return {
                    success: false,
                    error: 'Failed to apply edits to editor'
                };
            }
            // Clean up
            abortManager.abort(editId);
            return {
                success: true,
                content: processedCode
            };
        });
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
exports.applyLazyEdit = applyLazyEdit;
//# sourceMappingURL=lazyEdit.js.map