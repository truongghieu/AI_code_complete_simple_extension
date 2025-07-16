import * as vscode from 'vscode';

/**
 * Shows an input box with a decoration at the cursor position
 * @param editor The editor to show the input box in
 * @param placeholder The placeholder text for the input box
 * @returns A promise that resolves with the user's input, or undefined if cancelled
 */
export async function showInlineInputBox(
  editor: vscode.TextEditor,
  placeholder: string = 'Enter instructions for lazy edit'
): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve) => {
    // Create a decoration type for highlighting the cursor position
    const decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: '🔍 Edit Instructions',
        color: new vscode.ThemeColor('editorInfo.foreground'),
        margin: '0 0 0 10px',
        fontStyle: 'italic'
      },
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor('editorInfo.background'),
      border: '1px solid ' + new vscode.ThemeColor('editor.findMatchHighlightBorder')
    });
    
    // Get the cursor position
    const position = editor.selection.active;
    const range = new vscode.Range(position.line, 0, position.line, 0);
    
    // Apply the decoration
    editor.setDecorations(decorationType, [range]);
    
    // Create an input box for direct user instructions
    const inputOptions: vscode.InputBoxOptions = {
      prompt: 'Lazy Edit Instructions',
      placeHolder: placeholder,
validateInput: value => {
  return value && value.trim().length === 0 ? 'Input cannot be empty' : null;
},
      ignoreFocusOut: true
    };
    
    // Show the input box and wait for user input
    vscode.window.showInputBox(inputOptions).then(value => {
      // Remove the decoration when done
      editor.setDecorations(decorationType, []);
      
      // Resolve with the trimmed value or undefined
      resolve(value ? value.trim() : undefined);
    });
  });
}
