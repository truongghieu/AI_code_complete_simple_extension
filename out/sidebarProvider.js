"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidebarProvider = void 0;
const baseWebviewProvider_1 = require("./ui/baseWebviewProvider");
class SidebarProvider extends baseWebviewProvider_1.BaseWebviewProvider {
    constructor(extensionUri, chatManager) {
        super(extensionUri, chatManager);
    }
    resolveWebviewView(webviewView, context, _token) {
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
    _updateWebview() {
        if (this._view) {
            this._view.webview.html = this.generateWebviewHtml();
        }
    }
}
exports.SidebarProvider = SidebarProvider;
//# sourceMappingURL=sidebarProvider.js.map