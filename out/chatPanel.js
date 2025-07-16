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
exports.ChatPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const api_1 = require("./api");
const utils_1 = require("./utils");
const chatPanelTemplate_1 = require("./chatPanelTemplate");
class ChatPanel {
    constructor(panel, apiClient) {
        this._messages = [];
        this._disposables = [];
        this._modelSelectorState = {
            isLoading: false,
            error: null,
            selectedModel: ''
        };
        this._lazyEditState = {
            isActive: false,
            code: '',
            language: ''
        };
        this._panel = panel;
        this._apiClient = apiClient;
        this._modelSelectorState.selectedModel = apiClient.getModel();
        // Set initial content
        this._updateWebview();
        // Fetch available models
        this._fetchAvailableModels();
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await this._handleUserMessage(message.text, message.task);
                    break;
                case 'insertCode':
                    this._insertCodeToEditor(message.code);
                    break;
                case 'selectModel':
                    await this._handleModelSelection(message.model);
                    break;
                case 'refreshModels':
                    await this._fetchAvailableModels();
                    break;
                case 'clearHistory':
                    this._messages = [];
                    this._updateWebview();
                    break;
            }
        }, null, this._disposables);
    }
    /**
     * Handle model selection from the UI
     */
    async _handleModelSelection(modelName) {
        if (modelName && modelName !== this._modelSelectorState.selectedModel) {
            this._apiClient.setModel(modelName);
            this._modelSelectorState.selectedModel = modelName;
            // Save to configuration
            const config = vscode.workspace.getConfiguration('claudeCodeAssistant');
            await config.update('model', modelName, true);
            // Update the webview
            this._updateWebview();
            // Show confirmation message
            this._messages.push({
                role: 'system',
                content: `Model changed to ${modelName}`
            });
            this._updateWebview();
        }
    }
    /**
     * Fetch available models from the API
     */
    async _fetchAvailableModels() {
        try {
            this._modelSelectorState.isLoading = true;
            this._modelSelectorState.error = null;
            this._updateWebview();
            await this._apiClient.fetchAvailableModels();
            this._modelSelectorState.isLoading = false;
            this._updateWebview();
        }
        catch (error) {
            this._modelSelectorState.isLoading = false;
            this._modelSelectorState.error = error instanceof Error ? error.message : 'Failed to fetch models';
            this._updateWebview();
        }
    }
    /**
     * Set the lazy edit state
     * @param code The code to edit
     * @param language The language of the code
     * @param editor The editor containing the code
     * @param selection The selection in the editor
     */
    setLazyEditState(code, language, editor, selection) {
        this._lazyEditState = {
            isActive: true,
            code,
            language,
            editor,
            selection
        };
        // Get the file name and selection range for better context
        const fileName = editor.document.fileName.split(/[\\/]/).pop() || 'file';
        const startLine = selection.start.line + 1; // Convert to 1-based for display
        const endLine = selection.end.line + 1;
        const lineCount = code.split('\n').length;
        // Add a system message to indicate lazy edit mode with file and selection info
        this._messages.push({
            role: 'system',
            content: `Lazy Edit Mode activated. 
      
Selected code from ${fileName} (${lineCount} lines, lines ${startLine}-${endLine})
      
Please provide instructions on how you'd like to improve or modify this code.`
        });
        // Add a marker message instead of showing the actual code
        this._messages.push({
            role: 'assistant',
            content: `I'm ready to help you modify your selected code. Please describe what changes you'd like to make.`
        });
        this._updateWebview();
    }
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.One;
        // If the panel already exists, reveal it
        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._panel.reveal(column);
            return;
        }
        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel('claudeChatView', 'Rica', column, {
            enableScripts: true,
            localResourceRoots: [extensionUri]
        });
        // Get configuration
        const config = vscode.workspace.getConfiguration('claudeCodeAssistant');
        const apiUrl = config.get('apiUrl') || 'http://127.0.0.1:11434';
        const model = config.get('model') || 'databricks-claude-sonnet-4';
        ChatPanel.currentPanel = new ChatPanel(panel, new api_1.ClaudeApiClient(apiUrl, model));
        ChatPanel.currentPanel._panel.webview.html = ChatPanel.currentPanel._getWebviewContent();
    }
    async _handleUserMessage(text, task) {
        // Check if we're in lazy edit mode
        if (this._lazyEditState.isActive) {
            return this._handleLazyEditMessage(text);
        }
        // Add system prompt with edit command instructions
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
        this._messages.push({ role: 'system', content: systemPrompt });
        // Add user message to chat
        this._messages.push({ role: 'user', content: text });
        this._updateWebview();
        try {
            vscode.window.setStatusBarMessage('$(loading~spin) Rica is thinking...', 60000);
            // Get current editor content if text is a special command or automatically include it
            const editor = vscode.window.activeTextEditor;
            let editorContent = null;
            let language = '';
            let documentUri = null;
            // Always capture the current editor content if available
            if (editor) {
                const document = editor.document;
                documentUri = document.uri;
                const selection = editor.selection;
                if (selection && !selection.isEmpty) {
                    // Use selected text
                    editorContent = document.getText(selection);
                }
                else {
                    // Use entire document
                    editorContent = document.getText();
                }
                language = (0, utils_1.getLanguageId)(document.languageId);
            }
            if (text === '/code' || text.startsWith('/code ')) {
                // Explicit code command
                if (editor) {
                    const taskType = text.replace('/code', '').trim() || task || 'complete';
                    const request = {
                        input: editorContent,
                        language: language,
                        maxTokens: 2000,
                    };
                    const response = await this._apiClient.agentRequest(request);
                    this._messages.push({ role: 'assistant', content: response });
                    console.log(`Response for /code: ${response}`);
                    // Parse response for code changes
                    this._parseAndApplyCodeChanges(response, editorContent, documentUri);
                }
                else {
                    this._messages.push({
                        role: 'assistant',
                        content: "No active editor found. Please open a file first."
                    });
                }
            }
            else {
                // Regular message, but include editor content as context
                let enhancedInput = text;
                // If there's an open editor, include its content as context
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
                this._messages.push({ role: 'assistant', content: response });
                console.log(`Response for message: ${response}`);
                // Parse response for code changes if we have editor content
                if (editorContent && documentUri) {
                    this._parseAndApplyCodeChanges(response, editorContent, documentUri);
                }
            }
        }
        catch (error) {
            this._messages.push({
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
            });
        }
        finally {
            vscode.window.setStatusBarMessage('');
            this._updateWebview();
        }
    }
    /**
     * Parse AI response for code change instructions and apply them
     * @param response The AI response text
     * @param originalCode The original code content
     * @param documentUri The URI of the document to modify
     */
    _parseAndApplyCodeChanges(response, originalCode, documentUri) {
        // First check for edit commands
        const hasEditCommands = this._parseAndApplyEditCommands(response);
        // Then check for code replacement sections in the format:
        // ```replace
        // [original code]
        // ```
        // ```with
        // [new code]
        // ```
        const replaceRegex = /```replace\s*\n([\s\S]*?)\n```\s*\n```with\s*\n([\s\S]*?)\n```/g;
        let match;
        let hasChanges = false;
        // Store all replacements to apply them at once
        const replacements = [];
        while ((match = replaceRegex.exec(response)) !== null) {
            const originalText = match[1].trim();
            const newText = match[2].trim();
            if (originalText && newText && originalCode.includes(originalText)) {
                replacements.push({ originalText, newText });
                hasChanges = true;
            }
        }
        // Apply all replacements if any were found
        if (hasChanges) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.uri.toString() === documentUri.toString()) {
                editor.edit(editBuilder => {
                    // Apply replacements in reverse order to avoid position shifts
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
                }).then(success => {
                    if (success) {
                        vscode.window.showInformationMessage('Applied code changes from AI response');
                    }
                    else {
                        vscode.window.showErrorMessage('Failed to apply code changes');
                    }
                });
            }
        }
        return hasEditCommands || hasChanges;
    }
    /**
     * Parse AI response for edit commands and apply them
     * @param response The AI response text
     * @returns Boolean indicating if any edit commands were found and processed
     */
    _parseAndApplyEditCommands(response) {
        // Look for edit commands in the format: <edit_command>...</edit_command>
        const editCommandRegex = /<edit_command>([\s\S]*?)<\/edit_command>/g;
        let match;
        let hasCommands = false;
        while ((match = editCommandRegex.exec(response)) !== null) {
            hasCommands = true;
            const commandContent = match[1].trim();
            try {
                // Parse the command content
                const commandResult = this._executeEditCommand(commandContent);
                console.log(`Executed edit command: ${commandContent}`);
                console.log(`Result: ${commandResult}`);
                // Add system message about the command execution
                this._messages.push({
                    role: 'system',
                    content: `Edit command executed: ${commandResult}`
                });
                this._updateWebview();
            }
            catch (error) {
                console.error('Error executing edit command:', error);
                // Add system message about the error
                this._messages.push({
                    role: 'system',
                    content: `Error executing edit command: ${error instanceof Error ? error.message : String(error)}`
                });
                this._updateWebview();
            }
        }
        return hasCommands;
    }
    /**
     * Execute a specific edit command
     * @param commandContent The content of the edit command
     * @returns A string describing the result of the command execution
     */
    _executeEditCommand(commandContent) {
        // Parse command structure - commands can have different formats
        // Format 1: Simple replacement - replace "oldText" with "newText"
        const replaceMatch = commandContent.match(/replace\s+"(.*?)"\s+with\s+"(.*?)"/s);
        if (replaceMatch) {
            return this._executeReplaceCommand(replaceMatch[1], replaceMatch[2]);
        }
        // Format 2: Insert at line - insert "text" at line 10
        const insertLineMatch = commandContent.match(/insert\s+"(.*?)"\s+at\s+line\s+(\d+)/s);
        if (insertLineMatch) {
            return this._executeInsertAtLineCommand(insertLineMatch[1], parseInt(insertLineMatch[2], 10));
        }
        // Format 3: Insert at cursor - insert "text" at cursor
        const insertCursorMatch = commandContent.match(/insert\s+"(.*?)"\s+at\s+cursor/s);
        if (insertCursorMatch) {
            return this._executeInsertAtCursorCommand(insertCursorMatch[1]);
        }
        // Format 4: Delete lines - delete lines 10-15
        const deleteLinesMatch = commandContent.match(/delete\s+lines\s+(\d+)-(\d+)/);
        if (deleteLinesMatch) {
            return this._executeDeleteLinesCommand(parseInt(deleteLinesMatch[1], 10), parseInt(deleteLinesMatch[2], 10));
        }
        // Format 5: Create file - create file "path/to/file.js" with "content"
        const createFileMatch = commandContent.match(/create\s+file\s+"(.*?)"\s+with\s+"(.*?)"/s);
        if (createFileMatch) {
            return this._executeCreateFileCommand(createFileMatch[1], createFileMatch[2]);
        }
        // Format 6: Open file - open file "path/to/file.js"
        const openFileMatch = commandContent.match(/open\s+file\s+"(.*?)"/);
        if (openFileMatch) {
            return this._executeOpenFileCommand(openFileMatch[1]);
        }
        // If no known command format is matched
        throw new Error(`Unknown edit command format: ${commandContent}`);
    }
    /**
     * Execute a replace command to replace text in the current editor
     * @param oldText The text to replace
     * @param newText The new text to insert
     * @returns A string describing the result
     */
    _executeReplaceCommand(oldText, newText) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }
        const document = editor.document;
        const text = document.getText();
        if (!text.includes(oldText)) {
            throw new Error(`Text "${oldText}" not found in the current document`);
        }
        // Find all occurrences and ask user which one to replace if multiple
        const allMatches = [];
        let searchIndex = 0;
        while (true) {
            const index = text.indexOf(oldText, searchIndex);
            if (index === -1)
                break;
            const startPos = document.positionAt(index);
            const endPos = document.positionAt(index + oldText.length);
            allMatches.push(new vscode.Range(startPos, endPos));
            searchIndex = index + oldText.length;
        }
        if (allMatches.length === 1) {
            // Only one match, replace it directly
            editor.edit(editBuilder => {
                editBuilder.replace(allMatches[0], newText);
            });
            return `Replaced "${oldText}" with "${newText}"`;
        }
        else {
            // Multiple matches, use a quick pick to let the user choose
            // For now, just replace the first occurrence
            editor.edit(editBuilder => {
                editBuilder.replace(allMatches[0], newText);
            });
            return `Replaced first occurrence of "${oldText}" with "${newText}" (${allMatches.length} occurrences found)`;
        }
    }
    /**
     * Execute an insert at line command
     * @param text The text to insert
     * @param lineNumber The line number to insert at (1-based)
     * @returns A string describing the result
     */
    _executeInsertAtLineCommand(text, lineNumber) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }
        const document = editor.document;
        // Adjust for 0-based line numbers
        const adjustedLineNumber = Math.max(0, lineNumber - 1);
        if (adjustedLineNumber >= document.lineCount) {
            throw new Error(`Line ${lineNumber} is beyond the end of the document (${document.lineCount} lines)`);
        }
        const line = document.lineAt(adjustedLineNumber);
        const position = new vscode.Position(adjustedLineNumber, 0);
        editor.edit(editBuilder => {
            editBuilder.insert(position, text + '\n');
        });
        return `Inserted text at line ${lineNumber}`;
    }
    /**
     * Execute an insert at cursor command
     * @param text The text to insert
     * @returns A string describing the result
     */
    _executeInsertAtCursorCommand(text) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }
        editor.edit(editBuilder => {
            editBuilder.insert(editor.selection.active, text);
        });
        return `Inserted text at cursor position`;
    }
    /**
     * Execute a delete lines command
     * @param startLine The first line to delete (1-based)
     * @param endLine The last line to delete (1-based)
     * @returns A string describing the result
     */
    _executeDeleteLinesCommand(startLine, endLine) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }
        const document = editor.document;
        // Adjust for 0-based line numbers
        const adjustedStartLine = Math.max(0, startLine - 1);
        const adjustedEndLine = Math.min(document.lineCount - 1, endLine - 1);
        if (adjustedStartLine > adjustedEndLine) {
            throw new Error(`Invalid line range: ${startLine}-${endLine}`);
        }
        const startPos = new vscode.Position(adjustedStartLine, 0);
        const endPos = new vscode.Position(adjustedEndLine, document.lineAt(adjustedEndLine).text.length);
        const range = new vscode.Range(startPos, endPos);
        editor.edit(editBuilder => {
            editBuilder.delete(range);
        });
        return `Deleted lines ${startLine}-${endLine}`;
    }
    /**
     * Execute a create file command
     * @param filePath The path of the file to create
     * @param content The content to write to the file
     * @returns A string describing the result
     */
    _executeCreateFileCommand(filePath, content) {
        // Normalize the path and make it absolute if it's relative
        let normalizedPath = filePath;
        if (!path.isAbsolute(normalizedPath)) {
            // If the path is relative, make it relative to the workspace root
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder is open');
            }
            normalizedPath = path.join(workspaceFolders[0].uri.fsPath, normalizedPath);
        }
        // Create the directory if it doesn't exist
        const directory = path.dirname(normalizedPath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
        // Write the file
        fs.writeFileSync(normalizedPath, content, 'utf8');
        // Open the file in the editor
        vscode.workspace.openTextDocument(normalizedPath).then(doc => {
            vscode.window.showTextDocument(doc);
        });
        return `Created file "${filePath}"`;
    }
    /**
     * Execute an open file command
     * @param filePath The path of the file to open
     * @returns A string describing the result
     */
    _executeOpenFileCommand(filePath) {
        // Normalize the path and make it absolute if it's relative
        let normalizedPath = filePath;
        if (!path.isAbsolute(normalizedPath)) {
            // If the path is relative, make it relative to the workspace root
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder is open');
            }
            normalizedPath = path.join(workspaceFolders[0].uri.fsPath, normalizedPath);
        }
        // Check if the file exists
        if (!fs.existsSync(normalizedPath)) {
            throw new Error(`File "${filePath}" does not exist`);
        }
        // Open the file in the editor
        vscode.workspace.openTextDocument(normalizedPath).then(doc => {
            vscode.window.showTextDocument(doc);
        });
        return `Opened file "${filePath}"`;
    }
    /**
     * Handle a user message in lazy edit mode
     * @param text The user message text
     */
    async _handleLazyEditMessage(text) {
        // Add user message to chat
        this._messages.push({ role: 'user', content: text });
        this._updateWebview();
        try {
            vscode.window.setStatusBarMessage('$(loading~spin) Rica is applying lazy edit...', 60000);
            // Ensure we have the necessary data
            if (!this._lazyEditState.editor || !this._lazyEditState.code) {
                throw new Error('Lazy edit state is incomplete');
            }
            // Create the prompt for lazy edit
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
            // Send the prompt to the API
            const request = {
                input: lazyEditPrompt,
                language: this._lazyEditState.language,
                maxTokens: 4000
            };
            const response = await this._apiClient.agentRequest(request);
            // Add the response to the chat
            this._messages.push({ role: 'assistant', content: response });
            // Extract code from the response
            const codeBlockRegex = /```(?:\w*\n|\n)([\s\S]*?)```/g;
            const matches = [...response.matchAll(codeBlockRegex)];
            if (matches.length > 0) {
                const extractedCode = matches[0][1].trim();
                // Process the code to handle UNCHANGED CODE markers
                const processedCode = this._processLazyEditResponse(extractedCode);
                // Apply the changes to the editor
                if (this._lazyEditState.editor && this._lazyEditState.selection) {
                    const success = await this._lazyEditState.editor.edit(editBuilder => {
                        editBuilder.replace(this._lazyEditState.selection, processedCode);
                    });
                    if (success) {
                        this._messages.push({
                            role: 'system',
                            content: 'Lazy edit applied successfully!'
                        });
                    }
                    else {
                        this._messages.push({
                            role: 'system',
                            content: 'Failed to apply lazy edit to the editor.'
                        });
                    }
                }
            }
            else {
                this._messages.push({
                    role: 'system',
                    content: 'No code block found in the response.'
                });
            }
            // Reset the lazy edit state
            this._lazyEditState = {
                isActive: false,
                code: '',
                language: ''
            };
        }
        catch (error) {
            this._messages.push({
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
            });
            // Reset the lazy edit state on error
            this._lazyEditState = {
                isActive: false,
                code: '',
                language: ''
            };
        }
        finally {
            vscode.window.setStatusBarMessage('');
            this._updateWebview();
        }
    }
    /**
     * Process the lazy edit response to handle UNCHANGED CODE markers
     * @param editedCode The edited code with UNCHANGED CODE markers
     * @returns The final edited code with UNCHANGED CODE sections replaced
     */
    _processLazyEditResponse(editedCode) {
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
                // Find the context lines (at least one line above and below)
                let contextAbove = '';
                let contextBelow = '';
                // Get context above (if not at the beginning)
                if (i > 0) {
                    contextAbove = editedLines[i - 1];
                }
                // Get context below (if not at the end)
                if (i < editedLines.length - 1) {
                    contextBelow = editedLines[i + 1];
                }
                // Find matching section in original code
                const originalSection = this._findOriginalSection(originalLines, contextAbove, contextBelow);
                if (originalSection && originalSection.length > 0) {
                    // Add the original section
                    resultLines.push(...originalSection);
                }
                else {
                    // If no match found, keep the UNCHANGED CODE line as is
                    resultLines.push(line);
                }
                i++;
            }
            else {
                // Add the edited line
                resultLines.push(line);
                i++;
            }
        }
        return resultLines.join('\n');
    }
    /**
     * Find the original section of code based on context lines
     * @param originalLines The original lines of code
     * @param contextAbove The context line above the UNCHANGED CODE marker
     * @param contextBelow The context line below the UNCHANGED CODE marker
     * @returns The original section of code, or undefined if no match found
     */
    _findOriginalSection(originalLines, contextAbove, contextBelow) {
        // Try to find the context in the original code
        let startIndex = -1;
        let endIndex = -1;
        // Find the context above
        for (let i = 0; i < originalLines.length; i++) {
            if (originalLines[i].trim() === contextAbove.trim()) {
                startIndex = i + 1;
                break;
            }
        }
        // Find the context below
        for (let i = startIndex; i < originalLines.length; i++) {
            if (originalLines[i].trim() === contextBelow.trim()) {
                endIndex = i - 1;
                break;
            }
        }
        // If both context lines were found, return the section
        if (startIndex >= 0 && endIndex >= startIndex) {
            return originalLines.slice(startIndex, endIndex + 1);
        }
        // If only context above was found, try to find a reasonable section
        if (startIndex >= 0) {
            // Look for the next empty line or a line that matches the context below
            for (let i = startIndex; i < originalLines.length; i++) {
                if (originalLines[i].trim() === '' || originalLines[i].trim() === contextBelow.trim()) {
                    return originalLines.slice(startIndex, i);
                }
            }
            // If no empty line found, return a reasonable number of lines
            return originalLines.slice(startIndex, Math.min(startIndex + 10, originalLines.length));
        }
        return undefined;
    }
    _insertCodeToEditor(code) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit(editBuilder => {
                if (editor.selection.isEmpty) {
                    // Insert at cursor position
                    editBuilder.insert(editor.selection.active, code);
                }
                else {
                    // Replace selected text
                    editBuilder.replace(editor.selection, code);
                }
            });
        }
    }
    _updateWebview() {
        this._panel.webview.html = this._getWebviewContent();
    }
    // Updated _getWebviewContent method with improved code formatting
    _getWebviewContent() {
        // Generate model selector HTML
        const models = this._apiClient.getAvailableModels();
        const currentModel = this._modelSelectorState.selectedModel || this._apiClient.getModel();
        let modelSelectorHtml = '';
        if (this._modelSelectorState.isLoading) {
            modelSelectorHtml = '<div class="model-selector-loading">Loading models...</div>';
        }
        else if (this._modelSelectorState.error) {
            modelSelectorHtml = `<div class="model-selector-error">Error: ${this._modelSelectorState.error}</div>`;
        }
        else {
            const modelOptions = models.map(model => `<option value="${model.name}" ${model.name === currentModel ? 'selected' : ''}>${model.displayName || model.name}</option>`).join('');
            modelSelectorHtml = `
        <div class="model-selector">
          <label for="model-select">Model:</label>
          <div class="model-select-container">
            <select id="model-select">
              ${modelOptions.length ? modelOptions : `<option value="${currentModel}" selected>${currentModel}</option>`}
            </select>
            <button id="refresh-models" title="Refresh models list">↻</button>
          </div>
        </div>
      `;
        }
        const messageHtml = this._messages.map(msg => {
            const isUser = msg.role === 'user';
            const isSystem = msg.role === 'system';
            const className = isUser ? 'user-message' : (isSystem ? 'system-message' : 'assistant-message');
            const avatar = isUser ? '👤' : (isSystem ? '🔔' : '🤖');
            // Process message content
            let content = msg.content;
            if (!isUser) {
                // Process code blocks first - preserve them as formatted code
                const codeBlocks = [];
                let codeBlockIndex = 0;
                // Extract and process code blocks
                content = content.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, language, code) => {
                    const lang = language || 'text';
                    const trimmedCode = code.trim();
                    const placeholder = `__CODE_BLOCK_${codeBlockIndex}__`;
                    codeBlocks.push({
                        placeholder,
                        html: `<div class="code-block">
                            <div class="code-header">
                                <span class="language-tag">${lang}</span>
                                <div class="code-actions">
                                    <button class="copy-button" onclick="copyCode(this)" title="Copy to clipboard">Copy</button>
                                    <button class="insert-button" onclick="insertCode(this)" title="Insert into editor">Insert</button>
                                </div>
                            </div>
                            <pre><code class="language-${lang}">${trimmedCode}</code></pre>
                        </div>`
                    });
                    codeBlockIndex++;
                    return placeholder;
                });
                // Also process inline code with backticks before HTML escaping
                const inlineCodeBlocks = [];
                content = content.replace(/`([^`]+)`/g, (match, code) => {
                    const placeholder = `__INLINE_CODE_${codeBlockIndex}__`;
                    inlineCodeBlocks.push({
                        placeholder,
                        html: `<code class="inline-code">${code}</code>`
                    });
                    codeBlockIndex++;
                    return placeholder;
                });
                // Now escape HTML for the rest of the content
                content = this._escapeHtml(content);
                // Restore code blocks
                codeBlocks.forEach(block => {
                    content = content.replace(block.placeholder, block.html);
                });
                // Restore inline code blocks
                inlineCodeBlocks.forEach(block => {
                    content = content.replace(block.placeholder, block.html);
                });
                // Automatically detect and convert URLs to clickable links
                content = content.replace(/https?:\/\/[^\s<>"']+/g, '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>');
                // Convert plain text lists to HTML lists
                content = this._convertTextListsToHtml(content);
                // Replace newlines with <br> tags, but not inside code blocks
                content = content.replace(/\n(?![^<]*<\/pre>)/g, '<br>');
            }
            else {
                // For user messages, just escape HTML
                content = this._escapeHtml(content);
                // Make URLs clickable in user messages too
                content = content.replace(/https?:\/\/[^\s<>"']+/g, '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>');
            }
            return `<div class="message ${className}">
                    <div class="avatar" aria-label="${isUser ? 'User' : 'Assistant'}">${avatar}</div>
                    <div class="content">${content}</div>
                </div>`;
        }).join('');
        // Return the complete HTML template
        return (0, chatPanelTemplate_1.getChatPanelTemplate)(modelSelectorHtml, messageHtml);
    }
    _escapeHtml(text) {
        if (!text)
            return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    /**
     * Converts plain text lists to HTML lists for better visual display
     * This helps display responses in a more structured way without requiring markdown
     * @param text The text to convert
     * @returns The text with plain text lists converted to HTML lists
     */
    _convertTextListsToHtml(text) {
        // Process numbered lists (1. Item)
        let inNumberedList = false;
        let numberedListContent = '';
        const lines = text.split('<br>');
        const processedLines = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const numberedMatch = line.match(/^(\d+)\.\s(.+)$/);
            if (numberedMatch) {
                if (!inNumberedList) {
                    inNumberedList = true;
                    numberedListContent = `<ol><li>${numberedMatch[2]}</li>`;
                }
                else {
                    numberedListContent += `<li>${numberedMatch[2]}</li>`;
                }
            }
            else {
                if (inNumberedList) {
                    inNumberedList = false;
                    numberedListContent += '</ol>';
                    processedLines.push(numberedListContent);
                    processedLines.push(line);
                }
                else {
                    processedLines.push(line);
                }
            }
        }
        if (inNumberedList) {
            numberedListContent += '</ol>';
            processedLines.push(numberedListContent);
        }
        // Process bullet lists (• Item or - Item)
        let result = processedLines.join('<br>');
        let inBulletList = false;
        let bulletListContent = '';
        const bulletLines = result.split('<br>');
        const finalLines = [];
        for (let i = 0; i < bulletLines.length; i++) {
            const line = bulletLines[i];
            const bulletMatch = line.match(/^[\•\-]\s(.+)$/);
            if (bulletMatch) {
                if (!inBulletList) {
                    inBulletList = true;
                    bulletListContent = `<ul><li>${bulletMatch[1]}</li>`;
                }
                else {
                    bulletListContent += `<li>${bulletMatch[1]}</li>`;
                }
            }
            else {
                if (inBulletList) {
                    inBulletList = false;
                    bulletListContent += '</ul>';
                    finalLines.push(bulletListContent);
                    finalLines.push(line);
                }
                else {
                    finalLines.push(line);
                }
            }
        }
        if (inBulletList) {
            bulletListContent += '</ul>';
            finalLines.push(bulletListContent);
        }
        return finalLines.join('<br>');
    }
    dispose() {
        ChatPanel.currentPanel = undefined;
        if (this._panel) {
            // Proper cleanup code here
        }
        this._disposables.forEach((disposable) => disposable.dispose());
    }
}
exports.ChatPanel = ChatPanel;
//# sourceMappingURL=chatPanel.js.map