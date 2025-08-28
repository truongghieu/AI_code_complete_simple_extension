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
exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const api_1 = require("./api");
const chatManager_1 = require("./core/chatManager");
const sidebarProvider_1 = require("./sidebarProvider");
const editor_1 = require("./editor");
function activate(context) {
    console.log('AI Chat extension is now active!');
    // Get configuration
    const config = vscode.workspace.getConfiguration('claudeCodeAssistant');
    const apiUrl = config.get('apiUrl') || 'http://127.0.0.1:11434';
    const model = config.get('model') || 'databricks-claude-sonnet-4';
    const autoRefreshModels = config.get('autoRefreshModels') || true;
    // Create shared API client and chat manager
    const apiClient = new api_1.ClaudeApiClient(apiUrl, model);
    const chatManager = new chatManager_1.ChatManager(apiClient);
    // Auto-refresh models if enabled
    if (autoRefreshModels) {
        chatManager.fetchAvailableModels().then(() => {
            console.log('Available models refreshed on startup');
        }).catch(err => {
            console.error('Failed to refresh models on startup:', err);
        });
    }
    // Register sidebar provider for activity bar view
    const sidebarProvider = new sidebarProvider_1.SidebarProvider(context.extensionUri, chatManager);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("claudeCodeAssistantView", sidebarProvider));
    // Register sidebar provider for panel view
    const panelProvider = new sidebarProvider_1.SidebarProvider(context.extensionUri, chatManager);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("claudeCodeAssistantPanelView", panelProvider));
    // Register sidebar provider for secondary sidebar view
    const secondarySidebarProvider = new sidebarProvider_1.SidebarProvider(context.extensionUri, chatManager);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("claudeCodeAssistantSecondaryView", secondarySidebarProvider));
    // Register command to refresh models
    context.subscriptions.push(vscode.commands.registerCommand('claudeCodeAssistant.refreshModels', async () => {
        try {
            vscode.window.setStatusBarMessage('$(loading~spin) Refreshing available models...', 5000);
            await chatManager.fetchAvailableModels();
            vscode.window.showInformationMessage('Models refreshed successfully');
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to refresh models');
            console.error('Error refreshing models:', error);
        }
    }));
    // Register editor commands
    (0, editor_1.registerEditorCommands)(context, apiClient);
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map