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
exports.ChatManager = void 0;
const vscode = __importStar(require("vscode"));
const utils_1 = require("../utils");
/**
 * Core chat management functionality shared between different UI components
 */
class ChatManager {
    constructor(_apiClient) {
        this._apiClient = _apiClient;
        this._messages = [];
        this._lazyEditState = {
            isActive: false,
            code: '',
            language: ''
        };
        this._modelSelectorState = {
            isLoading: false,
            error: null,
            selectedModel: _apiClient.getModel()
        };
    }
    // Getters
    get messages() {
        return this._messages;
    }
    get modelSelectorState() {
        return this._modelSelectorState;
    }
    get lazyEditState() {
        return this._lazyEditState;
    }
    get apiClient() {
        return this._apiClient;
    }
    // Message management
    addMessage(message) {
        this._messages.push(message);
    }
    clearMessages() {
        this._messages = [];
    }
    // Model management
    async handleModelSelection(modelName) {
        if (modelName && modelName !== this._modelSelectorState.selectedModel) {
            this._apiClient.setModel(modelName);
            this._modelSelectorState.selectedModel = modelName;
            // Save to configuration
            const config = vscode.workspace.getConfiguration('claudeCodeAssistant');
            await config.update('model', modelName, true);
            // Add system message
            this.addMessage({
                role: 'system',
                content: `Model changed to ${modelName}`
            });
        }
    }
    async fetchAvailableModels() {
        try {
            this._modelSelectorState.isLoading = true;
            this._modelSelectorState.error = null;
            await this._apiClient.fetchAvailableModels();
            this._modelSelectorState.isLoading = false;
        }
        catch (error) {
            this._modelSelectorState.isLoading = false;
            this._modelSelectorState.error = error instanceof Error ? error.message : 'Failed to fetch models';
        }
    }
    // Lazy edit management
    setLazyEditState(code, language, editor, selection) {
        this._lazyEditState = {
            isActive: true,
            code,
            language,
            editor,
            selection
        };
        const fileName = editor.document.fileName.split(/[\\/]/).pop() || 'file';
        const startLine = selection.start.line + 1;
        const endLine = selection.end.line + 1;
        const lineCount = code.split('\n').length;
        this.addMessage({
            role: 'system',
            content: `Lazy Edit Mode activated. 
      
Selected code from ${fileName} (${lineCount} lines, lines ${startLine}-${endLine})
      
Please provide instructions on how you'd like to improve or modify this code.`
        });
        this.addMessage({
            role: 'assistant',
            content: `I'm ready to help you modify your selected code. Please describe what changes you'd like to make.`
        });
    }
    resetLazyEditState() {
        this._lazyEditState = {
            isActive: false,
            code: '',
            language: ''
        };
    }
    // Message handling
    async handleUserMessage(text, task = 'suggest') {
        if (this._lazyEditState.isActive) {
            return this.handleLazyEditMessage(text);
        }
        return this.handleRegularMessage(text, task);
    }
    async handleRegularMessage(text, task) {
        // Add system prompt
        const systemPrompt = `You are a helpful coding assistant. Please provide code solutions, explanations, or other relevant information to assist the user.
  
You can control VSCode directly using <edit_command> tags. For example:

<edit_command>
replace "oldCode" with "newCode"
</edit_command>

Available commands:
1. replace "oldText" with "newText" - Replace text in the current file
2. insert "text" at line 10 - Insert text at a specific line
3. insert "text" at cursor - Insert text at the current cursor position
4. delete lines 10-15 - Delete a range of lines
5. create file "path/to/file.js" with "content" - Create a new file with content
6. open file "path/to/file.js" - Open an existing file

Use these commands to directly modify code or create files as needed.`;
        this.addMessage({ role: 'system', content: systemPrompt });
        this.addMessage({ role: 'user', content: text });
        try {
            vscode.window.setStatusBarMessage('$(loading~spin) Rica is thinking...', 60000);
            const editor = vscode.window.activeTextEditor;
            let editorContent = null;
            let language = '';
            let documentUri = null;
            if (editor) {
                const document = editor.document;
                documentUri = document.uri;
                const selection = editor.selection;
                if (selection && !selection.isEmpty) {
                    editorContent = document.getText(selection);
                }
                else {
                    editorContent = document.getText();
                }
                language = (0, utils_1.getLanguageId)(document.languageId);
            }
            let enhancedInput = text;
            if (editorContent) {
                enhancedInput = `${systemPrompt}\n\n${text}\n\nCurrent file content:\n\`\`\`${language}\n${editorContent}\n\`\`\``;
            }
            else {
                enhancedInput = `${systemPrompt}\n\n${text}`;
            }
            const request = {
                input: enhancedInput,
                language: '',
                maxTokens: 2000,
            };
            const response = await this._apiClient.agentRequest(request);
            this.addMessage({ role: 'assistant', content: response });
            // Parse response for code changes if we have editor content
            if (editorContent && documentUri) {
                await this.parseAndApplyCodeChanges(response, editorContent, documentUri);
            }
        }
        catch (error) {
            this.addMessage({
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
            });
        }
        finally {
            vscode.window.setStatusBarMessage('');
        }
    }
    async handleLazyEditMessage(text) {
        this.addMessage({ role: 'user', content: text });
        try {
            vscode.window.setStatusBarMessage('$(loading~spin) Rica is applying lazy edit...', 60000);
            if (!this._lazyEditState.editor || !this._lazyEditState.code) {
                throw new Error('Lazy edit state is incomplete');
            }
            const lazyEditPrompt = `
You are an expert code editor. I'll provide you with code that needs to be improved or modified based on specific instructions.

ORIGINAL CODE:
\`\`\`${this._lazyEditState.language}
${this._lazyEditState.code}
\`\`\`

USER INSTRUCTIONS:
${text}

Please analyze and improve this code according to the user's instructions. Your response should be a code block containing a rewritten version of the file.

When parts of the code remain unchanged, you may indicate this with a comment that says "UNCHANGED CODE" instead of rewriting that section.
Keep at least one line above and below from the original code when using "UNCHANGED CODE", so that we can identify what the previous code was.
Do not place "UNCHANGED CODE" comments at the top or bottom of the file when there is nothing to replace them.
The code should always be syntactically valid, even with these comments.

Your improved code:
\`\`\`${this._lazyEditState.language}`;
            const request = {
                input: lazyEditPrompt,
                language: this._lazyEditState.language,
                maxTokens: 4000
            };
            const response = await this._apiClient.agentRequest(request);
            this.addMessage({ role: 'assistant', content: response });
            // Extract and apply code changes
            const codeBlockRegex = /```(?:\w*\n|\n)([\s\S]*?)```/g;
            const matches = [...response.matchAll(codeBlockRegex)];
            if (matches.length > 0) {
                const extractedCode = matches[0][1].trim();
                const processedCode = this.processLazyEditResponse(extractedCode);
                if (this._lazyEditState.editor && this._lazyEditState.selection) {
                    const success = await this._lazyEditState.editor.edit(editBuilder => {
                        editBuilder.replace(this._lazyEditState.selection, processedCode);
                    });
                    this.addMessage({
                        role: 'system',
                        content: success ? 'Lazy edit applied successfully!' : 'Failed to apply lazy edit to the editor.'
                    });
                }
            }
            else {
                this.addMessage({
                    role: 'system',
                    content: 'No code block found in the response.'
                });
            }
            this.resetLazyEditState();
        }
        catch (error) {
            this.addMessage({
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
            });
            this.resetLazyEditState();
        }
        finally {
            vscode.window.setStatusBarMessage('');
        }
    }
    processLazyEditResponse(editedCode) {
        if (!this._lazyEditState.code) {
            return editedCode;
        }
        const originalCode = this._lazyEditState.code;
        const originalLines = originalCode.split('\n');
        const editedLines = editedCode.split('\n');
        const resultLines = [];
        let i = 0;
        while (i < editedLines.length) {
            const line = editedLines[i];
            if (line.includes('UNCHANGED CODE')) {
                let contextAbove = '';
                let contextBelow = '';
                if (i > 0) {
                    contextAbove = editedLines[i - 1];
                }
                if (i < editedLines.length - 1) {
                    contextBelow = editedLines[i + 1];
                }
                const originalSection = this.findOriginalSection(originalLines, contextAbove, contextBelow);
                if (originalSection && originalSection.length > 0) {
                    resultLines.push(...originalSection);
                }
                else {
                    resultLines.push(line);
                }
                i++;
            }
            else {
                resultLines.push(line);
                i++;
            }
        }
        return resultLines.join('\n');
    }
    findOriginalSection(originalLines, contextAbove, contextBelow) {
        let startIndex = -1;
        let endIndex = -1;
        for (let i = 0; i < originalLines.length; i++) {
            if (originalLines[i].trim() === contextAbove.trim()) {
                startIndex = i + 1;
                break;
            }
        }
        for (let i = startIndex; i < originalLines.length; i++) {
            if (originalLines[i].trim() === contextBelow.trim()) {
                endIndex = i - 1;
                break;
            }
        }
        if (startIndex >= 0 && endIndex >= startIndex) {
            return originalLines.slice(startIndex, endIndex + 1);
        }
        if (startIndex >= 0) {
            for (let i = startIndex; i < originalLines.length; i++) {
                if (originalLines[i].trim() === '' || originalLines[i].trim() === contextBelow.trim()) {
                    return originalLines.slice(startIndex, i);
                }
            }
            return originalLines.slice(startIndex, Math.min(startIndex + 10, originalLines.length));
        }
        return undefined;
    }
    async parseAndApplyCodeChanges(response, originalCode, documentUri) {
        // Implementation would be moved from chatPanel.ts
        // This is a simplified version for the restructure
        const replaceRegex = /```replace\s*\n([\s\S]*?)\n```\s*\n```with\s*\n([\s\S]*?)\n```/g;
        let match;
        const replacements = [];
        while ((match = replaceRegex.exec(response)) !== null) {
            const originalText = match[1].trim();
            const newText = match[2].trim();
            if (originalText && newText && originalCode.includes(originalText)) {
                replacements.push({ originalText, newText });
            }
        }
        if (replacements.length > 0) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.uri.toString() === documentUri.toString()) {
                await editor.edit(editBuilder => {
                    for (const replacement of replacements) {
                        const document = editor.document;
                        const text = document.getText();
                        const startPos = document.positionAt(text.indexOf(replacement.originalText));
                        const endPos = document.positionAt(text.indexOf(replacement.originalText) + replacement.originalText.length);
                        if (startPos && endPos) {
                            const range = new vscode.Range(startPos, endPos);
                            editBuilder.replace(range, replacement.newText);
                        }
                    }
                });
                vscode.window.showInformationMessage('Applied code changes from AI response');
            }
        }
    }
}
exports.ChatManager = ChatManager;
//# sourceMappingURL=chatManager.js.map