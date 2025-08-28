import * as vscode from 'vscode';
import { ClaudeApiClient } from './api';
import { ChatManager } from './core/chatManager';
import { HtmlRenderer } from './ui/htmlRenderer';

export class ChatPanel {
  public static currentPanel: ChatPanel | undefined;
  public _panel: vscode.WebviewPanel;
  private _chatManager: ChatManager;
  private _disposables: vscode.Disposable[] = [];

  public constructor(panel: vscode.WebviewPanel, chatManager: ChatManager) {
    this._panel = panel;
    this._chatManager = chatManager;

    // Set initial content
    this._updateWebview();

    // Fetch available models
    this._chatManager.fetchAvailableModels().then(() => {
      this._updateWebview();
    });

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'sendMessage':
            await this._chatManager.handleUserMessage(message.text, message.task);
            this._updateWebview();
            break;
          case 'insertCode':
            this._insertCodeToEditor(message.code);
            break;
          case 'selectModel':
            await this._chatManager.handleModelSelection(message.model);
            this._updateWebview();
            break;
          case 'refreshModels':
            await this._chatManager.fetchAvailableModels();
            this._updateWebview();
            break;
          case 'clearHistory':
            this._chatManager.clearMessages();
            this._updateWebview();
            break;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Set the lazy edit state
   */
  public setLazyEditState(
    code: string,
    language: string,
    editor: vscode.TextEditor,
    selection: vscode.Selection
  ): void {
    this._chatManager.setLazyEditState(code, language, editor, selection);
    this._updateWebview();
  }
  
  public static createOrShow(extensionUri: vscode.Uri, chatManager: ChatManager) {
    const column = vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.One;

    // If the panel already exists, reveal it
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel._panel.reveal(column); 
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'claudeChatView',
      'Rica',
      column,{
        enableScripts: true,
        localResourceRoots: [extensionUri]
      }
    );

    ChatPanel.currentPanel = new ChatPanel(panel, chatManager);
  }

  private _insertCodeToEditor(code: string) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.edit(editBuilder => {
        if (editor.selection.isEmpty) {
          editBuilder.insert(editor.selection.active, code);
        } else {
          editBuilder.replace(editor.selection, code);
        }
      });
    }
  }

  private _updateWebview() {
    this._panel.webview.html = this._getWebviewContent();
  }

  private _getWebviewContent() {
    return HtmlRenderer.generateChatHtml(
      this._chatManager.modelSelectorState,
      this._chatManager.apiClient,
      this._chatManager.messages
    );
  }

  public dispose() {
    ChatPanel.currentPanel = undefined;
    if (this._panel) {
      // Proper cleanup code here
    }
    this._disposables.forEach((disposable) => disposable.dispose());
  }
}
