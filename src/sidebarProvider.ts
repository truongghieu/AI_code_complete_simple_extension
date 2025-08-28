import * as vscode from 'vscode';
import { ChatManager } from './core/chatManager';
import { BaseWebviewProvider } from './ui/baseWebviewProvider';

export class SidebarProvider extends BaseWebviewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  
  constructor(extensionUri: vscode.Uri, chatManager: ChatManager) {
    super(extensionUri, chatManager);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    this._updateWebview();
    
    // Fetch available models
    this._chatManager.fetchAvailableModels().then(() => {
      this._updateWebview();
    });

    // Set up message handling
    this.setupWebviewMessageHandling(webviewView.webview, () => {
      this._updateWebview();
    });
  }

  private _updateWebview() {
    if (this._view) {
      this._view.webview.html = this.generateWebviewHtml();
    }
  }
}
