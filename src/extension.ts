import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  /// Register the command to sort the selected lines alphabetically
  const generic = vscode.commands.registerCommand('extension.alphabetizeSelectedLines', () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) { return; }

    const selectedText: string[] = [];
	for (const line of editor.selections) {
		for (let i = line.start.line; i <= line.end.line; i++) {
			let lineText = editor.document.lineAt(i).text;
			if (lineText !== '' && lineText !== '\n') {
				selectedText.push(editor.document.lineAt(i).text);
			}
		}
	} 

    if (!selectedText) { return; }
 
	const sortedLines = alphabetizeSelectedLines(selectedText);

    editor.edit((editBuilder) => {
      editBuilder.replace(editor.selection, sortedLines);
    });
  });

  /// Register the command to sort the CSS code alphabetically by selector
  const cssSpecific = vscode.commands.registerCommand('extension.alphabetizeCSS', async (editor) => {
    const currentFile = editor;

    if (!currentFile) { return; }

	if (vscode.languages.getDiagnostics(currentFile.uri).some(diagnostic => diagnostic.severity === vscode.DiagnosticSeverity.Error)) {
		return;
	}

	const selectedText: string[] = [];
	const commentStore: Map<string,string> = new Map<string,string>();
	let commentFlag = false;
	let commentBuffer = "";
	const specialCharStore: string[] = [];
	for (let i = 0; i < currentFile.lineCount; i++) {
        const line = currentFile.lineAt(i).text.trim();
		if (line === '' || line === '\n') {
			continue;
		}
		if (line === '{') {
			selectedText[selectedText.length - 1] = selectedText[selectedText.length - 1] + '{';
			continue;
		}
		if (line.startsWith('/*') && line.endsWith('*/')) { //single line comment
			if (i + 1 < currentFile.lineCount) {
				if (currentFile.lineAt(i+1).text === '' || currentFile.lineAt(i+1).text === '\n') {
					specialCharStore.push(line);
				} else {
					commentStore.set(line, currentFile.lineAt(i+1).text);
				}
			} else {
				commentStore.set(line, 'eof');
			}
			continue;
		}
		if (line.startsWith('/*')) { //multi line comment
			commentFlag = true;
			commentBuffer += line;
			continue;
		}
		if (line.endsWith('*/') && commentFlag) {
			commentFlag = false;
			commentBuffer += '\n' + line;
			if (i + 1 < currentFile.lineCount) {
				let lineAnchor = "";
				let c = i;
				do {
					c++;
					lineAnchor = currentFile.lineAt(c).text.trim();
					if (lineAnchor.endsWith('{') && lineAnchor[lineAnchor.length - 2] !== ' ') {
						lineAnchor = lineAnchor.replace('{', ' {');
					}
				} while (lineAnchor === '' || lineAnchor === '\n');
				commentStore.set(commentBuffer, lineAnchor);
			} else {
				commentStore.set(commentBuffer, 'eof');
			}
			commentBuffer = "";
			continue;
		}
		if (commentFlag) {
			commentBuffer += '\n' + line;
			continue;
		}
		if (line.startsWith('@import') || line.startsWith('@charset') || line.startsWith('@namespace')) {
			specialCharStore.push(line);
			continue;
		}
		if (line.startsWith('\t')) {
			let newLine = line.replace('\t', '');
			selectedText.push(newLine);
			continue;
		}

		selectedText.push(line);
	}

    if (!selectedText) { return; }

	const config = vscode.workspace.getConfiguration('alphabetize');
	const sortedLines = alphabetizeCSSBySelector(selectedText, config.get('enableSortProperties') as boolean);

	//reinsert all special characters and comments
	specialCharStore.sort();
	for (const specialChar of specialCharStore) {
		sortedLines.unshift(specialChar);
	}

	for (const comment of commentStore) {
		if (comment[1] === 'eof') {
			sortedLines.push('\n' + comment[0]);
			continue;
		}
		sortedLines.splice(sortedLines.indexOf(comment[1].trim()), 0, comment[0]);
	}

	//post processing
	if (sortedLines[0] === '\n' || sortedLines[0].trim() === '') {
		sortedLines.shift();
	}

	for (let i=0; i<sortedLines.length; i++) {
		if (sortedLines[i].endsWith(';;')) {
			sortedLines.pop();
		}
	}

	const workspaceEdit = new vscode.WorkspaceEdit();
	workspaceEdit.replace(currentFile.uri, new vscode.Range(new vscode.Position(0,0), currentFile.lineAt(currentFile.lineCount - 1).range.end),sortedLines.join('\n'));
	await vscode.workspace.applyEdit(workspaceEdit);
	currentFile.save();
  });

  /// Register the event listener to sort the CSS code alphabetically on save
  const cssSpecificOnSave = vscode.workspace.onWillSaveTextDocument((event) => {
	if (event.document.languageId !== 'css') {
	  return;
	}

	const config = vscode.workspace.getConfiguration('alphabetize');

	if (!config.get('enableSortCssOnSave') as boolean) {
		return;
	}

	if (config.get('enableGlobalCssSort') as boolean) {
		vscode.workspace.textDocuments.filter(document => document.isDirty).forEach(file => {
			vscode.commands.executeCommand('extension.alphabetizeCSS', file);
		});
	} else {
		vscode.commands.executeCommand('extension.alphabetizeCSS', vscode.window.activeTextEditor);
	}
  });

  context.subscriptions.push(generic, cssSpecific, cssSpecificOnSave);
  vscode.languages.registerDocumentRangeFormattingEditProvider('*', {
    provideDocumentRangeFormattingEdits(
      document: vscode.TextDocument,
      range: vscode.Range
    ): vscode.TextEdit[] { 
      return [
        vscode.TextEdit.replace(range, document.getText(range).split('\n').sort().join('\n'))
      ];
    }
  });
}

