import * as vscode from "vscode"

export default function(text: string, position: vscode.Position): string {
    // get current cursor location
    const lines = text.split("\n")
    let index = position.character - 1
    for (let i = 0; i < position.line; i++) {
        index += lines[i].length
    }
    // get previous comma location or start of file

    let start = index

    for (; start > 0; start--) {
        if (text[start] === ";") {
            break
        }
    }

    // get next comma or end of file

    let end = index

    for (; end < text.length; end++) {
        if (text[end] === ";") {
            break
        }
    }

    // get sql statement

    const sql = text.substr(start, end - start).trim()

    return sql
}
