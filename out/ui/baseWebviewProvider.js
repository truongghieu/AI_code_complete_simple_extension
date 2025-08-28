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
exports.BaseWebviewProvider = void 0;
const vscode = __importStar(require("vscode"));
const htmlRenderer_1 = require("./htmlRenderer");
/**
 * Base class for webview providers that use chat functionality
 */
class BaseWebviewProvider {
    constructor(_extensionUri, chatManager) {
        this._extensionUri = _extensionUri;
        this._disposables = [];
        this._chatManager = chatManager;
    }
    setupWebviewMessageHandling(webview, onUpdate) {
        webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await this._chatManager.handleUserMessage(message.text, message.task);
                    onUpdate();
                    break;
                case 'insertCode':
                    this.insertCodeToEditor(message.code);
                    break;
                case 'selectModel':
                    await this._chatManager.handleModelSelection(message.model);
                    onUpdate();
                    break;
                case 'refreshModels':
                    await this._chatManager.fetchAvailableModels();
                    onUpdate();
                    break;
                case 'clearHistory':
                    this._chatManager.clearMessages();
                    onUpdate();
                    break;
            }
        }, null, this._disposables);
    }
    insertCodeToEditor(code) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit(editBuilder => {
                if (editor.selection.isEmpty) {
                    editBuilder.insert(editor.selection.active, code);
                }
                else {
                    editBuilder.replace(editor.selection, code);
                }
            });
        }
    }
    generateWebviewHtml() {
        return htmlRenderer_1.HtmlRenderer.generateChatHtml(this._chatManager.modelSelectorState, this._chatManager.apiClient, this._chatManager.messages);
    }
    dispose() {
        this._disposables.forEach((disposable) => disposable.dispose());
    }
}
exports.BaseWebviewProvider = BaseWebviewProvider;
//# sourceMappingURL=baseWebviewProvider.js.map