export function deactivate() {}

/// Sorts the selected lines alphabetically
function alphabetizeSelectedLines(selectedText: string[]): string {
	if (!selectedText) {
		return selectedText; // Nothing selected
	}

	const sortedLines = selectedText.sort().join('\n');
	if (sortedLines.endsWith('\n')) {
		sortedLines.slice(0, -1);
	}
	return sortedLines;
}

/// Sorts the CSS code alphabetically by selector
function alphabetizeCSSBySelector(cssCode: string[], sortProperties: boolean): string[] {
    const selectorRegex = /([^\{\}]+)\s*\{([^}]*)\}/g;
    const selectorsWithProperties = cssCode.join('\n').match(selectorRegex);

    if (!selectorsWithProperties) {
        return cssCode;
    }

    const sortedSelectors = selectorsWithProperties
        .map((selectorWithProps) => {
            const [fullMatch, selector, properties] = selectorWithProps.match(/([^\{\}]+)\s*\{([^}]*)\}/) || [];
            return { fullMatch, selector: selector ? selector.trim() : '', properties: properties ? properties.trim() : '' };
        })
        .sort((a, b) => a.selector.localeCompare(b.selector))
        .map(({ fullMatch, selector, properties }) => {
            if (sortProperties) {
                const sortedProperties = properties.split(";\n").filter(prop => prop.trim() !== ' ').sort();
				sortedProperties[sortedProperties.length - 1] = sortedProperties[sortedProperties.length - 1].replace(';', '');
                return `\n${selector} {${sortedProperties.map(prop => `\n  ${prop};`).join('')}\n}`;
            }
            return `${fullMatch}`;
        });

	let finalSort: string[] = [];

	for (let i = 0; i < sortedSelectors.length; i++) {
		sortedSelectors[i].split('\n').forEach((line) => {
			finalSort.push(line);
		});
	}
    return finalSort;
}