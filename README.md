# Rica

A VS Code extension that lets you chat with Claude AI to optimize, document, and get code suggestions directly within your editor.


## Features

- Chat with Claude AI directly within VS Code from multiple locations (activity bar, panel, or auxiliary bar)
- Get help with code optimization and refactoring
- Generate documentation for your code
- Receive code suggestions and alternatives
- Complete partial code snippets
- Apply "Lazy Edit" to quickly modify code based on natural language instructions
- Automatically includes current file content for context-aware assistance
- Execute powerful edit commands directly from AI responses

## Installation

1. Install the Rica extension from the VS Code Marketplace or by downloading the VSIX file
2. Configure the extension with your API server URL and preferred model
3. Start chatting with Rica to get AI-powered code assistance

## Usage

### Opening Rica

You can access Rica in three different ways:

1. **Activity Bar**: Click on the Rica icon in the activity bar (side panel)
2. **Panel**: Open Rica in the bottom panel area
3. **Auxiliary Bar**: Use Rica in the secondary sidebar
4. **Command Palette**: Run "Open Rica Chat" from the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)

### Basic Chat

1. Type your question or code-related query in the chat input
2. Rica automatically includes the content of your current open file with every request
3. Receive AI-powered responses with code suggestions, explanations, and more

### Special Commands

- **Lazy Edit**: Select code and press `Ctrl+L` (or `Cmd+L` on Mac) to activate Lazy Edit mode, then describe the changes you want in natural language
- **Code Analysis**: Type `/code` to explicitly analyze the current file or selection
- **Model Selection**: Choose different Claude models from the dropdown in the chat panel

### Edit Commands

Rica can directly modify your code using edit commands. The AI can use these commands in its responses:

```
<edit_command>
replace "oldCode" with "newCode"
</edit_command>
```

Available edit commands:
1. `replace "oldText" with "newText"` - Replace text in the current file
2. `insert "text" at line 10` - Insert text at a specific line
3. `insert "text" at cursor` - Insert text at the current cursor position
4. `delete lines 10-15` - Delete a range of lines
5. `create file "path/to/file.js" with "content"` - Create a new file with content
6. `open file "path/to/file.js"` - Open an existing file

### Automatic Code Changes

When Rica suggests code changes, it can also use a special format that will be automatically applied:

```
```replace
// Original code here
```

```with
// New code here
```
```

### Lazy Edit Mode

Lazy Edit is a powerful feature that allows you to modify code using natural language instructions:

1. Select the code you want to modify
2. Press `Ctrl+L` (or `Cmd+L` on Mac) to activate Lazy Edit mode
3. Describe the changes you want in natural language (e.g., "Add error handling", "Convert to async/await", etc.)
4. Rica will analyze your code and apply the requested changes

## Commands

- **Open Rica Chat**: Open the Rica chat panel
- **Refresh Available Models**: Refresh the list of available Claude models
- **Apply Lazy Edit to Current File**: Activate Lazy Edit mode for the current file or selection

## Keyboard Shortcuts

- `Ctrl+L` (Windows/Linux) or `Cmd+L` (Mac): Activate Lazy Edit mode for the current file or selection

## Configuration

In your VS Code settings:

- `claudeCodeAssistant.apiUrl`: URL of the API server (default: "http://127.0.0.1:11434")
- `claudeCodeAssistant.model`: Model name to use for API requests (default: "databricks-claude-sonnet-4")
- `claudeCodeAssistant.autoRefreshModels`: Automatically refresh available models when the extension starts (default: true)

## Requirements

- VS Code 1.101.0 or higher
- A running API server compatible with Ollama or OpenAI API format

## How It Works

Rica connects to a local API server that provides access to Claude AI models. The extension sends your code and queries to the API and displays the responses in a chat interface. It can automatically apply code changes suggested by the AI, create new files, and perform other editing operations based on AI recommendations.

The extension supports both Ollama-compatible and OpenAI-compatible API formats, making it flexible for different server implementations.

## Troubleshooting

If you encounter issues:

1. Check that your API server is running and accessible
2. Verify your API URL in the settings
3. Try refreshing the available models
4. Restart VS Code if needed

## License

This extension is licensed under the MIT License.
